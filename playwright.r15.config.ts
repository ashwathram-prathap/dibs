import { defineConfig } from '@playwright/test';
import base from './playwright.r14.config';
export default defineConfig({
  ...base,
  testMatch: ['round15.spec.ts'],
  projects: base
    .projects!.filter((p) =>
      [
        'iPhone-SE-light',
        'iPhone-15-Pro-dark',
        'Pixel-7-light',
        'Galaxy-S9+-dark',
        'chromium-1440-light',
        'webkit-1440-dark',
      ].includes(p.name!),
    )
    .map((p) => ({ ...p, testMatch: ['round15.spec.ts'] })),
  reporter: [['list'], ['json', { outputFile: 'review/round15/r15-browser-results.json' }]],
});
