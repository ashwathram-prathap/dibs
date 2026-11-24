// R19H before/after evidence: claim 0, 1, 2 at phone and desktop widths, both themes.
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, label] = [process.argv[2], process.argv[3]];
const out = `review/round19h/${label}`;
mkdirSync(out, { recursive: true });
const report: any[] = [];
for (const [engine, name] of [
  [chromium, 'chromium'],
  [webkit, 'webkit'],
] as const) {
  const browser = await engine.launch();
  for (const [width, height] of [
    [360, 780],
    [390, 844],
    [1440, 900],
  ])
    for (const colorScheme of ['light', 'dark'] as const) {
      const page = await browser.newPage({
        viewport: { width, height },
        colorScheme,
        reducedMotion: 'reduce',
      });
      await page.goto(base + '/?r19&r6');
      await page.locator('#answer').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const tag = `${name}-${width}-${colorScheme}`;
      await page.screenshot({ path: `${out}/${tag}-claim0.png` });
      for (const [i, answer] of ['Okapi', 'Quokka'].entries()) {
        await page.locator('#answer').fill(answer);
        await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
        await page.locator('.win-stamp').waitFor();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${out}/${tag}-claim${i + 1}.png` });
        const state = await page.evaluate(() => ({
          inputVisible: (() => {
            const el = document.querySelector('#answer');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight;
          })(),
          tableAboveFold: [...document.querySelectorAll('table.leaderboard')].some((t) => {
            const r = t.getBoundingClientRect();
            return r.height > 0 && r.top < innerHeight;
          }),
          focused: document.activeElement?.id || document.activeElement?.textContent?.trim(),
        }));
        report.push({ tag, claim: i + 1, ...state });
        const next = page.getByRole('button', { name: 'Next claim', exact: true });
        if (await next.count()) await next.click();
      }
      await page.close();
    }
  await browser.close();
}
writeFileSync(`${out}/state.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
