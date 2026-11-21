// Local-only accounting uses D1's actual result metadata, including index/trigger writes.
export function metered(db: D1Database) {
  const totals = { reads: 0, writes: 0 };
  const originals = new WeakMap<object, D1PreparedStatement>();
  const add = (r: D1Result) => { totals.reads += r.meta.rows_read || 0; totals.writes += r.meta.rows_written || 0; return r; };
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(statement, { get(target, key) {
      if (key === 'bind') return (...values: any[]) => wrap(target.bind(...values));
      if (key === 'all' || key === 'run') return async () => add(await target[key]());
      if (key === 'first') return async (column?: string) => {
        const r = add(await target.all()); const row = r.results[0] as any;
        return column ? row?.[column] ?? null : row ?? null;
      };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
    originals.set(proxy, statement); return proxy;
  };
  return { totals, db: new Proxy(db, { get(target, key) {
    if (key === 'prepare') return (sql: string) => wrap(target.prepare(sql));
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => (await target.batch(statements.map(s => originals.get(s) || s))).map(add);
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  }}) };
}
