import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const base = 'https://practice.dibs-7hz.pages.dev';
const token = readFileSync('.dev.vars.staging', 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)![1];
const reset = async () => {
  const r = await fetch(base + '/api/admin/practice-reset', {
    method: 'POST',
    headers: { origin: base, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw Error('Reset ' + r.status);
};
const checks: any[] = [];
mkdirSync('review/round6', { recursive: true });
await reset();
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
const desktop = process.argv[3] === 'desktop';
try {
  const page = await browser.newPage({
    viewport: { width: desktop ? 1440 : 390, height: desktop ? 900 : 844 },
  });
  page.setDefaultTimeout(30000);
  await page.goto(base);
  await page.locator('.practice-banner').waitFor();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByLabel('ENTRY:', { exact: true }).fill('Dog');
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/claim', {
    timeout: 95000,
  });
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  try {
    const r = await response;
    const data = await r.json();
    checks.push({
      action: 'real Turnstile and house strike',
      status: r.status(),
      passed: r.status() === 409 && data.house === true,
      message: data.message,
    });
    if (r.status() !== 409 || !data.house) throw Error('House filing failed');
    await page.getByLabel('ENTRY:', { exact: true }).fill('Okapi');
    const claim = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/claim');
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    const cr = await claim;
    const cd = await cr.json();
    checks.push({
      action: 'real practice claim',
      status: cr.status(),
      passed: cr.status() === 201,
    });
    if (cr.status() !== 201) throw Error(cd.message);
    await page.goto(base + '/certificate/' + cd.claim.id);
    await page.locator('.certificate').waitFor();
    const html = await (await fetch(base + '/certificate/' + cd.claim.id)).text();
    checks.push({
      action: 'practice certificate and metadata isolation',
      passed: html.includes(base + '/api/og/') && !html.includes('https://dibs.here'),
    });
    await page.screenshot({
      path: 'review/final/practice-live-certificate-390.png',
      fullPage: true,
    });
  } catch (e: any) {
    checks.push({
      action: 'live claim flow',
      passed: false,
      message: e.message,
      clerk: await page
        .locator('.clerk-message')
        .textContent()
        .catch(() => null),
    });
  }
  checks.push({ action: 'no application errors', passed: errors.length === 0, errors });
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(base);
      await page.evaluate((t) => {
        localStorage.setItem('dibs-theme', t);
      }, theme);
      await page.reload();
      await page.locator('.practice-banner').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `review/final/practice-live-${width}-${theme}.png`,
        fullPage: true,
      });
      checks.push({
        action: `practice ${width} ${theme} layout`,
        passed: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      });
    }
} finally {
  await browser.close();
  await reset();
  writeFileSync(
    `review/round6/practice-live-${engine.name()}-${desktop ? 'desktop' : 'phone'}.json`,
    JSON.stringify(checks, null, 2),
  );
}
console.log(checks);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
