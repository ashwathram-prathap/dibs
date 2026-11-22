import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
export function classificationPath(def: any) {
  const properties: string[] = def.properties || [def.property === 'P106' ? 'P106' : 'P31'];
  if (!properties.every((property) => /^P\d+$/.test(property)))
    throw Error('Invalid classification property');
  if (def.allStatementRanks)
    return '(' + properties.map((property) => `p:${property}/ps:${property}`).join('|') + ')';
  return properties.length === 1
    ? 'wdt:' + properties[0]
    : '(' + properties.map((property) => 'wdt:' + property).join('|') + ')';
}
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
  const prop = classificationPath(def);
  const article = def.englishOnlyCandidates
    ? ' . ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> .'
    : '';
  const extra = def.extraPattern ? (article ? ' ' : ' . ') + def.extraPattern : '';
  const ids = new Set<string>();
  const audit: any[] = [];
  // Bind the complete subclass set in small VALUES groups. This avoids both
  // repeated transitive joins and thousands of per-class round trips. LIMIT is
  // never applied to membership; each result is checked against its own COUNT.
  const groups = folder + '/complete-groups';
  mkdirSync(groups, { recursive: true });
  const collect = async (group: string[]): Promise<void> => {
    const hash = createHash('sha256').update(JSON.stringify(group)).digest('hex');
    const file = groups + '/' + hash + '.json';
    if (existsSync(file)) {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      if (saved.ids.length !== saved.expected) throw Error('Invalid cached group count');
      for (const id of saved.ids) ids.add(id);
      audit.push({ types: group, count: saved.expected, cached: true });
      return;
    }
    const pattern = `VALUES ?type { ${group.map((id) => 'wd:' + id).join(' ')} } ?item ${prop} ?type ${article} ${extra}`;
    try {
      let members: string[] = [];
      let expected = -1;
      for (let attempt = 0; attempt < 3; attempt++) {
        const text = await query(
          `SELECT DISTINCT ?item WHERE { ${pattern} } # snapshot ${Date.now()}`,
          'tsv',
        );
        const lines = text.trim().split('\n');
        if (
          lines[0] !== '?item' ||
          !lines.slice(1).every((s) => /^<http:\/\/www.wikidata.org\/entity\/Q\d+>$/.test(s))
        )
          throw Error('Invalid complete group table');
        members = [...new Set(lines.slice(1).map((s) => s.match(/Q\d+/)![0]))];
        const count = JSON.parse(
          await query(
            `SELECT (COUNT(DISTINCT ?item) AS ?count) WHERE { ${pattern} } # snapshot ${Date.now()}`,
          ),
        );
        expected = Number(count.results?.bindings?.[0]?.count?.value);
        if (Number.isSafeInteger(expected) && expected === members.length) break;
        await pause(1000);
      }
      if (expected !== members.length) throw Error('Live group count changed during three scans');
      writeFileSync(
        file,
        JSON.stringify({
          types: group,
          expected,
          ids: members,
          method: 'uncapped VALUES group with independent COUNT',
        }),
      );
      for (const id of members) ids.add(id);
      audit.push({ types: group, count: expected });
      writeFileSync(folder + '/class-audit.json', JSON.stringify(audit, null, 2));
      console.log(
        def.slug,
        'complete subclass group',
        group.length,
        'members',
        expected,
        'union',
        ids.size,
      );
      await pause(1000);
    } catch (error) {
      if (group.length === 1) throw error;
      const middle = Math.ceil(group.length / 2);
      await collect(group.slice(0, middle));
      await collect(group.slice(middle));
    }
  };
  if (types.length > 100) {
    for (let i = 0; i < types.length; i += 25) await collect(types.slice(i, i + 25));
    console.log(def.slug, 'complete union', ids.size, 'from', types.length, 'uncapped classes');
    return [...ids];
  }
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
    const pattern = `?item ${prop} wd:${type} ${article} ${extra}`;
    const countData = JSON.parse(
      await ask(
        `SELECT (COUNT(DISTINCT ?item) AS ?count) WHERE { ${pattern} } # snapshot ${Date.now()}`,
      ),
    );
    const expected = Number(countData.results?.bindings?.[0]?.count?.value);
    if (!Number.isSafeInteger(expected) || expected < 0)
      throw Error('Invalid subclass count ' + type);
    // A single direct-class query is often cheap even when the transitive union
    // times out. Prefer its consistent snapshot to paging a live, edited set.
    try {
      const text = await ask(
        `SELECT DISTINCT ?item WHERE { ${pattern} } # snapshot ${Date.now()}`,
        'tsv',
      );
      const lines = text.trim().split('\n');
      if (
        lines[0] !== '?item' ||
        !lines.slice(1).every((s) => /^<http:\/\/www.wikidata.org\/entity\/Q\d+>$/.test(s))
      )
        throw Error('Invalid direct-class table');
      let direct = [...new Set(lines.slice(1).map((s) => s.match(/Q\d+/)![0]))];
      const checkedCount = Number(
        JSON.parse(
          await ask(
            `SELECT (COUNT(DISTINCT ?item) AS ?count) WHERE { ${pattern} } # snapshot ${Date.now()}`,
          ),
        ).results?.bindings?.[0]?.count?.value,
      );
      if (direct.length !== checkedCount) {
        // Busy classes can change between two HTTP requests. Keep the uncapped
        // membership query and an independent COUNT in one database snapshot.
        const snapshot = JSON.parse(
          await ask(
            `SELECT DISTINCT ?item ?expected WHERE { { SELECT (COUNT(DISTINCT ?item) AS ?expected) WHERE { ${pattern} } } ${pattern} } # snapshot ${Date.now()}`,
          ),
        );
        const bindings = snapshot.results?.bindings;
        if (!Array.isArray(bindings) || !bindings.length)
          throw Error('Missing counted membership snapshot');
        direct = [...new Set<string>(bindings.map((row: any) => row.item.value.split('/').at(-1)))];
        if (
          !direct.every((id) => /^Q\d+$/.test(id)) ||
          bindings.some((row: any) => Number(row.expected?.value) !== direct.length)
        )
          throw Error('Counted membership snapshot mismatch');
      }
      writeFileSync(
        file,
        JSON.stringify({
          expected: direct.length,
          method: 'uncapped direct-class query with fresh independent count',
          ids: direct,
        }),
      );
      for (const id of direct) ids.add(id);
      audit.push({ type, count: direct.length, method: 'uncapped direct-class query' });
      writeFileSync(folder + '/class-audit.json', JSON.stringify(audit, null, 2));
      console.log(def.slug, type, 'complete direct class', direct.length);
      await pause(1000);
      continue;
    } catch (error) {
      console.log(def.slug, type, 'using keyset fallback:', String(error));
    }
    let unique = new Set<string>();
    let finalCount = expected;
    let matched = false;
    // Keyset pagination avoids losing rows when live edits shift OFFSET pages.
    for (let scan = 0; scan < 3 && !matched; scan++) {
      unique = new Set<string>();
      let after = '';
      while (true) {
        const cursorFilter = after
          ? 'FILTER(STR(?item) > "http://www.wikidata.org/entity/' + after + '")'
          : '';
        const page = parts + '/' + type + '-after-' + (after || 'start') + '.json';
        let batch: string[];
        if (scan === 0 && existsSync(page)) batch = JSON.parse(readFileSync(page, 'utf8'));
        else {
          const text = await ask(
            `SELECT DISTINCT ?item WHERE { ${pattern} ${cursorFilter} } ORDER BY STR(?item) LIMIT 5000${scan ? ' # fresh scan ' + Date.now() : ''}`,
            'tsv',
          );
          const lines = text.trim().split('\n');
          if (
            lines[0] !== '?item' ||
            !lines.slice(1).every((s) => /^<http:\/\/www.wikidata.org\/entity\/Q\d+>$/.test(s))
          )
            throw Error('Invalid keyset page ' + type);
          batch = lines.slice(1).map((s) => s.match(/Q\d+/)![0]);
          writeFileSync(page, JSON.stringify(batch));
        }
        if (batch.some((id) => unique.has(id))) throw Error('Non-advancing keyset page ' + type);
        for (const id of batch) unique.add(id);
        console.log(def.slug, type, unique.size, '/', expected, 'complete keyset paging');
        if (batch.length < 5000) break;
        after = batch.at(-1)!;
        await pause(1000);
      }
      const end = JSON.parse(
        await ask(
          `SELECT (COUNT(DISTINCT ?item) AS ?count) WHERE { ${pattern} } # snapshot ${Date.now()}`,
        ),
      );
      finalCount = Number(end.results?.bindings?.[0]?.count?.value);
      matched = unique.size === finalCount;
      if (!matched)
        console.log(
          def.slug,
          type,
          'changed during scan; repeating fresh keyset traversal',
          unique.size,
          finalCount,
        );
    }
    if (!matched)
      throw Error(
        'Unstable or incomplete subclass after three exhaustive keyset scans: ' +
          type +
          ' expected ' +
          finalCount +
          ' saw ' +
          unique.size,
      );
    writeFileSync(
      file,
      JSON.stringify({
        expected: finalCount,
        initialCount: expected,
        method: 'exhaustive keyset pagination',
        ids: [...unique],
      }),
    );
    for (const id of unique) ids.add(id);
    audit.push({ type, count: unique.size });
    writeFileSync(folder + '/class-audit.json', JSON.stringify(audit, null, 2));
    await pause(1000);
  }
  console.log(def.slug, 'complete union', ids.size, 'from', types.length, 'uncapped classes');
  return [...ids];
}
