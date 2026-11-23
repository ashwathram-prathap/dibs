import { readFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const config = 'worker/wrangler.staging.jsonc';
const run = (args: string[], input?: string) => {
  const r = spawnSync('./node_modules/.bin/wrangler', args, { input, encoding: 'utf8' });
  appendFileSync('.tmp/r19/practice-ops.log', r.stdout + r.stderr);
  if (r.status) throw Error('Practice operation failed; see private log');
};
if (process.argv[2] === 'test') {
  // Suppress automatic rehearsal alerts; this round permits only the final alert.
  run(['secret', 'delete', 'NTFY_TOPIC', '-c', config], 'y\n');
  run(['secret', 'put', 'TURNSTILE_SECRET', '-c', config], '1x0000000000000000000000000000000AA\n');
  run([
    'deploy',
    '-c',
    config,
    '--var',
    'TURNSTILE_SITE_KEY:1x00000000000000000000AA',
    '--define',
    'DIBS_PRACTICE_TEST_MODE:true',
  ]);
  console.log('Practice test verification installed; rehearsal notifications disabled.');
} else if (process.argv[2] === 'alerts') {
  const before = JSON.parse(readFileSync('review/round19/practice-before.json', 'utf8'));
  if (Date.now() < Date.parse(before.category.drop_at) + 125000)
    throw Error('Wait until the practice drop notification window has ended');
  const topic = readFileSync('FIXES-R9.md', 'utf8').match(/using topic `([^`]+)`/)?.[1];
  if (!topic) throw Error('Practice notification destination unavailable');
  run(['secret', 'put', 'NTFY_TOPIC', '-c', config], topic + '\n');
  console.log('Original practice notification setting restored after the QA window.');
} else {
  const secret = readFileSync('.dev.vars.staging', 'utf8')
    .split('\n')
    .find((s) => s.startsWith('TURNSTILE_SECRET='))!
    .slice(17)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  run(['secret', 'put', 'TURNSTILE_SECRET', '-c', config], secret + '\n');
  run(['deploy', '-c', config]);
  console.log('Real practice Turnstile restored.');
}
