import type { Env } from './routes';
export type JournalFile = {
  user: any;
  file: any;
  streakDates: string[];
  requests: Record<string, { answer: string; status: number; body: any }>;
};
// One SQLite row per meaningful event. No indexes, counters or per-event checkpoints.
// Each row contains the resulting private file, so replay needs no external writes.
export class EventJournal {
  files = new Map<string, JournalFile>();
  pending = new Map<string, { revision: number; value: JournalFile }>();
  sequence = 0;
  private flushing?: Promise<void>;
  constructor(
    private storage: DurableObjectStorage,
    private env: Env,
    private category: string,
  ) {
    storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY, payload TEXT NOT NULL)',
    );
    for (const row of storage.sql.exec<{ seq: number; payload: string }>(
      'SELECT seq,payload FROM events ORDER BY seq',
    )) {
      const value = JSON.parse(row.payload) as JournalFile;
      this.sequence = row.seq;
      this.files.set(value.user.id, value);
      this.pending.set(value.user.id, { revision: row.seq, value });
    }
  }
  // Call after every asynchronous validation, with ownership checked again synchronously.
  append(value: JournalFile) {
    const revision = this.sequence + 1;
    const payload = JSON.stringify(value);
    this.storage.sql.exec('INSERT INTO events(seq,payload) VALUES(?,?)', revision, payload);
    this.sequence = revision;
    const copy = JSON.parse(payload);
    this.files.set(value.user.id, copy);
    this.pending.set(value.user.id, { revision, value: copy });
  }
  rewriteUser(uid: string, transform: (value: JournalFile) => JournalFile) {
    // Privacy/moderation is rare. Rewrite every retained copy, including old events,
    // before acknowledging deletion; never keep a hidden original in the journal.
    this.storage.transactionSync(() => {
      for (const row of this.storage.sql
        .exec<{ seq: number; payload: string }>('SELECT seq,payload FROM events')
        .toArray()) {
        const value = JSON.parse(row.payload) as JournalFile;
        if (value.user.id !== uid) continue;
        const changed = transform(value);
        this.storage.sql.exec(
          'UPDATE events SET payload=? WHERE seq=?',
          JSON.stringify(changed),
          row.seq,
        );
      }
    });
    const latest = this.files.get(uid);
    this.files.delete(uid);
    this.pending.delete(uid);
    if (latest) this.append(transform(structuredClone(latest)));
  }
  async durable() {
    await this.storage.sync();
  }
  async mirror(env = this.env): Promise<void> {
    if (this.flushing) {
      await this.flushing;
      if (this.pending.size) return this.mirror(env);
      return;
    }
    this.flushing = this.flush(env).finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }
  private async flush(env: Env) {
    const rows = [...this.pending.entries()];
    // D1's bind limit is 100; 20 files = 80 parameters. One multi-row INSERT per chunk.
    for (let i = 0; i < rows.length; i += 20) {
      const chunk = rows.slice(i, i + 20);
      const files = env.DB.prepare(
        `INSERT INTO r17_files(category_id,user_id,revision,data) VALUES ${chunk.map(() => '(?,?,?,?)').join(',')} ON CONFLICT(category_id,user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data WHERE excluded.revision>r17_files.revision`,
      ).bind(
        ...chunk.flatMap(([uid, row]) => [
          this.category,
          uid,
          row.revision,
          JSON.stringify(row.value),
        ]),
      );
      // File snapshot + first-claim streak advance commit together in one D1 round trip.
      const identities = chunk
        .filter(([, row]) => row.value.file.dibs && row.value.streakDates.length)
        .map(([uid, row]) =>
          env.DB.prepare(
            "UPDATE r17_players SET data=json_set(data,'$.streakDates',json(?),'$.lastClaimDate',?) WHERE id=? AND COALESCE(json_extract(data,'$.lastClaimDate'),'')<?",
          ).bind(
            JSON.stringify(row.value.streakDates),
            row.value.streakDates[0],
            uid,
            row.value.streakDates[0],
          ),
        );
      await env.DB.batch([files, ...identities]);
      for (const [uid, row] of chunk)
        if (this.pending.get(uid)?.revision === row.revision) this.pending.delete(uid);
    }
  }
}
