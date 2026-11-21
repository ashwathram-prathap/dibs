import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('review/lighthouse', { recursive: true });
const browser = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
try {
  const result = await lighthouse(process.argv[2] || 'https://dibs-7hz.pages.dev', {
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
    writeFileSync('review/lighthouse/mobile.json', result.report[0]);
    writeFileSync('review/lighthouse/mobile.html', result.report[1]);
    console.log(
      JSON.stringify(
        Object.fromEntries(Object.entries(result.lhr.categories).map(([k, v]) => [k, v.score])),
      ),
    );
    console.log(result.lhr.audits['largest-contentful-paint'].displayValue);
  }
} finally {
  await browser.close();
}
