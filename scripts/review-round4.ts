import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const browser = await chromium.launch();
const results: any[] = [];
mkdirSync('review/final', { recursive: true });
mkdirSync('review/round4', { recursive: true });
for (const width of [390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      colorScheme: theme,
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto('http://127.0.0.1:5173/certificate/fixture-1');
    await page.getByRole('button', { name: 'SHARE', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator('.share-area')
      .screenshot({ path: `review/final/share-sheet-${width}-${theme}.png` });
    if (width === 390 && theme === 'light')
      for (const kind of ['story', 'feed']) {
        const d = page.waitForEvent('download');
        await page
          .getByRole('button', { name: kind === 'story' ? 'Story PNG' : 'Feed PNG', exact: true })
          .click();
        await (await d).saveAs(`review/final/certificate-${kind}.png`);
        const png = PNG.sync.read(readFileSync(`review/final/certificate-${kind}.png`));
        results.push({ kind, width: png.width, height: png.height });
      }
    await page.goto('http://127.0.0.1:5173/');
    for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
      await page.getByLabel('ENTRY:', { exact: true }).fill(answer);
      await page.getByRole('button', { name: 'CALL DIBS' }).click();
      await page.getByRole('article', { name: 'Certificate of Dibs for ' + answer }).waitFor();
      await page.waitForTimeout(1100);
    }
    await page.evaluate(() => {
      history.pushState({}, '', '/summary/fixture-summary');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.getByRole('button', { name: 'SHARE', exact: true }).waitFor();
    await page.screenshot({
      path: `review/final/public-summary-${width}-${theme}.png`,
      fullPage: true,
    });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw Error('Public summary overflow');
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        json: {
          days: [],
          platforms: [
            'native',
            'x',
            'whatsapp',
            'facebook',
            'instagram-tiktok',
            'copy-link',
            'copy-text',
            'story',
            'feed',
          ].map((platform) => ({ platform, shares: 0, arrivals: 0 })),
          d1: { retained: 0, eligible: 0 },
          d7: { retained: 0, eligible: 0 },
        },
      }),
    );
    await page.goto('http://127.0.0.1:5173/stats');
    await page.getByLabel('Admin token').fill('local-visual-fixture');
    await page.getByRole('button', { name: 'Read the record' }).click();
    await page.getByText('instagram-tiktok', { exact: true }).waitFor();
    await page.screenshot({
      path: `review/final/stats-platforms-${width}-${theme}.png`,
      fullPage: true,
    });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw Error('Stats overflow');
    await page.close();
  }
await browser.close();
for (const artifact of [
  'certificate-story',
  'day-summary-story',
  'certificate-feed',
  'day-summary-feed',
]) {
  const png = PNG.sync.read(readFileSync(`review/final/${artifact}.png`));
  const story = artifact.endsWith('story');
  if (png.width !== 1080 || png.height !== (story ? 1920 : 1350))
    throw Error('Wrong export dimensions');
  if (story) {
    for (let y = 0; y < png.height; y++) {
      if (y >= 160 && y < 1660) continue;
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4;
        if (png.data[i] !== 241 || png.data[i + 1] !== 236 || png.data[i + 2] !== 226)
          throw Error('Story content outside safe area: ' + artifact);
      }
    }
  }
  results.push({
    artifact,
    width: png.width,
    height: png.height,
    storySafeArea: story ? '160 top / 260 bottom: clear' : 'not applicable',
  });
}
writeFileSync('review/round4/export-checks.json', JSON.stringify(results, null, 2));
