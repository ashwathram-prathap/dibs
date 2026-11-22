import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  timeout: 90000,
  testMatch: ['round9.spec.ts', 'round10.spec.ts'],
  projects: base
    .projects!.filter(
      (p) =>
        !p.name?.startsWith('r6-390') &&
        (!process.env.R10_SKIP_FIREFOX || !p.name?.startsWith('firefox')),
    )
    .map((p) => ({
      ...p,
      testMatch: ['round9.spec.ts', 'round10.spec.ts'],
      testIgnore: undefined,
    })),
  webServer: {
    command: 'npm run preview -- --mode security-test --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
  reporter: [['list'], ['json', { outputFile: 'review/round10/browser-results.json' }]],
});
