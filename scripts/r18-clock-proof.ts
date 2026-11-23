import './test-traffic';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir = 'review/round18/clock';
mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const metrics = [];
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const page = await b.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
      await page.goto('http://127.0.0.1:5198/?r7-closed');
      const clock = page.locator('.closed-office .clock');
      await clock.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await clock.evaluate((el) => (el.textContent = '04:00:00'));
      const after = await page.screenshot({ fullPage: true });
      writeFileSync(`${dir}/r18-${width}-${theme}.png`, after);
      const styles = await clock.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          font: s.fontFamily,
          size: s.fontSize,
          weight: s.fontWeight,
          variation: s.fontVariationSettings,
          spacing: s.letterSpacing,
          filter: s.filter,
        };
      });
      metrics.push({ width, theme, ...styles });
      const before = readFileSync(`review/final/r7-chromium-${width}-${theme}-closed.png`);
      const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:${theme === 'dark' ? '#16150F' : '#F1ECE2'};color:${theme === 'dark' ? '#F1ECE2' : '#16150F'};font:16px sans-serif}.grid{display:grid;grid-template-columns:repeat(2,${width}px);gap:20px}h2{padding:12px;margin:0;font-size:20px}img{width:100%;display:block}.crop{height:${width === 390 ? 330 : 510}px;overflow:hidden}</style><div class=grid><section><h2>R7 original</h2><div class=crop><img src="data:image/png;base64,${before.toString('base64')}"></div></section><section><h2>R18 · same Archivo, visible digit gaps</h2><div class=crop><img src="data:image/png;base64,${after.toString('base64')}"></div></section></div>`;
      writeFileSync(`${dir}/comparison-${width}-${theme}.html`, html);
      await page.setViewportSize({ width: width * 2 + 20, height: width === 390 ? 400 : 600 });
      await page.setContent(html);
      await page
        .locator('img')
        .evaluateAll((els) => Promise.all(els.map((el) => (el as HTMLImageElement).decode())));
      await page.screenshot({ path: `${dir}/comparison-${width}-${theme}.png`, fullPage: true });
      await page.close();
    }
} finally {
  await b.close();
}
const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
writeFileSync(
  `${dir}/metrics.json`,
  JSON.stringify(
    {
      originalFont: hash(execFileSync('git', ['show', 'r7-done:public/fonts/archivo.woff2'])),
      currentFont: hash(readFileSync('public/fonts/archivo.v2.woff2')),
      note: 'R7 clock font shorthand resets stretch to normal (wdth 100). Matched the supplied reference and actual R7 CSS, retaining weight 900 and adding positive gaps; phone size only decreases enough to fit those gaps.',
      metrics,
    },
    null,
    2,
  ),
);
