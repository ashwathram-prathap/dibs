import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { readCategory } from './category-file';
import { normalize } from '../worker/domain';
import { fullDistance } from '../shared/catalog';
import assert from 'node:assert/strict';
const slug = 'rivers';
const catalog = JSON.parse(readFileSync(`public/catalog/${slug}/manifest.json`, 'utf8'));
const source = readCategory(`categories/${slug}.json`);
const byDisplay = new Map(source.answers.map((row: any) => [row.display, row]));
const samples = [8, 10, 12, 14, 20, 28].map((length) =>
  source.answers.find(
    (row: any, i: number) => i > 10000 && normalize(row.display).length === length,
  ),
);
assert.ok(samples.every(Boolean));
const results: any[] = [];
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
] as const) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/spelling-probe', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Spelling benchmark</title>',
      }),
    );
    await page.goto('http://127.0.0.1:5174/spelling-probe');
    for (const row of samples) {
      const answer = row.display.slice(0, -1) + (row.display.endsWith('x') ? 'z' : 'x');
      const result = await page.evaluate(
        async ({ catalog, answer, modulePath }) => {
          const { submittedSpelling } = await import(modulePath);
          const start = performance.now();
          const suggestion = await submittedSpelling(catalog, answer);
          return { suggestion, elapsedMs: performance.now() - start };
        },
        { catalog, answer, modulePath: '/src/spelling.ts' },
      );
      const proposed: any = byDisplay.get(result.suggestion);
      assert.ok(proposed, `${name}: no valid suggestion within the bounded budget for ${answer}`);
      const distance = Math.min(
        ...[proposed.display, ...proposed.aliases].map((s: string) =>
          fullDistance(normalize(answer), normalize(s)),
        ),
      );
      assert.ok(distance <= 2);
      results.push({ engine: name, answer, ...result, distance });
      console.log(name, normalize(answer).length, Math.round(result.elapsedMs), 'ms');
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(
  'review/round8/large-spelling-benchmark.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      catalog: slug,
      version: catalog.version,
      entries: catalog.count,
      method:
        'Actual submittedSpelling implementation and browser Worker, full generated assets over local Vite HTTP. Desktop Chromium/WebKit; no claim about physical-phone memory or mobile-network speed.',
      results,
    },
    null,
    2,
  ) + '\n',
);
