import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
test('a new daily register clears yesterday’s certificate and form state', async ({
  page,
}, info) => {
  let fixtureUrl = '';
  page.on('request', (request) => {
    if (/\/assets\/fixture-[^/]+\.js$/.test(new URL(request.url()).pathname))
      fixtureUrl = request.url();
  });
  await page.clock.install();
  await page.goto('/');
  await page.locator('#answer').fill('Pangolin');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.result-panel')).toContainText('Taken.');
  await page.locator('#answer').fill('Axolotl');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.win-stamp')).toContainText('AXOLOTL');
  expect(fixtureUrl).toBeTruthy();
  await page.evaluate(async (path) => {
    const fixture = await import(/* @vite-ignore */ path);
    fixture.advanceFixtureDay();
  }, fixtureUrl);
  await page.clock.fastForward(76000);
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: 'Universities', exact: true })).toBeVisible();
  await expect(page.locator('#answer')).toHaveValue('');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.locator('.win-stamp')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Pangolin' })).toHaveCount(0);
  const fits = await page.locator('h1.category').evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().width <= el.clientWidth + 1;
  });
  expect(fits).toBe(true);
  mkdirSync('review/rollover', { recursive: true });
  await page.screenshot({ path: `review/rollover/${info.project.name}.png`, fullPage: true });
});
