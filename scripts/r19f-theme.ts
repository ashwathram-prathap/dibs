import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
const dir = 'review/round19f/samsung';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  args: ['--force-dark-mode', '--enable-features=WebContentsForceDark'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  });
  await page.goto('http://127.0.0.1:5221/?r19&r7-closed');
  const results = [];
  for (const theme of ['light', 'dark', 'light']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.locator('.theme-toggle').tap();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const details = await page.evaluate(() => ({
      scheme: document.documentElement.style.colorScheme,
      meta: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content'),
      background: getComputedStyle(document.body).backgroundColor,
    }));
    assert.equal(details.scheme, theme);
    assert.equal(details.meta, 'light dark');
    const png = PNG.sync.read(await page.screenshot({ path: `${dir}/${theme}.png` }));
    const p = 4 * (5 * png.width + 5),
      luminance = (png.data[p] + png.data[p + 1] + png.data[p + 2]) / 3;
    assert.ok(
      theme === 'light' ? luminance > 150 : luminance < 100,
      'Browser must not force-invert our real theme',
    );
    results.push({ theme, ...details, luminance, passed: true });
  }
  writeFileSync(
    'review/round19f/samsung-theme.json',
    JSON.stringify({ passed: true, results }, null, 2),
  );
} finally {
  await browser.close();
}
