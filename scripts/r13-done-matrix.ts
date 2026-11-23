import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const sizes = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [360, 800],
  [412, 915],
  [768, 1024],
  [1024, 768],
  [1024, 1366],
  [1366, 1024],
  [844, 390],
  [1280, 900],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];
const results: any[] = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    for (const [width, height] of sizes)
      for (const theme of ['light', 'dark'] as const) {
        const c = await b.newContext({
          viewport: { width, height },
          colorScheme: theme,
          timezoneId: 'America/Toronto',
          isMobile: width < 1100,
          hasTouch: width < 1100,
          reducedMotion: 'reduce',
        });
        const p = await c.newPage();
        await p.goto('http://127.0.0.1:5176/?r6');
        await p.locator('#answer').waitFor();
        for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
          await p.locator('#answer').fill(answer);
          await p.locator('#answer').press('Enter');
          if (answer !== 'Quokka')
            await p.getByRole('button', { name: 'Next claim', exact: true }).click();
        }
        await p.locator('.day-certificate').waitFor();
        await p.evaluate(() => document.fonts.ready);
        const metrics = await p.evaluate(() => {
          const hero = document.querySelector('.file-closed-stamp')!.getBoundingClientRect(),
            cert = document.querySelector('.day-certificate')!.getBoundingClientRect();
          return {
            scrollWidth: document.documentElement.scrollWidth,
            hero: { left: hero.left, right: hero.right, top: hero.top, bottom: hero.bottom },
            certificateTop: cert.top,
          };
        });
        const failures = [];
        if (
          metrics.scrollWidth > width + 1 ||
          metrics.hero.left < -1 ||
          metrics.hero.right > width + 1
        )
          failures.push('done overflow');
        if (metrics.hero.top < 0) failures.push('result scrolled above viewport');
        if (metrics.hero.bottom > metrics.certificateTop)
          failures.push('result must precede certificate');
        const label = `${engine.name()}-${width}x${height}-${theme}`;
        await p.screenshot({ path: `review/round13/matrix/${label}-done.png` });
        results.push({ engine: engine.name(), width, height, theme, ...metrics, failures });
        console.log(label, failures.length ? failures : 'PASS');
        await c.close();
      }
  } finally {
    await b.close();
    writeFileSync('review/round13/done-matrix.json', JSON.stringify(results, null, 2));
  }
}
// One contact sheet for all 15 sizes, both themes, both engines and all three states.
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1800, height: 900 } });
  await p.setContent(
    '<style>body{margin:0;background:#ddd;font:12px monospace;display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:12px}figure{margin:0;min-width:0}img{width:100%;height:360px;object-fit:contain;object-position:top;background:white}figcaption{height:36px}</style>' +
      results
        .flatMap((r) =>
          ['closed', 'live', 'done'].map((state) => {
            const label = `${r.engine}-${r.width}x${r.height}-${r.theme}-${state}`;
            return `<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${readFileSync(`review/round13/matrix/${label}.png`).toString('base64')}"></figure>`;
          }),
        )
        .join(''),
  );
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p.screenshot({ path: 'review/round13/hero-matrix.png', fullPage: true });
} finally {
  await b.close();
}
if (results.some((r) => r.failures.length))
  throw Error('Done-state matrix failed; deploy blocked.');
