import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  reporter: [['list'], ['json', { outputFile: 'review/round7/browser-results.json' }]],
  projects: [
    ...[390, 1440].flatMap((width) =>
      ['light', 'dark'].map((colorScheme) => ({
        name: `r7-chromium-${width}-${colorScheme}`,
        use: {
          extraHTTPHeaders: { 'x-dibs-test': '1' },
          browserName: 'chromium' as const,
          viewport: { width, height: width === 390 ? 844 : 900 },
          colorScheme: colorScheme as 'light' | 'dark',
        },
      })),
    ),
    ...['webkit', 'firefox'].map((browserName) => ({
      name: `r7-${browserName}-390-light`,
      use: {
        browserName: browserName as 'webkit' | 'firefox',
        viewport: { width: 390, height: 844 },
        colorScheme: 'light' as const,
      },
    })),
  ].map((p) => ({ ...p, testMatch: 'round7.spec.ts' })),
});
