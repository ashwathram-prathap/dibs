import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
test('R16 header controls, timezone focus and readable content', async ({ page }) => {
  await page.goto('/?r7-closed');
  await page.locator('.closed-office').waitFor();
  await expect(page.locator('.theme-toggle')).toBeVisible();
  expect(await page.locator('.header-settings .theme-toggle').count()).toBe(0);
  await page.locator('.drop-countdown .text-link').click();
  await expect(page.getByLabel('Timezone', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Timezone', { exact: true })).toBeVisible();
  await page.getByLabel('Timezone', { exact: true }).selectOption('America/Vancouver');
  await expect(page.locator('.drop-countdown')).toContainText('PM PT · change in Settings');
  await expect(page.locator('.sound-toggle')).toHaveText(/Sound: (On|Off)/);
  await expect(page.locator('.music-toggle')).toHaveText('Music: Off');
  await page.locator('.header-settings > summary').click();
  await page.goto('/how-it-works');
  await page.locator('.how-page').waitFor();
  const player = await page.locator('.header-player').boundingBox();
  const heading = await page.locator('h1').boundingBox();
  expect(heading!.y - player!.y - player!.height).toBeGreaterThanOrEqual(32);
  expect(await page.locator('.how-page').evaluate((el) => getComputedStyle(el).maxWidth)).not.toBe(
    'none',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
test('R16 clock digits have visible spacing in both themes', async ({ page }) => {
  await page.goto('/?r7-closed');
  await page.locator('.closed-office .clock').waitFor();
  for (const digits of ['44:44:44', '11:11:11', '00:00:00']) {
    await page.locator('.clock').evaluate((el, value) => (el.textContent = value), digits);
    const geometry = await page.locator('.clock').evaluate((el) => {
      const css = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        spacing: parseFloat(css.letterSpacing),
        font: css.fontFamily,
        width: el.scrollWidth,
        available: box.width,
      };
    });
    expect(geometry.font).toContain('Archivo');
    expect(geometry.spacing).toBeGreaterThan(2);
    expect(geometry.width).toBeLessThanOrEqual(geometry.available + 1);
  }
});
