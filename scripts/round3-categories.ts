// R8 supersedes the legacy scheduled uploader. Existing live dates are preserved.
throw new Error('Legacy rollout stopped: use coverage-gated static catalogs; do not change the live schedule.');
import { LAUNCH_DATE, DROP_TIME_LABEL } from '../shared/config';
// Resumable owner-approved rollout. Persist this journal between daily runs.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalize, dropAt, torontoDate } from '../worker/domain';
import { catalogContent, keyContent } from '../shared/catalog-digest';
const base = process.env.DIBS_API || 'https://dibs.here/api';
const token =
  process.env.ADMIN_TOKEN || readFileSync('.dev.vars', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)?.[1];
if (!token) throw Error('ADMIN_TOKEN is required.');
const plan: string[] = JSON.parse(readFileSync('scripts/category-plan.json', 'utf8'));
const state = existsSync('.upload-state.json')
  ? JSON.parse(readFileSync('.upload-state.json', 'utf8'))
  : {};
const day = new Date().toISOString().slice(0, 10);
const budget = (state['remote:' + day] ||= { reservedWrites: 0, completed: {} });
const progress = (state.round3 ||= { categories: {}, decisions: [] });
const save = () => writeFileSync('.upload-state.json', JSON.stringify(state, null, 2) + '\n');
async function api(path: string, body?: any) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      origin: 'https://dibs.here',
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw Error(`Stopped: ${path} ${r.status} ${data.message}. No retry.`);
  return data;
}
budget.reservedWrites = Math.max(
  budget.reservedWrites,
  (await api('/admin/upload-budget')).reservedWrites,
);
save();
const registers = (await api('/admin/registers')).categories;
const stats = await api('/admin/stats');
const busy = stats.days.some(
  (d: any) =>
    d.day >= new Date(Date.now() - 86400000).toISOString().slice(0, 10) &&
    d.active_claimers >= 1000,
);
for (const [i, id] of plan.entries()) {
  const local = JSON.parse(readFileSync(`categories/${id}.json`, 'utf8'));
  let remote = registers.find((r: any) => r.id === id);
  const record = (progress.categories[id] ||= {
    status: 'pending',
    plannedDate: new Date(Date.parse(LAUNCH_DATE + 'T12:00:00Z') + i * 86400000)
      .toISOString()
      .slice(0, 10),
  });
  record.plannedDate = new Date(Date.parse(LAUNCH_DATE + 'T12:00:00Z') + i * 86400000)
    .toISOString()
    .slice(0, 10);
  if (remote?.status === 'approved') {
    record.status = 'approved';
    record.date = remote.date;
    save();
    continue;
  }
  if (!remote) {
    if (busy) {
      progress.decisions.push(`${day}: uploads deferred: busy traffic day`);
      save();
      break;
    }
    const keys = local.answers.reduce(
      (n: number, a: any) => n + new Set([normalize(a.display), ...a.aliases.map(normalize)]).size,
      0,
    );
    // New uploads only. Existing drafts are verified, never blindly replaced.
    const cost = 4 * local.answers.length + 3 * keys + 10;
    if (budget.reservedWrites + cost > 45000) {
      save();
      console.log('Daily upload allowance reached; remaining categories resume next UTC day.');
      break;
    }
    budget.reservedWrites += cost;
    record.reservedAt = new Date().toISOString();
    save();
    await api('/admin/category', { ...local, date: null, status: 'draft' });
    remote = { status: 'draft' };
    record.status = 'uploaded';
    save();
  }
  const verified = await api('/admin/verify?id=' + id);
  const expected = createHash('sha256').update(catalogContent(local.answers)).digest('hex');
  const keyCount = local.answers.reduce(
    (n: number, a: any) => n + new Set([normalize(a.display), ...a.aliases.map(normalize)]).size,
    0,
  );
  const expectedKeys = createHash('sha256')
    .update(
      keyContent(
        local.answers.flatMap((a: any) =>
          [...new Set([normalize(a.display), ...a.aliases.map(normalize)])].map((match_key) => ({
            match_key,
            display: a.display,
          })),
        ),
      ),
    )
    .digest('hex');
  if (
    verified.digest !== expected ||
    verified.keyDigest !== expectedKeys ||
    verified.entries !== local.answers.length ||
    verified.keys !== keyCount
  )
    throw Error(`${id}: remote content verification mismatch; not approved.`);
  record.verifiedAt = new Date().toISOString();
  record.digest = expected;
  record.status = 'verified';
  save();
  let date = record.plannedDate;
  // Protect every other planned date: a late upload moves only its own category.
  const occupied = new Set([
    ...registers.filter((g: any) => g.id !== id && g.status === 'approved').map((g: any) => g.date),
    ...plan.flatMap((other, index) =>
      other === id
        ? []
        : [
            new Date(Date.parse(LAUNCH_DATE + 'T12:00:00Z') + index * 86400000)
              .toISOString()
              .slice(0, 10),
          ],
    ),
    ...Object.entries(progress.categories)
      .filter(([other, r]: any) => other !== id && r.status === 'approved')
      .map(([, r]: any) => r.date),
  ]);
  while (dropAt(date) <= record.verifiedAt || occupied.has(date))
    date = new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  if (date !== record.plannedDate)
    progress.decisions.push(
      `${id}: moved ${record.plannedDate} to ${date} because its verified upload missed the planned drop; all other planned dates were preserved.`,
    );
  await api('/admin/approve', { id, date, reviewed: true });
  record.status = 'approved';
  record.date = date;
  budget.reservedWrites += 8;
  save();
  console.log(`${id}: verified and approved for ${date}, ${DROP_TIME_LABEL} Toronto`);
}
progress.remaining = plan.filter((id) => progress.categories[id]?.status !== 'approved');
save();
writeFileSync(
  'review/round3/upload-progress.json',
  JSON.stringify(
    {
      asOf: new Date().toISOString(),
      reservedWrites: budget.reservedWrites,
      categories: progress.categories,
      decisions: progress.decisions,
      remaining: progress.remaining,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `${plan.length - progress.remaining.length}/30 approved; ${budget.reservedWrites}/45000 upload writes reserved today.`,
);

if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `complete=${progress.remaining.length === 0}\n`);
