import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
const response = JSON.parse(
  execFileSync(
    './node_modules/.bin/wrangler',
    [
      'd1',
      'execute',
      'dibs-db',
      '--remote',
      '-c',
      'worker/wrangler.jsonc',
      '--json',
      '--command',
      "SELECT date,status,json_extract(source_json,'$.staticCatalog.slug') slug,json_extract(source_json,'$.staticCatalog.version') version FROM categories WHERE date IS NOT NULL ORDER BY date",
    ],
    { encoding: 'utf8' },
  ),
)[0];
const required = response.results.map((r: any) => {
  const path = `public/catalog/${r.slug}/${r.version}/full.json`;
  return { ...r, fullBytes: existsSync(path) ? statSync(path).size : null };
});
const large: any[] = [];
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = dir + '/' + name,
      s = statSync(path);
    if (s.isDirectory()) walk(path);
    else if (s.size > 10000000)
      large.push({
        path,
        bytes: s.size,
        requiredBy: required
          .filter((r: any) => path.startsWith(`public/catalog/${r.slug}/${r.version}/`))
          .map((r: any) => r.date),
      });
  }
}
walk('public');
writeFileSync(
  'review/round20/required-assets.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      source: 'Read-only scheduled catalog metadata. No seeds or selected answers queried.',
      required,
      large,
      queryCost: response.meta,
    },
    null,
    2,
  ),
);
console.log({ large, requiredDates: required.length });
