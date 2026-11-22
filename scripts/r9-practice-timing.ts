import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base = 'https://practice.dibs-7hz.pages.dev';
const browserOnly = process.argv.includes('--browser-only');
const withBrowser = process.argv.includes('--with-browser');
const vars = Object.fromEntries(
  readFileSync('.dev.vars.staging', 'utf8')
    .split('\n')
    .filter((s) => s.includes('='))
    .map((s) => {
      const at = s.indexOf('=');
      return [
        s.slice(0, at),
        s
          .slice(at + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ''),
      ];
    }),
);
const config = 'worker/wrangler.staging.jsonc';
const run = (args: string[], input?: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('npx', ['wrangler', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (b) => {
      output += b;
    });
    child.stderr.on('data', (b) => {
      output += b;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      appendFileSync('.tmp/r8-practice-wrangler.log', output + '\n');
      if (code === 0) resolve();
      else
        reject(
          Error(
            'Wrangler ' +
              args[0] +
              ' failed (' +
              code +
              '); output withheld to protect credentials',
          ),
        );
    });
    child.stdin.end(input);
  });
async function api(path: string, body?: any, cookie?: string, admin = false) {
  const response = await fetch(base + '/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin: base,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(admin ? { authorization: 'Bearer ' + vars.ADMIN_TOKEN } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: (await response.json()) as any };
}
async function reset() {
  const { response } = await api('/admin/practice-reset', {}, undefined, true);
  assert.equal(response.status, 200);
}
async function waitForSiteKey(expected: string) {
  for (let i = 0; i < 90; i++) {
    const result = await api('/bootstrap');
    if (result.data.today?.turnstileSiteKey === expected) return result;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw Error('Practice deployment did not expose the expected site key');
}
try {
  await run(
    ['secret', 'put', 'TURNSTILE_SECRET', '-c', config],
    '1x0000000000000000000000000000000AA\n',
  );
  await run([
    'deploy',
    '-c',
    config,
    '--var',
    'TURNSTILE_SITE_KEY:1x00000000000000000000AA',
    '--define',
    'DIBS_PRACTICE_TEST_MODE:true',
  ]);
  await waitForSiteKey('1x00000000000000000000AA');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'scripts/r9-timing.ts', process.argv[2] || 'after-official-test'], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(Error('Timing failed'))));
    child.on('error', reject);
  });
  if (process.argv.includes('--flow')) await new Promise<void>((resolve,reject)=>{
    const child=spawn('npx',['tsx','scripts/r9-live-flow.ts'],{stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(Error('Live flow failed')));child.on('error',reject);
  });
} finally {
  await run(['secret', 'put', 'TURNSTILE_SECRET', '-c', config], vars.TURNSTILE_SECRET + '\n');
  await run(['deploy', '-c', config]);
  console.log('Real practice verification restored');
}
