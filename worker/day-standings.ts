import { fileTitle, rarityTier } from '../shared/flow-rules';
import type { JournalFile } from './event-journal';
import { cleanHandle, playerNumber } from '../shared/handles';
import type { ScoreRow } from './leaderboard';
const compare = (a: ScoreRow, b: ScoreRow) =>
  b.points - a.points ||
  a.reachedAt.localeCompare(b.reachedAt) ||
  a.user_id.localeCompare(b.user_id);
function lower<T>(rows: T[], row: T, cmp: (a: T, b: T) => number) {
  let lo = 0,
    hi = rows.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (cmp(rows[m], row) < 0) lo = m + 1;
    else hi = m;
  }
  return lo;
}
/** Sorted vectors: O(log n) exact rank, O(n) shifts on update, no full-day sort on ack. */
export class DayStandings {
  private rows: ScoreRow[] = [];
  private byId = new Map<string, ScoreRow>();
  private names = new Map<string, Set<string>>();
  private finished: number[] = [];
  private finishedOwn = new Map<string, number>();
  private top?: any[];
  private loading = false;
  private off = new Set<string>();
  private final = false;
  reset(files: Iterable<JournalFile>) {
    this.rows = [];
    this.byId.clear();
    this.off.clear();
    this.names.clear();
    this.finished = [];
    this.finishedOwn.clear();
    this.top = undefined;
    this.loading = true;
    for (const file of files) this.update(file);
    this.loading = false;
    this.rows.sort(compare);
    this.finished.sort((a, b) => a - b);
  }
  update(s: JournalFile) {
    const id = s.user.id,
      old = this.byId.get(id);
    this.off.delete(id);
    if (
      !s.user.hidden &&
      s.file.eligible !== false &&
      (s.file.claims || []).some(
        (c: any) => !c.voided && rarityTier(c.percentile, c.pool) === 'Off the register',
      )
    )
      this.off.add(id);
    if (old) {
      this.rows.splice(lower(this.rows, old, compare), 1);
      this.byId.delete(id);
      this.names.get(cleanHandle(old.handle))?.delete(id);
    }
    const oldPoints = this.finishedOwn.get(id);
    if (oldPoints !== undefined) {
      this.finished.splice(
        lower(this.finished, oldPoints, (a, b) => a - b),
        1,
      );
      this.finishedOwn.delete(id);
    }
    if (!s.user.hidden && s.file.eligible !== false) {
      if (s.file.closed) {
        const points = s.file.points || 0;
        this.finished.splice(
          lower(this.finished, points, (a, b) => a - b),
          0,
          points,
        );
        this.finishedOwn.set(id, points);
      }
      if (s.file.dibs > 0) {
        const r: ScoreRow = {
          user_id: id,
          handle: s.user.handle,
          founder: !!s.user.founder,
          points: s.file.points,
          dibs: s.file.dibs,
          golden: !!s.file.golden,
          reachedAt: s.file.reachedAt,
          events: s.file.events.length,
        };
        if (this.loading) this.rows.push(r);
        else this.rows.splice(lower(this.rows, r, compare), 0, r);
        this.byId.set(id, r);
        const name = cleanHandle(r.handle);
        if (!r.founder && !['Withdrawn player', 'Record withheld', 'RESERVED'].includes(name)) {
          if (!this.names.has(name)) this.names.set(name, new Set());
          this.names.get(name)!.add(id);
        }
      }
    }
    this.top = undefined;
  }
  private expose(r: ScoreRow, rank: number, own = false) {
    const name = cleanHandle(r.handle);
    return {
      rank,
      handle:
        !r.founder && (this.names.get(name)?.size || 0) > 1
          ? `${name} #${playerNumber(r.user_id)}`
          : name,
      founder: r.founder,
      points: r.points,
      claims: r.dibs,
      golden: r.golden,
      ...((own || this.final) && this.off.has(r.user_id) ? { offRegister: true } : {}),
      own,
    };
  }
  title(uid: string, final: boolean) {
    const r = this.byId.get(uid);
    if (!r) return null;
    const tieRank = lower(this.rows, r, (a, b) => b.points - a.points) + 1;
    return fileTitle(
      { dibs: r.dibs, closed: this.finishedOwn.has(uid), golden: r.golden },
      { final, tieRank, total: this.rows.length, finished: this.finished.length },
    );
  }
  board(uid = '', final = false) {
    if (this.final !== final) this.top = undefined;
    this.final = final;
    this.top ||= this.rows.slice(0, 25).map((r, i) => this.expose(r, i + 1));
    const r = this.byId.get(uid),
      own = r ? this.expose(r, lower(this.rows, r, compare) + 1, true) : null;
    const points = this.finishedOwn.get(uid),
      n = this.finished.length;
    let comparison = {
      finished: n,
      points: points ?? null,
      rank: null as number | null,
      percentile: null as number | null,
    };
    if (points !== undefined) {
      const start = lower(this.finished, points, (a, b) => a - b),
        end = lower(this.finished, points, (a, b) => (a <= b ? -1 : 1));
      comparison = {
        finished: n,
        points,
        rank: n - end + 1,
        percentile: (start + (end - start) / 2) / n,
      };
    }
    return {
      rows: this.top.map((r) => ({ ...r, own: r.rank === own?.rank })),
      own,
      total: this.rows.length,
      comparison,
    };
  }
}
