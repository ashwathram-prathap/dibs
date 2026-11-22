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
    ({ html, title }) => {
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
        tables: Array.from(doc.querySelectorAll('table.wikitable')).map((t) => ({
          headers: Array.from(t.querySelectorAll('tr:first-child th,tr:first-child td')).map((x) =>
            x.textContent?.trim(),
          ),
          rows: Array.from(t.querySelectorAll('tr'))
            .filter((tr) => tr.querySelector('td'))
            .map((tr) => Array.from(tr.querySelectorAll(':scope > th,:scope > td')).map(links)),
        })),
        lists: Array.from(
          doc.querySelectorAll(
            '.mw-parser-output > ul > li,.div-col > ul > li,.divcol > ul > li,.mw-parser-output > section > ul > li',
          ),
        )
          .map((li) => links(li).slice(0, 1))
          .flat(),
      };
    },
    { html: d.parse.text['*'], title: d.parse.title },
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
