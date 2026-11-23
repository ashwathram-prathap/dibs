import './test-traffic';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const practice = process.argv[2] === 'practice';
const origin = practice ? 'https://practice.dibs-7hz.pages.dev' : 'https://dibs.here';
const checks: any[] = [];
mkdirSync('review/round7', { recursive: true });
const check = (name: string, passed: boolean, detail?: any) => {
  checks.push({ name, passed, detail });
};
const todayResponse = await fetch(origin + '/api/today', { cache: 'no-store' });
const today: any = await todayResponse.json();
check(
  'fresh server clock',
  Math.abs(Date.now() - Date.parse(today.serverTime)) < 3000,
  today.serverTime,
);
check('correct environment', today.practice === practice);
if (!practice)
  check(
    'launch schedule unchanged',
    today.nextDrop === '2026-11-24T02:00:00.000Z' && !today.category && today.claimed === 0,
    { nextDrop: today.nextDrop, claimed: today.claimed },
  );
else
  check(
    'existing commitment retained',
    today.specials.goldenTotal === 3 && /^[a-f0-9]{64}$/.test(today.specials.commitment),
    { goldenTotal: today.specials.goldenTotal },
  );
const html = await (await fetch(origin)).text();
check('no fixture in HTML', !/fixture-animals|fixture-reader|Teal Otter #41/.test(html));
const image = html.match(/property="og:image" content="([^"]+)"/)?.[1];
if (image) {
  const r = await fetch(image);
  const bytes = await r.arrayBuffer();
  check(
    'real OG PNG',
    r.ok &&
      r.headers.get('content-type')?.includes('image/png') === true &&
      bytes.byteLength < 300000,
    { bytes: bytes.byteLength },
  );
}
const browser = await chromium.launch();
try {
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
        timezoneId: 'America/Toronto',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin);
      await page.locator('.clock').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const clock = await page.locator('.clock').textContent();
      check(`${width} ${theme} countdown`, /^\d{2}:\d{2}:\d{2}$/.test(clock || ''), clock);
      check(
        `${width} ${theme} local drop`,
        practice ||
          (await page.locator('.drop-countdown .local-drop').textContent()) === '9:00 PM ET',
      );
      check(
        `${width} ${theme} no overflow`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
      if (practice) {
        const box = await page.getByRole('button', { name: 'CALL DIBS' }).boundingBox();
        check(
          `${width} ${theme} input above fold`,
          !!box && box.y + box.height <= (width === 390 ? 844 : 900),
        );
        check(
          `${width} ${theme} golden count`,
          (await page.locator('.gold-announcement').textContent())?.includes(
            `of ${today.specials.goldenTotal}`,
          ),
        );
      }
      await page.screenshot({
        path: `review/final/r7-live-${practice ? 'practice' : 'production'}-${width}-${theme}.png`,
        fullPage: true,
      });
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      check(
        `${width} ${theme} accessibility`,
        accessibility.violations.length === 0,
        accessibility.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      );
      check(`${width} ${theme} no application errors`, errors.length === 0, errors);
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(
    `review/round7/live-${practice ? 'practice' : 'production'}.json`,
    JSON.stringify({ origin, checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
  );
}
console.log(
  `${checks.filter((c) => c.passed).length}/${checks.length} ${practice ? 'practice' : 'production'} checks passed`,
);
for (const failed of checks.filter((c) => !c.passed)) console.log(failed);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
