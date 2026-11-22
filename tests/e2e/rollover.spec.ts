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
  await page.getByLabel('ENTRY:', { exact: true }).fill('Pangolin');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.result-panel')).toContainText('already called dibs');
  await page.getByLabel('ENTRY:', { exact: true }).fill('Axolotl');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(
    page.getByRole('article', { name: 'Certificate of Dibs for Axolotl' }),
  ).toBeVisible();
  expect(fixtureUrl).toBeTruthy();
  await page.evaluate(async (path) => {
    const fixture = await import(/* @vite-ignore */ path);
    fixture.advanceFixtureDay();
  }, fixtureUrl);
  await page.clock.fastForward(31000);
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: 'Universities', exact: true })).toBeVisible();
  await expect(page.getByLabel('ENTRY:', { exact: true })).toHaveValue('');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.locator('.result-panel')).toContainText('Think of an answer');
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
