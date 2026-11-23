import { displayNames } from '../shared/handles';
import { finishedComparisons } from './finished-scores';
import { MAX_CLAIMS, MAX_STRIKES } from '../shared/config';
import type { Env } from './routes';
import { scoreFile } from './scoring';
import { shardFor } from '../shared/catalog';
export type ScoreRow = {
  user_id: string;
  handle: string;
  founder: boolean;
  points: number;
  dibs: number;
  golden: boolean;
  reachedAt: string;
  events: number;
};
export const SCORE_TTL = 25000;
export function orderScores(rows: ScoreRow[]) {
  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      a.reachedAt.localeCompare(b.reachedAt) ||
      a.user_id.localeCompare(b.user_id),
  );
}
export function publicScores(rows: ScoreRow[], uid?: string, limit = 25, revealed = false) {
  const names = displayNames(
    rows.map((r) => ({ id: r.user_id, handle: r.handle, founder: r.founder })),
  );
  const comparison = finishedComparisons(
    rows.map((r) => ({
      user: { id: r.user_id },
      file: { points: r.points, closed: r.dibs >= MAX_CLAIMS || r.events - r.dibs >= MAX_STRIKES },
      streakDates: [],
      requests: {},
    })),
  );
  const expose = (row: ScoreRow, index: number) => ({
    rank: index + 1,
    handle: names.get(row.user_id)!,
    founder: row.founder,
    points: row.points,
    claims: row.dibs,
    ...(revealed ? { golden: row.golden } : {}),
    own: row.user_id === uid,
  });
  const ownIndex = rows.findIndex((r) => r.user_id === uid);
  return {
    rows: rows.slice(0, limit).map(expose),
    own: ownIndex < 0 ? null : expose(rows[ownIndex], ownIndex),
    total: rows.length,
    comparison: comparison.own.get(uid || '') || comparison.empty,
  };
}
// The public cache is split into 256 small shards, never a growing single KV value.
// D1 is read once on initialization/recovery. Normal reads and mutations use DO storage.
export class Leaderboard {
  private seeding = new Map<string, Promise<void>>();
  private cache = new Map<string, { at: number; rows: ScoreRow[] }>();
  constructor(
    private storage: DurableObjectStorage,
    private env: Env,
  ) {}
  async clear() {
    this.cache.clear();
    const keys = await this.storage.list({ prefix: 'scores:' });
    if (keys.size) await this.storage.delete([...keys.keys()]);
  }
  private async seed(category: string) {
    let flight = this.seeding.get(category);
    if (!flight) {
      flight = this.seedRows(category).finally(() => this.seeding.delete(category));
      this.seeding.set(category, flight);
    }
    return flight;
  }
  private async seedRows(category: string) {
    const key = `scores:${category}:ready`;
    if (await this.storage.get(key)) return;
    const data = await this.env.DB.prepare(
      `SELECT c.user_id,c.points,c.created_at at,c.file_no seq,'dibs' kind,c.bonus,
      CASE WHEN u.provider_subject LIKE 'withdrawn:%' THEN 'Withdrawn player' ELSE COALESCE(f.name,u.handle) END handle,
      (f.user_id IS NOT NULL) founder FROM claims c JOIN users u ON u.id=c.user_id LEFT JOIN founder_role f ON f.user_id=u.id
      WHERE c.category_id=? AND u.hidden=0 AND NOT EXISTS(SELECT 1 FROM claims v WHERE v.category_id=c.category_id AND v.user_id=c.user_id AND v.voided=1)
      UNION ALL SELECT s.user_id,0,s.created_at,s.seq,'strike',0,
      CASE WHEN u.provider_subject LIKE 'withdrawn:%' THEN 'Withdrawn player' ELSE COALESCE(f.name,u.handle) END,(f.user_id IS NOT NULL)
      FROM strikes s JOIN users u ON u.id=s.user_id LEFT JOIN founder_role f ON f.user_id=u.id WHERE s.category_id=? AND u.hidden=0
      AND NOT EXISTS(SELECT 1 FROM claims v WHERE v.category_id=s.category_id AND v.user_id=s.user_id AND v.voided=1)
      ORDER BY seq`,
    )
      .bind(category, category)
      .all<any>();
    const players = new Map<string, any[]>();
    for (const event of data.results) {
      const events = players.get(event.user_id) || [];
      events.push(event);
      players.set(event.user_id, events);
    }
    const shards: Record<string, ScoreRow[]> = {};
    for (const [uid, events] of players) {
      const e = events[0];
      (shards[this.key(category, uid)] ||= []).push({
        user_id: uid,
        handle: e.handle,
        founder: !!e.founder,
        ...scoreFile(events),
        dibs: events.filter((e) => e.kind === 'dibs').length,
        golden: events.some((e) => e.bonus === 100),
        events: events.length,
      });
    }
    // Strike-only players intentionally have no D1 identity. Their durable private session
    // supplies their real handle when rebuilding after a moderation or role change.
    for (const session of (await this.storage.list<any>({ prefix: 'session:' })).values()) {
      const file = session.file;
      if (
        !file ||
        file.category_id !== category ||
        file.dibs ||
        !file.strikes ||
        session.user.hidden
      )
        continue;
      const uid = session.user.id;
      (shards[this.key(category, uid)] ||= []).push({
        user_id: uid,
        handle: session.user.handle,
        founder: false,
        points: file.points || 0,
        reachedAt: file.reachedAt || file.events[0].at,
        dibs: 0,
        golden: false,
        events: file.strikes,
      });
    }
    if (Object.keys(shards).length) await this.storage.put(shards);
    await this.storage.put(key, true);
  }
  private key(category: string, uid: string) {
    return `scores:${category}:row:${shardFor(uid)}`;
  }
  async rows(category: string) {
    const saved = this.cache.get(category);
    if (saved && Date.now() - saved.at < SCORE_TTL) return saved.rows;
    await this.seed(category);
    const shards = await this.storage.list<ScoreRow[]>({ prefix: `scores:${category}:row:` });
    const rows = orderScores([...shards.values()].flat());
    this.cache.set(category, { at: Date.now(), rows });
    // Only the active day and a few recent archive pages stay resident.
    if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value!);
    return rows;
  }
  async update(category: string, row: ScoreRow, eligible = true) {
    await this.seed(category);
    const key = this.key(category, row.user_id);
    await this.storage.transaction(async (txn) => {
      const rows = (await txn.get<ScoreRow[]>(key)) || [];
      const previous = rows.find((r) => r.user_id === row.user_id);
      if (previous && previous.events > row.events) return;
      await txn.put(key, [
        ...rows.filter((r) => r.user_id !== row.user_id),
        ...(eligible ? [row] : []),
      ]);
    });
    const cached = this.cache.get(category);
    if (cached)
      cached.rows = orderScores([
        ...cached.rows.filter((r) => r.user_id !== row.user_id),
        ...(eligible ? [row] : []),
      ]);
  }
}
