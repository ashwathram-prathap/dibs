import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const tests = [
  'round9.spec.ts',
  'round11.spec.ts',
  'round12.spec.ts',
  'round13.spec.ts',
  'round14.spec.ts',
];
export default defineConfig({
  ...base,
  timeout: 90000,
  testMatch: tests,
  projects: base
    .projects!.filter(
      (p) =>
        !p.name?.startsWith('r6-390') &&
        (!process.env.R14_SKIP_FIREFOX || !p.name?.startsWith('firefox')),
    )
    .map((p) => ({ ...p, testMatch: tests, testIgnore: undefined }))
    .concat(
      ['chromium', 'webkit'].flatMap((browserName) =>
        ['light', 'dark'].map((colorScheme) => ({
          name: `r14-payoff-${browserName}-${colorScheme}`,
          testMatch: ['round14.spec.ts'],
          testIgnore: undefined,
          use: {
            extraHTTPHeaders: { 'x-dibs-test': '1' },
            browserName,
            colorScheme,
            viewport: { width: 390, height: 844 },
          },
        })),
      ),
    ) as any,
  use: { ...base.use, baseURL: process.env.R14_BASE || base.use?.baseURL },
  webServer: process.env.R14_BASE
    ? undefined
    : {
        command: 'npm run preview -- --mode security-test --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
      },
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.R14_REPORT || 'review/round14/browser-results.json' }],
  ],
});
