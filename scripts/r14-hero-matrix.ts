import './test-traffic';
import { chromium, webkit, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const names = [
  ...new Set([
    'Novels & novellas',
    'Fruits & vegetables',
    ...JSON.parse(readFileSync('scripts/category-sources.json', 'utf8')).map((c: any) => c.name),
  ]),
] as string[];
const results: any[] = [],
  captures: { path: string; label: string }[] = [];
mkdirSync('review/round14/matrix', { recursive: true });
const base = 'http://127.0.0.1:5176';
async function measure(p: Page) {
  return p.evaluate(() => {
    const box = (s: string) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
    };
    const h = document.querySelector('h1.category');
    const range = document.createRange();
    if (h) range.selectNodeContents(h);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      hero: box('h1.category'),
      input: box('#answer'),
      button: box('.input-row .primary'),
      intro: box('.game-intro'),
      clock: box('.clock'),
      heroFits: !h || range.getBoundingClientRect().width <= h.clientWidth + 1,
      scrollY,
      height: innerHeight,
    };
  });
}
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (const [width, height] of sizes)
      for (const theme of ['light', 'dark'] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme: theme,
          timezoneId: 'America/Toronto',
          isMobile: width < 1100,
          hasTouch: width < 1100,
        });
        await context.addInitScript(() => {
          (window as any).__name = (fn: any) => fn;
        });
        const p = await context.newPage();
        const label = `${engine.name()}-${width}x${height}-${theme}`;
        const failures: string[] = [];
        await p.goto(base + '/?r6');
        await p.locator('#answer').waitFor();
        await p.evaluate(() => document.fonts.ready);
        for (const name of ['Animals', ...names]) {
          await p.locator('h1.category').evaluate((e, name) => {
            e.textContent = name;
            e.className = name.length > 12 ? 'category long' : 'category';
            e.style.width = 'calc(100% - 1px)';
          }, name);
          await p.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          await p.locator('h1.category').evaluate((e) => {
            e.style.width = '100%';
          });
          await p.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          const m = await measure(p);
          if (m.overflow || !m.heroFits || m.hero!.right > width + 1)
            failures.push('category overflow: ' + name);
          if (width <= 430 && height > width && (m.button!.bottom > height || m.hero!.top < 0))
            failures.push('portrait action below fold: ' + name + ' ' + m.button!.bottom);
          if (width === 844 && height === 390 && m.button!.bottom > height * 2)
            failures.push('landscape scroll > one viewport: ' + name);
        }
        // Capture the long two-word heading after all catalog names have been checked.
        await p.locator('h1.category').evaluate((e) => {
          e.textContent = 'Fruits & vegetables';
          e.className = 'category long';
          e.style.width = 'calc(100% - 1px)';
        });
        await p.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const live = await measure(p);
        if (live.intro!.top < live.input!.bottom) failures.push('rules before input');
        let path = `review/round14/matrix/${label}-live.png`;
        await p.screenshot({ path });
        captures.push({ path, label: label + ' live' });
        // A reduced visual viewport emulates the area left by an on-screen keyboard.
        if (width <= 430) {
          await p.locator('#answer').focus();
          await p.setViewportSize({ width, height: Math.max(280, height - 310) });
          await p.waitForTimeout(200);
          const k = await measure(p);
          if (k.input!.top < 0 || k.button!.bottom > k.height + 1)
            failures.push('keyboard obscures form');
          await p.setViewportSize({ width, height });
          await p.locator('#answer').blur();
          await p.evaluate(() => scrollTo(0, 0));
        }
        // Text-size stress without shrinking hit targets: emulate 130% text with computed font sizes.
        await p.evaluate(() => {
          const nodes = [...document.querySelectorAll<HTMLElement>('header *,main *')];
          const sizes = nodes.map((e) => parseFloat(getComputedStyle(e).fontSize));
          nodes.forEach((e, i) => (e.style.fontSize = sizes[i] * 1.3 + 'px'));
        });
        await p.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const text = await measure(p);
        if (text.overflow || !text.heroFits || text.hero!.right > width + 1)
          failures.push('130% text overflow');
        await p.goto(base + '/?r7-closed');
        await p.locator('.closed-office .clock').waitFor();
        await p.evaluate(() => document.fonts.ready);
        const closed = await measure(p);
        if (
          closed.overflow ||
          closed.clock!.right > width + 1 ||
          closed.clock!.top > closed.intro!.top
        )
          failures.push('closed overflow/order');
        const clock = await p.locator('.clock').evaluate((e) => ({
          variant: getComputedStyle(e).fontVariantNumeric,
          parts: [...e.querySelectorAll('.clock-part')].map((x) => {
            const r = x.getBoundingClientRect();
            return { left: r.left, right: r.right };
          }),
        }));
        if (
          !clock.variant.includes('tabular-nums') ||
          clock.parts.some((r) => r.left < 0 || r.right > width)
        )
          failures.push('clock clips or non-tabular');
        path = `review/round14/matrix/${label}-closed.png`;
        await p.screenshot({ path });
        captures.push({ path, label: label + ' closed' });
        // 200% browser zoom equivalent: halve the CSS viewport at the same physical screen size.
        if (width >= 768) {
          await p.setViewportSize({ width: width / 2, height: height / 2 });
          const zoom = await measure(p);
          if (zoom.overflow) failures.push('200% zoom closed overflow');
          await p.goto(base + '/?r6');
          await p.locator('#answer').waitFor();
          if ((await measure(p)).overflow) failures.push('200% zoom live overflow');
        }
        results.push({
          engine: engine.name(),
          width,
          height,
          theme,
          categories: names.length + 1,
          live,
          closed,
          failures,
        });
        console.log(label, failures.length ? failures.join('; ') : 'PASS');
        await context.close();
      }
  } finally {
    await browser.close();
    writeFileSync('review/round14/hero-matrix.json', JSON.stringify(results, null, 2));
  }
}
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1800, height: 900 } });
  await p.setContent(
    '<style>body{margin:0;background:#ddd;font:12px monospace;display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:12px}figure{margin:0;min-width:0}img{width:100%;height:360px;object-fit:contain;object-position:top;background:white}figcaption{height:36px}</style>' +
      captures
        .map(
          (c) =>
            `<figure><figcaption>${c.label}</figcaption><img src="data:image/png;base64,${readFileSync(c.path).toString('base64')}"></figure>`,
        )
        .join(''),
  );
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p.screenshot({ path: 'review/round14/hero-matrix.png', fullPage: true });
} finally {
  await b.close();
}
if (results.some((r) => r.failures.length)) throw Error('Hero matrix failed; deploy blocked.');
