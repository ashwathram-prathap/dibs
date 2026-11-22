import { withdraw } from './withdraw';
import { calendarRoute } from './calendar';
import { platformUsage } from './platform-usage';
import { canReveal, publicCategory, concealClaim, concealSummary } from './visibility';
import { emptyMinute, alertConditions, freeLimits, type Minute } from './monitoring';
import { verifyChallenge, verificationToken, verifiedSession } from './turnstile';
import { specialStatus } from './specials';
import { dropAt } from './domain';
import { LAUNCH_DATE } from '../shared/config';
import { gate, securityKey, type Gate } from './security';
import { isLocal, originFailure, validId } from '../shared/security';
import { DurableObject } from 'cloudflare:workers';
import { route, current, fileState, publicClaim, json, safeError, body, type Env } from './routes';
import {
  cookieUser,
  handle,
  hmac,
  constantEqual,
  sessionCookie,
  fileKey,
  normalizeFileKey,
} from './identity';
import { nextDrop, registryDate, streak, normalize } from './domain';
import { og } from './og';
import { metered } from './metrics';
import { isPlatform, platforms } from '../shared/sharing';

type Snapshot = {
  category: any;
  specials?: any;
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
  private mutations = new Map<string, Promise<unknown>>();
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
        specials: category ? await specialStatus(env, category) : null,
        nextDrop: category
          ? nextDrop()
          : (
              await env.DB.prepare(
                "SELECT MIN(drop_at) at FROM categories WHERE status='approved' AND drop_at>?",
              )
                .bind(new Date().toISOString())
                .first<any>()
            )?.at || dropAt(LAUNCH_DATE),
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
  today(s: Snapshot, reveal = false) {
    return {
      serverTime: new Date().toISOString(),
      category: publicCategory(s.category),
      specials: s.specials
        ? { ...s.specials, houseWords: reveal ? s.specials.houseWords : [] }
        : null,
      practice: this.env.STAGING === 'true',
      claimed: s.rows.length,
      open: s.category
        ? s.category.total_registrable - s.reserved - (s.specials?.houseCount || 0)
        : 0,
      voided: s.reserved - s.rows.length,
      lastClaimAt: s.rows[0]?.created_at || null,
      nextDrop: s.nextDrop || nextDrop(),
      board: (reveal ? s.board || [] : []).map(({ user_id, ...row }) => row),
      turnstileSiteKey: this.env.TURNSTILE_SITE_KEY,
    };
  }
  async newHandle() {
    return this.ctx.blockConcurrencyWhile(async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        const pair = handle();
        let next = (await this.ctx.storage.get<number>('handle:' + pair)) || 0;
        for (; next <= 999; next++) {
          const value = pair + (next ? ' #' + next : '');
          if (await this.env.DB.prepare('SELECT id FROM users WHERE handle=?').bind(value).first())
            continue;
          await this.ctx.storage.put('handle:' + pair, next + 1);
          return value;
        }
      }
      throw Error('Handle pool unavailable');
    });
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
        user: { id, handle: await this.newHandle(), rerolls_used: 0, hidden: 0 },
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
    const founder = await this.env.DB.prepare('SELECT name FROM founder_role WHERE user_id=?')
      .bind(session.user.id)
      .first<any>();
    session.file.handle = founder?.name || session.user.handle;
    session.file.founder = !!founder;
    session.file.streak = streak(session.streakDates, registryDate());
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
    const holder = await env.DB.prepare(
      "SELECT CASE WHEN provider_subject LIKE 'withdrawn:%' THEN 'Withdrawn filer' ELSE handle END handle,hidden,provider_subject FROM users WHERE id=?",
    )
      .bind(ref.user)
      .first<any>();
    const dates = (
      await env.DB.prepare(
        'SELECT DISTINCT g.date FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=? AND c.voided=0 AND g.date<=?',
      )
        .bind(ref.user, category.date)
        .all<any>()
    ).results.map((r) => r.date);
    const owner = await this.ctx.storage.get<Session>('session:' + ref.user);
    const visibleIds = new Set(visible.map((c: any) => c.id));
    return json({
      file: {
        ...file,
        events: file.events.map((e) =>
          e.kind === 'dibs' && 'claimId' in e && !visibleIds.has(e.claimId)
            ? { at: e.at, kind: e.kind, display: 'Record withheld' }
            : e,
        ),
        claims: visible,
        summaryId: id,
        founder: visible.some((c: any) => c.founder),
        handle:
          visible[0]?.handle ||
          (holder?.hidden
            ? 'Record withheld'
            : holder?.handle || owner?.user.handle || 'Anonymous filer'),
        streak: holder?.provider_subject?.startsWith('withdrawn:')
          ? 0
          : streak(dates, category.date),
      },
      category,
      specials: await specialStatus(env, category),
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
    if ((await this.ctx.storage.get('image-format')) !== 11) {
      await this.ctx.blockConcurrencyWhile(async () => {
        if ((await this.ctx.storage.get('image-format')) === 11) return;
        for (const prefix of ['image:', 'image-expiry:']) {
          const rows = await this.ctx.storage.list({ prefix });
          if (rows.size) await this.ctx.storage.delete([...rows.keys()]);
        }
        await this.ctx.storage.put('image-bytes', 0);
        await this.ctx.storage.put('image-format', 11);
      });
    }
    const key = 'image:' + (id || 'default') + ':r11';
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
            await txn.put('image-expiry:' + id + ':r11', {
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
  async recordMetric(req: Request, response: Response, totals: { reads: number; writes: number }) {
    const path = new URL(req.url).pathname.replace(/^\/api/, '');
    const now = Date.now(),
      minute = Math.floor(now / 60000),
      day = new Date(now).toISOString().slice(0, 10);
    const uid = await cookieUser(req, this.env.COOKIE_SECRET);
    let data: any;
    if (path === '/claim' && [201, 409].includes(response.status))
      data = await response.clone().json();
    await this.ctx.storage.transaction(async (tx) => {
      const key = 'metric:' + minute;
      const m = (await tx.get<Minute>(key)) || emptyMinute();
      m.requests++;
      m.errors += Number(response.status >= 500);
      m.claims += Number(path === '/claim' && response.status === 201 && !data?.replayed);
      m.strikes += Number(path === '/claim' && response.status === 409 && !data?.replayed);
      m.completed += Number(path === '/claim' && data?.file?.closed && !data?.replayed);
      m.verifications += Number(path === '/verify-session');
      m.verificationFailures += Number(path === '/verify-session' && !response.ok);
      await tx.put(key, m);
      const usage = (await tx.get<any>('usage:' + day)) || { requests: 0, reads: 0, writes: 0 };
      usage.requests++;
      usage.reads += totals.reads;
      usage.writes += totals.writes;
      await tx.put('usage:' + day, usage);
      if (uid) await tx.put('active:' + uid, now);
    });
  }
  private calendarQueue: Promise<unknown> = Promise.resolve();
  async liveStats() {
    const now = Date.now(),
      minute = Math.floor(now / 60000);
    const minutes: Minute[] = [];
    for (let i = 4; i >= 0; i--)
      minutes.push((await this.ctx.storage.get<Minute>('metric:' + (minute - i))) || emptyMinute());
    const totals = minutes.reduce((a, m) => {
      for (const k of Object.keys(a) as (keyof Minute)[]) a[k] += m[k];
      return a;
    }, emptyMinute());
    const active = [
      ...(await this.ctx.storage.list<number>({ prefix: 'active:' })).values(),
    ].filter((at) => at > now - 300000).length;
    const usage = (await this.ctx.storage.get<any>(
      'usage:' + new Date(now).toISOString().slice(0, 10),
    )) || { requests: 0, reads: 0, writes: 0 };
    let platform = await this.ctx.storage.get<any>('platform-usage');
    let analyticsError = '';
    if (
      this.env.CF_ANALYTICS_TOKEN &&
      (!platform || Date.now() - Date.parse(platform.at) > 60000)
    ) {
      try {
        platform = await platformUsage(this.env);
        if (platform) await this.ctx.storage.put('platform-usage', platform);
      } catch (e) {
        analyticsError = (e as Error).message;
      }
    }
    if (platform && platform.at.slice(0, 10) === new Date().toISOString().slice(0, 10))
      Object.assign(usage, platform);
    const size = await this.env.DB.prepare('SELECT 1').all();
    usage.storageBytes = Number(size.meta.size_after || 0);
    const assets = await this.env.DB.prepare(
      "SELECT value_json FROM rollout_state WHERE key='assets'",
    ).first<any>();
    if (assets) {
      const a = JSON.parse(assets.value_json);
      usage.staticFiles = a.files;
      usage.maxAssetBytes = a.maxBytes;
    }

    return {
      at: new Date(now).toISOString(),
      active,
      claimsPerMinute: totals.claims / 5,
      strikesPerMinute: totals.strikes / 5,
      filesCompleted: totals.completed,
      errors: totals.errors,
      turnstileFailureRate: totals.verifications
        ? totals.verificationFailures / totals.verifications
        : 0,
      minutes,
      usage,
      limits: freeLimits,
      analyticsError,
      usageNote: platform
        ? 'Account-wide Cloudflare analytics; may lag by several minutes. Storage is this database.'
        : 'Measured API usage since this release. Excludes static Pages traffic, edge cache hits, external D1 jobs and other Workers. Check account totals in Cloudflare.',
      feedback: (
        await this.env.DB.prepare(
          'SELECT id,text,created_at FROM feedback ORDER BY created_at DESC LIMIT 30',
        ).all()
      ).results,
    };
  }
  async monitor() {
    const deliveries: { type: string; status: number }[] = [];
    const stats = await this.liveStats();
    const alerts = alertConditions(stats.minutes, stats.usage);
    const now = Date.now(),
      at =
        this.env.STAGING === 'true'
          ? Date.parse(
              (
                await this.env.DB.prepare(
                  "SELECT drop_at FROM categories WHERE id='practice' AND status='approved'",
                ).first<any>()
              )?.drop_at || '',
            )
          : Date.parse(dropAt(registryDate()));
    if (now >= at && now < at + 120000) {
      const g = await current(this.env);
      alerts.push({
        type: g ? 'drop-live' : 'drop-missing',
        message: g ? 'Dibs: Drop is live.' : 'Dibs: the scheduled drop failed to open.',
      });
    }
    const thresholdTypes = new Set(
      alerts.filter((a) => /-0\.[79]$/.test(a.type)).map((a) => a.type),
    );
    for (const [key] of await this.ctx.storage.list({ prefix: 'threshold-sent:' }))
      if (!thresholdTypes.has(key.slice('threshold-sent:'.length)))
        await this.ctx.storage.delete(key);
    for (const alert of alerts) {
      const threshold = thresholdTypes.has(alert.type);
      if (threshold && (await this.ctx.storage.get('threshold-sent:' + alert.type))) continue;
      const key = 'alert:' + alert.type;
      const previous = (await this.ctx.storage.get<number>(key)) || 0;
      if (
        Date.now() - previous < 1800000 ||
        !this.env.NTFY_TOPIC ||
        (this.env.STAGING === 'true' && alert.type !== 'drop-live')
      )
        continue;
      const response = await fetch('https://ntfy.sh/' + encodeURIComponent(this.env.NTFY_TOPIC), {
        method: 'POST',
        body: (this.env.STAGING === 'true' ? 'Practice rehearsal — ' : '') + alert.message,
        headers: { Title: 'Dibs office', Priority: 'high' },
      });
      deliveries.push({ type: alert.type, status: response.status });
      await this.ctx.storage.put('last-notification', {
        at: new Date().toISOString(),
        type: alert.type,
        status: response.status,
        retryAfter: response.headers.get('retry-after'),
        rateLimit: response.headers.get('ratelimit'),
        error: response.ok ? null : ((await response.json().catch(() => ({}))) as any).error,
      });
      if (response.ok) {
        await this.ctx.storage.put(key, Date.now());
        if (threshold) await this.ctx.storage.put('threshold-sent:' + alert.type, true);
      }
    }
    for (const [key] of await this.ctx.storage.list({
      prefix: 'metric:',
      end: 'metric:' + Math.floor((Date.now() - 86400000) / 60000),
    }))
      await this.ctx.storage.delete(key);
    for (const [key, at] of await this.ctx.storage.list<number>({ prefix: 'active:' }))
      if (at < Date.now() - 300000) await this.ctx.storage.delete(key);
    return json({
      ok: true,
      deliveries,
      lastNotification: await this.ctx.storage.get('last-notification'),
    });
  }
  async fetch(req: Request): Promise<Response> {
    const started = Date.now();
    const meter = metered(this.env.DB);
    const env = { ...this.env, DB: meter.db };
    let response: Response;
    try {
      const closed = await this.ctx.storage.get<{ until: number; body: any }>('quota-closed');
      if (closed && closed.until > Date.now()) response = json(closed.body, 503);
      else {
        const path = new URL(req.url).pathname;
        let uid = await cookieUser(req, env.COOKIE_SECRET);
        if (path.endsWith('/delete-file') && req.method === 'POST') {
          const b = await body(req.clone() as Request, 3000);
          if (b.key)
            uid =
              (
                await env.DB.prepare('SELECT user_id FROM recovery_keys WHERE key_hash=?')
                  .bind(await hmac(normalizeFileKey(String(b.key)), env.COOKIE_SECRET))
                  .first<any>()
              )?.user_id || uid;
        }
        if (uid && /\/(claim|delete-file)$/.test(path)) {
          const previous = this.mutations.get(uid) || Promise.resolve();
          const task = previous.catch(() => {}).then(() => this.dispatch(req, env));
          this.mutations.set(uid, task);
          try {
            response = await task;
          } finally {
            if (this.mutations.get(uid) === task) this.mutations.delete(uid);
          }
        } else response = await this.dispatch(req, env);
      }
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
    if (response.status !== 101) {
      this.ctx.waitUntil(this.recordMetric(req, response.clone() as Response, meter.totals));
      response = new Response(response.body, response);
      response.headers.set('server-timing', `worker;dur=${Date.now() - started}`);
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
      pair[1].serializeAttachment({ uid: await cookieUser(req, env.COOKIE_SECRET), at: 0 });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (path === '/bootstrap' || path === '/me') {
      const snapshot = await this.fresh(env);
      const { session, cookie } = await this.session(req, true);
      if (session && snapshot.category && (session.attempts.length || session.claim)) {
        session.file = await fileState(env, snapshot.category.id, session.user.id);
        session.claim = session.file.claims.at(-1) || null;
      }
      if (session) await this.ensureSummary(session);
      const data =
        path === '/me'
          ? this.me(session)
          : {
              today: this.today(snapshot, !!session?.file?.closed),
              me: this.me(session),
              rows: session?.file?.closed ? snapshot.rows.slice(0, 50) : [],
              version: snapshot.version,
            };
      return json(data, 200, cookie ? { 'set-cookie': cookie } : {});
    }
    if (path === '/today') {
      const snapshot = await this.fresh(env);
      const { session } = await this.session(req);
      return json(
        this.today(
          snapshot,
          session?.file?.category_id === snapshot.category?.id && session?.file?.closed,
        ),
      );
    }
    if (path === '/ledger') {
      const s = await this.fresh(env),
        category = url.searchParams.get('category');
      const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
      const g =
        s.category?.id === category
          ? s.category
          : await env.DB.prepare('SELECT id,date FROM categories WHERE id=?')
              .bind(category || '')
              .first();
      if (!(await canReveal(req, env, g))) return json({ rows: [], locked: true });
      if (s.category?.id === category)
        return json({ rows: s.rows.filter((r) => r.claim_no > since) });
      const r = await this.cached('ledger:' + category, 600000, () =>
        route(
          new Request(url.origin + '/api/ledger?category=' + encodeURIComponent(category || ''), {
            headers: req.headers,
          }),
          env,
        ),
      );
      if (!r.ok) return r;
      return json({ rows: ((await r.json()) as any).rows.filter((r: any) => r.claim_no > since) });
    }
    if (path === '/archive')
      return this.cached(
        'archive:' + registryDate() + ':' + (url.searchParams.get('id') || 'latest'),
        600000,
        () => route(req, env),
      );
    if (path.startsWith('/summary/') && req.method === 'GET') {
      const cached = await this.cached('summary:' + path.slice(9), 10000, () =>
        this.summary(path.slice(9), env),
      );
      if (!cached.ok) return cached;
      const data: any = await cached.json();
      return json(
        (await canReveal(req, env, data.category))
          ? { ...data, category: publicCategory(data.category), nextDrop: nextDrop() }
          : concealSummary(data),
      );
    }
    if (path.startsWith('/certificate/')) {
      // Cache only the unredacted record internally; viewer policy is applied on every read.
      const cached = await this.cached('certificate:' + path.slice(13), 86400000, () =>
        route(req, { ...env, INTERNAL_RECORD: true }),
      );
      if (!cached.ok) return cached;
      const data: any = await cached.json();
      const g = { id: data.claim.category_id, date: data.claim.category_date };
      return json({
        claim: (await canReveal(req, env, g)) ? data.claim : concealClaim(data.claim),
      });
    }
    if (path === '/og' || path.startsWith('/og/')) return this.image(path.slice(4), env);
    if (path === '/answers') return json({ answers: [] }); // Suggestions are a versioned Pages asset.
    if (path.startsWith('/admin/')) {
      const valid =
        !!env.ADMIN_TOKEN &&
        (await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN));
      const denied = await this.rateGate(req, env, true, valid);
      if (denied) return denied;
      if (path.startsWith('/admin/schedule')) {
        const operation = this.calendarQueue.then(() => calendarRoute(req, env, path));
        this.calendarQueue = operation.catch(() => undefined);
        const response = await operation;
        if (response.ok && req.method === 'POST') {
          this.snapshot = undefined;
          await this.ctx.storage.delete('snapshot');
        }
        return response;
      }
      if (path === '/admin/live' && req.method === 'GET') return json(await this.liveStats());
      if (path === '/admin/monitor' && req.method === 'POST') return this.monitor();
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
      if (response.ok && path === '/admin/practice-reset' && env.STAGING === 'true') {
        await this.ctx.storage.deleteAll();
        this.snapshot = undefined;
        for (const ws of this.ctx.getWebSockets()) ws.close(1012, 'Practice reset');
      }
      if (response.ok && path === '/admin/set-founder') {
        // Role changes must also refresh boards, sessions, certificate and image caches.
        const founder = await env.DB.prepare('SELECT user_id,name FROM founder_role').first<any>();
        for (const [key, board] of await this.ctx.storage.list<any[]>({ prefix: 'board:' })) {
          for (const row of board) {
            row.founder = row.user_id === founder.user_id;
            const user = await env.DB.prepare('SELECT handle FROM users WHERE id=?')
              .bind(row.user_id)
              .first<any>();
            row.handle = row.founder ? founder.name : user?.handle || row.handle;
          }
          await this.ctx.storage.put(key, board);
        }
      }
      if (response.ok && req.method === 'POST') {
        await this.ctx.storage.put(
          'version',
          ((await this.ctx.storage.get<number>('version')) || 0) + 1,
        );
        this.snapshot = undefined;
        await this.ctx.storage.delete('snapshot');
        const keys = await this.ctx.storage.list({ prefix: 'cache:' });
        await this.ctx.storage.delete([...keys.keys()]);
        if (
          path.endsWith('hide-user') ||
          path.endsWith('void-claim') ||
          path === '/admin/practice-reset' ||
          path === '/admin/set-founder'
        ) {
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
        data.missing = (
          await env.DB.prepare(
            "SELECT day,category_id,answer,count FROM missing_answers WHERE day>=date('now','-90 day') ORDER BY day DESC,count DESC LIMIT 500",
          ).all()
        ).results;
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
    if (path === '/delete-file' && req.method === 'POST') {
      const denied = await this.rateGate(req, env, false, true);
      if (denied) return denied;
      const b = await body(req, 3000);
      if (b.confirm !== 'DELETE MY FILE')
        return json({ message: 'Confirm that you want to permanently remove your file.' }, 422);
      if (!(await verifyChallenge(req, env, b.turnstileToken)))
        return json({ message: 'Please complete verification.' }, 400);
      let uid = (await this.session(req)).session?.user.id;
      if (b.key)
        uid = (
          await env.DB.prepare('SELECT user_id FROM recovery_keys WHERE key_hash=?')
            .bind(await hmac(normalizeFileKey(String(b.key)), env.COOKIE_SECRET))
            .first<any>()
        )?.user_id;
      if (!uid) return json({ message: 'Restore your file or enter its file key first.' }, 401);
      const replacements = await withdraw(env, uid);
      await this.ctx.storage.delete('session:' + uid);
      await this.ctx.storage.delete('active:' + uid);
      for (const [key, ref] of await this.ctx.storage.list<any>({ prefix: 'summary:' })) {
        if (ref.user === uid)
          await this.ctx.storage.put(key, { ...ref, user: replacements.get(ref.category) });
      }
      for (const [key, board] of await this.ctx.storage.list<any[]>({ prefix: 'board:' })) {
        await this.ctx.storage.put(
          key,
          board.filter((r) => r.user_id !== uid),
        );
      }
      // Other players may have a cached strike naming this holder. Re-read their
      // file on the next bootstrap; never leave the deleted handle in a cache.
      for (const [key, other] of await this.ctx.storage.list<Session>({ prefix: 'session:' })) {
        if (other.file) {
          other.file = await fileState(env, other.file.category_id, other.user.id);
          await this.ctx.storage.put(key, other);
        }
      }
      for (const prefix of ['cache:', 'image:', 'image-expiry:']) {
        const keys = await this.ctx.storage.list({ prefix });
        if (keys.size) await this.ctx.storage.delete([...keys.keys()]);
      }
      await this.ctx.storage.put('image-bytes', 0);
      if (env.IMAGE_CACHE)
        await Promise.all(
          Array.from({ length: 8 }, (_, i) =>
            env
              .IMAGE_CACHE!.get(env.IMAGE_CACHE!.idFromName('images-' + i))
              .fetch(new Request('https://images/invalidate', { method: 'POST' })),
          ),
        );
      await this.ctx.storage.put(
        'version',
        ((await this.ctx.storage.get<number>('version')) || 0) + 1,
      );
      this.snapshot = undefined;
      await this.ctx.storage.delete('snapshot');
      for (const ws of this.ctx.getWebSockets()) ws.close(1012, 'The public record was updated');
      return json(
        { ok: true, message: 'Your file is removed. Past claims now belong to Withdrawn filer.' },
        200,
        {
          'set-cookie':
            'dibs_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' +
            (isLocal(req, env.LOCAL_TEST) ? '' : '; Secure'),
        },
      );
    }
    if (path === '/recover' && req.method === 'POST') {
      const denied = await this.rateGate(req, env, false, true);
      if (denied) return denied;
      const b = await body(req, 200);
      const key = normalizeFileKey(String(b.key || ''));
      // Per-network five entries / 15 minutes, independent of a new browser cookie.
      const rate = 'recover:' + (await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST));
      const allowed = await this.ctx.storage.transaction(async (tx) => {
        let r = await tx.get<any>(rate);
        if (!r || r.until < Date.now()) r = { n: 0, until: Date.now() + 900000 };
        r.n++;
        await tx.put(rate, r);
        return r.n <= 5;
      });
      if (!allowed)
        return json({ message: 'Give the clerk 15 minutes before trying another key.' }, 429);
      const hash = await hmac(key, env.COOKIE_SECRET);
      const found = await env.DB.prepare('SELECT user_id FROM recovery_keys WHERE key_hash=?')
        .bind(hash)
        .first<any>();
      if (!found) return json({ message: 'That file key was not found.' }, 422);
      return json({ ok: true }, 200, {
        'set-cookie': await sessionCookie(
          found.user_id,
          env.COOKIE_SECRET,
          isLocal(req, env.LOCAL_TEST),
        ),
      });
    }
    const { session } = await this.session(req);
    if (!session) {
      // A cookie that survived the browser but lost its server file is not blocked storage.
      // Replace it and retry the original request once; nothing has been charged yet.
      if (/(?:^|;\s*)dibs_session=/.test(req.headers.get('cookie') || '')) {
        const fresh = await this.session(req, true);
        const headers = new Headers(req.headers);
        headers.set('cookie', fresh.cookie.split(';')[0]);
        const result = await this.dispatch(new Request(req, { headers }), env);
        const data = (await result.json()) as any;
        return json(
          {
            ...data,
            sessionNotice:
              env.STAGING === 'true'
                ? 'Practice was reset. You have a fresh file.'
                : 'You have a fresh file. Have a file key? Restore it.',
          },
          result.status,
          { 'set-cookie': fresh.cookie },
        );
      }
      return json(
        {
          code: 'COOKIES_BLOCKED',
          message: 'Cookies are required to keep your place. Tap the menu, then Open in browser.',
        },
        401,
      );
    }
    if (session.user.hidden)
      return json({ message: 'This account is not accepting new filings.' }, 403);
    if (req.method !== 'POST') return json({ message: 'No file at this address.' }, 404);
    if (path === '/session-check') return json({ ok: true });
    if (path === '/verify-session') {
      const denied = await this.rateGate(req, env, false, true);
      if (denied) return denied;
      const b = await body(req, 3000);
      if (!(await verifyChallenge(req, env, b.turnstileToken)))
        return json({ message: 'Verification was not accepted. Please try again.' }, 400);
      return json(await verificationToken(req, env, session.user.id));
    }
    if (path === '/me/reroll') {
      if (session.claim || session.user.rerolls_used >= 3)
        return json({ message: 'This handle has been filed. Re-rolls are closed.' }, 403);
      const nextHandle = await this.newHandle();
      // Serialize this small state mutation so simultaneous rerolls cannot exceed three.
      return this.ctx.blockConcurrencyWhile(async () => {
        const latest = (await this.ctx.storage.get<Session>('session:' + session.user.id))!;
        if (latest.claim || latest.user.rerolls_used >= 3)
          return json({ message: 'This handle has been filed. Re-rolls are closed.' }, 403);
        latest.user.handle = nextHandle;
        latest.user.rerolls_used++;
        await this.ctx.storage.put('session:' + latest.user.id, latest);
        return json({ user: latest.user });
      });
    }
    if (path === '/feedback') {
      const b = await body(req, 4000);
      if (
        typeof b.text !== 'string' ||
        !b.text.trim() ||
        b.text.length > (b.topic === 'privacy' ? 482 : 500)
      )
        return json({ message: 'Write up to 500 characters.' }, 422);
      if (
        !(await verifiedSession(req, env, session.user.id, b.sessionToken)) &&
        !(await verifyChallenge(req, env, b.turnstileToken))
      )
        return json({ message: 'Please complete verification.' }, 400);
      const key = 'feedback-rate:' + (await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST));
      const allowed = await this.ctx.storage.transaction(async (tx) => {
        const r = await tx.get<any>(key);
        if (r && r.until > Date.now() && r.count >= 3) return false;
        await tx.put(key, {
          until: r?.until > Date.now() ? r.until : Date.now() + 3600000,
          count: r?.until > Date.now() ? r.count + 1 : 1,
        });
        return true;
      });
      if (!allowed)
        return json({ message: 'The clerk has your notes. Try again in an hour.' }, 429);
      await env.DB.prepare('INSERT INTO feedback(id,user_id,text,created_at) VALUES(?,?,?,?)')
        .bind(
          crypto.randomUUID(),
          session.user.id,
          (b.topic === 'privacy' ? 'Privacy question: ' : '') + b.text.trim(),
          new Date().toISOString(),
        )
        .run();
      return json({ ok: true, message: 'The clerk has your note.' });
    }
    if (path === '/missing' && req.method === 'POST') {
      const denied = await this.rateGate(req, env, false, true);
      if (denied) return denied;
      const b = await body(req, 300);
      const category = await current(env);
      if (
        !category ||
        typeof b.answer !== 'string' ||
        b.answer.length > 120 ||
        Object.keys(b).some((k) => k !== 'answer')
      )
        return json({ message: 'Only the answer can be submitted.' }, 422);
      const answer = normalize(b.answer);
      if (!answer) return json({ message: 'Enter an answer first.' }, 422);
      const day = registryDate();
      const rate =
        'missing-rate:' + day + ':' + (await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST));
      const allowed = await this.ctx.storage.transaction(async (tx) => {
        const n = (await tx.get<number>(rate)) || 0;
        if (n >= 10) return false;
        await tx.put(rate, n + 1);
        return true;
      });
      if (!allowed) return json({ message: 'The clerk has your suggestions for today.' }, 429);
      await env.DB.prepare(
        'INSERT INTO missing_answers(day,category_id,answer) VALUES(?,?,?) ON CONFLICT(day,category_id,answer) DO UPDATE SET count=count+1',
      )
        .bind(day, category.id, answer)
        .run();
      return json({ ok: true, message: 'Submitted to the clerk. No strike charged.' });
    }
    if (path === '/claim') {
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
        if (this.snapshot) this.snapshot.checkedAt = 0;
        // Read authoritative D1 progress after every mutation. Concurrent requests cannot
        // overwrite session progress with an older response.
        await this.ctx.blockConcurrencyWhile(async () => {
          const latest = (await this.ctx.storage.get<Session>('session:' + session.user.id))!;
          // The claim route reads the authoritative file after committing. Never replace
          // a newer concurrent response with an older file; avoid reading the same file twice.
          if (
            !latest.file ||
            latest.file.category_id !== data.file.category_id ||
            latest.file.dibs + latest.file.strikes <= data.file.dibs + data.file.strikes
          )
            latest.file = data.file;
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
          await this.ensureSummary(latest);
          if (latest.file?.closed) {
            const key = 'board:' + latest.file.category_id;
            const board = (await this.ctx.storage.get<any[]>(key)) || [];
            const updated = [
              ...board.filter((r) => r.user_id !== latest.user.id),
              {
                user_id: latest.user.id,
                handle: latest.file.handle || latest.user.handle,
                founder: !!latest.file.founder,
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
        let recoveryKey: string | undefined;
        if (data.claim && session.file?.dibs === 1) {
          recoveryKey = await fileKey(session.user.id, env.COOKIE_SECRET);
          const issued = await env.DB.prepare(
            'INSERT OR IGNORE INTO recovery_keys(key_hash,user_id,created_at) VALUES(?,?,?)',
          )
            .bind(
              await hmac(normalizeFileKey(recoveryKey), env.COOKIE_SECRET),
              session.user.id,
              new Date().toISOString(),
            )
            .run();
          if (!issued.meta.changes && !data.replayed) recoveryKey = undefined;
        }
        return json(
          { ...data, recoveryKey, file: session.file, me: this.me(session) },
          response.status,
        );
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
      const previous = ws.deserializeAttachment() as { at: number; uid?: string } | null;
      if (previous && Date.now() - previous.at < 10000) return;
      ws.serializeAttachment({ ...previous, at: Date.now() });
      const closed = await this.ctx.storage.get<{ until: number; body: any }>('quota-closed');
      if (closed && closed.until > Date.now()) {
        ws.send(JSON.stringify({ error: closed.body }));
        return;
      }
      const s = await this.fresh(this.env);
      const viewer = previous?.uid
        ? await this.ctx.storage.get<Session>('session:' + previous.uid)
        : undefined;
      const reveal = viewer?.file?.category_id === s.category?.id && viewer?.file?.closed;
      const same = b.category === s.category?.id && (b.version || 0) === (s.version || 0);
      ws.send(
        JSON.stringify({
          today: this.today(s, reveal),
          rows: reveal ? s.rows.filter((r) => !same || r.claim_no > (Number(b.since) || 0)) : [],
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
