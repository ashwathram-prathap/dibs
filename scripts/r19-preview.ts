import './test-traffic';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const results = [];
for (const width of [320, 390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    const page = await browser.newPage({
      viewport: { width, height: width < 768 ? 844 : 1000 },
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    await page.goto('http://127.0.0.1:5199/?r6');
    await page.locator('#answer').fill('Axolotl');
    await page.locator('#answer').press('Enter');
    await page.locator('.win-stamp').waitFor();
    await page.evaluate(() => document.fonts.ready);
    mkdirSync('review/round19/previews', { recursive: true });
    await page.screenshot({
      path: `review/round19/previews/payoff-${width}-${theme}.png`,
      fullPage: true,
    });
    results.push({
      width,
      theme,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    });
    for (const answer of ['Okapi', 'Quokka']) {
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
      await page.locator('#answer').fill(answer);
      await page.locator('#answer').press('Enter');
    }
    await page.locator('.day-certificate').waitFor();
    await page.getByRole('button', { name: 'SHARE', exact: true }).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `review/round19/previews/done-${width}-${theme}.png`,
      fullPage: true,
    });
    await page.locator('.header-settings > summary').click();
    await page.locator('#file-settings > summary').click();
    await page.getByRole('button', { name: 'Delete my data', exact: true }).click();
    await page.evaluate(() => (document.documentElement.style.fontSize = '20.8px'));
    await page.screenshot({ path: `review/round19/previews/settings-${width}-${theme}.png` });
    await page.close();
  }
await browser.close();
writeFileSync('review/round19/previews/results.json', JSON.stringify(results, null, 2));
