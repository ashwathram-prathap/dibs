import { defineConfig } from '@playwright/test';
import base from './playwright.r14.config';
export default defineConfig({
  ...base,
  testMatch: ['round16.spec.ts'],
  projects: base
    .projects!.filter((p) => !p.name?.startsWith('r14-payoff'))
    .map((p) => ({ ...p, testMatch: ['round16.spec.ts'] })),
  reporter: [['list'], ['json', { outputFile: 'review/round16/browser-results.json' }]],
});
