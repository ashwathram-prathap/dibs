import { type Env, json } from './routes';
import { constantEqual } from './identity';
import { flowFunnel } from './flow-funnel';
import { funnel } from './funnel';
import { DayStandings } from './day-standings';
import { dropAt } from './domain';
const cache = new Map<string, { at: number; data: any }>();
export async function flowHistory(req: Request, env: Env) {
  if (
    req.method !== 'GET' ||
    !env.ADMIN_TOKEN ||
    !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
  )
    return json({ message: 'Not found.' }, 404);
  const date = new URL(req.url).searchParams.get('date') || '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    return json({ message: 'Choose a registry date.' }, 422);
  const next = new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(date + 'T12:00:00Z') + 172800000).toISOString().slice(0, 10);
  if (Date.parse(dropAt(next)) > Date.now())
    return json({ message: 'This night is still open.' }, 422);
  const old = cache.get(date);
  if (old && Date.now() - old.at < 60000) return json(old.data);
  const categories = (
    await env.DB.prepare("SELECT id,date FROM categories WHERE date IN (?,?) AND status='approved'")
      .bind(date, next)
      .all<any>()
  ).results;
  if (!categories.some((c) => c.date === date))
    return json({ message: 'Registry unavailable.' }, 404);
  const ids = categories.map((c) => c.id);
  const rows = (
    await env.DB.prepare(
      'SELECT user_id,category_id,data FROM r17_files WHERE category_id IN (SELECT value FROM json_each(?)) LIMIT 4001',
    )
      .bind(JSON.stringify(ids))
      .all<any>()
  ).results;
  if (rows.length > 4000)
    return json({ message: 'Nightly analytics exceeded the 4,000-file safety bound.' }, 503);
  const nights = categories.map((c) => {
    const files = new Map(
      rows.filter((r) => r.category_id === c.id).map((r) => [r.user_id, JSON.parse(r.data)]),
    );
    const standings = new DayStandings();
    standings.reset(files.values());
    return {
      date: c.date,
      files,
      counts: {
        ...funnel(files.values()),
        ...flowFunnel(files.values(), (id) =>
          standings.title(id, c.date === date || Date.parse(dropAt(end)) <= Date.now()),
        ),
      },
    };
  });
  const eligible = (s: any) =>
    !s.user.hidden &&
    !s.user.test &&
    s.file.eligible !== false &&
    !['Withdrawn player', 'Record withheld'].includes(s.user.handle) &&
    s.file.claims.some((c: any) => !c.voided);
  const first = nights.find((n) => n.date === date)!,
    second = nights.find((n) => n.date === next);
  const claimers = [...first.files].filter(([, s]) => eligible(s)).map(([id]) => id);
  const complete = Date.parse(dropAt(end)) <= Date.now();
  const returned =
    complete && second
      ? claimers.filter((id) => second.files.has(id) && eligible(second.files.get(id))).length
      : null;
  const data = {
    asOf: new Date().toISOString(),
    source:
      'Delayed D1 mirror; finalization lag unavailable. R17 files only; legacy-only identities unavailable.',
    cacheSeconds: 60,
    fileBound: 4000,
    nights: nights.map((n) => ({ date: n.date, ...n.counts })),
    returnRate: {
      day: date,
      nextDay: next,
      complete,
      claimers: claimers.length,
      returned,
      rate: returned === null || !claimers.length ? null : returned / claimers.length,
    },
    shareIntent:
      'Existing share/copy path records intent, not completed external shares; historical date-aligned copy totals unavailable.',
  };
  if (cache.size >= 3) cache.delete(cache.keys().next().value!);
  cache.set(date, { at: Date.now(), data });
  return json(data);
}
