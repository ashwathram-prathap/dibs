import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'after';
const b = await chromium.launch();
const metrics = [];
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const c = await b.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
        timezoneId: 'America/Toronto',
      });
      const p = await c.newPage();
      for (const [name, path] of [
        ['closed', '/?r7-closed'],
        ['live', '/?r6'],
        ['done', '/?r6'],
        ['office', '/about'],
      ]) {
        await p.goto('http://127.0.0.1:5175' + path);
        await p.locator('.loading').waitFor({ state: 'hidden' });
        if (name === 'done')
          for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
            await p.locator('#answer').fill(answer);
            await p.locator('#answer').press('Enter');
            if (answer !== 'Quokka')
              await p.getByRole('button', { name: /Next (dibs|claim)/ }).click();
          }
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(350);
        await p.screenshot({
          path: `review/round12/${name}-${width}-${theme}-${phase}.png`,
          fullPage: true,
        });
        metrics.push({
          name,
          width,
          theme,
          words: (await p.locator('body').innerText()).trim().split(/\s+/).length,
          overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        });
      }
      await c.close();
    }
} finally {
  await b.close();
  writeFileSync(`review/round12/${phase}-metrics.json`, JSON.stringify(metrics, null, 2));
}
