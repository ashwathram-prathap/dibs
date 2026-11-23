import { defineConfig } from '@playwright/test';
const engines = process.env.R19_FIREFOX ? ['firefox'] : ['chromium', 'webkit'];
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: process.env.R19_FULL ? '**/*.spec.ts' : 'round19.spec.ts',
  testIgnore: 'round7.spec.ts',
  fullyParallel: true,
  workers: 4,
  timeout: 90000,
  retries: 0,
  outputDir: '.tmp/r19/browser-artifacts',
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    timezoneId: 'America/Toronto',
  },
  projects: engines.flatMap((browserName) =>
    [320, 360, 390, 430, 768, 1024, 1440].flatMap((width) =>
      ['light', 'dark'].map((colorScheme) => ({
        name: `${browserName}-${width}-${colorScheme}`,
        use: {
          browserName: browserName as any,
          viewport: { width, height: width < 768 ? 844 : 1000 },
          colorScheme: colorScheme as any,
        },
      })),
    ),
  ),
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.R19_REPORT || 'review/round19/browser-results.json' }],
  ],
  webServer: {
    command: 'npm run preview -- --mode security-test --port 5199',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
  },
});
