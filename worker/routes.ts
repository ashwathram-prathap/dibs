import { ensureSpecials, specialStatus } from './specials';
import {
  canonicalRedirect,
  corsResponse,
  isLocal,
  originFailure,
  invalidParameters,
  validId,
  validText,
  validMetadata,
} from '../shared/security';
import { catalogContent, keyContent } from '../shared/catalog-digest';
/// <reference types="@cloudflare/workers-types" />
import { PUBLIC_ORIGIN } from '../shared/config';
import { handle, hmac, cookieUser, constantEqual, sessionCookie } from './identity';
import {
  normalize,
  registryDate,
  nextDrop,
  streak,
  torontoDate,
  dropAt,
  validDate,
} from './domain';
import { og } from './og';
export interface Env {
  DB: D1Database;
  STAGING?: string;
  REGISTRY?: DurableObjectNamespace;
  IMAGE_CACHE?: DurableObjectNamespace;
  PLAYER?: any;
  ATTEMPT_CHECKED?: boolean;
  COOKIE_SECRET: string;
  ADMIN_TOKEN: string;
  TURNSTILE_SECRET: string;
  TURNSTILE_SITE_KEY: string;
  LOCAL_TEST?: string;
}
const claimSelect = `SELECT c.id,c.category_id,c.claim_no,c.file_no,c.created_at,a.display,a.obscurity,EXISTS(SELECT 1 FROM daily_specials ds,json_each(ds.golden_json) j WHERE ds.category_id=c.category_id AND j.value=c.answer_id) golden,CASE WHEN u.hidden=1 THEN 'Record withheld' ELSE u.handle END handle,g.name category_name,g.date category_date,g.total_registrable-(SELECT COUNT(*) FROM house_words hw WHERE hw.category_id=g.id) total_registrable FROM claims c JOIN answers a ON a.id=c.answer_id JOIN users u ON u.id=c.user_id JOIN categories g ON g.id=c.category_id`;
export async function fileState(env: Env, category: string, uid: string) {
  const claims = (
    await env.DB.prepare(
      claimSelect + ' WHERE c.category_id=? AND c.user_id=? ORDER BY c.created_at,c.claim_no',
    )
      .bind(category, uid)
      .all()
  ).results as any[];
  const strikes = (
    await env.DB.prepare(
      'SELECT created_at,seq FROM strikes WHERE category_id=? AND user_id=? ORDER BY seq',
    )
      .bind(category, uid)
      .all()
  ).results as any[];
  const events = [
    ...claims.map((c) => ({
      at: c.created_at,
      kind: 'dibs',
      golden: !!c.golden,
      order: c.file_no,
    })),
    ...strikes.map((s) => ({ at: s.created_at, kind: 'strike', order: s.seq })),
  ].sort((a, b) => a.order - b.order);
  const closed = claims.length >= 3 || strikes.length >= 5;
  return {
    category_id: category,
    claims,
    dibs: claims.length,
    strikes: strikes.length,
    events,
    closed,
    completedAt: closed ? events.at(-1)?.at : null,
  };
}
export const publicClaim = claimSelect + ` WHERE c.voided=0 AND g.status='approved'`;
export const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
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
export async function current(env: Env) {
  const category =
    env.STAGING === 'true'
      ? await env.DB.prepare(
          "SELECT * FROM categories WHERE id='practice' AND status='approved'",
        ).first<any>()
      : await env.DB.prepare(
          "SELECT * FROM categories WHERE date=? AND status='approved' AND drop_at<=?",
        )
          .bind(registryDate(), new Date().toISOString())
          .first<any>();
  if (category) await ensureSpecials(env, category);
  return category;
}
async function user(req: Request, env: Env) {
  if (env.PLAYER) return env.PLAYER;
  const id = await cookieUser(req, env.COOKIE_SECRET);
  return id
    ? (await env.DB.prepare('SELECT id,handle,rerolls_used,hidden FROM users WHERE id=?')
        .bind(id)
        .first<any>()) || { id, handle: 'Clerk ' + id.slice(0, 8), rerolls_used: 0, hidden: 0 }
    : null;
}
export async function body(req: Request, limit = 4096) {
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
    return fail(404, 'No file at this address.');
  if (invalidParameters(req)) return fail(422, 'That form could not be read.');
  if (path === '/admin/verify' && req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id');
    const rows = (
      await env.DB.prepare('SELECT display,aliases_json,obscurity FROM answers WHERE category_id=?')
        .bind(id)
        .all<any>()
    ).results;
    const missing = (
      await env.DB.prepare(
        'SELECT k.match_key,a.display FROM answer_keys k JOIN answers a ON a.id=k.answer_id WHERE k.category_id=?',
      )
        .bind(id)
        .all<any>()
    ).results;
    const content = catalogContent(
      rows.map((a) => ({ ...a, aliases: JSON.parse(a.aliases_json) })),
    );
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))),
    ]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    const keyDigest = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyContent(missing))),
      ),
    ]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    return json({ id, entries: rows.length, keys: missing.length, digest, keyDigest });
  }
  if (path === '/admin/registers' && req.method === 'GET') {
    return json({
      categories: (
        await env.DB.prepare(
          `SELECT g.id,g.name,g.status,g.date,g.drop_at,g.total_registrable,g.source_json,(SELECT COUNT(*) FROM answers a WHERE a.category_id=g.id) answer_count,(SELECT COUNT(*) FROM answer_keys k WHERE k.category_id=g.id) key_count FROM categories g ORDER BY g.date,g.id`,
        ).all()
      ).results,
    });
  }
  if (path === '/admin/stats') {
    const days = await env.DB.prepare(
      `WITH days AS (SELECT substr(created_at,1,10) day FROM users UNION SELECT substr(created_at,1,10) day FROM claims UNION SELECT day FROM share_events) SELECT day,(SELECT COUNT(*) FROM users WHERE substr(created_at,1,10)=days.day) new_users,(SELECT COUNT(*) FROM claims WHERE substr(created_at,1,10)=days.day AND voided=0) claims,(SELECT COUNT(DISTINCT user_id) FROM claims WHERE substr(created_at,1,10)=days.day AND voided=0) active_claimers,(SELECT COUNT(*) FROM share_events WHERE day=days.day) shares FROM days ORDER BY day DESC LIMIT 90`,
    ).all();
    const retention = async (n: number) =>
      env.DB.prepare(
        `WITH firsts AS (SELECT user_id,MIN(g.date) first_day FROM claims c JOIN categories g ON c.category_id=g.id WHERE c.voided=0 GROUP BY user_id), eligible AS (SELECT * FROM firsts WHERE date(first_day,?)<=?) SELECT COUNT(*) eligible,COALESCE(SUM(EXISTS(SELECT 1 FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=e.user_id AND c.voided=0 AND g.date=date(e.first_day,?))),0) retained FROM eligible e`,
      )
        .bind('+' + n + ' day', registryDate(), '+' + n + ' day')
        .first();
    return json({ days: days.results, d1: await retention(1), d7: await retention(7) });
  }
  if (req.method !== 'POST') return fail(405, 'File changes by POST.');
  const b = await body(req, path === '/admin/category' ? 5_000_000 : 4096);
  if (path === '/admin/hide-user' || path === '/admin/void-claim') {
    if (!validId(b.id)) return fail(422, 'A record ID is required.');
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
  if (path === '/admin/practice-reset') {
    if (env.STAGING !== 'true') return fail(404, 'No such clerk procedure.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM strikes'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM attempts'),
      env.DB.prepare('DELETE FROM rate_limits'),
      env.DB.prepare('DELETE FROM users'),
      env.DB.prepare('DELETE FROM daily_specials'),
      env.DB.prepare('UPDATE house_words SET revealed=0'),
    ]);
    return json({ ok: true, practice: true });
  }
  if (path === '/admin/category') return uploadCategory(env, b);
  if (path === '/admin/approve') {
    if (!validId(b.id)) return fail(422, 'A record ID is required.');
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
    if (n.n < 2000 || n.n > 2200 || n.n !== c.total_registrable)
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
function bulkStatements(env: Env, sql: string, rows: any[]) {
  // At most 18 bounded JSON statements per table, under Free's 50-query invocation limit.
  const size = Math.max(1, Math.ceil(rows.length / 18));
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += size)
    statements.push(env.DB.prepare(sql).bind(JSON.stringify(rows.slice(i, i + size))));
  return statements;
}
export async function uploadCategory(env: Env, b: any) {
  if (
    !b ||
    !Array.isArray(b.answers) ||
    b.answers.length < 2000 ||
    b.answers.length > 2200 ||
    !validText(b.name, 50) ||
    typeof b.slug !== 'string' ||
    !/^[a-z0-9-]{2,60}$/.test(b.slug)
  )
    return fail(422, 'A register needs 2,000–2,200 valid entries, a name and a slug.');
  if (
    b.provenance !== undefined &&
    (!validMetadata(b.provenance) || JSON.stringify(b.provenance).length > 32768)
  )
    return fail(422, 'Keep the source notes brief and readable.');
  if (b.replaceDraft !== undefined && typeof b.replaceDraft !== 'boolean')
    return fail(422, 'Mark draft replacement with true or false.');
  if (b.status && b.status !== 'draft')
    return fail(422, 'Uploads enter as drafts. Approve separately after review.');
  if (b.date && !validDate(b.date))
    return fail(422, 'Use a real calendar date in YYYY-MM-DD form.');
  const id = b.id || b.slug;
  if (typeof id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(id))
    return fail(422, 'Use a plain register ID.');
  const existing = await env.DB.prepare('SELECT status,source_json FROM categories WHERE id=?')
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
      !a ||
      !validText(a.display) ||
      !a.display.trim() ||
      !Number.isInteger(a.obscurity) ||
      a.obscurity < 1 ||
      a.obscurity > 5 ||
      !Array.isArray(a.aliases) ||
      a.aliases.length > 40 ||
      a.aliases.some((s: any) => !validText(s))
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
  const fingerprint = [
    ...new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          JSON.stringify([b.name, b.slug, b.date || null, b.answers, b.provenance || {}]),
        ),
      ),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (existing && JSON.parse(existing.source_json || '{}').uploadFingerprint === fingerprint)
    return json({ id, status: 'draft', entries: b.answers.length, unchanged: true });
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
      JSON.stringify({ ...b.provenance, uploadFingerprint: fingerprint }),
    ),
    ...bulkStatements(
      env,
      "INSERT INTO answers SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]') FROM json_each(?)",
      entries,
    ),
    ...bulkStatements(
      env,
      "INSERT INTO answer_keys SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?)",
      keys,
    ),
  ]);
  return json({ id, status: 'draft', entries: b.answers.length }, 201);
}
export async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '');
  if (!env.COOKIE_SECRET) return fail(503, 'The registry is not configured.');
  const rejected = originFailure(req, isLocal(req, env.LOCAL_TEST));
  if (rejected) return rejected;
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
      return await og(claim);
    } catch (e) {
      console.error('OG render failed:', (e as Error).message);
      throw e;
    }
  }
  if (path === '/today') {
    const category = await current(env);
    const counts = category
      ? await env.DB.prepare(
          'SELECT COUNT(*) reserved,COALESCE(SUM(voided=0),0) claimed,MAX(CASE WHEN voided=0 THEN created_at END) lastClaimAt FROM claims WHERE category_id=?',
        )
          .bind(category.id)
          .first<any>()
      : { reserved: 0, claimed: 0 };
    const specials = category ? await specialStatus(env, category) : null;
    const claimed = Number(counts.claimed);
    return json({
      category,
      specials,
      practice: env.STAGING === 'true',
      claimed,
      lastClaimAt: counts.lastClaimAt || null,
      open: category
        ? category.total_registrable - Number(counts.reserved) - (specials?.houseCount || 0)
        : 0,
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
    if (!u && !g) return json({ user: null, claim: null, file: null, streak: 0, streakDates: [] });
    let cookie = '';
    if (!u) {
      const id = crypto.randomUUID();
      u = { id, handle: 'Clerk ' + id.slice(0, 8), rerolls_used: 0, hidden: 0 };
      cookie = await sessionCookie(id, env.COOKIE_SECRET, isLocal(req, env.LOCAL_TEST));
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
        file: g ? await fileState(env, g.id, u.id) : null,
        streak: streak(streakDates, registryDate()),
        streakDates: streakDates.slice(0, 7),
      },
      200,
      cookie ? { 'set-cookie': cookie } : {},
    );
  }
  if (path === '/answers') {
    return json({ answers: [] });
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
    if (env.STAGING === 'true') return json({ categories: [] });
    const rows = await env.DB.prepare(
      "SELECT id,date,name,slug,total_registrable,drop_at FROM categories g WHERE date<? AND status='approved' AND drop_at<=? ORDER BY date DESC",
    )
      .bind(registryDate(), new Date().toISOString())
      .all();
    return json({
      categories: await Promise.all(
        rows.results.map(async (g: any) => ({ ...g, specials: await specialStatus(env, g, true) })),
      ),
    });
  }
  if (path.startsWith('/certificate/')) {
    const id = path.slice(13);
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id))
      return fail(404, 'That certificate is not on the public record.');
    const exact = await env.DB.prepare(publicClaim + ' AND c.id=?')
      .bind(id)
      .first();
    if (exact) return json({ claim: exact });
    if (id.length >= 36) return fail(404, 'That certificate is not on the public record.');
    // A primary-key range supports printed short links without an OR/LIKE table scan.
    const rows = await env.DB.prepare(publicClaim + ' AND c.id>=? AND c.id<? LIMIT 2')
      .bind(id, id + '\uffff')
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
      'UPDATE users SET handle=?,rerolls_used=rerolls_used+1 WHERE id=? AND rerolls_used<3 AND NOT EXISTS(SELECT 1 FROM claims WHERE user_id=?) RETURNING id,handle,rerolls_used',
    )
      .bind(handle(), u.id, u.id)
      .first();
    return result
      ? json({ user: result })
      : fail(403, 'This handle has been filed. Re-rolls are closed.');
  }
  if (path === '/claim') return claim(req, env, u);
  return fail(404, 'No file at this address.');
}
async function claim(req: Request, env: Env, u: any) {
  const g = await current(env);
  if (!g) return fail(422, 'This register is not open.');
  if ((await fileState(env, g.id, u.id)).closed) return fail(403, 'Your file is closed for today.');
  try {
    if (!env.ATTEMPT_CHECKED)
      await env.DB.prepare('INSERT INTO attempts VALUES(?,?,?)')
        .bind(crypto.randomUUID(), u.id, Date.now())
        .run();
  } catch (e) {
    if (String(e).includes('USER_RATE_LIMIT'))
      return fail(429, 'Twelve attempts per minute. Give the ink a moment to dry.');
    throw e;
  }
  const b = await body(req);
  if (
    !validText(b.answer) ||
    typeof b.turnstileToken !== 'string' ||
    !/^[a-zA-Z0-9_.-]{1,2048}$/.test(b.turnstileToken)
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
      verified.hostname !== new URL(PUBLIC_ORIGIN).hostname ||
      verified.action !== 'claim'
    )
      return fail(400, 'Verification was not accepted. Please try again.');
  }
  const answer = await env.DB.prepare(
    'SELECT answer_id FROM answer_keys WHERE category_id=? AND match_key=?',
  )
    .bind(g.id, normalize(b.answer))
    .first<any>();
  if (!answer) return fail(422, "Not on today's register. Check the spelling.");
  const house = await env.DB.prepare(
    'SELECT a.display FROM house_words h JOIN answers a ON a.id=h.answer_id WHERE h.category_id=? AND h.answer_id=?',
  )
    .bind(g.id, answer.answer_id)
    .first<any>();
  const taken = async () => {
    const r = await env.DB.prepare(claimSelect + ' WHERE c.category_id=? AND c.answer_id=?')
      .bind(g.id, answer.answer_id)
      .first<any>();
    if (!r && !house) return null;
    try {
      await env.DB.prepare(
        "INSERT INTO strikes SELECT ?,?,(SELECT COUNT(*) FROM claims WHERE category_id=? AND user_id=?)+COUNT(*)+1,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM strikes WHERE category_id=? AND user_id=?",
      )
        .bind(g.id, u.id, g.id, u.id, g.id, u.id)
        .run();
    } catch (e) {
      if (String(e).includes('FILE_CLOSED')) return fail(403, 'Your file is closed for today.');
      throw e;
    }
    if (house)
      await env.DB.prepare(
        'UPDATE house_words SET revealed=1 WHERE category_id=? AND answer_id=? AND revealed=0',
      )
        .bind(g.id, answer.answer_id)
        .run();
    return json(
      {
        takenBy: house ? 'THE REGISTRY' : r.handle,
        house: !!house,
        message: house
          ? `${house.display.toUpperCase()} is held by the Registry. Obvious picks are reserved.`
          : undefined,
        at: r?.created_at,
        file: await fileState(env, g.id, u.id),
      },
      409,
    );
  };
  const existing = await taken();
  if (existing) return existing;
  // Persist a pending identity only once a valid, available claim is being filed.
  const persistUser = env.DB.prepare(
    'INSERT OR IGNORE INTO users(id,handle,created_at,rerolls_used) VALUES(?,?,?,?)',
  ).bind(u.id, u.handle, new Date().toISOString(), u.rerolls_used);
  const ip =
    (local ? req.headers.get('x-test-ip') : null) ||
    req.headers.get('CF-Connecting-IP') ||
    'unknown';
  const day = torontoDate();
  const hash = await hmac(ip || 'unknown', await hmac('ip:' + day, env.COOKIE_SECRET));
  const id = crypto.randomUUID();
  try {
    await env.DB.batch([
      persistUser,
      env.DB.prepare(
        "INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day,file_no) SELECT ?,?,?,?,COALESCE(MAX(claim_no),0)+1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),?,?,(SELECT COUNT(*) FROM claims WHERE category_id=? AND user_id=?)+(SELECT COUNT(*) FROM strikes WHERE category_id=? AND user_id=?)+1 FROM claims WHERE category_id=?",
      ).bind(id, g.id, answer.answer_id, u.id, hash, day, g.id, u.id, g.id, u.id, g.id),
    ]);
  } catch (e) {
    if (String(e).includes('FILE_CLOSED')) return fail(403, 'Your file is closed for today.');
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
      file: await fileState(env, g.id, u.id),
      claim: await env.DB.prepare(publicClaim + ' AND c.id=?')
        .bind(id)
        .first(),
    },
    201,
  );
}
export function safeError(e: unknown, env: Env): Response {
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
        code: 'REGISTRY_CLOSED',
        message:
          'Registry closed for the day. The clerk’s filing allowance is spent. Please return after ' +
          when +
          ', Toronto time.',
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
const inflight = new Map<string, Promise<Response>>();
const handler = {
  async fetch(req: Request, env: Env) {
    try {
      if (!env.REGISTRY)
        return env.LOCAL_TEST === 'true'
          ? await route(req, env)
          : fail(503, 'The registry cache is not configured. The clerk is checking the files.');
      const url = new URL(req.url),
        path = url.pathname.replace(/^\/api/, '');
      const stub = env.REGISTRY.get(env.REGISTRY.idFromName('public-registry-v1'));
      if ((path === '/og' || path.startsWith('/og/')) && env.IMAGE_CACHE) {
        const id = path.slice(4);
        const shard = (parseInt(id.replace(/[^a-f0-9]/gi, '').slice(0, 2) || '0', 16) || 0) % 8;
        return env.IMAGE_CACHE.get(env.IMAGE_CACHE.idFromName('images-' + shard)).fetch(req);
      }
      if (
        env.STAGING !== 'true' &&
        req.method === 'GET' &&
        (path === '/today' || path === '/ledger')
      ) {
        // Neither cookies, query order nor the player's cursor fragments the shared cache.
        const key = new URL(PUBLIC_ORIGIN + '/api' + path);
        if (path === '/ledger')
          key.searchParams.set('category', url.searchParams.get('category') || '');
        const cache = await caches.open('dibs-public-v2');
        let response = await cache.match(key.toString());
        if (!response) {
          let pending = inflight.get(key.toString());
          if (!pending) {
            pending = (async () => {
              const r = await stub.fetch(new Request(key.toString()));
              const shared = new Response(r.body, r);
              shared.headers.set('cache-control', 'public, max-age=10');
              if (shared.ok) await cache.put(key.toString(), shared.clone());
              return shared;
            })();
            inflight.set(key.toString(), pending);
          }
          try {
            response = (await pending).clone();
          } finally {
            inflight.delete(key.toString());
          }
        }
        if (path === '/ledger' && response.ok) {
          const data = (await response.json()) as any;
          const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
          const before = Number(url.searchParams.get('before')) || Infinity;
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
          return json({
            rows: data.rows
              .filter((r: any) => r.claim_no > since && r.claim_no < before)
              .slice(0, limit),
          });
        }
        return response;
      }
      return await stub.fetch(req);
    } catch (e) {
      return safeError(e, env);
    }
  },
  async scheduled(_event: ScheduledController, env: Env) {
    await current(env);
    if (_event.cron !== '17 5 * * *') return;
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

export default {
  ...handler,
  async fetch(req: Request, env: Env) {
    const local = isLocal(req, env.LOCAL_TEST);
    const redirect = canonicalRedirect(req, local);
    if (redirect) return corsResponse(req, redirect, local);
    const rejected = originFailure(req, local);
    const response =
      rejected ||
      (invalidParameters(req) && !new URL(req.url).pathname.startsWith('/api/admin/')
        ? fail(422, 'That form could not be read.')
        : req.method === 'OPTIONS'
          ? new Response(null, { status: 204 })
          : await handler.fetch(req, env));
    return corsResponse(req, response, local);
  },
} satisfies ExportedHandler<Env>;
