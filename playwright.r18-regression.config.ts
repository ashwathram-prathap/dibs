import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:5200' },
  testIgnore: 'round7.spec.ts',
  projects: base.projects!.filter((p) => !p.name?.startsWith('firefox')),
  outputDir: '.tmp/r18/regression-artifacts',
  reporter: [['list'], ['json', { outputFile: 'review/round18/regression-results.json' }]],
  webServer: {
    command: 'npm run preview -- --mode security-test --port 5200',
    url: 'http://127.0.0.1:5200',
    reuseExistingServer: false,
  },
});
