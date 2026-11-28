import { DatabaseSync } from 'node:sqlite';
import { it, expect } from 'vitest';
import { EventJournal, type JournalFile } from '../worker/event-journal';
function fixture() {
  const db = new DatabaseSync(':memory:');
  let syncFails = false,
    failBatch = 0,
    batches = 0;
  const mirrored = new Map<string, { revision: number; data: string }>();
  const storage: any = {
    sql: {
      exec(sql: string, ...args: any[]) {
        const stmt = db.prepare(sql);
        if (sql.startsWith('SELECT')) {
          const rows = stmt.all(...args);
          return Object.assign(rows, { toArray: () => rows });
        }
        stmt.run(...args);
        return { toArray: () => [] };
      },
    },
    sync: async () => {
      if (syncFails) throw Error('sync failed');
    },
    transactionSync: (fn: () => void) => fn(),
  };
  const env: any = {
    DB: {
      prepare: () => ({
        bind: (...args: any[]) => ({
          run: async () => {
            batches++;
            if (failBatch === batches) throw Error('D1 unavailable');
            for (let i = 0; i < args.length; i += 5) {
              const old = mirrored.get(args[i + 1]);
              if (!old || old.revision < args[i + 2])
                mirrored.set(args[i + 1], { revision: args[i + 2], data: args[i + 3] });
            }
            return { success: true };
          },
        }),
      }),
    },
  };
  return {
    journal: () => new EventJournal(storage, env, 'category', '2026-11-27'),
    mirrored,
    storage,
    setSyncFailure: (v: boolean) => (syncFails = v),
    failOn: (v: number) => (failBatch = v),
    batches: () => batches,
    close: () => db.close(),
  };
}
const file = (id: string, points = 100): JournalFile => ({
  user: { id, handle: 'Tan Dove', recoveryHash: 'synthetic-only' },
  file: { points, claims: [{ id: 'claim-' + id, points }], events: [] },
  requests: { 'synthetic-request': { answer: 'synthetic', status: 201, body: { points } } },
  streakDates: [],
});
it('replays unmirrored durable acknowledgements and skips already mirrored files after restart', async () => {
  const f = fixture();
  try {
    let j = f.journal();
    j.append(file('a'));
    await j.durable();
    j = f.journal();
    expect(j.pending.size).toBe(1);
    expect(j.files.get('a')).toEqual(file('a'));
    await j.mirror();
    expect(j.mirroredSequence).toBe(1);
    j = f.journal();
    expect(j.pending.size).toBe(0);
    await j.mirror();
    expect(f.batches()).toBe(1);
  } finally {
    f.close();
  }
});
it('retains work through outage and partial batch failure, converging without stale regression', async () => {
  const f = fixture();
  try {
    let j = f.journal();
    for (let i = 0; i < 45; i++) j.append(file(String(i)));
    await j.durable();
    f.failOn(2);
    await expect(j.mirror()).rejects.toThrow();
    expect(j.pending.size).toBe(25);
    expect(j.mirroredSequence).toBe(0);
    j = f.journal();
    expect(j.pending.size).toBe(45);
    j.append(file('0', 200));
    await j.durable();
    await j.mirror();
    expect(f.mirrored.size).toBe(45);
    expect(JSON.parse(f.mirrored.get('0')!.data).file.points).toBe(200);
    expect(f.journal().pending.size).toBe(0);
  } finally {
    f.close();
  }
});
it('does not resolve durability on a sync fault and retains journal for recovery', async () => {
  const f = fixture();
  try {
    const j = f.journal();
    j.append(file('a'));
    f.setSyncFailure(true);
    await expect(j.durable()).rejects.toThrow();
    f.setSyncFailure(false);
    expect(f.journal().files.get('a')).toEqual(file('a'));
  } finally {
    f.close();
  }
});
it('preserves concurrent append during mirror and replays it past the checkpoint', async () => {
  const f = fixture();
  try {
    const j = f.journal();
    j.append(file('a'));
    const flight = j.mirror();
    j.append(file('a', 200));
    await flight;
    expect(j.pending.size).toBe(1);
    const restarted = f.journal();
    expect(restarted.pending.size).toBe(1);
    await restarted.mirror();
    expect(JSON.parse(f.mirrored.get('a')!.data).file.points).toBe(200);
  } finally {
    f.close();
  }
});
it('removes private identity and replay data from every journal copy', async () => {
  const f = fixture();
  try {
    const j = f.journal();
    j.append(file('private-user'));
    j.append(file('private-user', 200));
    j.rewriteUser('private-user', (s) => ({
      ...s,
      user: { id: 'anonymous', handle: 'Withdrawn player' },
      requests: {},
      streakDates: [],
    }));
    await j.durable();
    const rows = f.storage.sql.exec('SELECT payload FROM events').toArray();
    expect(JSON.stringify(rows)).not.toContain('private-user\"');
    expect(JSON.stringify(rows)).not.toContain('recoveryHash');
    expect(f.journal().files.has('private-user')).toBe(false);
  } finally {
    f.close();
  }
});
