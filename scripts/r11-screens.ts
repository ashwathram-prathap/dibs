import './test-traffic';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'after',
  base = phase === 'before' ? 'http://127.0.0.1:5174' : 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const metrics: any[] = [];
try {
  for (const width of [390, 1440, 2560])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      for (const [name, path] of [
        ['closed', '/?r7-closed'],
        ['play', '/?r6'],
        ['day', '/?r6'],
        ['mid-round', '/?r6'],
        ['five-strikes', '/?r6'],
        ['gold', '/?r6'],
        ['office-expanded', '/about'],
        ['admin-live', '/admin/live'],
        ['calendar', '/admin/schedule'],
        ['stats', '/stats'],
        ['certificate', '/certificate/fixture-1'],
        ['archive', '/archive'],
        ['office', '/about'],
        ['error', '/not-a-page'],
      ]) {
        await page.goto(base + path);
        await page.locator('.loading').waitFor({ state: 'hidden' });
        if (name === 'office-expanded')
          await page
            .getByText('More about the game', { exact: true })
            .click()
            .catch(() => {});
        if (['day', 'mid-round', 'five-strikes', 'gold'].includes(name))
          for (const answer of name === 'five-strikes'
            ? ['Dog', 'Dog', 'Dog', 'Dog', 'Dog']
            : name === 'gold'
              ? ['Axolotl']
              : name === 'mid-round'
                ? ['Okapi']
                : ['Axolotl', 'Okapi', 'Quokka']) {
            await page.locator('#answer').fill(answer);
            await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
            if (name === 'five-strikes') {
              if (
                phase === 'before' &&
                (await page.getByRole('button', { name: 'See my file' }).count())
              )
                await page.getByRole('button', { name: 'See my file' }).click();
              continue;
            }
            if (name === 'gold') continue;
            if (phase === 'before')
              await page
                .getByRole('button', { name: answer === 'Quokka' ? 'See my file' : 'Next dibs' })
                .click();
            else if (answer !== 'Quokka')
              await page.getByRole('button', { name: 'Next dibs' }).click();
          }
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(650);
        const pathOut = `review/round11/vs-r7/${name}-${width}-${theme}-${phase}.png`;
        await page.screenshot({ path: pathOut, fullPage: true });
        metrics.push({
          name,
          width,
          theme,
          phase,
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          edges: await page
            .locator('.masthead, .closed-office, .focused-play, .file-key-panel, footer')
            .evaluateAll((els) =>
              els.map((el) => ({
                class: el.className,
                x: el.getBoundingClientRect().x,
                right: el.getBoundingClientRect().right,
              })),
            ),
        });
      }
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(`review/round11/${phase}-metrics.json`, JSON.stringify(metrics, null, 2));
}
