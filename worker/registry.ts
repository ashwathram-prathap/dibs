import { DurableObject } from 'cloudflare:workers';
import { route, current, publicClaim, json, safeError, type Env } from './routes';
import { cookieUser, handle, hmac } from './identity';
import { nextDrop, registryDate, streak } from './domain';
import { og } from './og';
import { metered } from './metrics';

type Snapshot = {
  category: any;
  rows: any[];
  reserved: number;
  checkedAt: number;
  day: string;
  version: number;
};
type Session = {
  user: any;
  claim: any;
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
      nextDrop: nextDrop(),
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
      cookie = `dibs_session=${id}.${await hmac(id, this.env.COOKIE_SECRET)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
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
      claim: s?.claim?.category_date === registryDate() ? s.claim : null,
      streakDates: s?.streakDates.slice(0, 7) || [],
      streak: streak(s?.streakDates || [], registryDate()),
    };
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
    const key = 'image:' + (id || 'default');
    const saved = await this.ctx.storage.get<ArrayBuffer>(key);
    if (saved) return this.png(saved);
    let pending = this.flights.get(key);
    if (!pending) {
      pending = (async () => {
        const r = !id
          ? null
          : env.REGISTRY
            ? await env.REGISTRY.get(env.REGISTRY.idFromName('public-registry-v1')).fetch(
                new Request('https://registry/api/certificate/' + id),
              )
            : await route(new Request('https://registry/api/certificate/' + id), env);
        if (r && !r.ok) return r;
        const claim = r ? ((await r.json()) as any).claim : null;
        // Old certificates keep their HTML/PNG export; their social preview becomes the common wordmark.
        if (claim && Date.now() - Date.parse(claim.created_at) > 30 * 86400000)
          return this.image('', env);
        const rendered = await og(claim);
        const bytes = await rendered.arrayBuffer();
        const stored = await this.ctx.storage.transaction(async (txn) => {
          const used = (await txn.get<number>('image-bytes')) || 0;
          if (id && used + bytes.byteLength > 400_000_000) return false;
          await txn.put(key, bytes);
          if (id) {
            await txn.put('image-bytes', used + bytes.byteLength);
            await txn.put('image-expiry:' + id, {
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
    for (const prefix of ['session:', 'cache:']) {
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
          if (!at || at < Date.now() - ttl) obsolete.push(key);
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
  async dispatch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api/, '');
    const origin = req.headers.get('origin');
    if ((req.method === 'POST' && !path.startsWith('/admin/')) || path === '/live') {
      if (
        origin &&
        origin !== PUBLIC_ORIGIN &&
        !(env.LOCAL_TEST === 'true' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      )
        return json({ message: 'Please file from the registry’s own window.' }, 403);
    }
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
    if (path.startsWith('/certificate/'))
      return this.cached('certificate:' + path.slice(13), 86400000, () => route(req, env));
    if (path === '/og' || path.startsWith('/og/')) return this.image(path.slice(4), env);
    if (path === '/answers') return json({ answers: [] }); // Suggestions are a versioned Pages asset.
    if (path.startsWith('/admin/')) {
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
        data.days.sort((a: any, b: any) => b.day.localeCompare(a.day));
        return json(data);
      }
      return response;
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
    if (path === '/events/share') {
      const b = (await req.json()) as any;
      if (!['feed', 'story'].includes(b.format))
        return json({ message: 'Unknown copy format.' }, 422);
      const day = new Date().toISOString().slice(0, 10);
      await this.ctx.storage.transaction(async (txn) => {
        await txn.put('shares:' + day, ((await txn.get<number>('shares:' + day)) || 0) + 1);
      });
      return json({ ok: true });
    }
    if (path === '/claim') {
      const allowed = await this.ctx.blockConcurrencyWhile(async () => {
        const latest = (await this.ctx.storage.get<Session>('session:' + session.user.id))!;
        latest.attempts = latest.attempts.filter((t) => t > Date.now() - 60000);
        if (latest.attempts.length >= 3) return false;
        latest.attempts.push(Date.now());
        await this.ctx.storage.put('session:' + latest.user.id, latest);
        return true;
      });
      if (!allowed)
        return json({ message: 'Three attempts per minute. Give the ink a moment to dry.' }, 429);
      const response = await route(req, { ...env, PLAYER: session.user, ATTEMPT_CHECKED: true });
      if (response.status === 201) {
        const { claim } = (await response.clone().json()) as any;
        session.claim = claim;
        session.streakDates = [...new Set([claim.category_date, ...session.streakDates])].slice(
          0,
          370,
        );
        const latest = await this.ctx.storage.get<Session>('session:' + session.user.id);
        session.attempts = latest?.attempts || [];
        await this.ctx.storage.put('session:' + session.user.id, session);
        await this.ctx.storage.put('cache:certificate:' + claim.id, {
          at: Date.now(),
          body: JSON.stringify({ claim }),
        });
        // Own claim is returned immediately; shared snapshots stay on their ten-second refresh clock.
        return json({ claim, me: this.me(session) }, 201);
      }
      return response;
    }
    return json({ message: 'No file at this address.' }, 404);
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      if (typeof message !== 'string' || message.length > 512)
        return ws.close(1009, 'Small forms only');
      const b = JSON.parse(message),
        previous = ws.deserializeAttachment() as { at: number } | null;
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
