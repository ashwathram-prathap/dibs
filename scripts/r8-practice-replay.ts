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
const rows: any[] = [];
let restored = false;
try {
  // Cloudflare's documented dummy credentials; these are deliberately public.
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
  console.log('Official Turnstile test credentials installed on practice only');
  await reset();
  const manifest = JSON.parse(readFileSync('public/catalog/animals/manifest.json', 'utf8'));
  const coverage = JSON.parse(readFileSync('review/coverage/results.json', 'utf8')).find(
    (r: any) => r.slug === 'animals',
  );
  assert.equal(coverage.ready, true);
  const installed = await api(
    '/admin/static-catalog',
    { id: 'practice', slug: 'animals', name: 'Animals', manifest, coverage },
    undefined,
    true,
  );
  assert.equal(installed.response.status, 200, installed.data.message);
  const words = browserOnly
    ? []
    : readFileSync('review/coverage/animals.txt', 'utf8').trim().split('\n');
  let recoveryChecked = false;
  for (const answer of words) {
    // Five new identities per connection per day is an intentional production rule.
    // Reset only the owned practice database between five-answer batches.
    if (rows.length > 0 && rows.length % 5 === 0) await reset();
    const start = await api('/bootstrap');
    assert.equal(start.response.status, 200);
    const cookie = start.response.headers.get('set-cookie')!.split(';')[0];
    const body = {
      answer,
      requestId: crypto.randomUUID(),
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    };
    let filed = await api('/claim', body, cookie);
    const retries: number[] = [];
    for (let retry = 0; filed.response.status >= 500 && retry < 3; retry++) {
      retries.push(filed.response.status);
      await new Promise((r) => setTimeout(r, 1000 * (retry + 1)));
      filed = await api('/claim', body, cookie); // Same request ID: never duplicate a filing.
    }
    assert.ok(
      [201, 409].includes(filed.response.status),
      answer + ': ' + filed.response.status + ' ' + filed.data.message,
    );
    rows.push({
      answer,
      retries,
      status: filed.response.status,
      code: filed.data.code || 'DIBS',
      display: filed.data.claim?.display || filed.data.answer,
      dibs: filed.data.file?.dibs,
      strikes: filed.data.file?.strikes,
    });
    if (filed.response.status === 201 && !recoveryChecked) {
      const replay = await api('/claim', body, cookie);
      assert.equal(replay.response.status, 201);
      assert.equal(replay.data.claim.id, filed.data.claim.id);
      assert.equal(replay.data.file.dibs, 1);
      const recovered = await api('/recover', { key: filed.data.recoveryKey });
      assert.equal(recovered.response.status, 200);
      const nextCookie = recovered.response.headers.get('set-cookie')!.split(';')[0];
      const next = await api('/me', undefined, nextCookie);
      assert.equal(next.data.user.id, start.data.me.user.id);
      assert.equal(next.data.file.dibs, 1);
      const typo = await api(
        '/claim',
        {
          answer: 'Chamelon',
          requestId: crypto.randomUUID(),
          turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
        },
        nextCookie,
      );
      assert.equal(typo.response.status, 422);
      assert.equal(typo.data.suggestion, 'Chameleon');
      const after = await api('/me', undefined, nextCookie);
      assert.equal(after.data.file.strikes, 0);
      recoveryChecked = true;
    }
    if (rows.length % 25 === 0) console.log('Replayed', rows.length, '/', words.length);
  }
  if (!browserOnly) assert.ok(recoveryChecked);
  if (!browserOnly)
    writeFileSync(
      'review/round8/practice-api-replay.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          origin: base,
          manifest,
          verification:
            'Official Cloudflare test credentials; real hostname/action checks are separately unit-tested. Real human Turnstile requires a phone check.',
          accepted: rows.length,
          stagingResetEvery: 5,
          obvious: words.length,
          idempotency: true,
          identityRecovery: true,
          typoNoStrike: true,
          rows,
        },
        null,
        2,
      ) + '\n',
    );
  if (browserOnly || withBrowser)
    for (const engine of ['chromium', 'webkit']) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          'npx',
          [
            'tsx',
            'scripts/r8-practice-flow.ts',
            '--official-test-keys',
            ...(engine === 'webkit' ? ['--webkit'] : []),
          ],
          { stdio: 'inherit' },
        );
        child.on('error', reject);
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(Error('Practice ' + engine + ' browser flow failed')),
        );
      });
    }
} catch (error) {
  console.error('Replay failed:', String(error));
  throw error;
} finally {
  await reset();
  await run(['secret', 'put', 'TURNSTILE_SECRET', '-c', config], vars.TURNSTILE_SECRET + '\n');
  const expected = JSON.parse(readFileSync(config, 'utf8')).vars.TURNSTILE_SITE_KEY;
  await run(['deploy', '-c', config, '--var', 'TURNSTILE_SITE_KEY:' + expected]);
  const after = await waitForSiteKey(expected);
  assert.equal(after.data.today.turnstileSiteKey, expected);
  assert.equal(after.data.today.claimed, 0);
  restored = true;
  writeFileSync(
    'review/round8/practice-restore.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        realSiteKeyRestored: true,
        claims: after.data.today.claimed,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Practice reset and real Turnstile credentials restored');
}
console.log({ replayed: rows.length, restored });
