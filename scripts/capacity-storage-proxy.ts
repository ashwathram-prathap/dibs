// Local capacity harness only: count SQLite-backed KV rows, including alarm writes.
// Instrumentation adds IO and must not be used to estimate duration or deployed.
const cache = new WeakMap<object, any>();
const wrapped = new WeakSet<object>();
async function record(kind: string, n: number, cause = 'KV') {
  await fetch('https://capacity.local/metric', {
    method: 'POST',
    body: JSON.stringify({ kind, n, cause }),
  });
}
export function __store(target: any): any {
  if (wrapped.has(target)) return target;
  if (cache.has(target)) return cache.get(target);
  const proxy = new Proxy(target, {
    get(t, k) {
      if (k === 'sql')
        return new Proxy(t.sql, {
          get(sql, op) {
            if (op === 'exec')
              return (query: string, ...bindings: any[]) => {
                const cursor = sql.exec(query, ...bindings);
                const rows = [...cursor];
                void record('reads', cursor.rowsRead, query);
                void record('writes', cursor.rowsWritten, query);
                return Object.assign(rows[Symbol.iterator](), {
                  toArray: () => rows,
                  one: () => {
                    if (rows.length !== 1) throw Error('Expected one row');
                    return rows[0];
                  },
                  rowsRead: cursor.rowsRead,
                  rowsWritten: cursor.rowsWritten,
                });
              };
            const value = sql[op];
            return typeof value === 'function' ? value.bind(sql) : value;
          },
        });
      if (k === 'transaction') return (cb: any) => t.transaction((tx: any) => cb(__store(tx)));
      if (k === 'put')
        return async (...args: any[]) => {
          const n = typeof args[0] === 'string' ? 1 : Object.keys(args[0]).length;
          const r = await t.put(...args);
          await record(
            'writes',
            n,
            'KV put ' + (typeof args[0] === 'string' ? args[0].split(':')[0] : 'multi'),
          );
          return r;
        };
      if (k === 'delete')
        return async (...args: any[]) => {
          const r = await t.delete(...args);
          await record('writes', typeof r === 'boolean' ? Number(r) : r);
          return r;
        };
      if (k === 'setAlarm')
        return async (...args: any[]) => {
          const r = await t.setAlarm(...args);
          await record('writes', 1, 'alarm');
          return r;
        };
      if (k === 'get' || k === 'list' || k === 'getAlarm')
        return async (...args: any[]) => {
          const r = await t[k](...args);
          await record('reads', r instanceof Map ? r.size : r == null ? 0 : 1);
          return r;
        };
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  cache.set(target, proxy);
  wrapped.add(proxy);
  return proxy;
}
