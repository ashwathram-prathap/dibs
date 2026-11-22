import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const samples: any[] = [];
try {
  for (let batch = 0; batch < 2; batch++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('https://practice.dibs-7hz.pages.dev');
    await page.locator('#answer').waitFor();
    for (let i = 0; i < 10; i++) {
      await page.locator('#answer').fill('Chamelon');
      const start = performance.now();
      const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/claim', {
        timeout: 45000,
      });
      await page.getByRole('button', { name: 'CALL DIBS' }).click();
      const r = await response;
      await page
        .locator('.result-panel')
        .filter({ hasText: /Chamelon|list|register/i })
        .waitFor();
      samples.push({
        ms: performance.now() - start,
        status: r.status(),
        serverTiming: r.headers()['server-timing'],
      });
    }
    await context.close();
  }
} catch (e) {
  samples.push({ error: String(e) });
} finally {
  await browser.close();
  const values = samples
    .filter((x) => x.ms)
    .map((x) => x.ms)
    .sort((a, b) => a - b);
  const result = {
    label: process.argv[2] || 'before',
    network: 'Live practice, local network; not a 4G claim',
    samples,
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.min(values.length - 1, Math.floor(values.length * 0.95))],
  };
  writeFileSync('review/round9/timing-' + result.label + '.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
