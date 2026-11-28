import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(
    (scale) => {
      document.addEventListener(
        'DOMContentLoaded',
        () => (document.documentElement.style.fontSize = `${16 * scale}px`),
      );
    },
    Number(info.project.metadata.fontScale || 1),
  );
});
for (const variant of ['off', 'missing', 'off&gold'])
  test(`single certificate keeps ${variant} tier, title and private copy truthful`, async ({
    page,
  }, info) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__copied = text;
          },
        },
      });
    });
    await page.goto('/?r19&r19c&r6&r21&' + variant);
    for (const answer of ['Okapi', 'Quokka', 'Wombat']) {
      await page.locator('#answer').fill(answer);
      await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
      await expect(page.locator('.win-stamp')).toContainText(answer.toUpperCase());
    }
    await page.evaluate(() => {
      history.pushState(null, '', '/certificate/fixture-2');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.locator('.title-stamp')).toHaveText('Owner');
    await expect(page.locator('.dibs-stamp span')).toContainText(
      variant.includes('gold')
        ? 'Golden ticket'
        : variant === 'off'
          ? 'Off the register'
          : 'Standard score',
    );
    if (await page.getByRole('button', { name: 'More', exact: true }).isVisible())
      await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.locator('.copy-result')).toBeVisible();
    await page.locator('.copy-result').click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__copied || ''))
      .toContain('Owner so far');
    if (variant.startsWith('off'))
      await expect
        .poll(() => page.evaluate(() => (window as any).__copied || ''))
        .toContain('Off the register');
    await page.getByLabel('Hide my answers', { exact: true }).check();
    await expect(page.locator('html')).not.toHaveClass(/keyboard-open/);
    await expect(page.locator('.copy-result')).toHaveText('Copy result');
    await expect(page.locator('.linkedin-share')).not.toHaveAttribute('href', /Okapi/);
    await page.locator('.copy-result').click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__copied || ''))
      .not.toMatch(/Okapi|Outside|Off the register/);
    const dir = `review/r21-flow/certificate-refresh/${info.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${variant.replace('&', '-')}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
