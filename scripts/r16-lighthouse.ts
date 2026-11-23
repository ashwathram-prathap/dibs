import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdirSync, writeFileSync } from 'node:fs';
const url = process.argv[2] || 'https://dibs.here';
const dir = process.argv[3] || 'review/round16/lighthouse-before';
const runs = Number(process.argv[4] || 1);
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--remote-debugging-port=9223'] });
const results: any[] = [];
try {
  for (let run = 1; run <= runs; run++)
    for (const strategy of ['mobile', 'desktop'] as const) {
      const desktop = strategy === 'desktop';
      const result = await lighthouse(url, {
        port: 9223,
        output: ['json', 'html'],
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: strategy,
        throttlingMethod: 'simulate',
        throttling: desktop
          ? {
              rttMs: 40,
              throughputKbps: 10240,
              cpuSlowdownMultiplier: 1,
              requestLatencyMs: 0,
              downloadThroughputKbps: 0,
              uploadThroughputKbps: 0,
            }
          : {
              rttMs: 150,
              throughputKbps: 1638.4,
              cpuSlowdownMultiplier: 4,
              requestLatencyMs: 562.5,
              downloadThroughputKbps: 1474.56,
              uploadThroughputKbps: 675,
            },
        screenEmulation: {
          mobile: !desktop,
          width: desktop ? 1440 : 390,
          height: desktop ? 900 : 844,
          deviceScaleFactor: desktop ? 1 : 3,
          disabled: false,
        },
      });
      if (!result) throw Error('No Lighthouse result');
      writeFileSync(`${dir}/${strategy}-${run}.json`, result.report[0]);
      writeFileSync(`${dir}/${strategy}-${run}.html`, result.report[1]);
      const summary = {
        strategy,
        run,
        scores: Object.fromEntries(
          Object.entries(result.lhr.categories).map(([k, v]) => [k, 100 * v.score!]),
        ),
        warnings: result.lhr.runWarnings,
        audits: Object.values(result.lhr.audits)
          .filter((a) => a.score !== null && a.score < 1)
          .map((a) => ({
            id: a.id,
            title: a.title,
            score: a.score,
            displayValue: a.displayValue,
            details: a.details,
          })),
      };
      results.push(summary);
      writeFileSync(`${dir}/summary.json`, JSON.stringify(results, null, 2));
      console.log(
        JSON.stringify({
          strategy,
          run,
          scores: summary.scores,
          warnings: summary.warnings,
          failed: summary.audits.map((a) => ({ id: a.id, score: a.score, value: a.displayValue })),
        }),
      );
    }
} finally {
  await browser.close();
}
