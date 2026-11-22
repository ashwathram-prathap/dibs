import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
// A timeout fallback, not a membership cap: exhaust every subclass and every ordered page,
// then compare the complete per-class unique set with an independent COUNT query.
export async function completeIdsByClass(
  def: any,
  folder: string,
  query: (q: string, format?: string) => Promise<string>,
) {
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const ask = async (q: string, format = 'json') => {
    let last: any;
    for (let i = 0; i < 3; i++) {
      try {
        return await query(q, format);
      } catch (e) {
        last = e;
        await pause(10000);
      }
    }
    throw last;
  };
  const rootList = def.roots || [def.root];
  const typesFile = folder + '/complete-types.json';
  let types: string[];
  if (existsSync(typesFile)) types = JSON.parse(readFileSync(typesFile, 'utf8'));
  else {
    const d = JSON.parse(
      await ask(
        `SELECT DISTINCT ?type WHERE { VALUES ?root {${rootList.map((r: string) => 'wd:' + r).join(' ')}} ?type wdt:P279* ?root }`,
      ),
    );
    if (!Array.isArray(d.results?.bindings) || !d.results.bindings.length)
      throw Error('No complete subclass list');
    types = d.results.bindings.map((r: any) => r.type.value.split('/').at(-1));
    writeFileSync(typesFile, JSON.stringify(types));
  }
  const prop = def.property === 'P106' ? 'P106' : 'P31';
  const ids = new Set<string>();
  const audit: any[] = [];
  const parts = folder + '/classes';
  mkdirSync(parts, { recursive: true });
  for (const type of types) {
    const file = parts + '/' + type + '.json';
    if (existsSync(file)) {
      const d = JSON.parse(readFileSync(file, 'utf8'));
      for (const id of d.ids) ids.add(id);
      audit.push({ type, count: d.ids.length, cached: true });
      continue;
    }
    const pattern = `?item wdt:${prop} wd:${type}`;
    const countData = JSON.parse(
      await ask(`SELECT (COUNT(DISTINCT ?item) AS ?count) WHERE { ${pattern} }`),
    );
    const expected = Number(countData.results?.bindings?.[0]?.count?.value);
    if (!Number.isSafeInteger(expected) || expected < 0)
      throw Error('Invalid subclass count ' + type);
    const unique = new Set<string>();
    for (let offset = 0; offset < expected; offset += 5000) {
      const page = parts + '/' + type + '-' + offset + '.json';
      let batch: string[];
      if (existsSync(page)) batch = JSON.parse(readFileSync(page, 'utf8'));
      else {
        const text = await ask(
          `SELECT DISTINCT ?item WHERE { ${pattern} } ORDER BY ?item LIMIT 5000 OFFSET ${offset}`,
          'tsv',
        );
        const lines = text.trim().split('\n');
        if (
          lines[0] !== '?item' ||
          !lines.slice(1).every((s) => /^<http:\/\/www.wikidata.org\/entity\/Q\d+>$/.test(s))
        )
          throw Error('Truncated ordered ID page ' + type + ' ' + offset);
        batch = lines.slice(1).map((s) => s.match(/Q\d+/)![0]);
        writeFileSync(page, JSON.stringify(batch));
      }
      if (!batch.length) throw Error('Empty ID page before full count ' + type);
      for (const id of batch) unique.add(id);
      console.log(def.slug, type, unique.size, '/', expected, 'complete ID paging');
      await pause(1000);
    }
    if (unique.size !== expected)
      throw Error(
        'Changed or incomplete subclass: ' + type + ' expected ' + expected + ' saw ' + unique.size,
      );
    writeFileSync(file, JSON.stringify({ expected, ids: [...unique] }));
    for (const id of unique) ids.add(id);
    audit.push({ type, count: unique.size });
    writeFileSync(folder + '/class-audit.json', JSON.stringify(audit, null, 2));
    await pause(1000);
  }
  console.log(def.slug, 'complete union', ids.size, 'from', types.length, 'uncapped classes');
  return [...ids];
}
