// LOCAL ONLY. Opens a real category in the local D1 emulator for end-to-end testing.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { registryDate, dropAt } from '../worker/domain';
const token = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_TOKEN=(.*)$/m)![1];
const c = JSON.parse(readFileSync('categories/animals.json', 'utf8'));
c.date = null;
c.drop_at = null;
const r = await fetch('http://127.0.0.1:8787/api/admin/category', {
  method: 'POST',
  headers: {
    origin: 'https://dibs.here',
    authorization: 'Bearer ' + token,
    'content-type': 'application/json',
  },
  body: JSON.stringify(c),
});
if (![201, 409].includes(r.status)) throw new Error(await r.text());
const date = registryDate();
execFileSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    'dibs-db',
    '--local',
    '-c',
    'worker/wrangler.jsonc',
    '--command',
    `UPDATE categories SET status='approved',date='${date}',drop_at='${dropAt(date)}' WHERE id='animals'`,
  ],
  { stdio: 'inherit' },
);
console.log('Local register opened. Remote categories are unchanged.');
