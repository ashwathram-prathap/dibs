import './test-traffic';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { writeFileSync, mkdirSync } from 'node:fs';
const reportDir = process.argv[3] || 'review/lighthouse';
mkdirSync(reportDir, { recursive: true });
const browser = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
// Observe only identities created or loaded by this audit, so QA cleanup never guesses by time.
const observer = await chromium.connectOverCDP('http://127.0.0.1:9222');
const identities = new Set<string>();
const failures: string[] = [];
observer.contexts()[0].on('page', (page) => {
  page.on('response', async (response) => {
    if (response.url().includes('/api/') && response.status() >= 400)
      failures.push(response.url() + ' ' + response.status());
    if (response.url() === 'https://dibs.here/api/me') {
      try {
        const data = await response.json();
        if (typeof data.user?.id === 'string') identities.add(data.user.id);
      } catch {}
    }
  });
});
try {
  const result = await lighthouse(process.argv[2] || 'https://dibs.here', {
    port: 9222,
    output: ['json', 'html'],
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'mobile',
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.56,
      uploadThroughputKbps: 675,
    },
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      disabled: false,
    },
  });
  if (result) {
    if (failures.length || result.lhr.audits['errors-in-console']?.score === 0)
      throw new Error('Invalid audit: failed API/console errors: ' + failures.join(', '));
    writeFileSync(reportDir + '/mobile.json', result.report[0]);
    writeFileSync(reportDir + '/mobile.html', result.report[1]);
    console.log(
      JSON.stringify(
        Object.fromEntries(Object.entries(result.lhr.categories).map(([k, v]) => [k, v.score])),
      ),
    );
    console.log(result.lhr.audits['largest-contentful-paint'].displayValue);
  }
} finally {
  writeFileSync(reportDir + '/qa-identities.json', JSON.stringify([...identities]));
  await observer.close();
  await browser.close();
}
