import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('https://practice.dibs-7hz.pages.dev/brand-proof');
  await page.locator('.brand-directions').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator('.brand-directions')
    .screenshot({ path: 'review/round9/brand-directions/side-by-side.png' });
  for (const direction of ['a', 'b'])
    await page
      .locator('.direction-' + direction)
      .screenshot({ path: 'review/round9/brand-directions/direction-' + direction + '.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'review/round9/brand-directions/mobile.png', fullPage: true });
} finally {
  await browser.close();
}
