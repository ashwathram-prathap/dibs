import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'round20-admin.spec.ts',
  workers: 2,
  timeout: 30000,
  reporter: [['list'], ['json', { outputFile: 'review/round20/admin-tests.json' }]],
  use: { baseURL: 'http://127.0.0.1:5250' },
  projects: [390, 1440].flatMap((width) =>
    ['light', 'dark'].map((colorScheme) => ({
      name: `chromium-${width}-${colorScheme}`,
      use: {
        browserName: 'chromium' as const,
        viewport: { width, height: 900 },
        colorScheme: colorScheme as 'light' | 'dark',
      },
    })),
  ),
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5250',
    url: 'http://127.0.0.1:5250',
    env: { DIBS_TEST_OUT_DIR: '.tmp/r20/browser-dist' },
  },
});
