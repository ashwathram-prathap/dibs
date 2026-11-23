import './test-traffic';
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('review/fallbacks', { recursive: true });
const browser = await chromium.launch();
const checks = [];
try {
  for (const scenario of ['reduced-motion', 'low-power', 'blocked-storage']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: scenario === 'reduced-motion' ? 'reduce' : 'no-preference',
    });
    if (scenario === 'low-power')
      await context.addInitScript({
        content: "Object.defineProperty(navigator,'hardwareConcurrency',{value:2})",
      });
    if (scenario === 'blocked-storage')
      await context.addInitScript({
        content:
          "Object.defineProperty(window,'localStorage',{get:function(){throw new DOMException('Storage disabled','SecurityError')}})",
      });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5173');
    await page.getByLabel('ENTRY:', { exact: true }).fill('Axolotl');
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    await page.getByRole('article').waitFor();
    await page.waitForTimeout(1400);
    if (
      scenario === 'reduced-motion' &&
      (await page.locator('.cert-answer').evaluate((e) => getComputedStyle(e).animationName)) !==
        'none'
    )
      throw new Error('Reduced motion ignored');
    if (
      scenario === 'low-power' &&
      !(await page.locator('html').evaluate((e) => e.classList.contains('low-power')))
    )
      throw new Error('Static stamp fallback not selected');
    await page.screenshot({ path: 'review/fallbacks/' + scenario + '.png', fullPage: true });
    checks.push({ scenario, passed: true });
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('https://dibs.here');
  if (!(await page.locator('noscript').isVisible()))
    throw new Error('No JavaScript fallback missing');
  checks.push({ scenario: 'javascript-disabled-notice', passed: true });
  await context.close();
  writeFileSync('review/fallbacks/results.json', JSON.stringify(checks, null, 2));
  console.log('All four fallback checks passed');
} finally {
  await browser.close();
}
