import './test-traffic';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage();
await p.evaluate('globalThis.__name = (fn) => fn');
const folder = '.category-cache/r8/independent-pages';
const results: any = {};
for (const f of readdirSync(folder).filter((f) => f.endsWith('.json'))) {
  const slug = f.replace(/-\d+\.json$/, '');
  const d = JSON.parse(readFileSync(folder + '/' + f, 'utf8'));
  const data = await p.evaluate(
    ({ html, title, slug }) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc
        .querySelectorAll(
          '.navbox,.metadata,.reflist,.mw-references-wrap,.toc,table.infobox,.sidebar',
        )
        .forEach((e) => e.remove());
      const link = (a: Element) => ({
        name: a.textContent?.trim(),
        title:
          a.getAttribute('title') ||
          decodeURIComponent(a.getAttribute('href')!.replace(/^\.\/|^\/wiki\//, '')).replaceAll(
            '_',
            ' ',
          ),
        source: 'https://en.wikipedia.org/wiki/' + title.replaceAll(' ', '_'),
      });
      const links = (cell: Element) =>
        Array.from(cell.querySelectorAll('a[href^="/wiki/"],a[href^="./"]'))
          .filter(
            (a) =>
              !/(?:File:|Help:|Category:|Template:|Wikipedia:|Special:|redlink=|^#)/.test(
                a.getAttribute('href')!,
              ),
          )
          .map(link)
          .filter((a) => a.name && a.title);
      return {
        tables: Array.from(doc.querySelectorAll('table.wikitable')).map((t) => {
          const carry: any[] = [];
          const rows: any[] = [];
          const headers = Array.from(
            t.querySelectorAll('tr:first-child > th,tr:first-child > td'),
          ).flatMap((cell: any) => Array(cell.colSpan || 1).fill(cell.textContent?.trim()));
          for (const tr of Array.from(t.querySelectorAll('tr'))) {
            const values: any[] = [];
            carry.forEach((v, i) => {
              if (v?.remaining > 0) {
                values[i] = v.links;
                v.remaining--;
              }
            });
            let c = 0;
            for (const cell of Array.from(
              tr.querySelectorAll(':scope > th,:scope > td'),
            ) as HTMLTableCellElement[]) {
              while (values[c] !== undefined) c++;
              const value = links(cell);
              for (let span = 0; span < (cell.colSpan || 1); span++) {
                values[c] = value;
                carry[c] = { remaining: (cell.rowSpan || 1) - 1, links: value };
                c++;
              }
            }
            if (tr.querySelector('td')) rows.push(values.map((v) => v || []));
          }
          return { headers, rows };
        }),
        lists: Array.from(
          doc.querySelectorAll(
            '.mw-parser-output > ul > li,.div-col > ul > li,.divcol > ul > li,.mw-parser-output > section > ul > li',
          ),
        )
          .map((li) => {
            const items = links(li).slice(0, 1);
            if (slug === 'arthropods') {
              const common = (li.firstChild?.textContent || '').replace(/,\s*$/, '').trim();
              return common && items.length ? [{ ...items[0], name: common }] : [];
            }
            return items;
          })
          .flat(),
      };
    },
    { html: d.parse.text['*'], title: d.parse.title, slug },
  );
  (results[slug] ||= []).push({ page: d.parse.title, ...data });
}
await b.close();
writeFileSync('.category-cache/r8/independent-structured.json', JSON.stringify(results));
console.log(
  Object.fromEntries(
    Object.entries(results).map(([k, pages]: any) => [
      k,
      pages.map((page: any) => ({
        page: page.page,
        lists: page.lists.length,
        tables: page.tables.map((t: any) => ({
          headers: t.headers,
          rows: t.rows.length,
          first: t.rows.slice(0, 2),
        })),
      })),
    ]),
  ),
);
