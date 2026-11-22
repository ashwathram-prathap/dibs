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
test('empty submission is free and timezone choice persists across pages', async ({ page }) => {
  await page.goto('/?r6');
  await page.locator('#answer').waitFor();
  await page.locator('#answer').press('Enter');
  await expect(page.locator('.strikes-progress')).toContainText('STRIKES 0/5');
  await page.goto('/?r7-closed');
  await page.getByLabel('Timezone', { exact: true }).selectOption('America/Vancouver');
  await expect(page.locator('.local-drop').first()).toContainText('7:00 PM PT');
  await page.getByRole('link', { name: 'Office notice', exact: true }).click();
  await expect(page.locator('.local-drop').first()).toContainText('7:00 PM PT');
  await page.reload();
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue('America/Vancouver');
  await expect(page.locator('.local-drop').first()).toContainText('7:00 PM PT');
});
test('all disclosure contents stay legible and within the viewport', async ({ page }, info) => {
  for (const [name, path] of [
    ['play', '/?r6'],
    ['closed', '/?r7-closed'],
    ['office', '/about'],
    ['archive', '/archive'],
    ['certificate', '/certificate/fixture-1'],
    ['live', '/admin/live'],
    ['calendar', '/admin/schedule'],
    ['error', '/not-a-page'],
  ]) {
    await page.goto(path);
    await page.locator('main h1').waitFor();
    await page
      .locator('details')
      .evaluateAll((els) => els.forEach((e) => ((e as HTMLDetailsElement).open = true)));
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      name,
    ).toBe(true);
    if (page.viewportSize()!.width >= 900) {
      const small = await page.locator('body *').evaluateAll((els) =>
        els
          .filter(
            (e) =>
              e.getClientRects().length &&
              [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) &&
              parseFloat(getComputedStyle(e).fontSize) < 14,
          )
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            size: getComputedStyle(e).fontSize,
            text: e.textContent?.slice(0, 60),
          })),
      );
      expect(small, name).toEqual([]);
    }
    await page.screenshot({
      path: `review/round11/disclosures/${info.project.name}-${name}.png`,
      fullPage: true,
    });
  }
});
