import { defineConfig } from '@playwright/test';
// R19H: three-claim continuation. Phone fit at 360×780 and 390×844, 767/768 boundary,
// 1.3 font scale, both themes, Chromium/WebKit locally and Firefox in CI (R19H_FIREFOX).
const port = process.env.R19H_PORT || '5233';
const sizes: [number, number, number[]][] = [
  [320, 568, [1]],
  [360, 780, [1, 1.3]],
  [390, 844, [1, 1.3]],
  [767, 900, [1]],
  [768, 1024, [1]],
  [1440, 900, [1]],
  [2560, 1440, [1]],
];
const engines = process.env.R19H_FIREFOX
  ? ['firefox']
  : process.env.R19H_ENGINES
    ? process.env.R19H_ENGINES.split(',')
    : ['chromium', 'webkit'];
const projects: any[] = [];
for (const browserName of engines)
  for (const [width, height, scales] of sizes)
    for (const colorScheme of ['light', 'dark'])
      for (const fontScale of scales)
        projects.push({
          name: `${browserName}-${width}x${height}-${colorScheme}-font${fontScale}`,
          metadata: { fontScale, zoom: 1, physicalWidth: width, physicalHeight: height },
          use: {
            browserName,
            viewport: { width, height },
            colorScheme,
          },
        });
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: [
    'round19c.spec.ts',
    'round19g.spec.ts',
    ...(process.env.R19H_FIREFOX ? ['flow.spec.ts'] : []),
  ],
  fullyParallel: true,
  workers: Number(process.env.R19H_WORKERS || 6),
  timeout: 120000,
  retries: 0,
  outputDir: '.tmp/r19h/browser-artifacts-' + port,
  use: {
    baseURL: 'http://127.0.0.1:' + port,
    timezoneId: 'America/Toronto',
    extraHTTPHeaders: { 'x-dibs-test': '1' },
    trace: process.env.R19H_TRACE ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  projects,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.R19H_REPORT ||
          `review/round19h/${process.env.R19H_FIREFOX ? 'firefox-' : ''}browser-results.json`,
      },
    ],
  ],
  webServer: {
    command: `npx vite preview --mode security-test --host 127.0.0.1 --port ${port}`,
    url: 'http://127.0.0.1:' + port,
    reuseExistingServer: !!process.env.R19H_REUSE,
    env: { DIBS_TEST_OUT_DIR: process.env.DIBS_TEST_OUT_DIR || '.tmp/r19h/after-dist' },
  },
});
