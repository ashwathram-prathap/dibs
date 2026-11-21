/// <reference types="@cloudflare/workers-types" />
import { handle, hmac, cookieUser } from './identity';
import {
  normalize,
  registryDate,
  nextDrop,
  streak,
  torontoDate,
  dropAt,
  validDate,
} from './domain';
import { schools } from '../src/types';
import { og } from './og';
export interface Env {
  DB: D1Database;
  COOKIE_SECRET: string;
  ADMIN_TOKEN: string;
  TURNSTILE_SECRET: string;
  TURNSTILE_SITE_KEY: string;
  SITE_URL: string;
  LOCAL_TEST?: string;
}
const claimSelect = `SELECT c.id,c.category_id,c.claim_no,c.created_at,a.display,a.obscurity,CASE WHEN u.hidden=1 THEN 'Record withheld' ELSE u.handle END handle,CASE WHEN u.hidden=1 THEN 'None' ELSE u.school END school,g.name category_name,g.date category_date,g.total_registrable FROM claims c JOIN answers a ON a.id=c.answer_id JOIN users u ON u.id=c.user_id JOIN categories g ON g.id=c.category_id`;
const publicClaim = claimSelect + ` WHERE c.voided=0 AND g.status='approved'`;
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json;charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
      ...extra,
    },
  });
const fail = (status: number, message: string) => json({ message }, status);
async function current(env: Env) {
  return env.DB.prepare(
    "SELECT * FROM categories WHERE date=? AND status='approved' AND drop_at<=?",
  )
    .bind(registryDate(), new Date().toISOString())
    .first<any>();
}
async function user(req: Request, env: Env) {
  const id = await cookieUser(req, env.COOKIE_SECRET);
  return id
    ? env.DB.prepare('SELECT id,handle,school,rerolls_used,hidden FROM users WHERE id=?')
        .bind(id)
        .first<any>()
    : null;
}
async function body(req: Request, limit = 4096) {
  if (Number(req.headers.get('content-length') || 0) > limit) throw new Error('BODY_TOO_LARGE');
  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError('Empty body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new SyntaxError('An object is required');
  return parsed;
}
async function ensureMaintenanceIndexes(env: Env) {
  await env.DB.batch([
    env.DB.prepare('CREATE INDEX IF NOT EXISTS answer_keys_answer_id ON answer_keys(answer_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS claims_answer_id ON claims(answer_id)'),
  ]);
}
async function admin(req: Request, env: Env, path: string) {
  if (
    !env.ADMIN_TOKEN ||
    !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
  )
    return fail(401, 'The clerk’s key is required.');
  if (path === '/admin/stats') {
    const days = await env.DB.prepare(
      `WITH days AS (SELECT substr(created_at,1,10) day FROM users UNION SELECT substr(created_at,1,10) day FROM claims UNION SELECT day FROM share_events) SELECT day,(SELECT COUNT(*) FROM users WHERE substr(created_at,1,10)=days.day) new_users,(SELECT COUNT(*) FROM claims WHERE substr(created_at,1,10)=days.day AND voided=0) claims,(SELECT COUNT(DISTINCT user_id) FROM claims WHERE substr(created_at,1,10)=days.day AND voided=0) active_claimers,(SELECT COUNT(*) FROM share_events WHERE day=days.day) shares FROM days ORDER BY day DESC LIMIT 90`,
    ).all();
    const retention = async (n: number) =>
      env.DB.prepare(
        `WITH firsts AS (SELECT user_id,MIN(g.date) first_day FROM claims c JOIN categories g ON c.category_id=g.id WHERE c.voided=0 GROUP BY user_id), eligible AS (SELECT * FROM firsts WHERE date(first_day,'+${n} day')<=?) SELECT COUNT(*) eligible,COALESCE(SUM(EXISTS(SELECT 1 FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=e.user_id AND c.voided=0 AND g.date=date(e.first_day,'+${n} day'))),0) retained FROM eligible e`,
      )
        .bind(registryDate())
        .first();
    return json({ days: days.results, d1: await retention(1), d7: await retention(7) });
  }
  if (req.method !== 'POST') return fail(405, 'File changes by POST.');
  const b = await body(req, path === '/admin/category' ? 5_000_000 : 4096);
  if (path === '/admin/hide-user' || path === '/admin/void-claim') {
    if (typeof b.id !== 'string') return fail(422, 'A record ID is required.');
    const hide = path.endsWith('hide-user');
    const results = await env.DB.batch([
      env.DB.prepare(
        hide ? 'UPDATE users SET hidden=1 WHERE id=?' : 'UPDATE claims SET voided=1 WHERE id=?',
      ).bind(b.id),
      env.DB.prepare('INSERT INTO admin_audit VALUES(?,?,?,?)').bind(
        crypto.randomUUID(),
        hide ? 'hide-user' : 'void-claim',
        b.id,
        new Date().toISOString(),
      ),
    ]);
    return results[0].meta.changes ? json({ ok: true }) : fail(404, 'Record not found.');
  }
  if (path === '/admin/category') return uploadCategory(env, b);
  if (path === '/admin/approve') {
    const c = await env.DB.prepare('SELECT * FROM categories WHERE id=?').bind(b.id).first<any>();
    if (!c) return fail(404, 'Register not found.');
    if (c.status !== 'draft')
      return fail(
        409,
        'Published registers keep their original date. File a new draft to run another day.',
      );
    if (b.reviewed !== true || !validDate(b.date))
      return fail(422, 'Supply the reviewed date and reviewed: true.');
    const n = await env.DB.prepare(
      'SELECT COUNT(*) n FROM answers WHERE category_id=? AND obscurity IS NOT NULL',
    )
      .bind(b.id)
      .first<any>();
    if (n.n < 2000 || n.n !== c.total_registrable)
      return fail(422, 'Review requires at least 2,000 fully scored entries.');
    if (
      await env.DB.prepare('SELECT id FROM categories WHERE date=? AND id<>?')
        .bind(b.date, b.id)
        .first()
    )
      return fail(409, 'Another register is already assigned to that date.');
    if (dropAt(b.date) <= new Date().toISOString()) return fail(422, 'Choose a future drop date.');
    await env.DB.batch([
      env.DB.prepare("UPDATE categories SET status='approved',date=?,drop_at=? WHERE id=?").bind(
        b.date,
        dropAt(b.date),
        b.id,
      ),
      env.DB.prepare('INSERT INTO admin_audit VALUES(?,?,?,?)').bind(
        crypto.randomUUID(),
        'approve-category',
        b.id,
        new Date().toISOString(),
      ),
    ]);
    return json({ ok: true });
  }
  return fail(404, 'No such clerk procedure.');
}
async function constantEqual(a: string, b: string) {
  return (await hmac(a, b)) === (await hmac(b, b));
}
export async function uploadCategory(env: Env, b: any) {
  if (
    !b ||
    !Array.isArray(b.answers) ||
    b.answers.length < 2000 ||
    b.answers.length > 12000 ||
    typeof b.name !== 'string' ||
    b.name.length > 50 ||
    typeof b.slug !== 'string' ||
    !/^[a-z0-9-]{2,60}$/.test(b.slug)
  )
    return fail(422, 'A register needs 2,000–12,000 valid entries, a name and a slug.');
  if (b.status && b.status !== 'draft')
    return fail(422, 'Uploads enter as drafts. Approve separately after review.');
  if (b.date && !validDate(b.date))
    return fail(422, 'Use a real calendar date in YYYY-MM-DD form.');
  const id = b.id || b.slug;
  if (typeof id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(id))
    return fail(422, 'Use a plain register ID.');
  const existing = await env.DB.prepare('SELECT status FROM categories WHERE id=?')
    .bind(id)
    .first<any>();
  if (
    existing &&
    (b.replaceDraft !== true ||
      existing.status !== 'draft' ||
      (await env.DB.prepare('SELECT id FROM claims WHERE category_id=? LIMIT 1').bind(id).first()))
  )
    return fail(409, 'Only an unclaimed draft can be replaced, with replaceDraft: true.');
  const seen = new Set<string>();
  const entries: any[] = [];
  const keys: any[] = [];
  for (const [i, a] of b.answers.entries()) {
    if (
      typeof a.display !== 'string' ||
      a.display.length > 120 ||
      !a.display.trim() ||
      !Number.isInteger(a.obscurity) ||
      a.obscurity < 1 ||
      a.obscurity > 5 ||
      !Array.isArray(a.aliases) ||
      a.aliases.some((s: any) => typeof s !== 'string' || s.length > 120)
    )
      return fail(422, 'Each entry needs a display name, aliases and measured obscurity (1–5).');
    const canonical = normalize(a.display);
    const aid = id + ':' + i;
    const matches = [...new Set([canonical, ...a.aliases.map(normalize)])].filter(Boolean);
    if (!canonical || matches.some((k) => seen.has(k)))
      return fail(422, 'A canonical name or alias belongs to more than one entry.');
    matches.forEach((k) => {
      seen.add(k);
      keys.push([id, k, aid]);
    });
    entries.push([aid, id, canonical, a.display, JSON.stringify(a.aliases), a.obscurity]);
  }
  if (existing) await ensureMaintenanceIndexes(env);
  // Each conditional delete is in the same transaction as insertion. If approval races
  // replacement, the insert conflicts and the entire batch rolls back without changing it.
  const replace: D1PreparedStatement[] = [];
  if (existing) {
    const guard =
      "EXISTS(SELECT 1 FROM categories g WHERE g.id=? AND g.status='draft' AND NOT EXISTS(SELECT 1 FROM claims WHERE category_id=g.id))";
    replace.push(
      env.DB.prepare('DELETE FROM answer_keys WHERE category_id=? AND ' + guard).bind(id, id),
      env.DB.prepare('DELETE FROM answers WHERE category_id=? AND ' + guard).bind(id, id),
      env.DB.prepare('DELETE FROM categories WHERE id=? AND ' + guard).bind(id, id),
    );
  }
  // JSON1 keeps bulk writes inside Free Worker query limits, including replacement.
  await env.DB.batch([
    ...replace,
    env.DB.prepare(
      'INSERT INTO categories(id,date,name,slug,total_registrable,drop_at,status,source_json) VALUES(?,?,?,?,?,?,?,?)',
    ).bind(
      id,
      b.date || null,
      b.name,
      b.slug,
      b.answers.length,
      b.date ? dropAt(b.date) : null,
      'draft',
      JSON.stringify(b.provenance || {}),
    ),
    env.DB.prepare(
      "INSERT INTO answers SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]') FROM json_each(?)",
    ).bind(JSON.stringify(entries)),
    env.DB.prepare(
      "INSERT INTO answer_keys SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?)",
    ).bind(JSON.stringify(keys)),
  ]);
  return json({ id, status: 'draft', entries: b.answers.length }, 201);
}
export async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '');
  if (!env.COOKIE_SECRET) return fail(503, 'The registry is not configured.');
  if (req.method === 'POST' && !path.startsWith('/admin/')) {
    const origin = req.headers.get('origin');
    if (
      origin &&
      origin !== env.SITE_URL &&
      !(env.LOCAL_TEST === 'true' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    )
      return fail(403, 'Please file from the registry’s own window.');
  }
  if (path.startsWith('/admin/')) return admin(req, env, path);
  if (path === '/og' || path.startsWith('/og/')) {
    const id = path.slice(4);
    const claim = id
      ? await env.DB.prepare(publicClaim + ' AND c.id=?')
          .bind(id)
          .first()
      : null;
    if (id && !claim) return fail(404, 'No certificate on file.');
    try {
      return await og(env.SITE_URL, claim);
    } catch (e) {
      console.error('OG render failed:', (e as Error).message);
      throw e;
    }
  }
  if (path === '/today') {
    const category = await current(env);
    const counts = category
      ? await env.DB.prepare(
          'SELECT COUNT(*) reserved,COALESCE(SUM(voided=0),0) claimed FROM claims WHERE category_id=?',
        )
          .bind(category.id)
          .first<any>()
      : { reserved: 0, claimed: 0 };
    const claimed = Number(counts.claimed);
    return json({
      category,
      claimed,
      open: category ? category.total_registrable - Number(counts.reserved) : 0,
      voided: Number(counts.reserved) - claimed,
      nextDrop: nextDrop(),
      turnstileSiteKey: env.TURNSTILE_SITE_KEY,
      closedReason: category
        ? undefined
        : 'THE NEXT REGISTER IS UNDER REVIEW. NO CLAIMS ARE OPEN YET.',
    });
  }
  if (path === '/me' && req.method === 'GET') {
    let u = await user(req, env);
    const g = await current(env);
    // A closed office does not need to create an identity or spend a database write.
    if (!u && !g) return json({ user: null, claim: null, streak: 0, streakDates: [] });
    let cookie = '';
    if (!u) {
      const id = crypto.randomUUID();
      for (let i = 0; i < 4; i++) {
        try {
          await env.DB.prepare('INSERT INTO users(id,handle,school,created_at) VALUES(?,?,?,?)')
            .bind(id, handle(), 'None', new Date().toISOString())
            .run();
          break;
        } catch (e) {
          if (i === 3) throw e;
        }
      }
      u = await env.DB.prepare('SELECT id,handle,school,rerolls_used,hidden FROM users WHERE id=?')
        .bind(id)
        .first<any>();
      cookie = `dibs_session=${id}.${await hmac(id, env.COOKIE_SECRET)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`;
    }
    const claim = g
      ? await env.DB.prepare(publicClaim + ' AND c.user_id=? AND c.category_id=?')
          .bind(u.id, g.id)
          .first()
      : null;
    const dates = await env.DB.prepare(
      'SELECT g.date FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=? AND c.voided=0 ORDER BY g.date DESC',
    )
      .bind(u.id)
      .all<{ date: string }>();
    const streakDates = dates.results.map((x) => x.date);
    return json(
      {
        user: u,
        claim,
        streak: streak(streakDates, registryDate()),
        streakDates: streakDates.slice(0, 7),
      },
      200,
      cookie ? { 'set-cookie': cookie } : {},
    );
  }
  if (path === '/answers') {
    const q = url.searchParams.get('q') || '';
    if (q.length < 3) return json({ answers: [] });
    const category = await current(env);
    if (!category) return json({ answers: [] });
    const key = normalize(q);
    const rows = await env.DB.prepare(
      'SELECT DISTINCT a.display FROM answer_keys k JOIN answers a ON a.id=k.answer_id WHERE k.category_id=? AND k.match_key LIKE ? ORDER BY a.display LIMIT 8',
    )
      .bind(category.id, key + '%')
      .all();
    return json({ answers: rows.results.map((r: any) => r.display) });
  }
  if (path === '/ledger') {
    const category = url.searchParams.get('category');
    const since = Number(url.searchParams.get('since') || 0);
    const rows = await env.DB.prepare(
      publicClaim + ' AND c.category_id=? AND c.claim_no>? ORDER BY c.claim_no DESC',
    )
      .bind(category, Number.isFinite(since) ? since : 0)
      .all();
    return json({ rows: rows.results });
  }
  if (path === '/archive') {
    const rows = await env.DB.prepare(
      "SELECT id,date,name,slug,total_registrable,drop_at FROM categories WHERE date<=? AND status='approved' AND drop_at<=? ORDER BY date DESC",
    )
      .bind(registryDate(), new Date().toISOString())
      .all();
    return json({ categories: rows.results });
  }
  if (path === '/schools') {
    const published = await env.DB.prepare(
      "SELECT id FROM categories WHERE date<=? AND status='approved' LIMIT 1",
    )
      .bind(registryDate())
      .first();
    if (!published) return json({ today: [], season: [] });
    const g = url.searchParams.get('category') || (await current(env))?.id || '';
    const base =
      "SELECT u.school,COUNT(*) claims FROM claims c JOIN users u ON u.id=c.user_id JOIN categories g ON g.id=c.category_id WHERE c.voided=0 AND u.hidden=0 AND g.status='approved' AND u.school NOT IN ('None','Other')";
    const [today, season] = await env.DB.batch([
      env.DB.prepare(
        base + ' AND c.category_id=? GROUP BY u.school ORDER BY claims DESC,u.school',
      ).bind(g),
      env.DB.prepare(base + ' GROUP BY u.school ORDER BY claims DESC,u.school'),
    ]);
    return json({ today: today.results, season: season.results });
  }
  if (path.startsWith('/certificate/')) {
    const id = path.slice(13);
    const rows = await env.DB.prepare(
      publicClaim + ' AND (c.id=? OR (length(?)>=8 AND c.id LIKE ?)) LIMIT 2',
    )
      .bind(id, id, id.replace(/[%_]/g, '') + '%')
      .all();
    return rows.results.length === 1
      ? json({ claim: rows.results[0] })
      : fail(404, 'That certificate is not on the public record.');
  }
  const u = await user(req, env);
  if (!u)
    return fail(
      401,
      'Cookies are required to keep your place. Please allow cookies or open Dibs in your regular browser.',
    );
  if (u.hidden) return fail(403, 'This account is not accepting new filings.');
  if (req.method !== 'POST') return fail(404, 'No file at this address.');
  if (path === '/session-check') return json({ ok: true });
  if (path === '/me/reroll') {
    const result = await env.DB.prepare(
      'UPDATE users SET handle=?,rerolls_used=rerolls_used+1 WHERE id=? AND rerolls_used<3 AND NOT EXISTS(SELECT 1 FROM claims WHERE user_id=?) RETURNING id,handle,school,rerolls_used',
    )
      .bind(handle(), u.id, u.id)
      .first();
    return result
      ? json({ user: result })
      : fail(403, 'This handle has been filed. Re-rolls are closed.');
  }
  if (path === '/me/school') {
    const b = await body(req);
    if (!schools.includes(b.school)) return fail(422, 'Choose a school from the register.');
    const result = await env.DB.prepare(
      'UPDATE users SET school=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM claims WHERE user_id=?) RETURNING id,handle,school,rerolls_used',
    )
      .bind(b.school, u.id, u.id)
      .first();
    return result
      ? json({ user: result })
      : fail(403, 'School affiliation locks with your first claim.');
  }
  if (path === '/events/share') {
    const b = await body(req);
    if (!['feed', 'story'].includes(b.format)) return fail(422, 'Unknown copy format.');
    await env.DB.prepare(
      'INSERT INTO share_events SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM share_events WHERE user_id=? AND day=?)<100',
    )
      .bind(
        crypto.randomUUID(),
        u.id,
        new Date().toISOString().slice(0, 10),
        b.format,
        u.id,
        new Date().toISOString().slice(0, 10),
      )
      .run();
    return json({ ok: true });
  }
  if (path === '/claim') return claim(req, env, u);
  return fail(404, 'No file at this address.');
}
async function claim(req: Request, env: Env, u: any) {
  try {
    await env.DB.prepare('INSERT INTO attempts VALUES(?,?,?)')
      .bind(crypto.randomUUID(), u.id, Date.now())
      .run();
  } catch (e) {
    if (String(e).includes('USER_RATE_LIMIT'))
      return fail(429, 'Three attempts per minute. Give the ink a moment to dry.');
    throw e;
  }
  const b = await body(req);
  if (
    typeof b.answer !== 'string' ||
    b.answer.length > 120 ||
    typeof b.turnstileToken !== 'string' ||
    b.turnstileToken.length > 2048
  )
    return fail(422, 'File an entry and its verification.');
  // The test bypass only works on a loopback URL and is never configured remotely.
  const local =
    env.LOCAL_TEST === 'true' && ['localhost', '127.0.0.1'].includes(new URL(req.url).hostname);
  if (!local) {
    if (!env.TURNSTILE_SECRET) return fail(503, 'Verification is not configured.');
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: b.turnstileToken }),
    });
    const verified = (await response.json()) as any;
    if (
      !verified.success ||
      verified.hostname !== new URL(env.SITE_URL).hostname ||
      verified.action !== 'claim'
    )
      return fail(400, 'Verification was not accepted. Please try again.');
  }
  const g = await current(env);
  if (!g) return fail(422, 'This register is not open.');
  if (
    await env.DB.prepare('SELECT id FROM claims WHERE category_id=? AND user_id=?')
      .bind(g.id, u.id)
      .first()
  )
    return fail(403, 'One claim per day. Yours is already on file.');
  const answer = await env.DB.prepare(
    'SELECT answer_id FROM answer_keys WHERE category_id=? AND match_key=?',
  )
    .bind(g.id, normalize(b.answer))
    .first<any>();
  if (!answer) return fail(422, 'That entry is not in this register. Please try another.');
  const taken = async () => {
    const r = await env.DB.prepare(claimSelect + ' WHERE c.category_id=? AND c.answer_id=?')
      .bind(g.id, answer.answer_id)
      .first<any>();
    return r ? json({ takenBy: r.handle, at: r.created_at }, 409) : null;
  };
  const existing = await taken();
  if (existing) return existing;
  const ip =
    (local ? req.headers.get('x-test-ip') : null) ||
    req.headers.get('CF-Connecting-IP') ||
    'unknown';
  const day = torontoDate();
  const hash = await hmac(ip || 'unknown', await hmac('ip:' + day, env.COOKIE_SECRET));
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      'INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day) SELECT ?,?,?,?,COALESCE(MAX(claim_no),0)+1,?,?,? FROM claims WHERE category_id=?',
    )
      .bind(id, g.id, answer.answer_id, u.id, new Date().toISOString(), hash, day, g.id)
      .run();
  } catch (e) {
    const won = await env.DB.prepare('SELECT id FROM claims WHERE category_id=? AND user_id=?')
      .bind(g.id, u.id)
      .first();
    if (won) return fail(403, 'One claim per day. Yours is already on file.');
    const conflict = await taken();
    if (conflict) return conflict;
    if (String(e).includes('IP_LIMIT'))
      return fail(429, 'This connection has reached its daily account allowance.');
    if (String(e).includes('USER_HIDDEN'))
      return fail(403, 'This account is not accepting new filings.');
    throw e;
  }
  return json(
    {
      claim: await env.DB.prepare(publicClaim + ' AND c.id=?')
        .bind(id)
        .first(),
    },
    201,
  );
}
export default {
  async fetch(req: Request, env: Env) {
    try {
      return await route(req, env);
    } catch (e) {
      if (env.LOCAL_TEST === 'true') console.error(e);
      if (/free tier daily|daily row read limit|daily row write limit|7500/i.test(String(e))) {
        const reset = new Date();
        reset.setUTCHours(24, 0, 0, 0);
        const when = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Toronto',
          weekday: 'long',
          hour: 'numeric',
          minute: '2-digit',
        }).format(reset);
        return json(
          {
            message:
              'Today’s filing allowance is spent. Please return after ' + when + ', Toronto time.',
            retryAt: reset.toISOString(),
          },
          503,
          { 'retry-after': String(Math.ceil((reset.getTime() - Date.now()) / 1000)) },
        );
      }
      if (e instanceof SyntaxError) return fail(400, 'That form could not be read.');
      if (String(e).includes('BODY_TOO_LARGE')) return fail(413, 'That form is too large.');
      return fail(500, 'The filing cabinet is unavailable. Please try again.');
    }
  },
  async scheduled(_event: ScheduledController, env: Env) {
    await ensureMaintenanceIndexes(env);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM attempts WHERE at<?').bind(Date.now() - 120000),
      env.DB.prepare("DELETE FROM rate_limits WHERE day<date('now','-2 day')"),
      env.DB.prepare(
        "UPDATE claims SET ip_hash='' WHERE ip_day<date('now','-2 day') AND ip_hash!=''",
      ),
    ]);
  },
} satisfies ExportedHandler<Env>;
