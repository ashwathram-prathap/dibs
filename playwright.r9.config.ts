import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  timeout: 90000,
  testMatch: 'round9.spec.ts',
  projects: base.projects!.map((p) => ({
    ...p,
    testMatch: 'round9.spec.ts',
    testIgnore: undefined,
  })),
  webServer: {
    command: 'npm run preview -- --mode security-test --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
  reporter: [['list'], ['json', { outputFile: 'review/round9/browser-results.json' }]],
});
