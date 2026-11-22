import { scoreAnswer, scoreFile } from './scoring';
import { MAX_CLAIMS, MAX_STRIKES } from '../shared/config';
import { clerkReply } from '../shared/moments';
import { canReveal, publicCategory, concealClaim } from './visibility';
import { verifyChallenge, verifiedSession } from './turnstile';
import { catalogMeta, lookup, nearMiss, answerId, persistAnswer } from './catalog';
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
import {
  handle,
  hmac,
  cookieUser,
  constantEqual,
  sessionCookie,
  normalizeFileKey,
} from './identity';
import {
  normalize,
  normalizeCommonName,
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
  NTFY_TOPIC?: string;
  CF_ANALYTICS_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  REGISTRY?: DurableObjectNamespace;
  IMAGE_CACHE?: DurableObjectNamespace;
  PLAYER?: any;
  INTERNAL_RECORD?: boolean;
  ATTEMPT_CHECKED?: boolean;
  COOKIE_SECRET: string;
  ADMIN_TOKEN: string;
  TURNSTILE_SECRET: string;
  TURNSTILE_SITE_KEY: string;
  LOCAL_TEST?: string;
}
const claimSelect = `SELECT c.id,c.category_id,c.claim_no,c.file_no,c.created_at,c.points,c.percentile,c.bonus,c.voided,a.display,a.obscurity,(c.bonus=100) golden,CASE WHEN u.provider_subject LIKE 'withdrawn:%' THEN 'Withdrawn player' WHEN u.hidden=1 THEN 'Record withheld' ELSE COALESCE((SELECT name FROM founder_role WHERE user_id=u.id),u.handle) END handle,EXISTS(SELECT 1 FROM founder_role WHERE user_id=u.id AND u.hidden=0) founder,g.name category_name,g.date category_date,COALESCE(json_extract(g.source_json,'$.staticCatalog.count'),g.total_registrable)-(SELECT COUNT(*) FROM house_words hw WHERE hw.category_id=g.id) total_registrable FROM claims c JOIN answers a ON a.id=c.answer_id JOIN users u ON u.id=c.user_id JOIN categories g ON g.id=c.category_id`;
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
      `SELECT s.created_at,s.seq,s.guess,s.house,c.created_at held_at,CASE WHEN u.provider_subject LIKE 'withdrawn:%' THEN 'Withdrawn player' WHEN u.hidden=1 OR c.voided=1 THEN 'Record withheld' ELSE COALESCE((SELECT name FROM founder_role WHERE user_id=u.id),u.handle) END holder,EXISTS(SELECT 1 FROM founder_role WHERE user_id=u.id AND u.hidden=0 AND c.voided=0) holder_founder FROM strikes s LEFT JOIN claims c ON c.id=s.holder_claim_id LEFT JOIN users u ON u.id=c.user_id WHERE s.category_id=? AND s.user_id=? ORDER BY s.seq`,
    )
      .bind(category, uid)
      .all()
  ).results as any[];
  const events = [
    ...claims.map((c) => ({
      at: c.created_at,
      kind: 'dibs',
      points: c.points,
      golden: !!c.golden,
      display: c.display,
      claimId: c.id,
      obscurity: c.obscurity,
      order: c.file_no,
    })),
    ...strikes.map((s) => ({
      at: s.created_at,
      kind: 'strike',
      order: s.seq,
      display: s.guess,
      house: !!s.house,
      holder: s.house ? 'RESERVED' : s.holder,
      holderFounder: !s.house && !!s.holder_founder,
      heldAt: s.held_at,
    })),
  ].sort((a, b) => a.order - b.order);
  const closed = claims.length >= MAX_CLAIMS || strikes.length >= MAX_STRIKES;
  return {
    category_id: category,
    ...scoreFile(events),
    eligible: !claims.some((c) => c.voided),
    golden: claims.some((c) => c.golden),
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
      date: new Date().toUTCString(),
      ...extra,
    },
  });
const fail = (status: number, message: string) => json({ message }, status);
export async function current(env: Env) {
  const category =
    env.STAGING === 'true'
      ? await env.DB.prepare(
          "SELECT * FROM categories WHERE id='practice' AND status='approved' AND drop_at<=?",
        )
          .bind(new Date().toISOString())
          .first<any>()
      : await env.DB.prepare(
          "SELECT * FROM categories WHERE date=? AND status='approved' AND drop_at<=?",
        )
          .bind(registryDate(), new Date().toISOString())
          .first<any>();
  if (category) {
    const meta = catalogMeta(category);
    if (meta) category.total_registrable = meta.count;
    await ensureSpecials(env, category);
  }
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
    return fail(404, 'Page not found; return to today.');
  if (invalidParameters(req)) return fail(422, 'That form could not be read.');
  if (path === '/admin/verify' && req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id');
    const category = await env.DB.prepare('SELECT * FROM categories WHERE id=?')
      .bind(id)
      .first<any>();
    const staticManifest = category && catalogMeta(category);
    if (staticManifest)
      return json({
        id,
        entries: staticManifest.count,
        version: staticManifest.version,
        houseCount: staticManifest.house.length,
        storage: 'immutable static assets',
      });
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
          `SELECT g.id,g.name,g.status,g.date,g.drop_at,COALESCE(json_extract(g.source_json,'$.staticCatalog.count'),g.total_registrable) total_registrable,g.source_json,(SELECT COUNT(*) FROM answers a WHERE a.category_id=g.id) answer_count,(SELECT COUNT(*) FROM answer_keys k WHERE k.category_id=g.id) key_count FROM categories g ORDER BY g.date,g.id`,
        ).all()
      ).results.map((row: any) => {
        const source = JSON.parse(row.source_json || '{}');
        if (source.staticCatalog) {
          delete source.staticCatalog.house;
        }
        return { ...row, source_json: JSON.stringify(source) };
      }),
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
  if (path === '/admin/set-founder') {
    const target = String(b.target || '');
    const name = String(b.name || 'THE REGISTRAR').trim();
    if (!/^[A-Za-z0-9 .'-]{2,40}$/.test(name))
      return fail(422, 'Use a name of 2–40 plain characters.');
    const hash = await hmac(normalizeFileKey(target), env.COOKIE_SECRET);
    const found = await env.DB.prepare(
      'SELECT id FROM users WHERE id=? UNION SELECT user_id id FROM recovery_keys WHERE key_hash=?',
    )
      .bind(target, hash)
      .first<any>();
    if (!found) return fail(404, 'No account matches that backup code or user ID.');
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO founder_role(slot,user_id,name) VALUES(1,?,?) ON CONFLICT(slot) DO UPDATE SET user_id=excluded.user_id,name=excluded.name',
      ).bind(found.id, name),
      env.DB.prepare('INSERT INTO admin_audit VALUES(?,?,?,?)').bind(
        crypto.randomUUID(),
        'set-founder',
        found.id,
        new Date().toISOString(),
      ),
    ]);
    return json({ ok: true, userId: found.id, name });
  }
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
  if (path === '/admin/practice-schedule') {
    if (env.STAGING !== 'true') return fail(404, 'No such clerk procedure.');
    if (
      typeof b.opensAt !== 'string' ||
      !Number.isFinite(Date.parse(b.opensAt)) ||
      Date.parse(b.opensAt) <= Date.now()
    )
      return fail(422, 'Choose a future practice opening.');
    await env.DB.prepare("UPDATE categories SET drop_at=?,date=? WHERE id='practice'")
      .bind(new Date(b.opensAt).toISOString(), torontoDate(new Date(b.opensAt)))
      .run();
    return json({ ok: true, opensAt: new Date(b.opensAt).toISOString() });
  }
  if (path === '/admin/practice-reset') {
    if (env.STAGING !== 'true') return fail(404, 'No such clerk procedure.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM founder_role'),
      env.DB.prepare('DELETE FROM recovery_keys'),
      env.DB.prepare('DELETE FROM claim_requests'),
      env.DB.prepare('DELETE FROM missing_answers'),
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
  if (path === '/admin/check-answers') {
    if (env.STAGING !== 'true') return fail(404, 'No such clerk procedure.');
    const category = await current(env);
    if (
      !category ||
      !catalogMeta(category) ||
      !Array.isArray(b.answers) ||
      b.answers.length > 20 ||
      b.answers.some((a: any) => !validText(a))
    )
      return fail(422, 'Check up to twenty practice answers.');
    const rows = [];
    for (const answer of b.answers) {
      const start = performance.now();
      const row = await lookup(category, answer);
      rows.push({ answer, found: !!row, display: row?.[1], ms: performance.now() - start });
    }
    return json({ rows });
  }
  if (path === '/admin/static-catalog') {
    if (
      !validId(b.id) ||
      !validId(b.slug) ||
      !validText(b.name, 50) ||
      !b.manifest ||
      b.manifest.slug !== b.slug ||
      !Number.isInteger(b.manifest.count) ||
      b.manifest.count < (b.slug === 'countries' ? 200 : 300) ||
      !/^[a-f0-9]{16}$/.test(b.manifest.version) ||
      b.manifest.house?.length !== 10
    )
      return fail(422, 'A verified static manifest is required.');
    const c = await env.DB.prepare('SELECT * FROM categories WHERE id=?').bind(b.id).first<any>();
    if (
      c &&
      ((await env.DB.prepare('SELECT id FROM claims WHERE category_id=? LIMIT 1')
        .bind(b.id)
        .first()) ||
        (env.STAGING !== 'true' && c.drop_at && c.drop_at <= new Date().toISOString()))
    )
      return fail(409, 'A played or opened register cannot be rebuilt.');
    const response = await fetch(PUBLIC_ORIGIN + '/catalog/' + b.slug + '/manifest.json');
    if (
      !response.ok ||
      JSON.stringify(await response.json()) !==
        JSON.stringify(
          Object.fromEntries(Object.entries(b.manifest).filter(([k]) => k !== 'house')),
        )
    )
      return fail(422, 'The published manifest does not match.');
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO categories(id,name,slug,total_registrable,source_json) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,total_registrable=excluded.total_registrable,source_json=excluded.source_json',
      ).bind(
        b.id,
        b.name,
        b.slug,
        Math.max(2000, b.manifest.count),
        JSON.stringify({ staticCatalog: b.manifest, coverage: b.coverage || null }),
      ),
      env.DB.prepare('DELETE FROM house_words WHERE category_id=?').bind(b.id),
      env.DB.prepare('DELETE FROM daily_specials WHERE category_id=?').bind(b.id),
    ]);
    const updated = await env.DB.prepare('SELECT * FROM categories WHERE id=?')
      .bind(b.id)
      .first<any>();
    await ensureSpecials(env, updated);
    return json({ ok: true, entries: b.manifest.count, schedulePreserved: true });
  }
  if (path === '/admin/pause') {
    if (!validId(b.id)) return fail(422, 'A register ID is required.');
    await env.DB.prepare("UPDATE categories SET status='draft' WHERE id=?").bind(b.id).run();
    return json({ ok: true });
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
    const meta = catalogMeta(c);
    const coverage = JSON.parse(c.source_json || '{}').coverage;
    if (meta ? !coverage?.ready : true)
      return fail(
        422,
        'Scheduling requires complete sources, 150 obvious answers and 50 independent checks.',
      );
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
      specials: specials ? { ...specials, houseWords: [] } : null,
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
    const g = await env.DB.prepare('SELECT id,date FROM categories WHERE id=?')
      .bind(category || '')
      .first();
    if (!(await canReveal(req, env, g))) return json({ rows: [], locked: true });
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
      "SELECT id,date,name,slug,COALESCE(json_extract(source_json,'$.staticCatalog.count'),total_registrable) total_registrable,drop_at FROM categories g WHERE date<? AND status='approved' AND drop_at<=? ORDER BY date DESC",
    )
      .bind(registryDate(), new Date().toISOString())
      .all();
    return json({
      categories: await Promise.all(
        rows.results.map(async (g: any) =>
          g.id === (url.searchParams.get('id') || rows.results[0]?.id)
            ? { ...g, specials: await specialStatus(env, g, true) }
            : g,
        ),
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
    if (exact) {
      const c = exact as any;
      return json({
        claim:
          env.INTERNAL_RECORD ||
          (await canReveal(req, env, { id: c.category_id, date: c.category_date }))
            ? c
            : concealClaim(c),
      });
    }
    if (id.length >= 36) return fail(404, 'That certificate is not on the public record.');
    // A primary-key range supports printed short links without an OR/LIKE table scan.
    const rows = await env.DB.prepare(publicClaim + ' AND c.id>=? AND c.id<? LIMIT 2')
      .bind(id, id + '\uffff')
      .all();
    return rows.results.length === 1
      ? json({
          claim:
            env.INTERNAL_RECORD ||
            (await canReveal(req, env, {
              id: rows.results[0].category_id,
              date: rows.results[0].category_date,
            }))
              ? rows.results[0]
              : concealClaim(rows.results[0]),
        })
      : fail(404, 'That certificate is not on the public record.');
  }
  const u = await user(req, env);
  if (!u)
    return fail(
      401,
      'Cookies are required to keep your place. Please allow cookies or open Dibs in your regular browser.',
    );
  if (u.hidden) return fail(403, 'This account is not accepting new filings.');
  if (req.method !== 'POST') return fail(404, 'Page not found; return to today.');
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
  return fail(404, 'Page not found; return to today.');
}
async function claim(req: Request, env: Env, u: any) {
  const b = await body(req);
  if (b.requestId !== undefined && !/^[a-f0-9-]{36}$/.test(b.requestId))
    return fail(422, 'A valid request ID is required.');
  const requestId = b.requestId || crypto.randomUUID();
  const g = await current(env);
  if (!g) return fail(422, 'The category is closed; check the opening time.');
  const replay = async () => {
    const c = await env.DB.prepare(
      publicClaim + ' AND c.user_id=? AND c.category_id=? AND c.request_id=?',
    )
      .bind(u.id, g.id, requestId)
      .first<any>();
    const old = await env.DB.prepare(
      'SELECT request_answer FROM claims WHERE user_id=? AND category_id=? AND request_id=? UNION ALL SELECT request_answer FROM strikes WHERE user_id=? AND category_id=? AND request_id=?',
    )
      .bind(u.id, g.id, requestId, u.id, g.id, requestId)
      .first<any>();
    if (!old) return null;
    if (old.request_answer !== normalize(String(b.answer || '')))
      return fail(422, 'A request ID belongs to its original answer.');
    if (c) return json({ claim: c, file: await fileState(env, g.id, u.id), replayed: true }, 201);
    const strike = await env.DB.prepare(
      'SELECT house,guess,holder_claim_id FROM strikes WHERE user_id=? AND category_id=? AND request_id=?',
    )
      .bind(u.id, g.id, requestId)
      .first<any>();
    const holder = strike.holder_claim_id
      ? await env.DB.prepare(publicClaim + ' AND c.id=?')
          .bind(strike.holder_claim_id)
          .first<any>()
      : null;
    return json(
      {
        house: !!strike.house,
        takenBy: strike.house ? 'RESERVED' : holder?.handle || 'Record withheld',
        founder: !strike.house && !!holder?.founder,
        message: strike.guess + ' is taken.',
        file: await fileState(env, g.id, u.id),
        replayed: true,
      },
      409,
    );
  };
  const repeated = await replay();
  if (repeated) return repeated;
  if ((await fileState(env, g.id, u.id)).closed)
    return fail(403, "You're done for today; see your certificate.");
  try {
    if (!env.ATTEMPT_CHECKED)
      await env.DB.prepare('INSERT INTO attempts VALUES(?,?,?)')
        .bind(crypto.randomUUID(), u.id, Date.now())
        .run();
  } catch (e) {
    if (String(e).includes('USER_RATE_LIMIT'))
      return fail(429, 'Too many attempts; wait a minute and try again.');
    throw e;
  }
  const local = isLocal(req, env.LOCAL_TEST);
  if (!validText(b.answer)) return fail(422, 'Enter an answer.');
  if (b.sessionToken) {
    if (!(await verifiedSession(req, env, u.id, b.sessionToken)))
      return json(
        { code: 'VERIFY_AGAIN', message: 'One quick verification, then try again.' },
        428,
      );
  } else if (!(await verifyChallenge(req, env, b.turnstileToken))) {
    return fail(400, 'Verification failed; try again.');
  }
  const note = clerkReply(b.answer, g.name);
  if (note) return json({ code: 'CLERK_NOTE', message: note }, 422);
  const staticRow = catalogMeta(g) ? await lookup(g, b.answer) : null;
  const answer = catalogMeta(g)
    ? staticRow
      ? { answer_id: answerId(g, staticRow) }
      : null
    : await env.DB.prepare('SELECT answer_id FROM answer_keys WHERE category_id=? AND match_key=?')
        .bind(g.id, normalizeCommonName(b.answer))
        .first<any>();
  if (!answer)
    return json(
      {
        code: 'NOT_REGISTERED',
        message: "Not on today's list. Check spelling.",
        suggestion: catalogMeta(g) ? await nearMiss(g, b.answer) : null,
        spellingCatalog: catalogMeta(g)
          ? {
              slug: catalogMeta(g).slug,
              version: catalogMeta(g).version,
              rowChunkSize: catalogMeta(g).rowChunkSize,
            }
          : null,
      },
      422,
    );
  if (staticRow) await persistAnswer(env, g, staticRow).run();
  const house = await env.DB.prepare(
    'SELECT a.display FROM house_words h JOIN answers a ON a.id=h.answer_id WHERE h.category_id=? AND h.answer_id=?',
  )
    .bind(g.id, answer.answer_id)
    .first<any>();
  const reserveRequest = () =>
    env.DB.prepare(
      'INSERT INTO claim_requests(user_id,category_id,request_id,answer_key,status,response_json,created_at) VALUES(?,?,?,?,0,?,?)',
    ).bind(u.id, g.id, requestId, normalize(b.answer), '{}', new Date().toISOString());
  const taken = async () => {
    const r = await env.DB.prepare(claimSelect + ' WHERE c.category_id=? AND c.answer_id=?')
      .bind(g.id, answer.answer_id)
      .first<any>();
    if (!r && !house) return null;
    try {
      await env.DB.batch([
        reserveRequest(),
        env.DB.prepare(
          "INSERT INTO strikes(category_id,user_id,seq,created_at,guess,holder_claim_id,house,request_id,request_answer) SELECT ?,?,(SELECT COUNT(*) FROM claims WHERE category_id=? AND user_id=?)+COUNT(*)+1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),?,?,?,?,? FROM strikes WHERE category_id=? AND user_id=?",
        ).bind(
          g.id,
          u.id,
          g.id,
          u.id,
          b.answer.trim().toUpperCase(),
          r?.id || null,
          house ? 1 : 0,
          requestId,
          normalize(b.answer),
          g.id,
          u.id,
        ),
      ]);
    } catch (e) {
      const repeated = await replay();
      if (repeated) return repeated;
      if (String(e).includes('FILE_CLOSED'))
        return fail(403, "You're done for today; see your certificate.");
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
        takenBy: house ? 'RESERVED' : r.handle,
        founder: !house && !!r.founder,
        house: !!house,
        message: house
          ? `${house.display.toUpperCase()} is reserved: the 10 most obvious answers are off-limits.`
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
  const score = await scoreAnswer(env, g, staticRow?.[0], answer.answer_id);
  try {
    await env.DB.batch([
      reserveRequest(),
      persistUser,
      env.DB.prepare(
        "INSERT INTO claims(id,category_id,answer_id,user_id,claim_no,created_at,ip_hash,ip_day,file_no,request_id,request_answer,points,percentile,bonus) SELECT ?,?,?,?,COALESCE(MAX(claim_no),0)+1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),?,?,(SELECT COUNT(*) FROM claims WHERE category_id=? AND user_id=?)+(SELECT COUNT(*) FROM strikes WHERE category_id=? AND user_id=?)+1,?,?,?,?,? FROM claims WHERE category_id=?",
      ).bind(
        id,
        g.id,
        answer.answer_id,
        u.id,
        hash,
        day,
        g.id,
        u.id,
        g.id,
        u.id,
        requestId,
        normalize(b.answer),
        score.points,
        score.percentile,
        score.bonus,
        g.id,
      ),
    ]);
  } catch (e) {
    const repeated = await replay();
    if (repeated) return repeated;
    if (String(e).includes('FILE_CLOSED'))
      return fail(403, "You're done for today; see your certificate.");
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
  else if (env.STAGING === 'true')
    console.error('Practice request failed:', String(e).slice(0, 500));
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
        path === '/today' &&
        !req.headers.get('cookie')
      ) {
        // Neither cookies, query order nor the player's cursor fragments the shared cache.
        const key = new URL(PUBLIC_ORIGIN + '/api' + path);
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
        if (path === '/today' && response.ok)
          return json({
            ...((await response.json()) as object),
            serverTime: new Date().toISOString(),
          });
        return response;
      }
      return await stub.fetch(req);
    } catch (e) {
      return safeError(e, env);
    }
  },
  async scheduled(_event: ScheduledController, env: Env) {
    await current(env);
    if (env.REGISTRY)
      await env.REGISTRY.get(env.REGISTRY.idFromName('public-registry-v1')).fetch(
        new Request(PUBLIC_ORIGIN + '/api/admin/monitor', {
          method: 'POST',
          headers: { origin: PUBLIC_ORIGIN, authorization: 'Bearer ' + env.ADMIN_TOKEN },
        }),
      );
    if (env.REGISTRY)
      await env.REGISTRY.get(env.REGISTRY.idFromName('public-registry-v1')).fetch(
        new Request(PUBLIC_ORIGIN + '/api/admin/schedule/tick', {
          method: 'POST',
          headers: {
            origin: PUBLIC_ORIGIN,
            authorization: 'Bearer ' + env.ADMIN_TOKEN,
            'content-type': 'application/json',
          },
          body: '{}',
        }),
      );
    if (_event.cron !== '17 5 * * *') return;
    await ensureMaintenanceIndexes(env);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM missing_answers WHERE day<date('now','-90 day')"),
      env.DB.prepare("DELETE FROM feedback WHERE created_at<datetime('now','-90 day')"),
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
