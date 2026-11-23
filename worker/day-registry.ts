import { resolveCertificate } from '../shared/certificate-id';
import { credentialGate } from './credential-gate';
import { cleanHandle, cleanStoredHandles, displayNames, playerNumber } from '../shared/handles';
import { finishedComparisons } from './finished-scores';
import { feedbackText, reserveFeedback } from './feedback';
import { pingIndexNow } from '../shared/indexnow';
import { backupCode } from './backup-code';
import { cluedId } from './clue';
import { og } from './og';
import { isPlatform } from '../shared/sharing';
import { securityKey, gate, type Gate, scheduleSecurityCleanup, expireSecurity } from './security';
import { withdraw } from './withdraw';
import { DurableObject } from 'cloudflare:workers';
import { EventJournal, type JournalFile } from './event-journal';
import { current, json, body, fileState, publicClaim, safeError, type Env } from './routes';
import {
  hmac,
  cookieUser,
  sessionCookie,
  handle,
  colors,
  animals,
  fileKey,
  normalizeFileKey,
  constantEqual,
} from './identity';
import { registryDate, streak, normalize, nextDrop, dropAt } from './domain';
import { MAX_CLAIMS, MAX_STRIKES, LAUNCH_DATE, PUBLIC_ORIGIN } from '../shared/config';
import { catalogMeta, lookup, answerId, nearMiss } from './catalog';
import { scoreAnswer, scoreFile } from './scoring';
import { verifyChallenge, verificationToken, verifiedSession } from './turnstile';
import {
  dayClosed,
  publicCategory,
  concealClaim,
  concealSummary,
  visibleClaim,
  publicSummary,
  publicSpecials,
  publicFile,
} from './visibility';
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
  private boardTop?: any[];
  private boardOwn = new Map<string, any>();
  private boardTotal = 0;
  private comparisons = finishedComparisons([]);
  private pushTimer?: ReturnType<typeof setTimeout>;
  private flushTimer?: ReturnType<typeof setInterval>;
  private nextCheck = 0;
  private nextOpening = dropAt(LAUNCH_DATE);
  private requestedDay?: string;
  private verified = new Map<string, any>();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  private async init(env: Env) {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.category =
        env.STAGING !== 'true' && this.requestedDay && this.requestedDay !== registryDate()
          ? await env.DB.prepare(
              "SELECT * FROM categories WHERE date=? AND status='approved' AND drop_at<=?",
            )
              .bind(this.requestedDay, new Date().toISOString())
              .first<any>()
          : await current(env);
      if (!this.category) {
        const next = await env.DB.prepare(
          "SELECT drop_at FROM categories WHERE status='approved' AND drop_at>? ORDER BY drop_at LIMIT 1",
        )
          .bind(new Date().toISOString())
          .first<any>();
        this.nextOpening = next?.drop_at || dropAt(LAUNCH_DATE);
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
      this.journal = new EventJournal(this.ctx.storage, env, this.category.id, this.category.date);
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
        if (file.claims[0]?.founder) {
          user.founder = true;
          user.handle = file.claims[0].handle;
        }
        const dates = (
          await env.DB.prepare(
            'SELECT DISTINCT g.date FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=? AND c.voided=0 ORDER BY g.date DESC LIMIT 370',
          )
            .bind(user_id)
            .all<any>()
        ).results.map((r) => r.date);
        const requests: JournalFile['requests'] = {};
        const accepted = (
          await env.DB.prepare(
            'SELECT id,request_id,request_answer FROM claims WHERE category_id=? AND user_id=? AND request_id IS NOT NULL',
          )
            .bind(this.category.id, user_id)
            .all<any>()
        ).results;
        for (const row of accepted) {
          const claim = file.claims.find((c: any) => c.id === row.id);
          if (claim)
            requests[row.request_id] = { answer: row.request_answer, status: 201, body: { claim } };
        }
        const rejected = (
          await env.DB.prepare(
            'SELECT request_id,request_answer,house,holder_claim_id FROM strikes WHERE category_id=? AND user_id=? AND request_id IS NOT NULL',
          )
            .bind(this.category.id, user_id)
            .all<any>()
        ).results;
        for (const row of rejected) {
          const holder = row.holder_claim_id
            ? await env.DB.prepare(publicClaim + ' AND c.id=?')
                .bind(row.holder_claim_id)
                .first<any>()
            : null;
          requests[row.request_id] = {
            answer: row.request_answer,
            status: 409,
            body: {
              house: !!row.house,
              takenBy: row.house ? 'RESERVED' : holder?.handle || 'Record withheld',
              founder: !row.house && !!holder?.founder,
            },
          };
        }
        this.legacy.set(user_id, cleanStoredHandles({ user, file, streakDates: dates, requests }));
      }
      this.rebuild();
      // Keep the single production day in memory until close. Otherwise idle
      // minute crons could repeatedly replay a 60k-event day after hibernation.
      // One 128-MB object for 24h is 11,059.2 GB-s, within the 13,000 free limit.
      // Practice stays hibernatable so it cannot consume a second full-day budget.
      if (
        env.STAGING !== 'true' &&
        env.LOCAL_TEST !== 'true' &&
        !dayClosed(this.category) &&
        !this.flushTimer
      )
        this.flushTimer = setInterval(
          () => this.ctx.waitUntil(this.flush(this.env).catch(() => {})),
          60000,
        );
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
    this.boardTop = undefined;
    this.owners.clear();
    this.claims = 0;
    for (const state of this.all().values()) {
      this.users.set(state.user.id, { ...state.user, streakDates: state.streakDates });
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
    if (!this.boardTop) {
      this.comparisons = finishedComparisons([...this.all().values()]);
      const rows = orderScores(
        [...this.all().values()]
          .filter((s) => !s.user.hidden && s.file.eligible !== false && s.file.dibs > 0)
          .map((s) => ({
            user_id: s.user.id,
            handle: s.user.handle,
            founder: !!s.user.founder,
            points: s.file.points,
            dibs: s.file.dibs,
            golden: s.file.golden,
            reachedAt: s.file.reachedAt,
            events: s.file.events.length,
          })),
      );
      this.boardTotal = rows.length;
      const names = displayNames(
        rows.map((r) => ({ id: r.user_id, handle: r.handle, founder: r.founder })),
      );
      for (const r of rows) r.handle = names.get(r.user_id)!;
      this.boardTop = publicScores(rows, undefined, 25, true).rows.map((r) => ({
        rank: r.rank,
        handle: r.handle,
        founder: r.founder,
        points: r.points,
        claims: r.claims,
        own: r.own,
        golden: r.golden,
      }));
      this.boardOwn = new Map(
        rows.map((r, i) => [
          r.user_id,
          {
            rank: i + 1,
            handle: r.handle,
            founder: r.founder,
            points: r.points,
            claims: r.dibs,
            golden: r.golden,
            own: true,
          },
        ]),
      );
    }
    const own = this.boardOwn.get(uid || '') || null;
    return {
      rows: this.boardTop.map((r) => ({ ...r, own: r.rank === own?.rank })),
      own,
      total: this.boardTotal,
      comparison: this.comparisons.own.get(uid || '') || this.comparisons.empty,
    };
  }
  private state(uid: string): JournalFile | undefined {
    return this.journal?.files.get(uid) || this.legacy.get(uid);
  }
  private presentFile(state: JournalFile) {
    const board = this.board(state.user.id);
    const ownNumber = playerNumber(state.user.id);
    const entries = [
      { name: cleanHandle(state.user.handle), number: ownNumber, founder: state.user.founder },
      ...state.file.events
        .filter((e: any) => e.holder && !e.house)
        .map((e: any) => ({
          name: cleanHandle(e.holder),
          number:
            e.holderNumber ||
            playerNumber(
              [...this.owners.values()].find(
                (c) => c.created_at === e.heldAt && cleanHandle(c.handle) === cleanHandle(e.holder),
              )?.user_id || e.holder,
            ),
          founder: e.holderFounder,
        })),
    ];
    const label = (name: string, number: number, founder: boolean) => {
      const base = cleanHandle(name);
      const ids = new Set(entries.filter((p) => p.name === base).map((p) => p.number));
      return !founder &&
        !['Withdrawn player', 'Record withheld', 'RESERVED'].includes(base) &&
        ids.size > 1
        ? `${base} #${number}`
        : base;
    };
    return {
      ...publicFile(state.file, dayClosed(this.category), true),
      events: state.file.events.map((e: any) =>
        e.holder
          ? {
              ...e,
              holder: label(
                e.holder,
                entries.find(
                  (p) =>
                    p.name === cleanHandle(e.holder) && p.number === (e.holderNumber || p.number),
                )?.number || playerNumber(e.holder),
                e.holderFounder,
              ),
            }
          : e,
      ),
      handle: label(state.user.handle, ownNumber, state.user.founder),
      founder: !!state.user.founder,
      rank: board.own?.rank || null,
      players: board.total,
      comparison: board.comparison,
      streak: streak(state.streakDates, this.category.date),
      revealed: dayClosed(this.category),
    };
  }
  private ledgerRows() {
    const rows = [...this.owners.values()].filter((c) => !c.voided);
    const names = displayNames(
      rows.map((c) => ({ id: c.user_id, handle: c.handle, founder: c.founder })),
    );
    return rows.map((c) => visibleClaim({ ...c, handle: names.get(c.user_id)! }, true));
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
            ...publicSpecials(this.specials, closed),
            houseWords: closed
              ? (catalogMeta(g)?.house || []).map((r: any) => ({
                  display: r[1],
                  handle: 'RESERVED',
                }))
              : [],
            clue: this.specials.clue
              ? {
                  text: this.specials.clue.text,
                  crackedBy:
                    rows.find(
                      (c) => c.answer_id === cluedId([...this.golden], this.specials.commitment),
                    )?.handle || this.specials.clue.crackedBy,
                }
              : null,
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
      nextDrop: g ? nextDrop() : this.nextOpening,
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
      const latest = await env.DB.prepare(
        'SELECT data FROM r17_files WHERE user_id=? ORDER BY day DESC LIMIT 1',
      )
        .bind(uid)
        .first<any>();
      const saved = await env.DB.prepare('SELECT data FROM r17_players WHERE id=?')
        .bind(uid)
        .first<any>();
      if (latest) {
        const state = JSON.parse(latest.data);
        user = { ...state.user, streakDates: state.streakDates };
      }
      if (saved)
        user = {
          ...user,
          ...JSON.parse(saved.data),
          streakDates: user?.streakDates || JSON.parse(saved.data).streakDates || [],
        };
      if (!user)
        user = await env.DB.prepare('SELECT id,handle,rerolls_used,hidden FROM users WHERE id=?')
          .bind(uid)
          .first<any>();
    }
    if (!user && (create || uid)) {
      const network = await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST);
      if (network && !uid) {
        await scheduleSecurityCleanup(this.ctx.storage);
        const allowed = await this.ctx.storage.transaction(async (tx) => {
          const key = 'security:identity:' + network;
          const old = await tx.get<{ count: number; expires: number }>(key);
          const value =
            old && old.expires > Date.now() ? old : { count: 0, expires: Date.now() + 600000 };
          if (value.count >= 120) return false;
          value.count++;
          await tx.put(key, value);
          return true;
        });
        if (!allowed) throw new Error('IDENTITY_LIMIT');
      }
      uid ||= crypto.randomUUID();
      const seed = parseInt(uid.replaceAll('-', '').slice(0, 8), 16);
      user = {
        id: uid,
        handle:
          colors[seed % colors.length] +
          ' ' +
          animals[Math.floor(seed / colors.length) % animals.length],
        rerolls_used: 0,
        hidden: 0,
        streakDates: [],
      };
      cookie = await sessionCookie(uid, env.COOKIE_SECRET, isLocal(req, env.LOCAL_TEST));
    }
    if (user) {
      user.handle = cleanHandle(user.handle);
      if (!user.streakDates)
        user.streakDates = (
          await env.DB.prepare(
            'SELECT DISTINCT g.date FROM claims c JOIN categories g ON g.id=c.category_id WHERE c.user_id=? AND c.voided=0 ORDER BY g.date DESC LIMIT 370',
          )
            .bind(user.id)
            .all<any>()
        ).results.map((r) => r.date);
      user.recoveryHash ||= await hmac(
        normalizeFileKey(await fileKey(user.id, env.COOKIE_SECRET)),
        env.COOKIE_SECRET,
      );
      const role = await env.DB.prepare('SELECT name FROM founder_role WHERE user_id=?')
        .bind(user.id)
        .first<any>();
      if (role) {
        user.handle = role.name;
        user.founder = true;
      }
      this.users.set(user.id, user);
    }
    return { user, cookie };
  }
  private me(user: any) {
    const s = user ? this.state(user.id) : undefined;
    return {
      user: user ? { id: user.id, handle: user.handle, rerolls_used: user.rerolls_used } : null,
      claim: s?.file.claims.at(-1)
        ? visibleClaim(s.file.claims.at(-1), dayClosed(this.category), true)
        : null,
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
      response = String(e).includes('IDENTITY_LIMIT')
        ? json(
            { message: 'Too many new players from this network; try again in a few minutes.' },
            429,
          )
        : safeError(e, env);
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
    const credentialDenied = await credentialGate(req, env);
    if (credentialDenied) return credentialDenied;
    const routePath = new URL(req.url).pathname.replace(/^\/api/, '');
    if (routePath.startsWith('/admin/')) {
      const valid =
        !!env.ADMIN_TOKEN &&
        (await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN));
      const network = await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST);
      const status = network
        ? await this.ctx.storage.transaction(async (tx) => {
            const key = 'security:admin:' + network;
            const result = gate(await tx.get<Gate>(key), Date.now(), valid, true);
            await tx.put(key, result.state);
            return result.status;
          })
        : valid
          ? 200
          : 404;
      await scheduleSecurityCleanup(this.ctx.storage);
      if (status !== 200) return json({ message: 'Not found.' }, status);
    }
    if (!this.category && this.nextCheck && Date.now() >= this.nextCheck) this.ready = undefined;
    this.requestedDay ||= req.headers.get('x-r17-day') || registryDate();
    await this.init(env);
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api/, '');
    if (path === '/admin/r17-moderate' && req.method === 'POST') {
      if (
        !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
      )
        return json({ message: 'Not found.' }, 404);
      const b = await body(req, 3000);
      if (b.uid) this.users.delete(b.uid);
      const selected = [...this.all().values()].filter(
        (s) => s.user.id === b.uid || s.file.claims.some((c: any) => c.id === b.claimId),
      );
      for (const state of selected) {
        if (!this.journal?.files.has(state.user.id)) this.journal?.append(state);
        const role = await env.DB.prepare('SELECT name FROM founder_role WHERE user_id=?')
          .bind(state.user.id)
          .first<any>();
        const identity = await env.DB.prepare('SELECT handle,hidden FROM users WHERE id=?')
          .bind(state.user.id)
          .first<any>();
        this.journal?.rewriteUser(state.user.id, (s) => {
          if (b.hide) s.user.hidden = 1;
          if (b.role) {
            s.user.handle = role?.name || identity?.handle || s.user.handle;
            s.user.founder = !!role;
          }
          s.file.claims = s.file.claims.map((c: any) => ({
            ...c,
            handle: s.user.hidden ? 'Record withheld' : s.user.handle,
            founder: !s.user.hidden && !!s.user.founder,
            voided: c.id === b.claimId ? 1 : c.voided,
          }));
          s.file.eligible = !s.user.hidden && !s.file.claims.some((c: any) => c.voided);
          s.requests = {};
          return s;
        });
      }
      await this.journal?.durable();
      await this.flush(env);
      this.rebuild();
      this.push();
      return json({ ok: true, changed: selected.length });
    }
    if (path === '/admin/r17-remove' && req.method === 'POST') {
      if (
        !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
      )
        return json({ message: 'Not found.' }, 404);
      const b = await body(req, 3000);
      await this.removeUser(String(b.uid), env);
      return json({ ok: true });
    }
    if (path === '/admin/r17-refresh' && req.method === 'POST') {
      if (
        env.STAGING !== 'true' ||
        !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
      )
        return json({ message: 'Not found.' }, 404);
      this.ready = undefined;
      this.category = undefined;
      this.journal = undefined;
      this.legacy.clear();
      this.users.clear();
      this.owners.clear();
      for (const ws of this.ctx.getWebSockets()) ws.close(1012, 'Practice schedule changed');
      return json({ ok: true });
    }
    if (path === '/admin/r17-reset' && req.method === 'POST') {
      if (
        env.STAGING !== 'true' ||
        !(await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
      )
        return json({ message: 'Not found.' }, 404);
      await this.ctx.storage.deleteAll();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM r17_files'),
        env.DB.prepare('DELETE FROM r17_players'),
        env.DB.prepare('DELETE FROM r17_boards'),
      ]);
      this.ready = undefined;
      this.journal = undefined;
      this.category = undefined;
      this.legacy.clear();
      this.users.clear();
      this.owners.clear();
      this.attempts.clear();
      for (const ws of this.ctx.getWebSockets()) ws.close(1012, 'Practice reset');
      return json({ ok: true });
    }
    if (path.startsWith('/og/')) {
      const summary = path.startsWith('/og/summary/'),
        id = path.slice(summary ? 12 : 4);
      if (summary) {
        const state = [...this.all().values()].find((s) => s.file.summaryId === id);
        if (!state) return json({ message: 'Not found.' }, 404);
        const data = { file: this.presentFile(state), category: publicCategory(this.category) };
        return og(null, publicSummary(data, dayClosed(this.category), !!state.file.shareAnswers));
      }
      const claim = resolveCertificate(this.owners.values(), id);
      if (!claim) return json({ message: 'Not found.' }, 404);
      const state = this.state(claim.user_id);
      return og(
        visibleClaim(
          claim,
          dayClosed(this.category),
          false,
          !!state?.file.sharedClaimIds?.includes(claim.id),
        ),
      );
    }
    if (path === '/backup-code' && req.method === 'GET') {
      const uid = await cookieUser(req, env.COOKIE_SECRET);
      return backupCode(req, env, uid ? this.state(uid)?.user.recoveryHash : undefined);
    }
    if (path === '/today') return json(this.today());
    if (path === '/bootstrap' || path === '/me') {
      const { user, cookie } = await this.user(req, env, !!this.category);
      return json(
        path === '/me'
          ? this.me(user)
          : {
              today: this.today(),
              me: this.me(user),
              leaderboard: this.board(user?.id),
              rows: dayClosed(this.category) ? this.ledgerRows() : [],
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
        rows: dayClosed(this.category) ? this.ledgerRows() : [],
        locked: !dayClosed(this.category),
      });
    if (path === '/live') {
      if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return json({ message: 'A live connection is required.' }, 426);
      const uid = await cookieUser(req, env.COOKIE_SECRET);
      const network = await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST);
      const active = this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment() as any);
      if (
        active.filter((a) => (uid ? a?.uid === uid : !a?.uid && a?.securityKey === network))
          .length >= (uid ? 8 : 4)
      )
        return json({ message: 'Too many live connections; close another tab and retry.' }, 429);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({
        uid,
        day: registryDate(),
        diagnostic: env.LOCAL_TEST === 'true',
        securityKey: network,
      });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (path.startsWith('/certificate/')) {
      const id = path.slice(13),
        claim = resolveCertificate(this.owners.values(), id);
      if (!claim || claim.voided) return json({ message: 'Certificate not found.' }, 404);
      const uid = await cookieUser(req, env.COOKIE_SECRET),
        revealed = dayClosed(this.category),
        owned = uid === claim.user_id;
      const state = this.state(claim.user_id);
      if (req.method === 'POST') {
        if (!owned || !state || !this.journal)
          return json({ message: 'Only the holder can share this answer.' }, 403);
        const choice = await body(req, 100);
        if (typeof choice.showAnswers !== 'boolean' || Object.keys(choice).length !== 1)
          return json({ message: 'Choose whether to show your answer.' }, 422);
        if (
          !!this.state(claim.user_id)?.file.sharedClaimIds?.includes(claim.id) ===
          choice.showAnswers
        )
          return json({ ok: true });
        const updated = structuredClone(this.state(claim.user_id)!);
        const ids = new Set<string>(updated.file.sharedClaimIds || []);
        choice.showAnswers ? ids.add(claim.id) : ids.delete(claim.id);
        updated.file.sharedClaimIds = [...ids];
        this.journal.append(updated);
        await this.journal.durable();
        return json({ ok: true });
      }
      const score = state ? publicFile(this.presentFile(state), false) : undefined;
      return json({
        claim: visibleClaim(
          claim,
          revealed,
          owned,
          !!state?.file.sharedClaimIds?.includes(claim.id),
        ),
        score,
      });
    }
    if (path.startsWith('/summary/')) {
      const s = [...this.all().values()].find((s) => s.file.summaryId === path.slice(9));
      if (!s) return json({ message: 'Results not found.' }, 404);
      const owned = (await cookieUser(req, env.COOKIE_SECRET)) === s.user.id;
      if (req.method === 'POST') {
        if (!owned || !this.journal)
          return json({ message: 'Only the holder can share these answers.' }, 403);
        const choice = await body(req, 100);
        if (typeof choice.showAnswers !== 'boolean' || Object.keys(choice).length !== 1)
          return json({ message: 'Choose whether to show your answers.' }, 422);
        if (!!this.state(s.user.id)?.file.shareAnswers === choice.showAnswers)
          return json({ ok: true });
        const updated = structuredClone(this.state(s.user.id)!);
        updated.file.shareAnswers = choice.showAnswers;
        this.journal.append(updated);
        await this.journal.durable();
        return json({ ok: true });
      }

      const data = {
        file: this.presentFile(s),
        category: publicCategory(this.category),
        specials: this.today().specials,
        nextDrop: nextDrop(),
      };
      return json({
        ...publicSummary(data, dayClosed(this.category), !!s.file.shareAnswers),
        owned,
      });
    }
    if (path === '/events/share' || path === '/events/arrival') {
      if (req.method !== 'POST') return json({ message: 'Not found.' }, 404);
      const b = await body(req, 100);
      if (!isPlatform(b.platform) || Object.keys(b).some((k) => k !== 'platform'))
        return json({ message: 'Unknown platform.' }, 422);
      return json({ ok: true }); // Unused per-player analytics intentionally dropped.
    }
    if (
      path === '/admin/r17-flush' &&
      req.method === 'POST' &&
      (await constantEqual(req.headers.get('authorization') || '', 'Bearer ' + env.ADMIN_TOKEN))
    ) {
      await this.flush(env);
      return json({
        ok: true,
        files: this.all().size,
        claims: this.owners.size,
        sequence: this.journal?.sequence,
      });
    }
    if (path === '/recover' && req.method === 'POST') {
      const b = await body(req, 300),
        key = normalizeFileKey(String(b.key || ''));
      const hash = await hmac(key, env.COOKIE_SECRET);
      const current = [...this.all().values()].find((s) => s.user.recoveryHash === hash);
      const row = current
        ? { id: current.user.id }
        : await env.DB.prepare(
            "SELECT user_id id FROM r17_files WHERE json_extract(data,'$.user.recoveryHash')=? UNION SELECT id FROM r17_players WHERE json_extract(data,'$.recoveryHash')=?",
          )
            .bind(hash, hash)
            .first<any>();
      if (!row) {
        const legacy = await env.DB.prepare('SELECT user_id FROM recovery_keys WHERE key_hash=?')
          .bind(await hmac(key, env.COOKIE_SECRET))
          .first<any>();
        if (legacy)
          return json({ ok: true }, 200, {
            'set-cookie': await sessionCookie(
              legacy.user_id,
              env.COOKIE_SECRET,
              isLocal(req, env.LOCAL_TEST),
            ),
          });
        return json({ message: 'Backup code not found; check it and try again.' }, 422);
      }
      return json({ ok: true }, 200, {
        'set-cookie': await sessionCookie(row.id, env.COOKIE_SECRET, isLocal(req, env.LOCAL_TEST)),
      });
    }
    let { user } = await this.user(req, env);
    if (path === '/delete-file' && req.method === 'POST') {
      const payload = await body(req.clone() as Request, 3000);
      if (payload.key) {
        const hash = await hmac(normalizeFileKey(String(payload.key)), env.COOKIE_SECRET);
        const current = [...this.all().values()].find((s) => s.user.recoveryHash === hash);
        const found = current
          ? { id: current.user.id }
          : await env.DB.prepare(
              "SELECT user_id id FROM r17_files WHERE json_extract(data,'$.user.recoveryHash')=? UNION SELECT id FROM r17_players WHERE json_extract(data,'$.recoveryHash')=? UNION SELECT user_id id FROM recovery_keys WHERE key_hash=?",
            )
              .bind(hash, hash, hash)
              .first<any>();
        if (!found) return json({ message: 'Backup code not found; check it and try again.' }, 422);
        const headers = new Headers(req.headers);
        headers.set(
          'cookie',
          (await sessionCookie(found.id, env.COOKIE_SECRET, isLocal(req, env.LOCAL_TEST))).split(
            ';',
          )[0],
        );
        ({ user } = await this.user(new Request(req, { headers }), env));
      }
    }
    if (!user)
      return json(
        {
          code: 'COOKIES_BLOCKED',
          message: 'Cookies are required to keep your place. Open in browser.',
        },
        401,
      );
    if (user.hidden && path !== '/delete-file')
      return json({ message: 'This account is not accepting new filings.' }, 403);
    if (req.method !== 'POST') return json({ message: 'Page not found.' }, 404);
    if (path === '/session-check') return json({ ok: true });
    if (path === '/verify-session') {
      const key =
        user.id +
        ':' +
        ('SOCKET_SECURITY_KEY' in env
          ? env.SOCKET_SECURITY_KEY
          : await securityKey(req, env.COOKIE_SECRET, env.LOCAL_TEST));
      const previous = this.verified.get(key);
      if (previous && previous.expires > Date.now()) return json(previous);
      const b = await body(req, 3000);
      if (!(await verifyChallenge(req, env, b.turnstileToken)))
        return json({ message: 'Verification failed; try again.' }, 400);
      const token = await verificationToken(req, env, user.id);
      this.verified.set(key, token);
      return json(token);
    }
    if (path === '/feedback') {
      const b = await body(req, 4000);
      if (typeof b.text !== 'string' || !b.text.trim() || b.text.length > 500)
        return json({ message: 'Write up to 500 characters.' }, 422);
      if (
        !(await verifiedSession(req, env, user.id, b.sessionToken)) &&
        !(await verifyChallenge(req, env, b.turnstileToken))
      )
        return json({ message: 'Please complete verification.' }, 400);
      const note = feedbackText(b.text);
      if (!note.ok) return json({ message: note.message }, 422);
      const limit = await reserveFeedback(req, env, user.id);
      if (limit) return json({ message: limit }, 429);
      await env.DB.prepare('INSERT INTO feedback(id,user_id,text,created_at) VALUES(?,?,?,?)')
        .bind(
          crypto.randomUUID(),
          user.id,
          (b.topic === 'privacy' ? 'Privacy question: ' : '') + note.text,
          new Date().toISOString(),
        )
        .run();
      return json({ ok: true, message: 'Feedback received.' });
    }
    if (path === '/missing') {
      const b = await body(req, 300);
      if (
        !this.category ||
        typeof b.answer !== 'string' ||
        b.answer.length > 120 ||
        Object.keys(b).some((k) => k !== 'answer')
      )
        return json({ message: 'Only the answer can be submitted.' }, 422);
      const recent = this.attempts.get('missing:' + user.id) || [];
      if (recent.length >= 10)
        return json({ message: 'Suggestion limit reached; try again tomorrow.' }, 429);
      this.attempts.set('missing:' + user.id, [...recent, Date.now()]);
      await env.DB.prepare(
        'INSERT INTO missing_answers(day,category_id,answer) VALUES(?,?,?) ON CONFLICT(day,category_id,answer) DO UPDATE SET count=count+1',
      )
        .bind(this.category.date, this.category.id, normalize(b.answer))
        .run();
      return json({ ok: true, message: 'Suggestion received; no strike charged.' });
    }
    if (path === '/me/reroll') {
      if (
        this.state(user.id)?.file.dibs ||
        (user.streakDates || []).length ||
        user.rerolls_used >= 3
      )
        return json({ message: 'This handle has been filed. Re-rolls are closed.' }, 403);
      user.handle = handle();
      user.rerolls_used++;
      await env.DB.prepare(
        'INSERT INTO r17_players(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      )
        .bind(user.id, JSON.stringify(user))
        .run();
      if (this.state(user.id))
        this.journal?.rewriteUser(user.id, (s) => {
          s.user = structuredClone(user);
          return s;
        });
      this.rebuild();
      return json({ user: { id: user.id, handle: user.handle, rerolls_used: user.rerolls_used } });
    }
    if (path === '/delete-file') {
      const b = await body(req, 3000);
      if (b.confirm !== 'DELETE MY FILE')
        return json({ message: 'Confirm that you want to permanently remove your file.' }, 422);
      if (
        !(await verifiedSession(req, env, user.id, b.sessionToken)) &&
        !(await verifyChallenge(req, env, b.turnstileToken))
      )
        return json({ message: 'Please complete verification.' }, 400);
      // Flush current work so the cross-day inventory includes the latest day.
      await this.journal?.mirror(env);
      const days = (
        await env.DB.prepare(
          'SELECT g.date FROM r17_files f JOIN categories g ON g.id=f.category_id WHERE f.user_id=?',
        )
          .bind(user.id)
          .all<any>()
      ).results;
      for (const { date } of days) {
        if (date === this.category?.date) continue;
        if (!env.DAY_REGISTRY) throw Error('Day namespace unavailable');
        const r = await env.DAY_REGISTRY.get(
          env.DAY_REGISTRY.idFromName(env.STAGING === 'true' ? 'practice' : date),
        ).fetch(
          new Request('https://registry/api/admin/r17-remove', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer ' + env.ADMIN_TOKEN,
              origin: PUBLIC_ORIGIN,
              'x-r17-day': date,
            },
            body: JSON.stringify({ uid: user.id }),
          }),
        );
        if (!r.ok) throw Error('Cross-day removal incomplete; retry');
      }
      await this.removeUser(user.id, env);
      // Legacy ownership survives under anonymous holders, using the existing policy.
      const old = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(user.id).first();
      if (old && env.REGISTRY) {
        const legacy = await env.REGISTRY.get(env.REGISTRY.idFromName('public-registry-v1')).fetch(
          new Request(PUBLIC_ORIGIN + '/api/delete-file', {
            method: 'POST',
            headers: {
              origin: PUBLIC_ORIGIN,
              'content-type': 'application/json',
              cookie: (
                await sessionCookie(user.id, env.COOKIE_SECRET, isLocal(req, env.LOCAL_TEST))
              ).split(';')[0],
            },
            body: JSON.stringify(b),
          }),
        );
        if (!legacy.ok) throw Error('Legacy removal incomplete; retry');
      }
      await env.DB.prepare('DELETE FROM feedback WHERE user_id=?').bind(user.id).run();
      await env.DB.prepare('DELETE FROM r17_players WHERE id=?').bind(user.id).run();
      this.users.delete(user.id);
      return json(
        { ok: true, message: 'Your file is removed. Past claims now belong to Withdrawn player.' },
        200,
        { 'set-cookie': 'dibs_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' },
      );
    }
    if (path === '/claim') return this.claim(req, env, user);
    return json({ message: 'Page not found.' }, 404);
  }
  private async removeUser(uid: string, env: Env) {
    const previous = this.state(uid),
      oldHandle = previous?.user.handle,
      anonymous = crypto.randomUUID();
    if (previous) {
      if (!this.journal?.files.has(uid)) this.journal?.append(previous);
      this.journal?.rewriteUser(uid, (s) => {
        s.user = { id: anonymous, handle: 'Withdrawn player', rerolls_used: 3, hidden: 0 };
        s.streakDates = [];
        s.requests = {};
        s.file.claims = s.file.claims.map((c: any) => ({
          ...c,
          handle: 'Withdrawn player',
          founder: false,
        }));
        return s;
      });
      // Redact references in other players' strikes and replay bodies as well.
      for (const state of this.journal?.files.values() || [])
        if (
          state.user.id !== anonymous &&
          state.file.events.some((e: any) => e.holder === oldHandle)
        )
          this.journal?.rewriteUser(state.user.id, (s) => {
            s.file.events = s.file.events.map((e: any) =>
              e.holder === oldHandle
                ? { ...e, holder: 'Withdrawn player', holderFounder: false }
                : e,
            );
            for (const request of Object.values(s.requests))
              if (request.body.takenBy === oldHandle) {
                request.body.takenBy = 'Withdrawn player';
                request.body.founder = false;
              }
            return s;
          });
    }
    await this.journal?.durable();
    await this.journal?.mirror(env);
    await env.DB.prepare('DELETE FROM r17_files WHERE category_id=? AND user_id=?')
      .bind(this.category?.id || '', uid)
      .run();
    this.users.delete(uid);
    this.legacy.delete(uid);
    this.rebuild();
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
          user: {
            id: user.id,
            handle: user.handle,
            rerolls_used: user.rerolls_used,
            hidden: user.hidden,
            founder: user.founder,
            recoveryHash: user.recoveryHash,
          },
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
        holderNumber: house ? undefined : playerNumber(holder.user_id),
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
    this.boardTop = undefined;
    this.users.set(user.id, { ...state.user, streakDates: state.streakDates });
    if (status === 201) {
      this.owners.set(aid, { ...result.claim, user_id: user.id });
      this.claims = result.claim.claim_no;
    }
    await this.journal.durable();
    const saved = this.state(user.id)!;
    const response = {
      ...result,
      file: this.presentFile(saved),
      me: this.me(user),
      leaderboard: this.board(user?.id),
      ...(status === 201 && file.dibs === 1
        ? { recoveryKey: await fileKey(user.id, env.COOKIE_SECRET) }
        : {}),
    };
    this.push();
    return json(response, status);
  }
  private push() {
    if (this.pushTimer || !this.ctx.getWebSockets().length) return;
    // Coalesce fanout, not persistence or acknowledgements. One sorted board and
    // one day snapshot serve all connected viewers, at most once per second.
    this.pushTimer = setTimeout(() => {
      this.pushTimer = undefined;
      this.broadcast();
    }, 1000);
  }
  private broadcast() {
    const today = this.today();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as any;
      try {
        ws.send(
          JSON.stringify({
            today,
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
      const now = Date.now();
      if (!a) return ws.close(1008, 'Reconnect');
      if (!a.window || now - a.window >= 60000) {
        a.window = now;
        a.count = 0;
      }
      a.count = (a.count || 0) + 1;
      ws.serializeAttachment(a);
      if (a.count > 30) return ws.close(1008, 'Too many requests');
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
        const r = await this.dispatch(req, {
          ...this.env,
          DB: meter.db,
          SOCKET_SECURITY_KEY: a.securityKey,
        });
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
  private async flush(env = this.env) {
    await this.journal?.mirror(env);
    if (dayClosed(this.category) && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (dayClosed(this.category) && this.category) {
      const saved = await env.DB.prepare(
        'INSERT INTO r17_boards(category_id,data) VALUES(?,?) ON CONFLICT(category_id) DO UPDATE SET data=excluded.data WHERE r17_boards.data!=excluded.data',
      )
        .bind(this.category.id, JSON.stringify(this.board()))
        .run();
      if (saved.meta.changes && env.STAGING !== 'true' && env.LOCAL_TEST !== 'true')
        await pingIndexNow(['/', '/archive', '/archive?date=' + this.category.date]);
    }
  }
  async alarm() {
    await expireSecurity(this.ctx.storage);
    await this.init(this.env);
    await this.flush();
  }
}
