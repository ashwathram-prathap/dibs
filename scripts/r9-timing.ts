import './test-traffic';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch();
const samples: any[] = [];
try {
  for (let batch = 0; batch < 2; batch++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const verification = (process.argv[2] || '').startsWith('after') ? page.waitForResponse(r=>r.url().endsWith('/api/verify-session')&&r.ok(),{timeout:60000}) : undefined;
    if ((process.argv[2] || '').includes('4g')) { const cdp=await context.newCDPSession(page); await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000}); }
    await page.goto('https://practice.dibs-7hz.pages.dev');
    if(verification) await verification;
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
    network: (process.argv[2] || '').includes('4g') ? 'Live practice, Chromium emulated 4G: 150ms latency, 1.6Mbps down, 720Kbps up' : 'Live practice, local network; not a 4G claim',
    samples,
    p50: values[Math.ceil(values.length * 0.5) - 1],
    p95: values[Math.ceil(values.length * 0.95) - 1],
  };
  writeFileSync('review/round9/timing-' + result.label + '.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
