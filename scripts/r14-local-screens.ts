import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const results: any[] = [];
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
        reducedMotion: 'reduce',
        timezoneId: 'America/Toronto',
      });
      await page.goto('http://127.0.0.1:5176/?r6');
      await page.locator('#answer').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `review/round14/local-${width}-${theme}-live.png`,
        fullPage: true,
      });
      await page.locator('#answer').fill('Dog');
      await page.locator('#answer').press('Enter');
      await page.locator('.strike-count').waitFor();
      await page.screenshot({
        path: `review/round14/local-${width}-${theme}-strike.png`,
        fullPage: true,
      });
      await page.locator('#answer').fill('Okapi');
      await page.locator('#answer').press('Enter');
      await page.locator('.claim-payoff').waitFor();
      await page.screenshot({
        path: `review/round14/local-${width}-${theme}-payoff.png`,
        fullPage: true,
      });
      results.push({
        width,
        theme,
        payoff: await page.locator('.claim-payoff').boundingBox(),
        viewport: page.viewportSize(),
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
      await page.locator('#answer').fill('Quokka');
      await page.locator('#answer').press('Enter');
      await page.locator('.claim-payoff').waitFor();
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
      await page.locator('#answer').fill('Wombat');
      await page.locator('#answer').press('Enter');
      await page.locator('.day-summary').waitFor();
      await page.screenshot({
        path: `review/round14/local-${width}-${theme}-done.png`,
        fullPage: true,
      });
      await page.close();
    }
} finally {
  await browser.close();
  writeFileSync('review/round14/local-geometry.json', JSON.stringify(results, null, 2));
  console.log(results);
}
