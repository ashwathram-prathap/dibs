import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { decode } from 'jpeg-js';
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
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          (window as any).copied = text;
        },
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Animals', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await shot('01-load');
  const input = page.locator('#answer');
  await input.fill('Pangolin');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.result-panel')).toContainText('Taken.');
  await shot('02-taken');
  await input.fill('Axolotl');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.win-stamp')).toContainText('AXOLOTL');
  await shot('03-success');
  await expect(page.locator('table.ledger')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next claim', exact: true }).click();
  for (const answer of ['Okapi', 'Quokka']) {
    await input.fill(answer);
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    if (answer !== 'Quokka') {
      await expect(page.locator('.win-stamp')).toContainText(answer.toUpperCase());
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
    }
  }
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Day summary' })).toBeVisible();
  await expect(page.locator('.file-progress')).toContainText('Claims 3 of 3');
  await expect(page.locator('.file-tally')).toContainText('1 strike');
  await page.getByText('More ways to share', { exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).copied))
    .toBe('https://dibs.here/summary/fixture-summary?s=copy-link');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Feed JPEG' }).click();
  const d = await download;
  await d.saveAs(dir + '/certificate-feed.png');
  const png = decode(readFileSync(dir + '/certificate-feed.png'));
  expect([png.width, png.height]).toEqual([1080, 1350]);
  await shot('05-share-fallback');
  const story = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Story JPEG' }).click();
  const s = await story;
  await s.saveAs(dir + '/certificate-story.png');
  const sp = decode(readFileSync(dir + '/certificate-story.png'));
  expect([sp.width, sp.height]).toEqual([1080, 1920]);
  await page.getByRole('button', { name: 'Copy text', exact: true }).click();
  await expect(page.locator('.share-hint[role=status]')).not.toBeEmpty();
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
    ['/archive?r6', '07-archive'],
    ['/about', '09-about'],
  ]) {
    await page.goto(route);
    await expect(page.locator('.page-heading, .shared-invitation')).toBeVisible();
    await page.waitForTimeout(250);
    await shot(name);
  }
});

test('five strikes close the file and invalid entries cost nothing', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('#answer');
  await input.fill('unknown animal');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.result-panel')).toContainText(
    "Not on today's list; check the spelling.",
  );
  await expect(page.getByRole('img', { name: '0 of 5 strikes' })).toBeVisible();
  for (let i = 1; i <= 5; i++) {
    await input.fill('Pangolin');
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    if (i < 5) await expect(page.getByRole('img', { name: `${i} of 5 strikes` })).toBeVisible();
    else await expect(page.locator('.final-strike')).toContainText("That's 5 strikes.");
  }
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Day summary' })).toBeVisible();
  await expect(page.locator('.file-tally')).toContainText('0/3 claims · 5 strikes');
  await expect(input).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CALL DIBS' })).toHaveCount(0);
});
