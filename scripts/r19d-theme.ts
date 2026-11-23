import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
const dir = 'review/round19d/samsung';
mkdirSync(dir, { recursive: true });
const normal = await chromium.launch();
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
  await page.goto('http://127.0.0.1:5223/?r19&r7-closed');
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
    const target = await page.locator('.theme-toggle').boundingBox();
    assert.ok(target && target.width >= 44 && target.height >= 44);
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
  const plain = await normal.newPage({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  for (const p of [page, plain]) {
    await p.goto('http://127.0.0.1:5223/certificate/fixture-1?r19&r19c&gold&p=.94');
    await expect(p.locator('.certificate')).toBeVisible();
    await p.evaluate(() => document.fonts.ready);
  }
  for (const theme of ['light', 'dark', 'light']) {
    const shots = [];
    for (const [i, p] of [page, plain].entries()) {
      if ((await p.locator('html').getAttribute('data-theme')) !== theme)
        await p.locator('.theme-toggle').tap();
      await expect(p.locator('html')).toHaveAttribute('data-theme', theme);
      shots.push(
        PNG.sync.read(
          await p
            .locator('.certificate')
            .screenshot({
              path: `${dir}/${theme}-${i ? 'normal' : 'forced'}-certificate.png`,
              animations: 'disabled',
            }),
        ),
      );
    }
    assert.equal(shots[0].data.length, shots[1].data.length);
    const meanDifference =
      shots[0].data.reduce((sum, value, i) => sum + Math.abs(value - shots[1].data[i]), 0) /
      shots[0].data.length;
    assert.ok(meanDifference < 1, `Auto-dark changed the certificate inks: ${meanDifference}`);
    results.push({ theme, meanDifference, passed: true } as any);
  }
  writeFileSync(
    'review/round19d/samsung-theme.json',
    JSON.stringify({ passed: true, results }, null, 2),
  );
} finally {
  await browser.close();
  await normal.close();
}
