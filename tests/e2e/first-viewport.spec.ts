import { test, expect } from './security-fixture';
test('a fresh phone explains the game and can call dibs without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.play-heading')).toContainText('Animals');
  await page.evaluate(() => document.fonts.ready);
  for (const locator of [
    page.locator('h1.category'),
    page.locator('#answer'),
    page.getByRole('button', { name: 'CALL DIBS' }),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
});
test('certificate and canvas export never print the local origin', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).printed = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      (window as any).printed.push(text);
      return original.call(this, text, ...(args as [number, number]));
    };
    Object.defineProperty(navigator, 'canShare', { value: () => false });
  });
  await page.goto('/certificate/fixture-1');
  await expect(page.locator('.cert-footer')).toContainText('dibs.here');
  await page.getByText('More ways to share', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Story JPEG' }).click();
  await download;
  const text = await page.evaluate(() => (window as any).printed.join(' '));
  expect(text).toContain('dibs.here');
  expect(text).not.toMatch(/127\.0\.0\.1|localhost|5173/);
  const label = await page
    .locator('.dibs-stamp span')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(label).toBeGreaterThanOrEqual(9);
});
