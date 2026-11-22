import { gate, securityKey, type Gate } from './security';
import { isLocal, originFailure, validId } from '../shared/security';
import { DurableObject } from 'cloudflare:workers';
import { route, current, fileState, publicClaim, json, safeError, body, type Env } from './routes';
import { cookieUser, handle, hmac, constantEqual, sessionCookie } from './identity';
import { nextDrop, registryDate, streak, normalize } from './domain';
import { og } from './og';
import { metered } from './metrics';
import { isPlatform, platforms } from '../shared/sharing';

type Snapshot = {
  category: any;
  rows: any[];
  reserved: number;
  checkedAt: number;
  day: string;
  version: number;
  board?: any[];
  nextDrop?: string;
};
type Session = {
  user: any;
  claim: any;
  file?: any;
  streakDates: string[];
  attempts: number[];
  lastSeen?: number;
  shared?: { day: string; count: number };
};
// One global read coordinator. SQLite-backed Durable Objects are included on Workers Free.
// Hibernation avoids charging five minutes of active duration for every open browser.
export class Registry extends DurableObject<Env> {
  private snapshot?: Snapshot;
  private refreshing?: Promise<Snapshot>;
  private flights = new Map<string, Promise<Response>>();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }
  async fresh(env: Env): Promise<Snapshot> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      this.snapshot ||= await this.ctx.storage.get<Snapshot>('snapshot');
      const day = registryDate();
      if (this.snapshot?.day === day && Date.now() - this.snapshot.checkedAt < 10000)
        return this.snapshot;
      const category = await current(env);
      const previous =
        this.snapshot?.category?.id === category?.id && this.snapshot?.day === day
          ? this.snapshot
          : undefined;
      const reserved = category
        ? Number(
            (
              await env.DB.prepare(
                'SELECT COALESCE(MAX(claim_no),0) n FROM claims WHERE category_id=?',
              )
                .bind(category.id)
                .first<any>()
            )?.n || 0,
          )
        : 0;
      const added = category
        ? (
            await env.DB.prepare(
              publicClaim + ' AND c.category_id=? AND c.claim_no>? ORDER BY c.claim_no DESC',
            )
              .bind(category.id, previous?.reserved || 0)
              .all()
          ).results
        : [];
      const rows = [...added, ...(previous?.rows || [])];
      this.snapshot = {
        category,
        nextDrop: category
          ? nextDrop()
          : (
              await env.DB.prepare(
                "SELECT MIN(drop_at) at FROM categories WHERE status='approved' AND drop_at>?",
              )
                .bind(new Date().toISOString())
                .first<any>()
            )?.at || '2026-11-25T02:00:00.000Z',
        board: category ? (await this.ctx.storage.get<any[]>('board:' + category.id)) || [] : [],
        rows,
        reserved,
        checkedAt: Date.now(),
        day,
        version: (await this.ctx.storage.get<number>('version')) || 0,
      };
      await this.ctx.storage.put('snapshot', this.snapshot);
      return this.snapshot;
    })();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = undefined;
    }
  }
  today(s: Snapshot) {
    return {
      category: s.category,
      claimed: s.rows.length,
      open: s.category ? s.category.total_registrable - s.reserved : 0,
      voided: s.reserved - s.rows.length,
      lastClaimAt: s.rows[0]?.created_at || null,
      nextDrop: s.nextDrop || nextDrop(),
      board: (s.board || []).map(({ user_id, ...row }) => row),
      turnstileSiteKey: this.env.TURNSTILE_SITE_KEY,
    };
  }
  async session(req: Request, create = false): Promise<{ session?: Session; cookie: string }> {
    let id = await cookieUser(req, this.env.COOKIE_SECRET);
    let session = id ? await this.ctx.storage.get<Session>('session:' + id) : undefined;
    // Upgrade existing signed identities once, then all page reads use the private session cache.
    if (id && !session) {
      const u = await this.env.DB.prepare(
        'SELECT id,handle,rerolls_used,hidden FROM users WHERE id=?',
      )
        .bind(id)
        .first<any>();
      if (u) {
        const dates = (
          await this.env.DB.prepare(
            'SELECT g.date FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=? AND c.voided=0 ORDER BY c.created_at DESC LIMIT 370',
          )
            .bind(id)
            .all<any>()
        ).results.map((r) => r.date);
        const claim = await this.env.DB.prepare(publicClaim + ' AND c.user_id=? AND g.date=?')
          .bind(id, registryDate())
          .first();
        session = {
          user: u,
          claim,
          file: (await current(this.env))
            ? await fileState(this.env, (await current(this.env)).id, id)
            : null,
          streakDates: dates.slice(0, 370),
          attempts: [],
          lastSeen: Date.now(),
        };
        await this.ctx.storage.put('session:' + id, session);
      }
    }
    let cookie = '';
    if (!session && create) {
      id = crypto.randomUUID();
      session = {
        user: { id, handle: handle(), rerolls_used: 0, hidden: 0 },
        claim: null,
        streakDates: [],
        attempts: [],
        lastSeen: Date.now(),
      };
      await this.ctx.storage.put('session:' + id, session);
      cookie = await sessionCookie(id, this.env.COOKIE_SECRET, isLocal(req, this.env.LOCAL_TEST));
    }
    if (session && create && Date.now() - (session.lastSeen || 0) > 86400000) {
      session.lastSeen = Date.now();
      await this.ctx.storage.put('session:' + session.user.id, session);
    }
    if (session && !(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 86400000);
    return { session, cookie };
  }
  me(s?: Session) {
    return {
      user: s?.user || null,
      file: s?.file?.category_id === this.snapshot?.category?.id ? s?.file : null,
      claim: s?.claim?.category_date === registryDate() ? s.claim : null,
      streakDates: s?.streakDates.slice(0, 7) || [],
      streak: streak(s?.streakDates || [], registryDate()),
    };
  }
  async ensureSummary(session: Session) {
    if (!session.file?.closed) return;
    const id = (
      await hmac(session.user.id + ':' + session.file.category_id, this.env.COOKIE_SECRET)
    ).slice(0, 40);
    session.file.summaryId = id;
    const key = 'summary:' + id;
    if (!(await this.ctx.storage.get(key)))
      await this.ctx.storage.put(key, {
        category: session.file.category_id,
        user: session.user.id,
      });
  }
  async summary(id: string, env: Env) {
    const ref = await this.ctx.storage.get<{ category: string; user: string }>('summary:' + id);
    if (!ref) return json({ message: 'No day summary on file.' }, 404);
    const category = await env.DB.prepare(
      "SELECT * FROM categories WHERE id=? AND status='approved'",
    )
      .bind(ref.category)
      .first<any>();
    if (!category) return json({ message: 'No day summary on file.' }, 404);
    const file = await fileState(env, ref.category, ref.user);
    // Keep the completed score, but never expose a voided claim in a shared file.
    const visible = (
      await env.DB.prepare(
        publicClaim + ' AND c.category_id=? AND c.user_id=? ORDER BY c.created_at,c.claim_no',
      )
        .bind(ref.category, ref.user)
        .all()
    ).results;
    return json({
      file: { ...file, claims: visible, summaryId: id },
      category,
      nextDrop: nextDrop(),
    });
  }
  async cached(key: string, ttl: number, produce: () => Promise<Response>) {
    const stored = await this.ctx.storage.get<{ at: number; body: string }>('cache:' + key);
    if (stored && Date.now() - stored.at < ttl)
      return new Response(stored.body, { headers: { 'content-type': 'application/json' } });
    let promise = this.flights.get(key);
    if (!promise) {
      promise = (async () => {
        const r = await produce();
        if (r.ok)
          await this.ctx.storage.put('cache:' + key, {
            at: Date.now(),
            body: await r.clone().text(),
          });
        return r;
      })();
      this.flights.set(key, promise);
    }
    try {
      return (await promise).clone();
    } finally {
      this.flights.delete(key);
    }
  }
  async image(id: string, env: Env): Promise<Response> {
    const key = 'image:' + (id || 'default') + ':r4';
    const saved = await this.ctx.storage.get<ArrayBuffer>(key);
    if (saved) return this.png(saved);
    let pending = this.flights.get(key);
    if (!pending) {
      pending = (async () => {
        const r = !id
          ? null
          : env.REGISTRY
            ? await env.REGISTRY.get(env.REGISTRY.idFromName('public-registry-v1')).fetch(
                new Request(
                  'https://registry/api/' + (id.startsWith('summary/') ? id : 'certificate/' + id),
                ),
              )
            : await route(
                new Request(
                  'https://registry/api/' + (id.startsWith('summary/') ? id : 'certificate/' + id),
                ),
                env,
              );
        if (r && !r.ok) return r;
        const data = r ? ((await r.json()) as any) : null;
        const claim = data?.claim || null;
        const summary = data?.file ? data : null;
        // Old certificates keep their HTML/PNG export; their social preview becomes the common wordmark.
        if (
          (claim || summary) &&
          Date.now() - Date.parse(claim?.created_at || summary.file.completedAt) > 30 * 86400000
        )
          return this.image('', env);
        const rendered = await og(claim, summary);
        const bytes = await rendered.arrayBuffer();
        const stored = await this.ctx.storage.transaction(async (txn) => {
          const used = (await txn.get<number>('image-bytes')) || 0;
          if (id && used + bytes.byteLength > 400_000_000) return false;
          await txn.put(key, bytes);
          if (id) {
            await txn.put('image-bytes', used + bytes.byteLength);
            await txn.put('image-expiry:' + id + ':r4', {
              at: Date.now() + 30 * 86400000,
              size: bytes.byteLength,
            });
          }
          return true;
        });
        if (!stored) return this.image('', env);
        if (!(await this.ctx.storage.getAlarm()))
          await this.ctx.storage.setAlarm(Date.now() + 86400000);
        return this.png(bytes);
      })();
      this.flights.set(key, pending);
    }
    try {
      return (await pending).clone();
    } finally {
      this.flights.delete(key);
    }
  }
  png(bytes: ArrayBuffer) {
    return new Response(bytes, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=86400',
        'x-public-origin': PUBLIC_ORIGIN,
      },
    });
  }
  async alarm() {
    const expiry = await this.ctx.storage.list<{ at: number; size: number } | number>({
      prefix: 'image-expiry:',
    });
    for (const [key, value] of expiry) {
      const at = typeof value === 'number' ? value : value.at;
      if (at <= Date.now())
        await this.ctx.storage.transaction(async (txn) => {
          const size =
            typeof value === 'number'
              ? (await txn.get<ArrayBuffer>(key.replace('image-expiry:', 'image:')))?.byteLength ||
                0
              : value.size;
          await txn.delete([key, key.replace('image-expiry:', 'image:')]);
          await txn.put(
            'image-bytes',
            Math.max(0, ((await txn.get<number>('image-bytes')) || 0) - size),
          );
        });
    }
    // Bound private session and certificate-cache storage without deleting any D1 record.
    for (const prefix of ['session:', 'cache:', 'security:']) {
      let after: string | undefined;
      while (true) {
        const page = await this.ctx.storage.list<any>({
          prefix,
          limit: 500,
          ...(after ? { startAfter: after } : {}),
        });
        if (!page.size) break;
        const obsolete: string[] = [];
        for (const [key, value] of page) {
          const at = prefix === 'session:' ? value.lastSeen : value.at;
          const ttl = prefix === 'session:' ? 30 * 86400000 : 86400000;
          if (prefix === 'security:' ? value.expires <= Date.now() : !at || at < Date.now() - ttl)
            obsolete.push(key);
        }
        if (obsolete.length) await this.ctx.storage.delete(obsolete);
        after = [...page.keys()].at(-1);
        if (page.size < 500) break;
      }
    }
    await this.ctx.storage.setAlarm(Date.now() + 86400000);
  }
  async fetch(req: Request): Promise<Response> {
    const meter = metered(this.env.DB);
    const env = { ...this.env, DB: meter.db };
    let response: Response;
    try {
      const closed = await this.ctx.storage.get<{ until: number; body: any }>('quota-closed');
      if (closed && closed.until > Date.now()) response = json(closed.body, 503);
      else response = await this.dispatch(req, env);
    } catch (e) {
      response = safeError(e, env);
      if (response.status === 503) {
        const data = (await response.clone().json()) as any;
        if (data.code === 'REGISTRY_CLOSED')
          await this.ctx.storage.put('quota-closed', {
            until: Date.parse(data.retryAt),
            body: data,
          });
      }
    }
    if (env.LOCAL_TEST === 'true' && response.status !== 101) {
      response = new Response(response.body, response);
      response.headers.set('x-d1-rows-read', String(meter.totals.reads));
      response.headers.set('x-d1-rows-written', String(meter.totals.writes));
    }
    return response;
  }
  async rateGate(req: Request, env: Env, admin: boolean, valid: boolean) {
    const key =
      'security:' +
      (admin ? 'admin:' : 'events:') +
      (await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST));
    const status = await this.ctx.storage.transaction(async (txn) => {
      const result = gate(await txn.get<Gate>(key), Date.now(), valid, admin);
      await txn.put(key, result.state);
      return result.status;
    });
    if (!(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 86400000);
    return status === 200
      ? null
      : json(
          {
            message:
              status === 404
                ? 'No file at this address.'
                : 'Give the clerk a minute before filing again.',
          },
          status,
        );
  }
  async dispatch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api/, '');
    const rejected = originFailure(req, isLocal(req, env.LOCAL_TEST));
    if (rejected) return rejected;
    if (path === '/live') {
      if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return json({ message: 'A live connection is required.' }, 426);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (path === '/bootstrap' || path === '/me') {
      const snapshot = await this.fresh(env);
      const { session, cookie } = await this.session(req, !!snapshot.category);
      if (session && snapshot.category && (session.attempts.length || session.claim)) {
        session.file = await fileState(env, snapshot.category.id, session.user.id);
        session.claim = session.file.claims.at(-1) || null;
      }
      if (session) await this.ensureSummary(session);
      const data =
        path === '/me'
          ? this.me(session)
          : {
              today: this.today(snapshot),
              me: this.me(session),
              rows: snapshot.rows.slice(0, 50),
              version: snapshot.version,
            };
      return json(data, 200, cookie ? { 'set-cookie': cookie } : {});
    }
    if (path === '/today') return json(this.today(await this.fresh(env)));
    if (path === '/ledger') {
      const s = await this.fresh(env),
        category = url.searchParams.get('category');
      const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
      if (s.category?.id === category)
        return json({ rows: s.rows.filter((r) => r.claim_no > since) });
      const r = await this.cached('ledger:' + category, 600000, () =>
        route(
          new Request(url.origin + '/api/ledger?category=' + encodeURIComponent(category || '')),
          env,
        ),
      );
      if (!r.ok) return r;
      return json({ rows: ((await r.json()) as any).rows.filter((r: any) => r.claim_no > since) });
    }
    if (path === '/archive')
      return this.cached('archive:' + registryDate(), 600000, () => route(req, env));
    if (path.startsWith('/summary/') && req.method === 'GET') {
      const cached = await this.cached('summary:' + path.slice(9), 86400000, () =>
        this.summary(path.slice(9), env),
      );
      if (!cached.ok) return cached;
      return json({ ...((await cached.json()) as any), nextDrop: nextDrop() });
    }
    if (path.startsWith('/certificate/'))
      return this.cached('certificate:' + path.slice(13), 86400000, () => route(req, env));
    if (path === '/og' || path.startsWith('/og/')) return this.image(path.slice(4), env);
    if (path === '/answers') return json({ answers: [] }); // Suggestions are a versioned Pages asset.
    if (path.startsWith('/admin/')) {
      const valid =
        !!env.ADMIN_TOKEN &&
        (await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN));
      const denied = await this.rateGate(req, env, true, valid);
      if (denied) return denied;
      if (
        path === '/admin/upload-budget' ||
        (path === '/admin/category' && env.LOCAL_TEST !== 'true')
      ) {
        const key = 'upload-budget:' + new Date().toISOString().slice(0, 10);
        if (path === '/admin/upload-budget')
          return json({
            reservedWrites: (await this.ctx.storage.get<number>(key)) || 0,
            limit: 45000,
          });
        const b = await body(req.clone() as Request, 5_000_000);
        if (
          !Array.isArray(b.answers) ||
          b.answers.length > 2200 ||
          b.answers.some(
            (a: any) =>
              !a ||
              typeof a.display !== 'string' ||
              !Array.isArray(a.aliases) ||
              a.aliases.length > 40 ||
              a.aliases.some((v: any) => typeof v !== 'string'),
          )
        )
          return json({ message: 'Answers are required.' }, 422);
        const keys = b.answers.reduce(
          (n: number, a: any) =>
            n + new Set([normalize(a.display), ...(a.aliases || []).map(normalize)]).size,
          0,
        );
        if (!validId(b.id || b.slug)) return json({ message: 'A register ID is required.' }, 422);
        const exists = await env.DB.prepare('SELECT id FROM categories WHERE id=?')
          .bind(b.id || b.slug)
          .first();
        const cost = (exists ? 2 : 1) * (4 * b.answers.length + 3 * keys) + 10;
        const allowed = await this.ctx.storage.transaction(async (txn) => {
          const reserved = (await txn.get<number>(key)) || 0;
          if (reserved + cost > 45000) return false;
          await txn.put(key, reserved + cost);
          return true;
        });
        if (!allowed)
          return json(
            { message: 'Daily upload budget is reserved. Resume after midnight UTC.' },
            429,
          );
      }

      const response = await route(req.clone() as Request, env);
      if (response.ok && req.method === 'POST') {
        await this.ctx.storage.put(
          'version',
          ((await this.ctx.storage.get<number>('version')) || 0) + 1,
        );
        this.snapshot = undefined;
        await this.ctx.storage.delete('snapshot');
        const keys = await this.ctx.storage.list({ prefix: 'cache:' });
        await this.ctx.storage.delete([...keys.keys()]);
        if (path.endsWith('hide-user') || path.endsWith('void-claim')) {
          const b = (await req.clone().json()) as any; // caller body is cloned by route below
          if (path.endsWith('hide-user')) {
            const s = await this.ctx.storage.get<Session>('session:' + b.id);
            if (s) {
              s.user.hidden = 1;
              if (s.file) {
                const key = 'board:' + s.file.category_id;
                const board = (await this.ctx.storage.get<any[]>(key)) || [];
                await this.ctx.storage.put(
                  key,
                  board.map((r) => (r.user_id === b.id ? { ...r, handle: 'Record withheld' } : r)),
                );
              }
              await this.ctx.storage.put('session:' + b.id, s);
            }
          }
          // Moderation invalidates previews too; a redacted card is a new revision.
          const images = await this.ctx.storage.list({ prefix: 'image:' });
          await this.ctx.storage.delete([...images.keys()]);
          const expiries = await this.ctx.storage.list({ prefix: 'image-expiry:' });
          await this.ctx.storage.delete([...expiries.keys()]);
          await this.ctx.storage.put('image-bytes', 0);
          if (env.IMAGE_CACHE)
            await Promise.all(
              Array.from({ length: 8 }, (_, i) =>
                env
                  .IMAGE_CACHE!.get(env.IMAGE_CACHE!.idFromName('images-' + i))
                  .fetch(new Request('https://images/invalidate', { method: 'POST' })),
              ),
            );
        }
      }
      if (response.ok && path === '/admin/stats') {
        const data = (await response.json()) as any;
        const shares = await this.ctx.storage.list<number>({ prefix: 'shares:' });
        for (const [key, count] of shares) {
          const day = key.slice(7);
          let row = data.days.find((d: any) => d.day === day);
          if (!row) {
            row = { day, new_users: 0, claims: 0, active_claimers: 0, shares: 0 };
            data.days.push(row);
          }
          row.shares += count;
        }
        data.platforms = platforms.map((platform) => ({ platform, shares: 0, arrivals: 0 }));
        const counters = await this.ctx.storage.list<
          Record<string, { shares: number; arrivals: number }>
        >({ prefix: 'platforms:' });
        for (const [key, counts] of counters) {
          const day = key.slice(10);
          let row = data.days.find((d: any) => d.day === day);
          if (!row) {
            row = { day, new_users: 0, claims: 0, active_claimers: 0, shares: 0 };
            data.days.push(row);
          }
          for (const total of data.platforms) {
            total.shares += counts[total.platform]?.shares || 0;
            total.arrivals += counts[total.platform]?.arrivals || 0;
            row.shares += counts[total.platform]?.shares || 0;
          }
        }
        data.days.sort((a: any, b: any) => b.day.localeCompare(a.day));
        return json(data);
      }
      return response;
    }
    if ((path === '/events/share' || path === '/events/arrival') && req.method === 'POST') {
      const denied = await this.rateGate(req, env, false, true);
      if (denied) return denied;
      const b = await body(req, 100);
      if (
        !b ||
        typeof b !== 'object' ||
        !isPlatform(b.platform) ||
        Object.keys(b).some((k) => k !== 'platform')
      )
        return json({ message: 'Unknown platform.' }, 422);
      const key = 'platforms:' + new Date().toISOString().slice(0, 10);
      await this.ctx.storage.transaction(async (txn) => {
        const counts =
          (await txn.get<Record<string, { shares: number; arrivals: number }>>(key)) || {};
        counts[b.platform] ||= { shares: 0, arrivals: 0 };
        counts[b.platform][path === '/events/share' ? 'shares' : 'arrivals']++;
        await txn.put(key, counts);
      });
      return json({ ok: true });
    }
    const { session } = await this.session(req);
    if (!session)
      return json(
        {
          message:
            'Cookies are required to keep your place. Please allow cookies or open Dibs in your regular browser.',
        },
        401,
      );
    if (session.user.hidden)
      return json({ message: 'This account is not accepting new filings.' }, 403);
    if (req.method !== 'POST') return json({ message: 'No file at this address.' }, 404);
    if (path === '/session-check') return json({ ok: true });
    if (path === '/me/reroll') {
      if (session.claim || session.user.rerolls_used >= 3)
        return json({ message: 'This handle has been filed. Re-rolls are closed.' }, 403);
      // Serialize this small state mutation so simultaneous rerolls cannot exceed three.
      return this.ctx.blockConcurrencyWhile(async () => {
        const latest = (await this.ctx.storage.get<Session>('session:' + session.user.id))!;
        if (latest.claim || latest.user.rerolls_used >= 3)
          return json({ message: 'This handle has been filed. Re-rolls are closed.' }, 403);
        latest.user.handle = handle();
        latest.user.rerolls_used++;
        await this.ctx.storage.put('session:' + latest.user.id, latest);
        return json({ user: latest.user });
      });
    }
    if (path === '/claim') {
      if (this.me(session).file?.closed)
        return json({ message: 'Your file is closed for today.' }, 403);
      const allowed = await this.ctx.blockConcurrencyWhile(async () => {
        const latest = (await this.ctx.storage.get<Session>('session:' + session.user.id))!;
        latest.attempts = latest.attempts.filter((t) => t > Date.now() - 60000);
        if (latest.attempts.length >= 12) return false;
        latest.attempts.push(Date.now());
        await this.ctx.storage.put('session:' + latest.user.id, latest);
        return true;
      });
      if (!allowed)
        return json({ message: 'Twelve attempts per minute. Give the ink a moment to dry.' }, 429);
      const response = await route(req, { ...env, PLAYER: session.user, ATTEMPT_CHECKED: true });
      if (response.status === 201 || response.status === 409) {
        const data = (await response.clone().json()) as any;
        // Read authoritative D1 progress after every mutation. Concurrent requests cannot
        // overwrite session progress with an older response.
        await this.ctx.blockConcurrencyWhile(async () => {
          const latest = (await this.ctx.storage.get<Session>('session:' + session.user.id))!;
          const category = await current(env);
          latest.file = category ? await fileState(env, category.id, session.user.id) : null;
          if (data.claim) {
            latest.claim = data.claim;
            latest.streakDates = [
              ...new Set([data.claim.category_date, ...latest.streakDates]),
            ].slice(0, 370);
            await this.ctx.storage.put('cache:certificate:' + data.claim.id, {
              at: Date.now(),
              body: JSON.stringify({ claim: data.claim }),
            });
          }
          if (latest.file?.closed) {
            const key = 'board:' + latest.file.category_id;
            const board = (await this.ctx.storage.get<any[]>(key)) || [];
            const updated = [
              ...board.filter((r) => r.user_id !== latest.user.id),
              {
                user_id: latest.user.id,
                handle: latest.user.handle,
                dibs: latest.file.dibs,
                strikes: latest.file.strikes,
                completedAt: latest.file.completedAt,
              },
            ]
              .sort(
                (a, b) =>
                  b.dibs - a.dibs ||
                  a.strikes - b.strikes ||
                  a.completedAt.localeCompare(b.completedAt) ||
                  a.user_id.localeCompare(b.user_id),
              )
              .slice(0, 10);
            await this.ctx.storage.put(key, updated);
            if (this.snapshot && this.snapshot.category?.id === latest.file.category_id)
              this.snapshot.board = updated;
          }
          await this.ensureSummary(latest);
          if (data.claim || latest.file?.closed)
            await this.ctx.storage.put('session:' + latest.user.id, latest);
          Object.assign(session, latest);
        });
        return json({ ...data, file: session.file, me: this.me(session) }, response.status);
      }
      return response;
    }
    return json({ message: 'No file at this address.' }, 404);
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      if (typeof message !== 'string' || message.length > 512)
        return ws.close(1009, 'Small forms only');
      const b = JSON.parse(message);
      if (
        !b ||
        typeof b !== 'object' ||
        (b.category != null && !/^[a-zA-Z0-9-]{2,80}$/.test(b.category)) ||
        ['since', 'version'].some((k) => b[k] != null && (!Number.isSafeInteger(b[k]) || b[k] < 0))
      )
        return ws.close(1008, 'That form could not be read');
      const previous = ws.deserializeAttachment() as { at: number } | null;
      if (previous && Date.now() - previous.at < 10000) return;
      ws.serializeAttachment({ at: Date.now() });
      const closed = await this.ctx.storage.get<{ until: number; body: any }>('quota-closed');
      if (closed && closed.until > Date.now()) {
        ws.send(JSON.stringify({ error: closed.body }));
        return;
      }
      const s = await this.fresh(this.env);
      const same = b.category === s.category?.id && (b.version || 0) === (s.version || 0);
      ws.send(
        JSON.stringify({
          today: this.today(s),
          rows: s.rows.filter((r) => !same || r.claim_no > (Number(b.since) || 0)),
          reset: !same,
          version: s.version,
        }),
      );
    } catch (e) {
      const response = safeError(e, this.env);
      const data = (await response.json()) as any;
      if (data.code === 'REGISTRY_CLOSED')
        await this.ctx.storage.put('quota-closed', { until: Date.parse(data.retryAt), body: data });
      ws.send(JSON.stringify({ error: data }));
    }
  }
  webSocketClose(ws: WebSocket, code: number) {
    ws.close([1005, 1006, 1015].includes(code) ? 1000 : code);
  }
  webSocketError(ws: WebSocket) {
    ws.close(1011, 'Please reopen the registry.');
  }
}
import { PUBLIC_ORIGIN } from '../shared/config';

// Dedicated, bounded image shards keep each object below the stricter Free storage ceiling.
export class ImageCache extends Registry {
  async fetch(req: Request): Promise<Response> {
    // This namespace is reachable externally only through /api/og; invalidation is internal.
    if (new URL(req.url).pathname === '/invalidate' && req.method === 'POST') {
      for (const prefix of ['image:', 'image-expiry:', 'cache:']) {
        const keys = await this.ctx.storage.list({ prefix });
        await this.ctx.storage.delete([...keys.keys()]);
      }
      await this.ctx.storage.put('image-bytes', 0);
      return json({ ok: true });
    }
    return super.fetch(req);
  }
}
