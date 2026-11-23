import { defineConfig } from '@playwright/test';
import base from './playwright.r14.config';
export default defineConfig({
  ...base,
  testMatch: ['round17.spec.ts'],
  projects: base
    .projects!.filter(
      (p) =>
        (process.env.R17_FIREFOX
          ? p.name?.startsWith('firefox')
          : !p.name?.startsWith('firefox')) && !p.name?.startsWith('r14-payoff'),
    )
    .map((p) => ({ ...p, testMatch: ['round17.spec.ts'] })),
  reporter: [['list'], ['json', { outputFile: 'review/round17/browser-results.json' }]],
});
