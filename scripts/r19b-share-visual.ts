import './test-traffic';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const results = [];
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const p = await b.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
        extraHTTPHeaders: { 'x-dibs-test': '1' },
      });
      await p.goto('http://127.0.0.1:5199/?r19&r6&no-analytics=1');
      for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
        await p.locator('#answer').fill(answer);
        await p.locator('#answer').press('Enter');
        if (answer !== 'Quokka')
          await p.getByRole('button', { name: 'Next claim', exact: true }).click();
      }
      await p.getByRole('button', { name: 'Download image', exact: true }).waitFor();
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: `review/round19b/share-${width}-${theme}.png`, fullPage: true });
      results.push({
        width,
        theme,
        overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        linkedin: await p.getByRole('link', { name: 'Post on LinkedIn' }).getAttribute('href'),
      });
      await p.close();
    }
} finally {
  await b.close();
}
writeFileSync('review/round19b/share-visual.json', JSON.stringify(results, null, 2));
