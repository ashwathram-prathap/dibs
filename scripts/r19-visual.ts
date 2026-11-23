import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const results: any[] = [];
const sizes = [
  { width: 390, height: 844 },
  { width: 768, height: 1000 },
  { width: 1440, height: 1000 },
  { width: 1920, height: 1080 },
];
const phones = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
for (const [group, profiles] of [
  ['payoff', sizes],
  ['payoff-phone', phones],
] as const) {
  mkdirSync('review/round19/' + group, { recursive: true });
  for (const size of profiles)
    for (const theme of ['light', 'dark'] as const)
      for (const scale of group === 'payoff-phone' ? [1, 1.3] : [1])
        for (const percentile of group === 'payoff-phone' ? [0.05] : [0.05, 0.5, 0.94]) {
          const engine =
            group === 'payoff-phone' && [375, 390, 430].includes(size.width) ? webkit : chromium;
          const b = await engine.launch();
          const p = await b.newPage({
            viewport: size,
            colorScheme: theme,
            reducedMotion: 'reduce',
            timezoneId: 'America/Toronto',
          });
          await p.goto(`http://127.0.0.1:5199/?r19&r6&p=${percentile}`);
          await p.locator('#answer').waitFor();
          await p.evaluate(
            (scale) => (document.documentElement.style.fontSize = 16 * scale + 'px'),
            scale,
          );
          await p
            .locator('#answer')
            .fill(percentile < 0.1 ? 'Deer' : percentile === 0.5 ? 'Okapi' : 'Axolotl');
          await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
          await p.locator('.win-stamp').waitFor();
          await p.evaluate(() => document.fonts.ready);
          await p.waitForTimeout(150);
          await p.screenshot({
            path: `review/round19/${group}/${size.width}-${size.height}-${theme}-${scale}-${percentile}.png`,
            fullPage: true,
          });
          results.push({
            group,
            ...size,
            theme,
            scale,
            percentile,
            overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          });
          await b.close();
        }
}
writeFileSync('review/round19/visual-metrics.json', JSON.stringify(results, null, 2));
