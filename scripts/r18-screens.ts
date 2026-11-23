import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'after';
const origin = process.env.R18_ORIGIN || 'http://127.0.0.1:5198';
const dir = 'review/round18';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const results: any[] = [];
try {
  for (const width of phase === 'before' ? [390, 1440] : [320, 375, 390, 430, 768, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width < 768 ? 844 : 1000 },
        colorScheme: theme,
        timezoneId: 'America/Toronto',
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      for (const [name, path] of [
        ['play', '/?r6'],
        ['done', '/?r6'],
        ['certificate', '/certificate/fixture-1?r17=closed'],
        ['closed', '/?r7-closed'],
        ['settings', '/?r7-closed'],
        ['feedback', '/?r7-closed'],
        ['footer', '/?r7-closed'],
      ]) {
        await page.goto(origin + path);
        await page.locator('.loading').waitFor({ state: 'hidden' });
        if (name === 'done')
          for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
            await page.locator('#answer').fill(answer);
            await page.locator('#answer').press('Enter');
            if (answer !== 'Quokka')
              await page.getByRole('button', { name: /Next (dibs|claim)/ }).click();
          }
        if (name === 'done') await page.locator('.day-certificate').waitFor();
        if (name === 'certificate') await page.locator('.certificate').waitFor();
        if (name === 'settings') {
          await page.locator('.header-settings > summary').click();
          await page.locator('#file-settings > summary').click();
        }
        if (name === 'feedback') await page.locator('#feedback summary').click();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const target = name === 'footer' ? page.locator('footer') : page;
        await target.screenshot({
          path: `${dir}/${phase}-${name}-${width}-${theme}.png`,
          ...(name === 'footer' ? {} : { fullPage: !['settings', 'feedback'].includes(name) }),
        });
        if (name === 'settings') {
          await page.locator('.header-controls').evaluate((el) => (el.scrollTop = el.scrollHeight));
          await page.screenshot({
            path: `${dir}/${phase}-settings-scrolled-${width}-${theme}.png`,
          });
        }
        results.push({
          phase,
          name,
          width,
          theme,
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        });
      }
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(`${dir}/${phase}-metrics.json`, JSON.stringify(results, null, 2));
}
