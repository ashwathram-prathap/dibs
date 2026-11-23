import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const checks: any[] = [];
mkdirSync('review/round19/examples', { recursive: true });
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    for (const width of [320, 390, 1440])
      for (const theme of ['light', 'dark'] as const) {
        const p = await b.newPage({
          viewport: { width, height: width < 768 ? 844 : 900 },
          colorScheme: theme,
          reducedMotion: 'reduce',
        });
        for (const value of [0, 1, 3, 7, 30, 100]) {
          await p.goto(`http://127.0.0.1:5199/?r19&r6&streak=${value}`);
          await p.locator('#answer').waitFor();
          await p.evaluate(() => document.fonts.ready);
          assert.equal(await p.locator('.streak-chip strong').innerText(), String(value));
          assert.equal(
            await p
              .locator('.streak-chip')
              .evaluate((e) => e.classList.contains('streak-milestone')),
            [3, 7, 30, 100].includes(value),
          );
          await p.locator('.masthead').screenshot({
            path: `review/round19/streak/states-${engine.name()}-${width}-${theme}-${value}.png`,
          });
        }
        checks.push({
          kind: 'streak',
          browser: engine.name(),
          width,
          theme,
          states: [0, 1, 3, 7, 30, 100],
          passed: true,
        });
        await p.close();
      }
    for (const width of [320, 360, 390, 1440])
      for (const theme of ['light', 'dark'] as const) {
        const p = await b.newPage({
          viewport: { width, height: width < 768 ? 844 : 900 },
          colorScheme: theme,
          reducedMotion: 'reduce',
        });
        await p.goto('http://127.0.0.1:5199/how-it-works?r19&r6');
        await p.locator('.example-row').first().waitFor();
        await p.evaluate(() => document.fonts.ready);
        await p.screenshot({
          path: `review/round19/examples/${engine.name()}-${width}-${theme}.png`,
          fullPage: true,
        });
        assert.equal(
          await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        checks.push({ kind: 'examples', browser: engine.name(), width, theme, passed: true });
        await p.close();
      }
    for (const [width, height] of [
      [1470, 956],
      [1440, 900],
    ])
      for (const theme of ['light', 'dark'] as const) {
        const p = await b.newPage({
          viewport: { width: width / 2, height: height / 2 },
          deviceScaleFactor: 2,
          colorScheme: theme,
        });
        await p.goto('http://127.0.0.1:5199/?r19&r7-closed');
        await p.locator('.header-settings > summary').click();
        await p.locator('#file-settings > summary').click();
        await p.getByRole('button', { name: 'Delete my data', exact: true }).click();
        await p.locator('#restore-key').fill('DIBS-ABCDE-12345-FABCD-67890');
        await p.locator('#delete-key').fill('DIBS-ABCDE-12345-FABCD-67890');
        await p.evaluate(() => document.fonts.ready);
        const bad = await p
          .locator('.header-controls')
          .evaluate((panel) =>
            [panel, ...panel.querySelectorAll('*')]
              .filter(
                (e) => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 1,
              )
              .map((e) => e.tagName),
          );
        assert.deepEqual(bad, []);
        assert.equal(
          await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await p.screenshot({
          path: `review/round19/settings/zoom200-${engine.name()}-${width}-${theme}.png`,
        });
        checks.push({
          kind: '200% browser-zoom-equivalent CSS viewport',
          browser: engine.name(),
          physicalViewport: { width, height },
          cssViewport: { width: width / 2, height: height / 2 },
          theme,
          passed: true,
        });
        await p.close();
      }
  } finally {
    await b.close();
  }
}
writeFileSync('review/round19/supplemental.json', JSON.stringify(checks, null, 2));
console.log({ checks: checks.length, passed: true });
