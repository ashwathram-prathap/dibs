import { readFileSync, writeFileSync, createReadStream, copyFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const folder = '.category-cache/r8/';
const queueText = readFileSync(folder + 'measurement-queue.json', 'utf8');
const requested = new Set<string>(JSON.parse(queueText));
const present = new Set<string>();
const headers = execFileSync(
  'curl',
  [
    '-fsSI',
    '--max-time',
    '30',
    'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-all-titles-in-ns0.gz',
  ],
  { encoding: 'utf8' },
);
const modified = headers.match(/^last-modified:\s*(.+)$/im)?.[1];
if (!modified) throw Error('Could not date complete title inventory');
const dumpDate = new Date(modified).toISOString();
console.log(
  'Matching complete title dump',
  dumpDate,
  'against',
  requested.size,
  'candidate titles',
);
const start = new Date(new Date(dumpDate).getTime() - 2 * 86400000).toISOString();
let scanned = 0;
for await (const line of createInterface({
  input: createReadStream(folder + 'enwiki-titles.gz').pipe(createGunzip()),
})) {
  const title = line.replaceAll('_', ' ').normalize('NFC');
  if (requested.has(title)) present.add(title);
  scanned++;
}
// Bridge the snapshot to today with every new page and move target, without a result cap.
let additions = 0;
for (const mode of ['new', 'move']) {
  let cont: any = {};
  do {
    const base =
      mode === 'new'
        ? {
            list: 'recentchanges',
            rctype: 'new',
            rcnamespace: '0',
            rcprop: 'title',
            rcdir: 'newer',
            rcstart: start,
            rclimit: '500',
          }
        : {
            list: 'logevents',
            letype: 'move',
            lenamespace: '0',
            leprop: 'title|details',
            ledir: 'newer',
            lestart: start,
            lelimit: '500',
          };
    const url =
      'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({ action: 'query', format: 'json', ...base, ...cont } as any);
    let data: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'DibsCatalog/2.0 (https://dibs.here/about)' },
          signal: AbortSignal.timeout(45000),
        });
        if (r.status === 429)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(60000, Number(r.headers.get('retry-after') || 60) * 1000)),
          );
        if (!r.ok) throw Error('HTTP ' + r.status);
        data = await r.json();
        if (data.error) throw Error(data.error.info);
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    for (const r of data.query[mode === 'new' ? 'recentchanges' : 'logevents']) {
      const title = mode === 'new' ? r.title : r.params?.target_title;
      if (title && requested.has(title.normalize('NFC'))) {
        present.add(title.normalize('NFC'));
        additions++;
      }
    }
    cont = data.continue;
    console.log(mode, 'new/moved requested titles', additions, 'continuing', !!cont);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (cont);
}
const result = {
  queueHash: createHash('sha256').update(queueText).digest('hex'),
  source: 'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-all-titles-in-ns0.gz',
  dumpDate,
  asOf: new Date().toISOString(),
  scanned,
  requested: requested.size,
  matched: present.size,
  additions,
  present: [...present],
};
const checkedFile = 'measurement-queue-' + result.queueHash + '.json';
copyFileSync(folder + 'measurement-queue.json', folder + checkedFile);
writeFileSync(folder + 'wiki-title-presence.json', JSON.stringify({ ...result, checkedFile }));
const { present: _, ...audit } = result;
writeFileSync(
  'review/round8/wikipedia-title-inventory.json',
  JSON.stringify(audit, null, 2) + '\n',
);
console.log(audit);
