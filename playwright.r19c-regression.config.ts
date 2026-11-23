import { defineConfig } from '@playwright/test';
import base from './playwright.r19.config';
export default defineConfig({
  ...base,
  testMatch: '**/*.spec.ts',
  testIgnore: ['round7.spec.ts', 'round19c.spec.ts'],
  projects: base.projects!.filter((p) => /-(390|1440)-/.test(p.name!)),
  use: { ...base.use, baseURL: 'http://127.0.0.1:5207' },
  outputDir: '.tmp/r19c/regression-artifacts',
  reporter: [['list'], ['json', { outputFile: 'review/round19c/regression-browser-results.json' }]],
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5207',
    url: 'http://127.0.0.1:5207',
    reuseExistingServer: false,
  },
});
