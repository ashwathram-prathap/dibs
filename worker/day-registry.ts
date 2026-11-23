import { DurableObject } from 'cloudflare:workers';
import { EventJournal, type JournalFile } from './event-journal';
import { current, json, body, fileState, publicClaim, safeError, type Env } from './routes';
import {
  cookieUser,
  sessionCookie,
  handle,
  fileKey,
  normalizeFileKey,
  constantEqual,
} from './identity';
import { registryDate, streak, normalize, nextDrop, dropAt } from './domain';
import { MAX_CLAIMS, MAX_STRIKES, LAUNCH_DATE, PUBLIC_ORIGIN } from '../shared/config';
import { catalogMeta, lookup, answerId, nearMiss } from './catalog';
import { scoreAnswer, scoreFile } from './scoring';
import { verifyChallenge, verificationToken, verifiedSession } from './turnstile';
import { dayClosed, publicCategory, concealClaim, concealSummary } from './visibility';
import { specialStatus, closeAt } from './specials';
import { publicScores, orderScores } from './leaderboard';
import { clerkReply } from '../shared/moments';
import { originFailure, isLocal, validText } from '../shared/security';
import { metered } from './metrics';

// Exactly one instance per category/day. A synchronous ownership decision + SQLite
// append precede the first await; storage.sync and the output gate precede replies.
export class DayRegistry extends DurableObject<Env> {
  private category: any;
  private specials: any;
  private journal?: EventJournal;
  private ready?: Promise<void>;
  private users = new Map<string, any>();
  private owners = new Map<string, any>();
  private attempts = new Map<string, number[]>();
  private golden = new Set<string>();
  private legacy = new Map<string, JournalFile>();
  private claims = 0;
  private nextCheck = 0;
  private verified = new Map<string, any>();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  private async init(env: Env) {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.category = await current(env);
      if (!this.category) {
        this.nextCheck = Date.now() + 5000;
        return;
      }
      this.specials = await specialStatus(env, this.category);
      const special = await env.DB.prepare(
        'SELECT golden_json FROM daily_specials WHERE category_id=?',
      )
        .bind(this.category.id)
        .first<any>();
      this.golden = new Set(JSON.parse(special?.golden_json || '[]'));
      this.journal = new EventJournal(this.ctx.storage, env, this.category.id);
      // Import R16 progress read-only. Original rows are never rewritten or deleted.
      const old = (
        await env.DB.prepare(
          'SELECT DISTINCT user_id FROM claims WHERE category_id=? UNION SELECT DISTINCT user_id FROM strikes WHERE category_id=?',
        )
          .bind(this.category.id, this.category.id)
          .all<any>()
      ).results;
      for (const { user_id } of old) {
        if (this.journal.files.has(user_id)) continue;
        const user = await env.DB.prepare(
          'SELECT id,handle,rerolls_used,hidden FROM users WHERE id=?',
        )
          .bind(user_id)
          .first<any>();
        if (!user) continue;
        const file = await fileState(env, this.category.id, user_id);
        const dates = (
          await env.DB.prepare(
            'SELECT DISTINCT g.date FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=? AND c.voided=0 ORDER BY g.date DESC LIMIT 370',
          )
            .bind(user_id)
            .all<any>()
        ).results.map((r) => r.date);
        this.legacy.set(user_id, { user, file, streakDates: dates, requests: {} });
      }
      this.rebuild();
      // One alarm per minute, shared by the whole category, including after eviction.
      if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 45000);
    })().catch((e) => {
      this.ready = undefined;
      throw e;
    });
    return this.ready;
  }
  private all() {
    return new Map([...this.legacy, ...(this.journal?.files || [])]);
  }
  private rebuild() {
    this.owners.clear();
    this.claims = 0;
    for (const state of this.all().values()) {
      this.users.set(state.user.id, state.user);
      for (const claim of state.file.claims) {
        this.owners.set(claim.answer_id || claim.display.toLowerCase(), {
          ...claim,
          user_id: state.user.id,
        });
        this.claims = Math.max(this.claims, claim.claim_no);
      }
    }
  }
  private board(uid?: string) {
    const rows = [...this.all().values()]
      .filter((s) => !s.user.hidden && s.file.eligible !== false)
      .map((s) => ({
        user_id: s.user.id,
        handle: s.user.handle,
        founder: !!s.user.founder,
        points: s.file.points,
        dibs: s.file.dibs,
        golden: s.file.golden,
        reachedAt: s.file.reachedAt,
        events: s.file.events.length,
      }));
    return publicScores(orderScores(rows), uid);
  }
  private state(uid: string): JournalFile | undefined {
    return this.journal?.files.get(uid) || this.legacy.get(uid);
  }
  private presentFile(state: JournalFile) {
    const board = this.board(state.user.id);
    return {
      ...state.file,
      handle: state.user.handle,
      founder: !!state.user.founder,
      rank: board.own?.rank || null,
      players: board.total,
      streak: streak(state.streakDates, this.category.date),
      revealed: dayClosed(this.category),
    };
  }
  private today() {
    const g = this.category,
      closed = dayClosed(g),
      rows = [...this.owners.values()].filter((c) => !c.voided);
    return {
      serverTime: new Date().toISOString(),
      category: publicCategory(g),
      specials: g
        ? {
            ...this.specials,
            houseWords: closed ? this.specials.houseWords : [],
            goldenFound: rows.filter((c) => c.golden).length,
          }
        : null,
      revealed: closed,
      closesAt: g ? closeAt(g) : null,
      practice: this.env.STAGING === 'true',
      claimed: rows.length,
      open: g ? g.total_registrable - this.claims - this.specials.houseCount : 0,
      voided: this.claims - rows.length,
      lastClaimAt: rows.at(-1)?.created_at || null,
      nextDrop: g ? nextDrop() : dropAt(LAUNCH_DATE),
      board: [],
      turnstileSiteKey: this.env.TURNSTILE_SITE_KEY,
    };
  }
  private async user(req: Request, env: Env, create = false) {
    let uid = await cookieUser(req, env.COOKIE_SECRET),
      cookie = '';
    if (uid && this.users.has(uid)) return { user: this.users.get(uid), cookie };
    let user: any;
    if (uid) {
      const saved = await env.DB.prepare('SELECT data FROM r17_players WHERE id=?')
        .bind(uid)
        .first<any>();
      user = saved
        ? JSON.parse(saved.data)
        : await env.DB.prepare('SELECT id,handle,rerolls_used,hidden FROM users WHERE id=?')
            .bind(uid)
            .first<any>();
    }
    if (!user && create) {
      uid = crypto.randomUUID();
      user = {
        id: uid,
        handle: handle() + ' #' + uid.slice(0, 8),
        rerolls_used: 0,
        hidden: 0,
        streakDates: [],
      };
      await env.DB.prepare('INSERT INTO r17_players(id,data) VALUES(?,?)')
        .bind(uid, JSON.stringify(user))
        .run();
      cookie = await sessionCookie(uid, env.COOKIE_SECRET, isLocal(req, env.LOCAL_TEST));
    }
    if (user) {
      user.streakDates ||= [];
      this.users.set(user.id, user);
    }
    return { user, cookie };
  }
  private me(user: any) {
    const s = user ? this.state(user.id) : undefined;
    return {
      user: user ? { id: user.id, handle: user.handle, rerolls_used: user.rerolls_used } : null,
      claim: s?.file.claims.at(-1) || null,
      file: s ? this.presentFile(s) : null,
      streakDates: s?.streakDates || user?.streakDates || [],
      streak: streak(
        s?.streakDates || user?.streakDates || [],
        this.category?.date || registryDate(),
      ),
    };
  }
  async fetch(req: Request) {
    const meter = metered(this.env.DB),
      env = { ...this.env, DB: meter.db };
    let response: Response;
    try {
      response = await this.dispatch(req, env);
    } catch (e) {
      response = safeError(e, env);
    }
    if (
      response.status !== 101 &&
      (env.LOCAL_TEST === 'true' ||
        (env.STAGING === 'true' &&
          (await constantEqual(
            req.headers.get('authorization') || '',
            'Bearer ' + env.ADMIN_TOKEN,
          ))))
    ) {
      response = new Response(response.body, response);
      response.headers.set('x-d1-rows-read', String(meter.totals.reads));
      response.headers.set('x-d1-rows-written', String(meter.totals.writes));
    }
    return response;
  }
  private async dispatch(req: Request, env: Env): Promise<Response> {
    const rejected = originFailure(req, isLocal(req, env.LOCAL_TEST));
    if (rejected) return rejected;
    if (!this.category && this.nextCheck && Date.now() >= this.nextCheck) this.ready = undefined;
    await this.init(env);
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api/, '');
    if (path === '/today') return json(this.today());
    if (path === '/bootstrap' || path === '/me') {
      const { user, cookie } = await this.user(req, env, true);
      return json(
        path === '/me'
          ? this.me(user)
          : {
              today: this.today(),
              me: this.me(user),
              leaderboard: this.board(user.id),
              rows: dayClosed(this.category)
                ? [...this.owners.values()].map(({ user_id, answer_id, ...c }) => c)
                : [],
              version: 17,
            },
        200,
        cookie ? { 'set-cookie': cookie } : {},
      );
    }
    if (path === '/leaderboard')
      return json({
        ...this.board((await cookieUser(req, env.COOKIE_SECRET)) || undefined),
        final: dayClosed(this.category),
      });
    if (path === '/ledger')
      return json({
        rows: dayClosed(this.category)
          ? [...this.owners.values()]
              .filter((c) => !c.voided)
              .map(({ user_id, answer_id, ...c }) => c)
          : [],
        locked: !dayClosed(this.category),
      });
    if (path === '/live') {
      if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return json({ message: 'A live connection is required.' }, 426);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({
        uid: await cookieUser(req, env.COOKIE_SECRET),
        day: registryDate(),
        diagnostic: env.LOCAL_TEST === 'true',
      });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (path.startsWith('/certificate/')) {
      const id = path.slice(13),
        claim = [...this.owners.values()].find((c) => c.id === id);
      if (!claim || claim.voided) return json({ message: 'Certificate not found.' }, 404);
      const uid = await cookieUser(req, env.COOKIE_SECRET),
        revealed = dayClosed(this.category),
        owned = uid === claim.user_id;
      const { user_id, answer_id, ...visible } = claim;
      return json({
        claim: revealed || owned ? { ...visible, revealed, owned } : concealClaim(visible),
      });
    }
    if (path.startsWith('/summary/')) {
      const s = [...this.all().values()].find((s) => s.file.summaryId === path.slice(9));
      if (!s) return json({ message: 'Results not found.' }, 404);
      const data = {
        file: this.presentFile(s),
        category: publicCategory(this.category),
        specials: this.today().specials,
        nextDrop: nextDrop(),
      };
      return json(dayClosed(this.category) ? data : concealSummary(data));
    }
    if (path === '/events/share' || path === '/events/arrival') return json({ ok: true }); // unused per-player analytics dropped
    if (
      path === '/admin/r17-flush' &&
      req.method === 'POST' &&
      (await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
    ) {
      await this.journal?.mirror();
      return json({
        ok: true,
        files: this.all().size,
        claims: this.owners.size,
        sequence: this.journal?.sequence,
      });
    }
    const { user } = await this.user(req, env);
    if (!user)
      return json(
        {
          code: 'COOKIES_BLOCKED',
          message: 'Cookies are required to keep your place. Open in browser.',
        },
        401,
      );
    if (user.hidden) return json({ message: 'This account is not accepting new filings.' }, 403);
    if (req.method !== 'POST') return json({ message: 'Page not found.' }, 404);
    if (path === '/session-check') return json({ ok: true });
    if (path === '/verify-session') {
      const previous = this.verified.get(user.id);
      if (previous && previous.expiresAt > Date.now()) return json(previous);
      const b = await body(req, 3000);
      if (!(await verifyChallenge(req, env, b.turnstileToken)))
        return json({ message: 'Verification failed; try again.' }, 400);
      const token = await verificationToken(req, env, user.id);
      this.verified.set(user.id, token);
      return json(token);
    }
    if (path === '/claim') return this.claim(req, env, user);
    return json({ message: 'Page not found.' }, 404);
  }
  private async claim(req: Request, env: Env, user: any): Promise<Response> {
    const b = await body(req),
      g = this.category;
    if (!g || !this.journal || dayClosed(g))
      return json({ message: 'The category is closed; check the opening time.' }, 422);
    if (!validText(b.answer)) return json({ message: 'Enter an answer.' }, 422);
    if (b.requestId !== undefined && !/^[a-f0-9-]{36}$/.test(b.requestId))
      return json({ message: 'A valid request ID is required.' }, 422);
    const requestId = b.requestId || crypto.randomUUID(),
      answer = normalize(b.answer);
    const replay = () => {
      const old = this.state(user.id)?.requests[requestId];
      if (!old) return null;
      return old.answer === answer
        ? json(
            { ...old.body, file: this.presentFile(this.state(user.id)!), replayed: true },
            old.status,
          )
        : json({ message: 'A request ID belongs to its original answer.' }, 422);
    };
    const repeated = replay();
    if (repeated) return repeated;
    const attempts = (this.attempts.get(user.id) || []).filter((t) => t > Date.now() - 60000);
    if (attempts.length >= 12)
      return json({ message: 'Too many attempts; wait a minute and try again.' }, 429);
    this.attempts.set(user.id, [...attempts, Date.now()]);
    if (
      b.sessionToken
        ? !(await verifiedSession(req, env, user.id, b.sessionToken))
        : !(await verifyChallenge(req, env, b.turnstileToken))
    )
      return json(
        { code: 'VERIFY_AGAIN', message: 'One quick verification, then try again.' },
        428,
      );
    const note = clerkReply(b.answer, g.name);
    if (note) return json({ code: 'CLERK_NOTE', message: note }, 422);
    const row = await lookup(g, b.answer);
    if (!row)
      return json(
        {
          code: 'NOT_REGISTERED',
          message: "Not on today's list. Check spelling.",
          suggestion: await nearMiss(g, b.answer),
          spellingCatalog: {
            slug: catalogMeta(g).slug,
            version: catalogMeta(g).version,
            rowChunkSize: catalogMeta(g).rowChunkSize,
          },
        },
        422,
      );
    const aid = answerId(g, row),
      score = await scoreAnswer(env, g, row[0], aid, this.golden.has(aid));
    // No await from this replay/ownership check through the durable INSERT.
    const again = replay();
    if (again) return again;
    const previous = this.state(user.id);
    if (previous?.file.closed)
      return json({ message: "You're done for today; see your certificate." }, 403);
    const state: JournalFile = previous
      ? structuredClone(previous)
      : {
          user: structuredClone(user),
          file: {
            category_id: g.id,
            claims: [],
            events: [],
            dibs: 0,
            strikes: 0,
            closed: false,
            eligible: true,
          },
          streakDates: [...(user.streakDates || [])],
          requests: {},
        };
    const file = state.file,
      at = new Date().toISOString(),
      holder = this.owners.get(aid) || this.owners.get(row[1].toLowerCase()),
      house = catalogMeta(g).house.some((r: any) => r[0] === row[0]);
    let status: number, result: any;
    if (holder || house) {
      file.strikes++;
      file.events.push({
        kind: 'strike',
        at,
        display: b.answer.trim().toUpperCase(),
        house,
        holder: house ? 'RESERVED' : holder.handle,
        holderFounder: !house && holder.founder,
        heldAt: holder?.created_at,
      });
      result = {
        house,
        takenBy: house ? 'RESERVED' : holder.handle,
        founder: !house && holder.founder,
        at: holder?.created_at,
      };
      status = 409;
    } else {
      const claim = {
        id: g.date + '-' + crypto.randomUUID(),
        category_id: g.id,
        category_slug: g.slug,
        category_name: g.name,
        category_date: g.date,
        answer_id: aid,
        claim_no: this.claims + 1,
        file_no: file.events.length + 1,
        created_at: at,
        display: row[1],
        obscurity: row[2] ?? null,
        handle: user.handle,
        founder: !!user.founder,
        total_registrable: g.total_registrable - this.specials.houseCount,
        ...score,
        golden: score.bonus === 100,
        voided: 0,
      };
      file.claims.push(claim);
      file.dibs++;
      file.events.push({
        kind: 'dibs',
        at,
        display: claim.display,
        claimId: claim.id,
        points: claim.points,
        golden: claim.golden,
        obscurity: claim.obscurity,
      });
      state.streakDates = [...new Set([g.date, ...state.streakDates])].slice(0, 370);
      result = { claim };
      status = 201;
    }
    Object.assign(file, scoreFile(file.events));
    file.golden = file.claims.some((c: any) => c.golden);
    file.closed = file.dibs >= MAX_CLAIMS || file.strikes >= MAX_STRIKES;
    file.completedAt = file.closed ? at : null;
    // Random first-event id doubles as the unguessable summary reference, stable on replay.
    file.summaryId ||= g.date + '-' + crypto.randomUUID();
    state.requests[requestId] = { answer, status, body: result };
    this.journal.append(state);
    this.rebuild();
    await this.journal.durable();
    const saved = this.state(user.id)!;
    const response = {
      ...result,
      file: this.presentFile(saved),
      me: this.me(user),
      leaderboard: this.board(user.id),
      ...(status === 201 && file.dibs === 1
        ? { recoveryKey: await fileKey(user.id, env.COOKIE_SECRET) }
        : {}),
    };
    this.push();
    return json(response, status);
  }
  private push() {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as any;
      try {
        ws.send(
          JSON.stringify({
            today: this.today(),
            leaderboard: this.board(a?.uid),
            rows: [],
            version: 17,
            reset: true,
          }),
        );
      } catch {}
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      if (typeof message !== 'string' || message.length > 4096)
        return ws.close(1009, 'Small forms only');
      const b = JSON.parse(message),
        a = ws.deserializeAttachment() as any;
      if (b.rpc) {
        if (
          !a?.uid ||
          a.day !== registryDate() ||
          !['/claim', '/verify-session', '/events/share'].includes(b.path) ||
          !/^[a-f0-9-]{36}$/.test(b.rpc)
        )
          return ws.close(1008, 'Reconnect');
        const req = new Request(
          (this.env.LOCAL_TEST === 'true' ? 'http://localhost' : PUBLIC_ORIGIN) + '/api' + b.path,
          {
            method: 'POST',
            headers: {
              origin: PUBLIC_ORIGIN,
              'content-type': 'application/json',
              cookie: (await sessionCookie(a.uid, this.env.COOKIE_SECRET)).split(';')[0],
            },
            body: JSON.stringify(b.body),
          },
        );
        const meter = metered(this.env.DB);
        const r = await this.dispatch(req, { ...this.env, DB: meter.db });
        ws.send(
          JSON.stringify({
            rpc: b.rpc,
            status: r.status,
            body: await r.json(),
            ...(a.diagnostic ? { d1: meter.totals } : {}),
          }),
        );
      } else {
        await this.init(this.env);
        ws.send(
          JSON.stringify({
            today: this.today(),
            me: this.me(this.users.get(a?.uid)),
            leaderboard: this.board(a?.uid),
            rows: [],
            version: 17,
            reset: true,
          }),
        );
      }
    } catch (e) {
      ws.send(JSON.stringify({ error: { message: 'Please reconnect and try again.' } }));
    }
  }
  webSocketClose(ws: WebSocket, code: number) {
    ws.close([1005, 1006, 1015].includes(code) ? 1000 : code);
  }
  async alarm() {
    await this.init(this.env);
    await this.journal?.mirror();
    if (!dayClosed(this.category)) await this.ctx.storage.setAlarm(Date.now() + 45000);
  }
}
