import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const phase = 'after';
mkdirSync('review/final/round17', { recursive: true });
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
        ['leaderboard', '/leaderboard'],
        ['how', '/how-it-works'],
        ['office', '/about'],
        ['certificate', '/certificate/fixture-1'],
        ['archive', '/archive'],
        ['stats', '/stats'],
        ['admin', '/admin/live'],
        ['calendar', '/admin/schedule'],
        ['error', '/not-a-page'],
      ]) {
        await p.goto('http://127.0.0.1:5199' + path);
        await p.locator('.loading').waitFor({ state: 'hidden' });
        if (name === 'done')
          for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
            await p.locator('#answer').fill(answer);
            await p.locator('#answer').press('Enter');
            if (answer !== 'Quokka')
              await p.getByRole('button', { name: /Next (dibs|claim)/ }).click();
          }
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(750);
        await p.screenshot({
          path: `review/final/round17/${name}-${width}-${theme}-${phase}.png`,
          fullPage: true,
        });
        metrics.push({
          name,
          width,
          theme,
          words: await p.locator('main').evaluate((el) => {
            const clone = el.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('select,option,script,style').forEach((n) => n.remove());
            return (clone.innerText || el.innerText).trim().split(/\s+/).length;
          }),
          overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        });
      }
      await c.close();
    }
} finally {
  await b.close();
  writeFileSync(`review/round17/${phase}-metrics.json`, JSON.stringify(metrics, null, 2));
}
