import { defineConfig } from '@playwright/test';
// R19I: no second strike for a repeat guess, plus the full R19H three-claim gate. Phone fit at 360×780 and 390×844, 767/768 boundary,
// 1.3 font scale, both themes, all browsers locally (R19I_ENGINES or R19I_FIREFOX).
const port = process.env.R19I_PORT || '5243';
const sizes: [number, number, number[]][] = [
  [320, 568, [1]],
  [360, 780, [1, 1.3]],
  [390, 844, [1, 1.3]],
  [767, 900, [1]],
  [768, 1024, [1]],
  [1440, 900, [1]],
  [2560, 1440, [1]],
];
const engines = process.env.R19I_FIREFOX
  ? ['firefox']
  : process.env.R19I_ENGINES
    ? process.env.R19I_ENGINES.split(',')
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
    'round19i.spec.ts',
    ...(process.env.R19I_FIREFOX ? ['flow.spec.ts'] : []),
  ],
  fullyParallel: true,
  workers: Number(process.env.R19I_WORKERS || 6),
  timeout: 120000,
  retries: 0,
  outputDir: '.tmp/r19i/browser-artifacts-' + port,
  use: {
    baseURL: 'http://127.0.0.1:' + port,
    timezoneId: 'America/Toronto',
    extraHTTPHeaders: { 'x-dibs-test': '1' },
    trace: process.env.R19I_TRACE ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  projects,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.R19I_REPORT ||
          `review/round19i/${process.env.R19I_FIREFOX ? 'firefox-' : ''}browser-results.json`,
      },
    ],
  ],
  webServer: {
    command: `npx vite preview --mode security-test --host 127.0.0.1 --port ${port}`,
    url: 'http://127.0.0.1:' + port,
    reuseExistingServer: !!process.env.R19I_REUSE,
    env: { DIBS_TEST_OUT_DIR: process.env.DIBS_TEST_OUT_DIR || '.tmp/r19i/after-dist' },
  },
});
