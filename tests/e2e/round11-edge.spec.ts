import { test, expect } from './security-fixture';
test('keyboard-only play, announcements and 200 percent zoom', async ({ page }) => {
  await page.goto('/?r6');
  await page.locator('#answer').waitFor();
  let found = false;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (await page.locator('#answer').evaluate((e) => e === document.activeElement)) {
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
  for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
    await page.keyboard.type(answer);
    await page.keyboard.press('Enter');
    if (answer !== 'Quokka') {
      await expect(page.locator('.win-beat[role=status]')).toContainText(answer.toUpperCase());
      // Tab follows the document to the Next dibs action; no pointer input.
      let next = await page
        .getByRole('button', { name: 'Next dibs' })
        .evaluate((e) => e === document.activeElement);
      for (let i = 0; i < 20 && !next; i++) {
        await page.keyboard.press('Tab');
        if (
          await page
            .getByRole('button', { name: 'Next dibs' })
            .evaluate((e) => e === document.activeElement)
        ) {
          next = true;
          break;
        }
      }
      expect(next).toBe(true);
      await page.keyboard.press('Enter');
      await expect(page.locator('#answer')).toBeFocused();
    }
  }
  await expect(page.locator('.day-certificate')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('sound choice persists and reduced motion uses the quiet stamp', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r6');
  await page.getByRole('button', { name: 'Turn stamp sound off' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Turn stamp sound on' })).toBeVisible();
  await page.locator('#answer').fill('Axolotl');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('.win-stamp')).toBeVisible();
  expect(await page.locator('.win-stamp').evaluate((e) => getComputedStyle(e).animationName)).toBe(
    'ink-fade',
  );
});
