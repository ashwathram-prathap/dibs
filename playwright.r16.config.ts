import { defineConfig } from '@playwright/test';
import base from './playwright.r14.config';
const tests = process.env.R16_FULL
  ? [
      'round9.spec.ts',
      'round11.spec.ts',
      'round12.spec.ts',
      'round13.spec.ts',
      'round14.spec.ts',
      'round15.spec.ts',
      'round16.spec.ts',
    ]
  : ['round16.spec.ts'];
export default defineConfig({
  outputDir: '.tmp/r16/browser-artifacts',
  ...base,
  testMatch: tests,
  projects: base
    .projects!.filter((p) => !p.name?.startsWith('r14-payoff'))
    .map((p) => ({ ...p, testMatch: tests })),
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.R16_REPORT || 'review/round16/browser-results.json' }],
  ],
});
