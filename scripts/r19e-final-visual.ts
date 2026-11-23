import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Reuse the exact release assertions at the two OVERNIGHT final-review widths.
// Keep these captures separate so the required 360-combination matrix stays exact.
const directory = '.tmp/r19e/final-visual';
mkdirSync(directory, { recursive: true });
const source = readFileSync('tests/e2e/round19c.spec.ts', 'utf8')
  .replace("'./security-fixture'", "'../../../tests/e2e/security-fixture'")
  .replace('review/round19c/matrix/raw/', 'review/final/round19e/');
writeFileSync(directory + '/final.spec.ts', source);
const projects = ['chromium', 'webkit'].flatMap((browserName) =>
  [390, 1440].flatMap((width) =>
    ['light', 'dark'].map((colorScheme) => ({
      name: `${browserName}-${width}-${colorScheme}`,
      metadata: { fontScale: 1, zoom: 1, physicalWidth: width, physicalHeight: 900 },
      use: { browserName, viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme },
    })),
  ),
);
writeFileSync(
  directory + '/playwright.config.ts',
  `import { defineConfig } from '@playwright/test';
export default defineConfig(${JSON.stringify({
    testDir: '.',
    testMatch: 'final.spec.ts',
    fullyParallel: true,
    workers: 4,
    timeout: 90000,
    retries: 0,
    outputDir: '../final-visual-artifacts',
    use: {
      baseURL: 'http://127.0.0.1:5215',
      timezoneId: 'America/Toronto',
      extraHTTPHeaders: { 'x-dibs-test': '1' },
      screenshot: 'only-on-failure',
    },
    projects,
    reporter: [
      ['list'],
      [
        'json',
        { outputFile: process.cwd() + '/review/round19e/final-visual-browser-results.json' },
      ],
    ],
    webServer: {
      command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5215',
      cwd: process.cwd(),
      url: 'http://127.0.0.1:5215',
      reuseExistingServer: false,
    },
  })});`,
);
const result = spawnSync(
  './node_modules/.bin/playwright',
  ['test', '-c', directory + '/playwright.config.ts'],
  {
    env: process.env,
    stdio: 'inherit',
  },
);
assert.equal(result.status, 0, 'Final visual capture assertions failed');
