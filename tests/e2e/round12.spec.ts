import { test, expect } from './security-fixture';
import { GAME_EXPLANATION, LIMIT_EXPLANATION } from '../../shared/copy';
test('R12 first visitor sees plain rules and a full worked example in every home state', async ({
  page,
}) => {
  for (const path of ['/?r7-closed', '/?r6']) {
    await page.goto(path);
    await expect(page.locator('.game-explanation')).toContainText(GAME_EXPLANATION);
    await expect(page.locator('.game-explanation')).toContainText(LIMIT_EXPLANATION);
    await expect(page.locator('.worked-example p')).toHaveCount(3);
    expect(
      await page
        .locator('.game-explanation')
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(18);
    await expect(page.locator('body')).not.toContainText(/file key/i);
  }
  for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
    if (answer !== 'Quokka') await page.getByRole('button', { name: 'Next claim' }).click();
  }
  await expect(page.locator('.day-certificate')).toBeVisible();
  await expect(page.locator('.game-explanation')).toBeVisible();
  await page.locator('#file-settings summary').click();
  await expect(page.getByLabel('Backup code', { exact: true })).toBeVisible();
});
