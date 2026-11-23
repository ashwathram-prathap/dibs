import './test-traffic';
import { chromium } from '@playwright/test';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
const dir = 'review/final';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const checks: any[] = [];
for (const width of [390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      colorScheme: theme,
      recordVideo:
        width === 390 && theme === 'light'
          ? { dir: 'review/final/video', size: { width: 390, height: 844 } }
          : undefined,
    });
    await context.addInitScript(() =>
      Object.defineProperty(navigator, 'canShare', { value: () => false }),
    );
    const page = await context.newPage();
    const shot = async (name: string) => {
      await page.screenshot({ path: `${dir}/${name}-${width}-${theme}.png`, fullPage: true });
      checks.push({
        name,
        width,
        theme,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
    };
    await page.goto('http://127.0.0.1:5173');
    await page.getByLabel('ENTRY:', { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot('today');
    const claim = async (answer: string) => {
      await page.getByLabel('ENTRY:', { exact: true }).fill(answer);
      await page.getByRole('button', { name: 'CALL DIBS' }).click();
      await page.waitForTimeout(1500);
    };
    await claim('Axolotl');
    await claim('Pangolin');
    await shot('mid-game');
    await claim('Okapi');
    await claim('Quokka');
    await page.getByRole('article', { name: 'Day summary' }).waitFor();
    await shot('day-summary');
    if (width === 390 && theme === 'light')
      for (const [button, kind] of [
        ['Feed PNG', 'feed'],
        ['Story PNG', 'story'],
      ]) {
        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: button }).click();
        await (await downloaded).saveAs(`${dir}/day-summary-${kind}.png`);
      }
    for (const [route, name] of [
      ['/certificate/fixture-1', 'certificate'],
      ['/archive', 'archive'],
      ['/about', 'about'],
      ['/stats', 'stats'],
    ]) {
      await page.goto('http://127.0.0.1:5173' + route);
      await page.waitForTimeout(700);
      await shot(name);
    }
    await page.goto('http://127.0.0.1:5173');
    await page.getByLabel('ENTRY:', { exact: true }).waitFor();
    for (let i = 0; i < 5; i++) await claim('Pangolin');
    await shot('five-strikes');
    const video = page.video();
    await context.close();
    if (video) copyFileSync(await video.path(), `${dir}/claim-moment.webm`);
  }
await browser.close();
writeFileSync('review/round3/visual-checks.json', JSON.stringify(checks, null, 2));
if (checks.some((x) => x.overflow)) throw Error('Horizontal overflow');
