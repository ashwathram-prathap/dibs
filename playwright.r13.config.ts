import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const tests = ['round9.spec.ts', 'round11.spec.ts', 'round12.spec.ts', 'round13.spec.ts'];
export default defineConfig({
  ...base,
  timeout: 90000,
  testMatch: tests,
  projects: base
    .projects!.filter(
      (p) =>
        !p.name?.startsWith('r6-390') &&
        (!process.env.R13_SKIP_FIREFOX || !p.name?.startsWith('firefox')),
    )
    .map((p) => ({ ...p, testMatch: tests, testIgnore: undefined })),
  use: {
    extraHTTPHeaders: { 'x-dibs-test': '1' },
    ...base.use,
    baseURL: process.env.R13_BASE || base.use?.baseURL,
  },
  webServer: process.env.R13_BASE
    ? undefined
    : {
        command: 'npm run preview -- --mode security-test --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
      },
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.R13_REPORT || 'review/round13/browser-results.json' }],
  ],
});
