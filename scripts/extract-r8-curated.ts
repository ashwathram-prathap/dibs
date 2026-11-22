import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.evaluate('globalThis.__name = (fn) => fn');
const out: any = { foods: [], 'fruits-vegetables': [] };
const audit: any[] = [];
for (const file of [
  'dish-list.json',
  'greek-list.json',
  ...readdirSync('.category-cache/r8').filter((f) => f.startsWith('wiki-') && f.endsWith('.json')),
]) {
  const data = JSON.parse(readFileSync('.category-cache/r8/' + file, 'utf8'));
  if (!data.parse) continue;
  const rows = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const node of doc.querySelectorAll(
      '.navbox,.reflist,.references,.hatnote,.toc,.metadata,.sidebar,table.infobox',
    ))
      node.remove();
    const boundary = Array.from(doc.querySelectorAll('h2')).find((h) =>
      /^(See also|Notes|References|Bibliography|External links)/i.test(h.textContent || ''),
    );
    if (boundary) {
      let next = (boundary.closest('.mw-heading') || boundary).nextSibling;
      while (next) {
        const remove = next;
        next = next.nextSibling;
        remove.remove();
      }
    }
    const excludedSection = (node: Element) => {
      const headings = Array.from(doc.querySelectorAll('h2,h3,h4')).filter(
        (h) => !!(h.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
      const nearest = headings
        .slice(-3)
        .map((h) => h.textContent)
        .join(' ');
      return /beverages|drinks|wines|liqueurs|restaurants|chefs|see also|references|external links|bibliography/i.test(
        nearest,
      );
    };
    const lists = Array.from(doc.querySelectorAll('.mw-parser-output li'))
      .filter((li) => !li.closest('table') && !excludedSection(li))
      .map((li) => {
        const a = li.querySelector('a[href^="/wiki/"]:not([href*="File:"])');
        return a
          ? {
              display: a.textContent?.trim(),
              title: a.getAttribute('title'),
              href: a.getAttribute('href'),
            }
          : null;
      })
      .filter(
        (r) =>
          r?.display &&
          r.title &&
          !r.title.includes(':') &&
          !/^List |cuisine|cooking|steaming|frying|Common name|Binomial nomenclature/i.test(
            r.title,
          ),
      );
    return [
      ...lists,
      ...Array.from(doc.querySelectorAll('table tbody tr'))
        .map((row) => {
          const cell = row.querySelector('td');
          if (!cell || excludedSection(row)) return null;
          const a = cell.querySelector('a[href^="/wiki/"]:not([href*="File:"])');
          if (!a) return null;
          return {
            display: a.textContent?.trim(),
            title: a.getAttribute('title'),
            href: a.getAttribute('href'),
          };
        })
        .filter(
          (r) =>
            r?.display &&
            r.title &&
            !r.title.includes(':') &&
            !/^List |cuisine|cooking|steaming|frying|Common name|Binomial nomenclature/i.test(
              r.title,
            ),
        ),
    ];
  }, data.parse.text['*']);
  const slug = data.parse.title === 'List of vegetables' ? 'fruits-vegetables' : 'foods';
  for (const r of rows as any) {
    if (r.display === 'Sliced puddle') r.display = r.title;
    out[slug].push({
      display: r.display,
      aliases: [r.title.replace(/ \([^)]*\)$/, '').replace(/ as food$/, '')],
      wikipediaTitle: r.title,
      source: 'https://en.wikipedia.org/wiki/' + data.parse.title.replaceAll(' ', '_'),
    });
  }
  audit.push({
    page: data.parse.title,
    entries: rows.length,
    method:
      'All named first-column table entries and main-content list entries, excluding navigation and references; no arbitrary cap. Supplemental sources, not a claim that this exhausts every dish.',
  });
}
const pool = JSON.parse(readFileSync('.category-cache/r8/independent-pools.json', 'utf8'))[
  'fruits-vegetables'
];
const gbif = JSON.parse(readFileSync('.category-cache/r8/gbif-extracted.json', 'utf8')).plants;
const scientific = new Map(gbif.map((r: any) => [r.aliases.at(-1), r]));
const genera = new Set(gbif.map((r: any) => r.aliases.at(-1).split(' ')[0]));
for (const r of pool) {
  let display = r.name;
  const isScientific = r.name === r.title && genera.has(r.name.split(' ')[0]);
  if (isScientific) {
    const common: any = scientific.get(r.title);
    if (!common) continue;
    display = common.display;
  }
  out['fruits-vegetables'].push({
    display,
    aliases: [r.name, r.title],
    wikipediaTitle: r.title,
    source: 'https://en.wikipedia.org/wiki/List_of_culinary_fruits',
  });
}
await browser.close();
writeFileSync('scripts/r8-curated-supplements.json', JSON.stringify(out, null, 2));
writeFileSync('review/round8/curated-source-extraction.json', JSON.stringify(audit, null, 2));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]: any) => [k, v.length])), audit);
