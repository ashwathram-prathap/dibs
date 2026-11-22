import { readFileSync, writeFileSync } from 'node:fs';
const structured = JSON.parse(
  readFileSync('.category-cache/r8/independent-structured.json', 'utf8'),
);
const path = '.category-cache/r8/independent-pools.json';
const pools = JSON.parse(readFileSync(path, 'utf8'));
const columns: Record<string, RegExp> = {
  airports: /^airports?(?:\s|$)/i,
  albums: /^album$/i,
  asteroids: /^designation$/i,
  bands: /^name$/i,
  castles: /^name$/i,
  films: /^film$/i,
  islands: /^island$/i,
  lakes: /^name$/i,
  mountains: /^mountain$/i,
  museums: /^name$/i,
  novels: /^(book|novel)$/i,
  rivers: /^river$/i,
  ships: /^ship$/i,
  songs: /^single$/i,
  stations: /^station$/i,
  television: /^series$/i,
  universities: /^university$/i,
  'video-games': /^(title|game)$/i,
  actors: /^actor$/i,
  footballers: /^player$/i,
  paintings: /^(name|painting|title)$/i,
};
const listKinds = new Set(['arthropods', 'painters', 'poets', 'composers', 'architects']);
const audit: any = {};
for (const [slug, pages] of Object.entries(structured) as [string, any[]][]) {
  const rows: any[] = [];
  for (const page of pages) {
    if (listKinds.has(slug)) rows.push(...page.lists);
    else
      for (const table of page.tables) {
        const index = table.headers.findIndex((h: string) =>
          columns[slug]?.test(h.replace(/\[[^\]]*\]/g, '').trim()),
        );
        if (index < 0) continue;
        for (const row of table.rows) {
          // A river-system cell can list several independently valid constituent rivers.
          const names = slug === 'rivers' ? row[index] : row[index]?.slice(0, 1);
          rows.push(...(names || []));
        }
      }
  }
  const unique = new Map<string, any>();
  for (const r of rows) {
    if (
      !r.title ||
      !r.name ||
      /^(?:Portal:|List of |Lists of |Category:|Template:|Wikipedia:|Help:)/.test(r.title)
    )
      continue;
    if (r.name.length > 120 || /^\d{4}$/.test(r.name)) continue;
    if (slug === 'lakes') r.name = r.title.replace(/ \([^)]*\)$/, '');
    if (slug === 'asteroids') r.name = r.title.replace(/ \([^)]*\)$/, '');
    if (!unique.has(r.title)) unique.set(r.title, r);
  }
  pools[slug] = [...unique.values()];
  audit[slug] = {
    sources: pages.map((p) => p.page),
    entries: pools[slug].length,
    method: listKinds.has(slug)
      ? 'First linked entry in each content list; butterfly common names read from the list label'
      : 'Named subject column, preserving row spans; navigation, images, authors and other columns excluded',
  };
}
writeFileSync(path, JSON.stringify(pools));
writeFileSync(
  'review/round8/independent-pool-extraction.json',
  JSON.stringify(audit, null, 2) + '\n',
);
console.log(Object.fromEntries(Object.entries(pools).map(([k, v]: any) => [k, v.length])));
