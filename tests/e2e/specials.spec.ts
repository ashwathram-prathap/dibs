import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
test('house strike, gold stamp, gold certificate and verified archive', async ({ page }, info) => {
  const dir = 'review/devices/' + info.project.name;
  mkdirSync(dir, { recursive: true });
  await page.goto('/?r6=1');
  await expect(page.locator('.practice-banner')).toHaveText('PRACTICE — NOT THE PUBLIC RECORD');
  const input = page.getByLabel('ENTRY:', { exact: true });
  await input.fill('Dog');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.house-strike')).toHaveText(
    'DOG is held by the Registry. Obvious picks are reserved.',
  );
  await expect(page.getByRole('img', { name: '1 of 5 strikes' })).toBeVisible();
  await page.screenshot({ path: dir + '/r6-house-strike.png', fullPage: true });
  await input.fill('Axolotl');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.gold-stamp')).toBeVisible();
  await page.locator('.gold-stamp').screenshot({ path: dir + '/r6-gold-stamp.png' });
  await page.locator('.gold-certificate').screenshot({ path: dir + '/r6-gold-certificate.png' });
  const goldA11y = await new AxeBuilder({ page })
    .include('.gold-certificate')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(goldA11y.violations).toEqual([]);
  await page.goto('/archive?r6=1');
  await expect(page.locator('.reserved-list li')).toHaveCount(10);
  await expect(page.getByText('✓ Verified', { exact: true })).toBeVisible();
  await page.screenshot({ path: dir + '/r6-reserved-list.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
