import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const source =
  'https://ssd-api.jpl.nasa.gov/sbdb_query.api?' +
  new URLSearchParams({
    fields: 'spkid,full_name,pdes,name,class',
    'sb-kind': 'a',
    'sb-cdata': JSON.stringify({ AND: ['name|DF'] }),
  });
const cache = '.category-cache/r8/jpl-named-minor-planets.json';
if (!existsSync(cache))
  execFileSync('curl', ['-fL', '--retry', '2', '--max-time', '180', source, '-o', cache], {
    stdio: 'ignore',
  });
const d = JSON.parse(readFileSync(cache, 'utf8'));
if (
  d.signature?.version !== '1.0' ||
  d.fields.join(',') !== 'spkid,full_name,pdes,name,class' ||
  d.data.length !== Number(d.count)
)
  throw Error('Incomplete or changed JPL SBDB response');
const rows = d.data.map(([spkid, full, pdes, name, orbitClass]: string[]) => ({
  display: name,
  aliases: [full.trim(), pdes + ' ' + name],
  wikipediaTitle: pdes + ' ' + name,
  source: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=' + spkid,
  orbitClass,
}));
writeFileSync('.category-cache/r8/other-references/asteroids.json', JSON.stringify(rows));
writeFileSync(
  'review/round8/asteroid-reference-extraction.json',
  JSON.stringify(
    {
      source,
      complete: true,
      rows: rows.length,
      quality:
        'All named objects in JPL asteroid/minor-planet class; excludes unnamed provisional designations, no result limit',
      license:
        'NASA public scientific data; https://science.nasa.gov/researchers/science-information-policy_faq/',
      signature: d.signature,
    },
    null,
    2,
  ) + '\n',
);
console.log(rows.length, 'complete named minor planets');
