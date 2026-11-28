import { test, expect } from './security-fixture';
test('changing answer visibility preserves the copy target and private caption', async ({
  page,
}, info) => {
  await page.addInitScript(
    (scale) => {
      document.addEventListener(
        'DOMContentLoaded',
        () => (document.documentElement.style.fontSize = `${16 * scale}px`),
      );
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__copied = text;
          },
        },
      });
    },
    Number(info.project.metadata.scale || 1),
  );
  await page.goto('/?r19&r19c&r6&gold');
  for (const answer of ['Okapi', 'Quokka', 'Wombat']) {
    await page.locator('#answer').fill(answer);
    await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await expect(page.locator('.win-stamp')).toContainText(answer.toUpperCase());
  }
  await page.evaluate(() => {
    history.pushState(null, '', '/certificate/fixture-2');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('.certificate-page .share-area')).toBeVisible();
  const more = page.getByRole('button', { name: 'More', exact: true });
  if (await more.isVisible()) await more.click();
  await page.locator('.copy-result').click();
  await expect.poll(() => page.evaluate(() => (window as any).__copied || '')).toContain('Okapi');
  await page.getByLabel('Hide my answers', { exact: true }).check();
  await expect(page.locator('html')).not.toHaveClass(/keyboard-open/);
  await page.locator('.copy-result').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__copied || ''))
    .not.toContain('Okapi');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
