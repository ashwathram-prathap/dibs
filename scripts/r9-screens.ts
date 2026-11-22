import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'after';
const browser = await chromium.launch();
const report: any[] = [];
try {
  for (const width of [390, 1440, 2560])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      for (const [name, path] of [
        ['play', '/'],
        ['closed', '/?r7-closed'],
        ['complete', '/?r6'],
        ['office', '/about'],
        ['archive', '/archive'],
      ]) {
        await page.goto('http://127.0.0.1:5173' + path);
        await page.locator('.loading').waitFor({ state: 'hidden' });
        if (name === 'complete')
          for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
            await page.locator('#answer').fill(answer);
            await page.getByRole('button', { name: 'CALL DIBS' }).click();
            if (answer !== 'Quokka')
              await page.getByRole('button', { name: /Next dibs|See my file/ }).click();
            else await page.locator('.day-certificate').waitFor();
          }
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.locator('main').evaluate((el) => ({
          words: el.innerText.trim().split(/\s+/).length,
          minFont: Math.min(
            ...Array.from(el.querySelectorAll('*'))
              .filter(
                (e) =>
                  e.childNodes.length &&
                  Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim()) &&
                  e.getBoundingClientRect().height > 0,
              )
              .map((e) => parseFloat(getComputedStyle(e).fontSize)),
          ),
        }));
        mkdirSync(`review/round9/${phase}`, { recursive: true });
        await page.screenshot({
          path: `review/round9/${phase}/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
        report.push({ name, width, theme, ...metrics });
      }
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(`review/round9/${phase}-screens.json`, JSON.stringify(report, null, 2));
}
