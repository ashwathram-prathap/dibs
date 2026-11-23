import { defineConfig } from '@playwright/test';
const full = !!process.env.R18_FULL;
const engines = process.env.R18_FIREFOX ? ['firefox'] : ['chromium', 'webkit'];
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: full ? '**/*.spec.ts' : 'round18.spec.ts',
  // round7 is the retired multi-panel flow; its replacement gates are the later rounds.
  testIgnore: 'round7.spec.ts',
  fullyParallel: true,
  workers: 4,
  timeout: 90000,
  outputDir: '.tmp/r18/browser-artifacts',
  use: { baseURL: process.env.R18_BASE || 'http://127.0.0.1:5199', trace: 'retain-on-failure' },
  projects: engines.flatMap((browserName) =>
    [320, 375, 390, 430, 768, 1440, 2560].flatMap((width) =>
      ['light', 'dark'].map((colorScheme) => ({
        name: `${browserName}-${width}-${colorScheme}`,
        use: {
          browserName: browserName as any,
          viewport: { width, height: width < 768 ? 844 : 1000 },
          colorScheme: colorScheme as any,
          timezoneId: 'America/Toronto',
        },
      })),
    ),
  ),
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.R18_REPORT || 'review/round18/browser-results.json' }],
  ],
  webServer: process.env.R18_BASE
    ? undefined
    : {
        command: 'npm run preview -- --mode security-test --port 5199',
        url: 'http://127.0.0.1:5199',
        reuseExistingServer: true,
      },
});
