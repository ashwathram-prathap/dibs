import './test-traffic';
import { verifyPreviews } from './r19f-preview-bots';
import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { GAME_DESCRIPTION, GAME_EXPLANATION, LIMIT_EXPLANATION } from '../shared/copy';
import { INDEXNOW_KEY } from '../shared/indexnow';
const checks: any[] = [];
async function rollback() {
  const ids = JSON.parse(readFileSync('review/round19f/rollback.json', 'utf8'));
  const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
    encoding: 'utf8',
  });
  if (auth.status) throw Error('Rollback authentication unavailable');
  const headers = { authorization: 'Bearer ' + JSON.parse(auth.stdout).token };
  const project = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/pages/projects/dibs',
    { headers },
  );
  const current: any = await project.json();
  let pagesOkay =
    project.ok && current.success && current.result.canonical_deployment.id === ids.pages;
  if (!pagesOkay) {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/pages/projects/dibs/deployments/${ids.pages}/rollback`,
      { method: 'POST', headers },
    );
    const result: any = await r.json();
    pagesOkay = r.ok && result.success;
  }
  const worker = spawnSync(
    './node_modules/.bin/wrangler',
    [
      'rollback',
      ids.workerVersion,
      '-c',
      'worker/wrangler.jsonc',
      '--yes',
      '--message',
      'R19F production smoke failed',
    ],
    { encoding: 'utf8' },
  );
  appendFileSync('.tmp/r19f/rollback.log', worker.stdout + worker.stderr);

  writeFileSync(
    'review/round19f/rollback-result.json',
    JSON.stringify(
      { pages: pagesOkay, worker: worker.status === 0, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  assert.ok(pagesOkay && worker.status === 0, 'Rollback needs attention');
}
if (process.argv.includes('--rollback-now')) {
  await rollback();
  process.exit(0);
}
try {
  for (const [path, type] of [
    ['/sitemap.xml', 'application/xml; charset=utf-8'],
    ['/robots.txt', 'text/plain; charset=utf-8'],
  ]) {
    const response = await fetch('https://dibs.here' + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), type);
    const body = await response.text();
    assert.ok(body.includes(path === '/sitemap.xml' ? '<urlset' : 'Sitemap:'));
    assert.ok(!body.includes('challenge-platform'));
  }
  await verifyPreviews('https://dibs.here');
  const bootstrap: any = await (await fetch('https://dibs.here/api/bootstrap')).json();
  assert.equal(bootstrap.today.category, null);
  assert.equal(bootstrap.me.user, null);
  const home = await fetch('https://dibs.here');
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(
    html.includes('data-dibs-beacon='),
    'Real-visitor analytics configuration must be present and inert',
  );
  assert.ok(html.includes('src="/analytics.js"'), 'Conditional analytics loader missing');
  assert.ok(
    !html.includes('src="https://static.cloudflareinsights.com/'),
    'Beacon must not be active in HTML',
  );
  assert.ok(html.includes('name="dibs-test"'), 'QA header marker missing');
  const structured = JSON.parse(
    html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1],
  );
  assert.equal(structured['@context'], 'https://schema.org');
  const game = structured['@graph'].find((entry: any) => entry['@type'] === 'VideoGame');
  assert.equal(game.name, 'Dibs');
  assert.equal(game.author.name, 'Ashwathram Prathap');
  assert.equal(game.offers.price, 0);
  const key = await fetch('https://dibs.here/' + INDEXNOW_KEY + '.txt');
  assert.equal(key.status, 200);
  assert.equal((await key.text()).trim(), INDEXNOW_KEY);
  const today = (await (await fetch('https://dibs.here/api/today')).json()) as any;
  assert.equal(today.category, null);
  assert.equal(today.nextDrop, '2026-11-24T02:00:00.000Z');
  for (const engine of [chromium, webkit]) {
    const b = await engine.launch();
    try {
      for (const width of [390, 1440])
        for (const colorScheme of ['light', 'dark'] as const) {
          const c = await b.newContext({
            viewport: { width, height: width === 390 ? 844 : 900 },
            colorScheme,
            timezoneId: 'America/Toronto',
          });
          const p = await c.newPage();
          const errors: string[] = [];
          const audioRequests: string[] = [];
          const analytics: string[] = [];
          p.on('request', (r) => {
            if (r.url().includes('cloudflareinsights')) analytics.push(r.url());
            if (r.url().includes('/audio/')) audioRequests.push(r.url());
          });
          p.on('pageerror', (e) => errors.push(e.message));
          p.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
          });
          await p.goto('https://dibs.here');
          await p.locator('.closed-office').waitFor();
          await expect(p.locator('#leaderboard')).toContainText('No scores yet. Be first.');
          await expect(p.getByRole('link', { name: 'Leaderboard', exact: true })).toBeVisible();
          await expect(p.locator('.game-explanation')).toContainText(GAME_EXPLANATION);
          await expect(p.locator('.game-explanation')).toContainText(LIMIT_EXPLANATION);
          await expect(p.locator('.closed-office h1')).toContainText('Monday at 9:00 PM');
          await expect(p.locator('.opening-zone')).toContainText('9:00 PM ET');
          await expect(p.locator('meta[name=description]')).toHaveAttribute(
            'content',
            GAME_DESCRIPTION,
          );
          await p.locator('.reminder-button').click();
          await expect(p.getByRole('link', { name: 'Google Calendar' })).toBeVisible();
          await expect(p.getByRole('link', { name: 'Outlook', exact: true })).toBeVisible();
          await p.locator('.reminder-button').click();
          await p.locator('.drop-countdown .text-link').click();
          await expect(p.getByLabel('Timezone', { exact: true })).toBeFocused();
          const theme = p.getByRole('combobox', { name: 'Theme', exact: true });
          await expect(theme.locator('option')).toHaveText(['System', 'Paper copy', 'Carbon copy']);
          await expect(theme).toHaveValue('system');
          await theme.selectOption('light');
          await expect(p.locator('html')).toHaveAttribute('data-theme', 'light');
          await theme.selectOption('system');
          await expect(p.locator('html')).toHaveAttribute('data-theme', colorScheme);
          const statusBar = await p.locator('meta[name="theme-color"]').getAttribute('content');
          const opposite = colorScheme === 'light' ? 'dark' : 'light';
          await p.emulateMedia({ colorScheme: opposite });
          await expect(p.locator('html')).toHaveAttribute('data-theme', opposite);
          await expect(p.locator('meta[name="theme-color"]')).not.toHaveAttribute(
            'content',
            statusBar!,
          );
          assert.equal(await p.evaluate(() => localStorage.getItem('dibs-theme')), null);
          await p.emulateMedia({ colorScheme });
          await expect(p.locator('html')).toHaveAttribute('data-theme', colorScheme);
          await p.locator('#file-settings > summary').click();
          assert.ok(
            await p.locator('.header-controls').evaluate((el) => el.scrollWidth <= el.clientWidth),
          );
          await p.locator('.settings-close').click();
          await p.locator('#feedback summary').click();
          await expect(p.getByRole('dialog', { name: 'Send feedback' })).toBeVisible();
          await p.keyboard.press('Escape');
          await expect(p.getByRole('dialog')).toHaveCount(0);
          const initial = await p.locator('html').getAttribute('data-theme');
          await p.locator('.theme-toggle').click();
          await expect(p.locator('html')).toHaveAttribute(
            'data-theme',
            initial === 'light' ? 'dark' : 'light',
          );
          await p.locator('.theme-toggle').click();
          assert.equal(await p.locator('#answer').count(), 0);
          assert.equal(
            await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
          );
          if (engine === chromium)
            await p.screenshot({
              path: `review/round19f/production-${engine.name()}-${width}-${colorScheme}.png`,
              fullPage: true,
            });
          await expect(p.locator('.theme-toggle')).toHaveText(
            colorScheme === 'light' ? 'Carbon copy' : 'Paper copy',
          );
          const description = await p.locator('.launch-description').boundingBox();
          const hero = await p.locator('.closed-office .clock').boundingBox();
          assert.ok(
            description!.y + description!.height <= hero!.y,
            'Description directly above countdown',
          );
          const intro = await p.locator('.game-intro').boundingBox();
          assert.ok(hero!.y < intro!.y, 'Countdown leads explanation');
          assert.deepEqual(audioRequests, [], 'Music stays unloaded');
          assert.deepEqual(errors, []);
          assert.deepEqual(analytics, [], 'Automated smoke must not load analytics');
          await p.goto('https://dibs.here/about');
          await expect(p.locator('main')).toContainText(
            'Rarer answers score more: from 10 for the most familiar to 110 for the rarest.',
          );
          assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          // WebKit's screenshot API injects `body {}`, rejected by the real CSP.
          // Exercise WebKit under the unchanged production policy without captures;
          // its visual captures use the isolated security-test server instead.
          if (engine === chromium)
            await p.screenshot({
              path: `review/round19f/production-faq-${engine.name()}-${width}-${colorScheme}.png`,
              fullPage: true,
            });
          assert.deepEqual(errors, []);
          checks.push({
            browser: engine.name(),
            width,
            colorScheme,
            passed: true,
            consoleErrors: errors,
          });
          await c.close();
        }
    } finally {
      await b.close();
    }
  }
  writeFileSync(
    'review/round19f/production-smoke.json',
    JSON.stringify(
      { passed: true, at: new Date().toISOString(), nextDrop: today.nextDrop, checks },
      null,
      2,
    ),
  );
  console.log(
    'Production smoke passed: closed, Monday 9 PM ET, rules, reminders, dark mode, no console errors.',
  );
} catch (e) {
  writeFileSync(
    'review/round19f/production-smoke.json',
    JSON.stringify({ passed: false, checks, error: String(e) }, null, 2),
  );
  if (process.argv.includes('--rollback-on-failure')) await rollback();
  throw e;
}
