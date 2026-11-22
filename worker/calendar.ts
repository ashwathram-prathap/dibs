import { PUBLIC_ORIGIN, LAUNCH_DATE } from '../shared/config';
import type { Env } from './routes';
import { dropAt, registryDate, validDate } from './domain';
import { closeAt, ensureSpecials } from './specials';
import { dayAfter, chooseTopic, leadTime, type CalendarDay, type Topic } from '../shared/calendar';
import { deploymentBlocked } from '../shared/deploy-window';
const json = (data: any, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const stamp = () => new Date().toISOString();
async function log(env: Env, date: string, action: string, detail: string) {
  await env.DB.prepare('INSERT INTO schedule_log(date,action,detail,at) VALUES(?,?,?,?)')
    .bind(date, action, detail.slice(0, 1000), stamp())
    .run();
}
export async function library(env: Env): Promise<Topic[]> {
  const rows = await env.DB.prepare(
    'SELECT l.*,(SELECT MAX(date) FROM topic_schedule s WHERE s.slug=l.slug AND s.date<=?) last_used FROM topic_library l ORDER BY priority,name',
  )
    .bind(registryDate())
    .all<any>();
  return rows.results.map((r) => {
    const c = JSON.parse(r.coverage_json);
    return {
      slug: r.slug,
      name: r.name,
      kind: r.kind,
      priority: r.priority,
      ready: !!c.ready,
      uploaded: !!r.uploaded,
      score: c.score,
      checkedAt: r.checked_at,
      lastUsed: r.last_used,
      recipe: JSON.parse(r.recipe_json),
    };
  });
}
async function rows(env: Env, full = false) {
  const query = full
    ? env.DB.prepare('SELECT * FROM topic_schedule ORDER BY date')
    : env.DB.prepare('SELECT * FROM topic_schedule WHERE date>=? ORDER BY date').bind(
        dayAfter(registryDate(), -22),
      );
  return (await query.all<CalendarDay>()).results;
}

function readOnly(d: CalendarDay, now = Date.now()) {
  return Date.parse(dropAt(d.date)) <= now || ['live', 'closed', 'archived'].includes(d.status);
}
async function mutable(env: Env, date: string, revision?: number, newTopic = false) {
  if (
    !validDate(date) ||
    date < LAUNCH_DATE ||
    date < registryDate() ||
    date > dayAfter(registryDate() < LAUNCH_DATE ? LAUNCH_DATE : registryDate(), 59)
  )
    throw Error('Choose a date in the next 60 days.');
  const d = await env.DB.prepare('SELECT * FROM topic_schedule WHERE date=?')
    .bind(date)
    .first<CalendarDay>();
  if (d && readOnly(d)) throw Error('Live and past days are read-only.');
  leadTime(dropAt(date), Date.now(), newTopic);
  if (revision !== undefined && (d?.revision || 0) !== revision)
    throw Error('This day changed. Refresh the calendar and try again.');
  if (d?.category_id) {
    const c = await env.DB.prepare(
      'SELECT drop_at,(SELECT COUNT(*) FROM claims WHERE category_id=c.id) claims FROM categories c WHERE id=?',
    )
      .bind(d.category_id)
      .first<any>();
    if (c && (c.claims || (c.drop_at && Date.parse(c.drop_at) <= Date.now())))
      throw Error('A played or opened register cannot be changed.');
  }
  return d;
}
async function releaseCategory(env: Env, d?: CalendarDay | null) {
  if (!d?.category_id) return;
  const c = await env.DB.prepare(
    'SELECT drop_at,(SELECT COUNT(*) FROM claims WHERE category_id=c.id) claims,(SELECT COUNT(*) FROM strikes WHERE category_id=c.id) strikes FROM categories c WHERE id=?',
  )
    .bind(d.category_id)
    .first<any>();
  if (!c) return;
  if (c.claims || c.strikes || (c.drop_at && Date.parse(c.drop_at) <= Date.now()))
    throw Error('Played or opened metadata is retained.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM daily_specials WHERE category_id=?').bind(d.category_id),
    env.DB.prepare('DELETE FROM house_words WHERE category_id=?').bind(d.category_id),
    env.DB.prepare('DELETE FROM claim_requests WHERE category_id=?').bind(d.category_id),
    env.DB.prepare('DELETE FROM answer_keys WHERE category_id=?').bind(d.category_id),
    env.DB.prepare('DELETE FROM answers WHERE category_id=?').bind(d.category_id),
    env.DB.prepare('DELETE FROM categories WHERE id=?').bind(d.category_id),
  ]);
}

async function assign(
  env: Env,
  date: string,
  topic: Topic | null,
  request: string | null,
  auto: boolean,
  reason: string,
  previous?: CalendarDay | null,
) {
  await releaseCategory(env, previous);
  await env.DB.prepare(
    `INSERT INTO topic_schedule(date,slug,request,status,category_id,auto_picked,reason,build_result,updated_at,revision) VALUES(?,?,?,?,NULL,?,?,?, ?,1) ON CONFLICT(date) DO UPDATE SET slug=excluded.slug,request=excluded.request,status=excluded.status,category_id=NULL,auto_picked=excluded.auto_picked,reason=excluded.reason,build_result='',updated_at=excluded.updated_at,built_at=NULL,revision=topic_schedule.revision+1`,
  )
    .bind(
      date,
      topic?.slug || null,
      request,
      topic ? 'requested' : request ? 'needs recipe' : 'empty',
      auto ? 1 : 0,
      reason,
      '',
      stamp(),
    )
    .run();
  await log(
    env,
    date,
    auto ? 'auto-pick' : topic ? 'library-pick' : request ? 'request' : 'clear',
    reason || request || 'Day cleared',
  );
}
export async function calendarRead(env: Env) {
  const today = registryDate() < LAUNCH_DATE ? LAUNCH_DATE : registryDate(),
    all = await rows(env),
    topics = await library(env),
    stored = await env.DB.prepare('SELECT value_json,updated_at FROM rollout_state WHERE key=?')
      .bind('assets')
      .first<any>();
  const days = Array.from({ length: 60 }, (_, i) => {
    const date = dayAfter(today, i),
      d = all.find((d) => d.date === date) || { date, slug: null, status: 'empty', revision: 0 };
    let status = d.status;
    if (d.category_id && ['ready', 'live', 'closed'].includes(status)) {
      if (Date.parse(closeAt({ date })) <= Date.now()) status = 'closed';
      else if (Date.parse(dropAt(date)) <= Date.now()) status = 'live';
    }
    return { ...d, status, readOnly: readOnly(d), dropAt: dropAt(date) };
  });
  const size = await env.DB.prepare('SELECT 1').all();
  const state = await env.DB.prepare(
    "SELECT key,value_json,updated_at FROM rollout_state WHERE key<>'assets'",
  ).all();
  return {
    days,
    library: topics,
    log: (await env.DB.prepare('SELECT * FROM schedule_log ORDER BY id DESC LIMIT 30').all())
      .results,
    storage: {
      d1Bytes: Number(size.meta.size_after || 0),
      d1Limit: 500_000_000,
      assets: stored ? JSON.parse(stored.value_json) : null,
      assetFileLimit: 20000,
      assetMaxFileBytes: 25 * 1024 * 1024,
      updatedAt: stored?.updated_at,
    },
    runs: state.results,
  };
}
async function buildDay(env: Env, d: CalendarDay) {
  if (!d.slug || readOnly(d)) return;
  const topic = await env.DB.prepare('SELECT * FROM topic_library WHERE slug=?')
    .bind(d.slug)
    .first<any>();
  if (!topic || !JSON.parse(topic.coverage_json).ready || !topic.uploaded)
    throw Error('Coverage-passed uploaded recipe is required. Waiting for the rollout job.');
  const manifest = JSON.parse(topic.manifest_json);
  if (manifest.house?.length !== 10) throw Error('Ten measured house words are required.');
  const id = d.category_id || 'day-' + d.date;
  const existing = await env.DB.prepare('SELECT * FROM categories WHERE date=?')
    .bind(d.date)
    .first<any>();
  if (existing && existing.id !== id)
    throw Error('Another register owns this date; seed or move it first.');
  await env.DB.prepare("UPDATE topic_schedule SET status='building',updated_at=? WHERE date=?")
    .bind(stamp(), d.date)
    .run();
  await env.DB.prepare(
    `INSERT INTO categories(id,name,slug,total_registrable,source_json,date,drop_at,status) VALUES(?,?,?,?,?,?,?,'draft') ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,total_registrable=excluded.total_registrable,source_json=excluded.source_json,date=excluded.date,drop_at=excluded.drop_at,status='draft'`,
  )
    .bind(
      id,
      topic.name,
      d.slug,
      Math.max(2000, manifest.count),
      JSON.stringify({ staticCatalog: manifest, coverage: JSON.parse(topic.coverage_json) }),
      d.date,
      dropAt(d.date),
    )
    .run();
  const category = await env.DB.prepare('SELECT * FROM categories WHERE id=?').bind(id).first();
  await ensureSpecials(env, category);
  await env.DB.batch([
    env.DB.prepare("UPDATE categories SET status='approved' WHERE id=?").bind(id),
    env.DB.prepare(
      "UPDATE topic_schedule SET status='ready',category_id=?,build_result=?,built_at=?,updated_at=?,revision=revision+1 WHERE date=?",
    ).bind(
      id,
      `${manifest.count.toLocaleString()} answers · ${(JSON.parse(topic.coverage_json).score * 100).toFixed(1)}% coverage · uploaded · commitment sealed`,
      stamp(),
      stamp(),
      d.date,
    ),
  ]);
  await log(
    env,
    d.date,
    'ready',
    'Coverage and upload verified; house words stored and golden commitment sealed.',
  );
}
async function importExisting(env: Env) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO topic_schedule(date,slug,status,category_id,reason,build_result,updated_at,built_at) SELECT date,slug,CASE WHEN status='approved' THEN 'ready' ELSE 'requested' END,id,'Preserved the existing Round 8 plan.','Existing catalog; schedule preserved.',?,? FROM categories WHERE date>=?`,
  )
    .bind(stamp(), stamp(), dayAfter(registryDate(), -1))
    .run();
}
export async function calendarTick(env: Env) {
  if (env.STAGING !== 'true' && deploymentBlocked(Date.now(), 'part-b')) return { frozen: true };
  await importExisting(env);
  const all = await rows(env),
    topics = await library(env),
    now = Date.now();
  const transitions = all
    .filter((d) => d.category_id && ['ready', 'live', 'closed'].includes(d.status))
    .map((d) => ({
      date: d.date,
      status:
        Date.parse(closeAt(d)) <= now
          ? 'closed'
          : Date.parse(dropAt(d.date)) <= now
            ? 'live'
            : 'ready',
      old: d.status,
    }))
    .filter((d) => d.status !== d.old);
  if (transitions.length)
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE topic_schedule SET status=(SELECT json_extract(value,'$.status') FROM json_each(?) WHERE json_extract(value,'$.date')=topic_schedule.date),updated_at=? WHERE date IN (SELECT json_extract(value,'$.date') FROM json_each(?))`,
      ).bind(JSON.stringify(transitions), stamp(), JSON.stringify(transitions)),
      env.DB.prepare(
        `INSERT INTO schedule_log(date,action,detail,at) SELECT json_extract(value,'$.date'),json_extract(value,'$.status'),'Drop lifecycle advanced automatically.',? FROM json_each(?)`,
      ).bind(stamp(), JSON.stringify(transitions)),
    ]);
  // One build per invocation bounds D1 subrequests and isolates failures.
  for (let i = 0; i < 3; i++) {
    const date = dayAfter(registryDate(), i),
      d = all.find((x) => x.date === date),
      hours = (Date.parse(dropAt(date)) - now) / 3600000;
    if (date < LAUNCH_DATE || hours <= 0 || hours > 48) continue;
    if (!d || ['empty', 'failed', 'needs recipe'].includes(d.status)) {
      const pick = chooseTopic(
        date,
        all,
        topics.filter((t) => t.uploaded),
      );
      await assign(
        env,
        date,
        pick.topic,
        null,
        true,
        (d?.request ? `Request “${d.request}” did not pass a recipe gate in time. ` : '') +
          pick.reason,
        d,
      );
      const assigned = { date, slug: pick.topic.slug, status: 'requested', revision: 1 };
      await buildDay(env, assigned);
      return { picked: date };
    }
  }
  const pending = all.find(
    (d) =>
      d.date <= dayAfter(registryDate(), 7) &&
      Date.parse(dropAt(d.date)) > now &&
      ['requested', 'building'].includes(d.status) &&
      d.slug,
  );
  if (pending) {
    try {
      await buildDay(env, pending);
      return { built: pending.date };
    } catch (e) {
      await env.DB.prepare(
        "UPDATE topic_schedule SET status='failed',build_result=?,updated_at=? WHERE date=?",
      )
        .bind((e as Error).message, stamp(), pending.date)
        .run();
      await log(env, pending.date, 'failed', (e as Error).message);
      return { failed: pending.date };
    }
  }
  return { idle: true };
}
export async function calendarRoute(req: Request, env: Env, path: string) {
  try {
    if (req.method === 'GET' && path === '/admin/schedule') return json(await calendarRead(env));
    if (req.method === 'GET' && path === '/admin/schedule/plan')
      return json({
        days: await rows(env, true),
        library: await library(env),
        categories: (
          await env.DB.prepare('SELECT id,slug,date,drop_at,source_json FROM categories').all()
        ).results.map((r: any) => ({
          id: r.id,
          slug: r.slug,
          date: r.date,
          closeAt: r.date ? closeAt(r) : null,
          version: JSON.parse(r.source_json || '{}').staticCatalog?.version,
        })),
      });
    if (req.method !== 'POST') return json({ message: 'Use POST for calendar changes.' }, 405);
    if (Number(req.headers.get('content-length') || 0) > 100000)
      return json({ message: 'Calendar form too large.' }, 413);
    const text = await req.text();
    if (text.length > 100000) return json({ message: 'Calendar form too large.' }, 413);
    const b = JSON.parse(text || '{}');
    if (path === '/admin/schedule/tick') return json(await calendarTick(env));
    if (path === '/admin/schedule/library') {
      const r = b.recipe,
        c = b.coverage,
        m = b.manifest;
      if (
        !r ||
        !/^[-a-z0-9]{2,60}$/.test(r.slug) ||
        !r.name ||
        !r.kind ||
        !r.sources?.length ||
        !r.scope ||
        !r.aliases ||
        !r.obvious ||
        !r.independent ||
        !m ||
        m.slug !== r.slug ||
        !/^[a-f0-9]{16}$/.test(m.version) ||
        m.house?.length !== 10 ||
        !c ||
        typeof c.ready !== 'boolean'
      )
        throw Error('A complete recipe, coverage result and manifest are required.');
      if (
        c.ready &&
        (!(c.score >= 0.98) ||
          c.obvious < 150 ||
          c.independentChecked < 50 ||
          c.independentMissing?.length ||
          !c.sourceComplete ||
          !c.rankingComplete)
      )
        throw Error('Recipe failed the coverage gate.');
      // The rollout owns the signed admin credential; verify published immutable version metadata too.
      const response = await fetch(new URL(`/catalog/${r.slug}/manifest.json`, PUBLIC_ORIGIN));
      const published: any = response.ok ? await response.json() : null;
      const uploaded =
        !!published && published.version === m.version && published.count === m.count;
      if (response.ok && !uploaded) throw Error('Uploaded manifest does not match this recipe.');
      await env.DB.prepare(
        `INSERT INTO topic_library VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,kind=excluded.kind,priority=excluded.priority,recipe_json=excluded.recipe_json,manifest_json=excluded.manifest_json,coverage_json=excluded.coverage_json,checked_at=excluded.checked_at,uploaded=excluded.uploaded`,
      )
        .bind(
          r.slug,
          r.name,
          r.kind,
          r.priority || 50,
          JSON.stringify(r),
          JSON.stringify(m),
          JSON.stringify(c),
          stamp(),
          uploaded ? 1 : 0,
        )
        .run();
      return json({ ok: true, slug: r.slug, ready: c.ready, uploaded });
    }
    if (path === '/admin/schedule/seed') {
      const current = (
        await env.DB.prepare(
          'SELECT * FROM categories WHERE date IS NOT NULL ORDER BY date',
        ).all<any>()
      ).results;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO topic_schedule(date,slug,status,category_id,reason,build_result,updated_at,built_at) SELECT date,slug,CASE WHEN status='approved' THEN 'ready' ELSE 'requested' END,id,'Preserved the existing Round 8 plan.','Existing catalog; schedule preserved.',?,? FROM categories WHERE date IS NOT NULL`,
      )
        .bind(stamp(), stamp())
        .run();
      return json({ ok: true, preserved: current.length });
    }
    if (path === '/admin/schedule/assets' || path === '/admin/schedule/run') {
      const key = path.endsWith('assets') ? 'assets' : 'last-run';
      await env.DB.prepare(
        'INSERT INTO rollout_state VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',
      )
        .bind(key, JSON.stringify(b), stamp())
        .run();
      return json({ ok: true });
    }
    if (path === '/admin/schedule/request-result') {
      const d = await env.DB.prepare('SELECT * FROM topic_schedule WHERE date=?')
        .bind(b.date)
        .first<CalendarDay>();
      if (!d || readOnly(d) || d.revision !== b.revision)
        throw Error('Request changed or is locked.');
      if (b.slug) {
        const topic = (await library(env)).find((t) => t.slug === b.slug && t.ready);
        if (!topic) throw Error('Generated recipe has not passed coverage.');
        await assign(
          env,
          d.date,
          topic,
          d.request || null,
          false,
          'Automatically matched request to an audited complete-list recipe.',
          d,
        );
      } else {
        await env.DB.prepare(
          "UPDATE topic_schedule SET status='needs recipe',build_result=?,updated_at=? WHERE date=?",
        )
          .bind(
            String(b.reason || 'No complete source and independent coverage fixture found.').slice(
              0,
              1000,
            ),
            stamp(),
            d.date,
          )
          .run();
        await log(env, d.date, 'needs recipe', String(b.reason).slice(0, 1000));
      }
      return json({ ok: true });
    }
    if (path === '/admin/schedule/archive') {
      const d = await env.DB.prepare('SELECT * FROM topic_schedule WHERE date=?')
        .bind(b.date)
        .first<CalendarDay>();
      if (!d?.category_id || Date.parse(closeAt(d)) + 7 * 86400000 > Date.now())
        throw Error('Archive cleanup is allowed only seven days after close.');
      await env.DB.prepare("UPDATE topic_schedule SET status='archived',updated_at=? WHERE date=?")
        .bind(stamp(), d.date)
        .run();
      return json({ ok: true });
    }
    if (path !== '/admin/schedule') return json({ message: 'Unknown calendar procedure.' }, 404);
    const all = await rows(env),
      topics = await library(env);
    const d = await mutable(env, b.date, b.revision, b.action === 'request');
    if (b.action === 'clear') {
      await assign(env, b.date, null, null, false, 'Cleared by owner.', d);
      return json({ ok: true });
    }
    if (b.action === 'move' || b.action === 'swap') {
      const target = await mutable(env, b.to, b.targetRevision, !!d?.request && !d.slug);
      if (!d?.slug && !d?.request) throw Error('Choose a non-empty source day.');
      if (b.to === b.date) throw Error('Choose another day.');
      if (b.action === 'move' && target && (target.slug || target.request))
        throw Error('The destination is occupied. Use Swap.');
      if (b.action === 'swap' && target?.request && !target.slug)
        leadTime(dropAt(b.date), Date.now(), true);
      await releaseCategory(env, d);
      await releaseCategory(env, target);
      await assign(
        env,
        b.to,
        topics.find((t) => t.slug === d.slug) || null,
        d.request || null,
        !!d.auto_picked,
        `Moved from ${b.date}.`,
      );
      await assign(
        env,
        b.date,
        b.action === 'swap' ? topics.find((t) => t.slug === target?.slug) || null : null,
        b.action === 'swap' ? target?.request || null : null,
        false,
        b.action === 'swap' ? `Swapped with ${b.to}.` : 'Moved to ' + b.to,
      );
      return json({ ok: true });
    }
    if (b.action === 'request') {
      const request = String(b.request || '').trim();
      if (request.length < 2 || request.length > 80)
        throw Error('Use a topic name of 2–80 characters.');
      await assign(
        env,
        b.date,
        null,
        request,
        false,
        'New topic request; automatic recipe matching runs nightly. Falls back at 48 hours if no recipe passes.',
        d,
      );
      return json({ ok: true });
    }
    const pick =
      b.action === 'pick'
        ? chooseTopic(
            b.date,
            all.filter((x) => x.date !== b.date),
            topics,
          )
        : null;
    const topic = pick?.topic || topics.find((t) => t.slug === b.slug && t.ready);
    if (!topic) throw Error('Choose a coverage-passed library topic.');
    if (!['pick', 'library'].includes(b.action)) throw Error('Unknown calendar action.');
    await assign(env, b.date, topic, null, !!pick, pick?.reason || 'Selected by owner.', d);
    return json({ ok: true });
  } catch (e) {
    return json({ message: (e as Error).message }, 422);
  }
}
