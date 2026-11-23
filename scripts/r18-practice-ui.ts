import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const checks = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    for (const width of [390, 1440])
      for (const colorScheme of ['light', 'dark'] as const) {
        const p = await b.newPage({ viewport: { width, height: 900 }, colorScheme });
        const errors: string[] = [];
        p.on('pageerror', (e) => errors.push(e.message));
        await p.goto('https://practice.dibs-7hz.pages.dev');
        await expect(p.locator('#answer')).toBeVisible();
        await p.locator('.header-settings > summary').click();
        await p.locator('#file-settings > summary').click();
        expect(
          await p.locator('.header-controls').evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await p.locator('.settings-close').click();
        await p.goto('https://practice.dibs-7hz.pages.dev/about');
        await p.locator('#feedback summary').click();
        await expect(p.getByRole('dialog', { name: 'Send feedback' })).toBeVisible();
        await p.keyboard.press('Escape');
        await expect(p.getByRole('dialog')).toHaveCount(0);
        expect(await p.locator('.share-buttons').count()).toBe(0);
        expect(errors).toEqual([]);
        checks.push({ browser: engine.name(), width, colorScheme, passed: true });
        await p.close();
      }
  } finally {
    await b.close();
  }
}
writeFileSync(
  'review/round18/practice-ui-final.json',
  JSON.stringify(
    {
      passed: true,
      at: new Date().toISOString(),
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      checks,
    },
    null,
    2,
  ),
);
console.log('Final practice UI passed in Chromium and WebKit, phone/desktop, both themes.');
