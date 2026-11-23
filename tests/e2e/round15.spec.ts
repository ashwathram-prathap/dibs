import { test, expect } from './security-fixture';
test('R15 navigation has four labelled icons and disappears around the phone keyboard', async ({
  page,
}) => {
  await page.goto('/?r6');
  await page.locator('#answer').waitFor();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  expect(
    await nav
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('aria-label'))),
  ).toEqual(['Play', 'Leaderboard', 'Archive', 'How it works']);
  expect(await nav.getByRole('link').allInnerTexts()).toEqual(
    page.viewportSize()!.width < 768
      ? ['Play', 'Board', 'Archive', 'How to play']
      : ['Play', 'Leaderboard', 'Archive', 'How it works'],
  );
  expect(await nav.locator('svg').count()).toBe(4);
  const width = page.viewportSize()!.width;
  if (width < 768) {
    await expect(nav).toBeVisible();
    await page.locator('#answer').focus();
    await expect(nav).toBeHidden();
    await page.locator('#answer').blur();
    await expect(nav).toBeVisible();
  }
  await page.locator('.header-settings > summary').click();
  await expect(page.locator('.theme-toggle')).toBeVisible();
  await expect(page.locator('.music-toggle')).toBeVisible();
});
test('R15 Copy result stays spoiler-free and native sharing sends only the file', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).copied = '';
    (window as any).shared = null;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (t: string) => {
          (window as any).copied = t;
        },
      },
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: async (data: any) => {
        (window as any).shared = data;
      },
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
  });
  await page.goto('/?r6');
  for (const [i, answer] of ['Okapi', 'Quokka', 'Wombat'].entries()) {
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
    await page
      .getByRole('button', { name: i < 2 ? 'Next claim' : 'See my results', exact: true })
      .click();
  }
  await page.getByRole('button', { name: 'Copy result', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  const data = await page.evaluate(() => ({
    copy: (window as any).copied,
    shareKeys: Object.keys((window as any).shared),
  }));
  expect(data.shareKeys).toEqual(['files']);
  expect(data.copy).toBe("I scored 180 on today's Dibs (Animals), #1 of 1. dibs.here");
  expect(data.copy).not.toMatch(/Okapi|Quokka|Wombat|starts with/);
});
test('R15 unavailable clipboard falls back to selectable text', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw Error('denied');
        },
      },
      configurable: true,
    }),
  );
  await page.goto('/?r6');
  for (const [i, answer] of ['Okapi', 'Quokka', 'Wombat'].entries()) {
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
    await page
      .getByRole('button', { name: i < 2 ? 'Next claim' : 'See my results', exact: true })
      .click();
  }
  await page.getByRole('button', { name: 'Copy result', exact: true }).click();
  await expect(page.locator('textarea.share-copy')).toHaveValue(
    /I scored 180 on today's Dibs \(Animals\), #1 of 1\. dibs\.here/,
  );
  await page.locator('textarea.share-copy').focus();
  expect(
    await page
      .locator('textarea.share-copy')
      .evaluate((e: HTMLTextAreaElement) => e.selectionEnd - e.selectionStart),
  ).toBeGreaterThan(20);
});
