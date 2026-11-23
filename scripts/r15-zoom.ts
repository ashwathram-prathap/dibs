import './test-traffic';
import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const result: any[] = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    for (const [physicalWidth, physicalHeight] of [
      [320, 568],
      [375, 667],
      [390, 844],
      [393, 852],
      [430, 932],
      [360, 800],
      [412, 915],
    ])
      for (const theme of ['light', 'dark'] as const) {
        const p = await b.newPage({
          viewport: {
            width: Math.floor(physicalWidth / 2),
            height: Math.floor(physicalHeight / 2),
          },
          deviceScaleFactor: 2,
          colorScheme: theme,
        });
        await p.goto('http://127.0.0.1:5190/?r6');
        await p.locator('#answer').waitFor();
        await p.evaluate(() => document.fonts.ready);
        await p.locator('#answer').blur();
        await p.waitForTimeout(100);
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        const nav = await p.locator('nav[aria-label="Main navigation"]').boundingBox();
        const viewport = p.viewportSize()!;
        const labels = await p.locator('nav[aria-label="Main navigation"] a').allTextContents();
        const check = {
          engine: engine.name(),
          physicalWidth,
          physicalHeight,
          cssWidth: viewport.width,
          zoom: 200,
          theme,
          overflow,
          navFits: !!nav && nav.x >= 0 && nav.x + nav.width <= viewport.width + 1,
          labels,
        };
        result.push(check);
        await p.screenshot({
          path: `review/round15/matrix/${engine.name()}-${physicalWidth}x${physicalHeight}-${theme}-zoom200.png`,
          fullPage: true,
        });
        await p.close();
      }
  } finally {
    await b.close();
  }
}
writeFileSync('review/round15/zoom200.json', JSON.stringify(result, null, 2));
console.log(result.filter((r) => r.overflow || !r.navFits));
if (result.some((r) => r.overflow || !r.navFits)) process.exitCode = 1;
