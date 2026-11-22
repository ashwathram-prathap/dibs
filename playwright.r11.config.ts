import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  timeout: 60000,
  outputDir: '.tmp/r11/playwright-main',
  testMatch: ['round9.spec.ts', 'round11.spec.ts'],
  projects: base
    .projects!.filter(
      (p) =>
        !p.name?.startsWith('r6-390') &&
        (!process.env.R11_SKIP_FIREFOX || !p.name?.startsWith('firefox')),
    )
    .map((p) => ({
      ...p,
      testMatch: ['round9.spec.ts', 'round11.spec.ts'],
      testIgnore: undefined,
    })),
  webServer: {
    command: 'npm run preview -- --mode security-test --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
  reporter: [['list'], ['json', { outputFile: 'review/round11/browser-results.json' }]],
});
