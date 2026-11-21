import { test, expect } from '@playwright/test';
test('a fresh phone explains the game and can call dibs without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.game-rule')).toHaveText('Name an animal nobody has claimed yet. First to call it owns it today.');
  await page.evaluate(() => document.fonts.ready);
  for (const locator of [page.locator('h1.category'), page.locator('.game-rule'), page.getByLabel('ENTRY:', {exact:true}), page.getByRole('button', {name:'CALL DIBS'})]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
});
