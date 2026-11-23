import { defineConfig } from '@playwright/test';
const full = !!process.env.R19C_FULL;
const sizes = full
  ? [
      [320, 568],
      [360, 780],
      [375, 667],
      [390, 844],
      [412, 915],
      [430, 932],
      [768, 1024],
      [1024, 768],
      [1024, 1366],
      [1366, 1024],
      [844, 390],
      [1280, 800],
      [1470, 956],
      [1920, 1080],
      [2560, 1440],
    ]
  : [
      [390, 844],
      [1470, 956],
      [320, 568],
    ];
const engines = process.env.R19C_FIREFOX
  ? ['firefox']
  : process.env.R19C_QUICK
    ? ['chromium']
    : ['chromium', 'webkit'];
const projects: any[] = [];
for (const browserName of engines)
  for (const [width, height] of sizes)
    for (const colorScheme of ['light', 'dark'])
      for (const fontScale of full ? [1, 1.3] : [1])
        for (const zoom of full ? [1, 2] : [1])
          projects.push({
            name: `${browserName}-${width}x${height}-${colorScheme}-font${fontScale}-zoom${zoom}`,
            metadata: { fontScale, zoom, physicalWidth: width, physicalHeight: height },
            use: {
              browserName,
              viewport: { width: Math.floor(width / zoom), height: Math.floor(height / zoom) },
              deviceScaleFactor: zoom,
              colorScheme,
            },
          });
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'round19c.spec.ts',
  fullyParallel: true,
  workers: Number(process.env.R19C_WORKERS || 6),
  timeout: 90000,
  retries: 0,
  outputDir: '.tmp/r19c/browser-artifacts',
  use: {
    baseURL: 'http://127.0.0.1:5204',
    timezoneId: 'America/Toronto',
    extraHTTPHeaders: { 'x-dibs-test': '1' },
    trace: 'retain-on-failure',
  },
  projects,
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: process.env.R19C_REPORT || 'review/round19c/matrix-browser-results.json' },
    ],
  ],
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5204',
    url: 'http://127.0.0.1:5204',
    reuseExistingServer: false,
  },
});
