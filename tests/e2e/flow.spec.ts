import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
test('full filing, certificate, sharing and public record', async ({ page }, info) => {
  const dir = 'review/devices/' + info.project.name;
  mkdirSync(dir, { recursive: true });
  const shot = async (step: string) => {
    await page.screenshot({ path: dir + '/' + step + '.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  };
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => false });
    Object.defineProperty(navigator, 'share', { value: undefined });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Animals', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await shot('01-load');
  const input = page.getByLabel('ENTRY:', { exact: true });
  await input.fill('Pan');
  await expect(page.getByRole('option', { name: 'Pangolin' })).toBeVisible();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('Pangolin');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.getByRole('status')).toContainText('already called dibs');
  await shot('02-taken');
  await input.fill('Axolotl');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(
    page.getByRole('article', { name: 'Certificate of Dibs for Axolotl' }),
  ).toBeVisible();
  await page.waitForTimeout(1400);
  await shot('03-success');
  await expect(page.getByRole('row').filter({ hasText: 'Axolotl' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('searchbox').fill('Axolotl');
  await shot('04-ledger');
  for (const answer of ['Okapi', 'Quokka']) {
    await input.fill(answer);
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    await expect(
      page.getByRole('article', { name: 'Certificate of Dibs for ' + answer }),
    ).toBeVisible();
    await page.waitForTimeout(1200);
  }
  await expect(page.getByRole('article', { name: 'Day summary' })).toBeVisible();
  await expect(page.locator('.file-progress')).toContainText('DIBS 3 / 3');
  await expect(page.getByRole('img', { name: '1 of 5 strikes' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Feed PNG' }).click();
  const d = await download;
  await d.saveAs(dir + '/certificate-feed.png');
  const png = PNG.sync.read(readFileSync(dir + '/certificate-feed.png'));
  expect([png.width, png.height]).toEqual([1080, 1350]);
  await shot('05-share-fallback');
  const story = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Story PNG' }).click();
  const s = await story;
  await s.saveAs(dir + '/certificate-story.png');
  const sp = PNG.sync.read(readFileSync(dir + '/certificate-story.png'));
  expect([sp.width, sp.height]).toEqual([1080, 1920]);
  await page.getByRole('button', { name: 'Copy text', exact: true }).click();
  await expect(page.locator('.share-hint')).not.toBeEmpty();
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  for (const [route, name] of [
    ['/certificate/fixture-1', '06-certificate'],
    ['/archive', '07-archive'],
    ['/about', '09-about'],
  ]) {
    await page.goto(route);
    await expect(page.locator('.page-heading')).toBeVisible();
    await page.waitForTimeout(250);
    await shot(name);
  }
});

test('five strikes close the file and invalid entries cost nothing', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('ENTRY:', { exact: true });
  await input.fill('unknown animal');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.getByRole('status')).toHaveText("Not on today's register. Check the spelling.");
  await expect(page.getByRole('img', { name: '0 of 5 strikes' })).toBeVisible();
  for (let i = 1; i <= 5; i++) {
    await input.fill('Pangolin');
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    await expect(page.getByRole('img', { name: `${i} of 5 strikes` })).toBeVisible();
  }
  await expect(page.getByRole('article', { name: 'Day summary' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CALL DIBS' })).toHaveCount(0);
});
