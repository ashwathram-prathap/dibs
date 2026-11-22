import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const tests = ['round9.spec.ts', 'round11.spec.ts', 'round12.spec.ts'];
export default defineConfig({
  ...base,
  timeout: 90000,
  testMatch: tests,
  projects: base
    .projects!.filter((p) => !p.name?.startsWith('r6-390'))
    .map((p) => ({ ...p, testMatch: tests, testIgnore: undefined })),
  webServer: {
    command: 'npm run preview -- --mode security-test --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
  reporter: [['list'], ['json', { outputFile: 'review/round12/browser-results.json' }]],
});
