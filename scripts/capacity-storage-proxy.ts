// Local capacity harness only: count SQLite-backed KV rows, including alarm writes.
// Instrumentation adds IO and must not be used to estimate duration or deployed.
const cache = new WeakMap<object, any>();
const wrapped = new WeakSet<object>();
async function record(kind: string, n: number) {
  await fetch('https://capacity.local/metric', {
    method: 'POST',
    body: JSON.stringify({ kind, n }),
  });
}
export function __store(target: any): any {
  if (wrapped.has(target)) return target;
  if (cache.has(target)) return cache.get(target);
  const proxy = new Proxy(target, {
    get(t, k) {
      if (k === 'transaction') return (cb: any) => t.transaction((tx: any) => cb(__store(tx)));
      if (k === 'put')
        return async (...args: any[]) => {
          const n = typeof args[0] === 'string' ? 1 : Object.keys(args[0]).length;
          const r = await t.put(...args);
          await record('writes', n);
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
          await record('writes', 1);
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
