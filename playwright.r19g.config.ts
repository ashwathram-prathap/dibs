import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const projects = [];
for (const browserName of (process.env.R19G_FIREFOX ? ['firefox'] : ['chromium', 'webkit']) as (
  'chromium' | 'webkit' | 'firefox'
)[])
  for (const width of [320, 360, 390, 1440])
    for (const colorScheme of ['light', 'dark'] as const)
      projects.push({
        name: `${browserName}-${width}-${colorScheme}`,
        use: { browserName, colorScheme, viewport: { width, height: width < 768 ? 844 : 900 } },
      });
export default defineConfig({
  ...base,
  projects,
  testMatch: ['round19g.spec.ts', 'flow.spec.ts'],
  workers: 4,
  outputDir: '.tmp/r19g/browser-artifacts',
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: `review/round19g/${process.env.R19G_FIREFOX ? 'firefox-' : ''}browser-results.json`,
      },
    ],
  ],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5221' },
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5221',
    url: 'http://127.0.0.1:5221',
    reuseExistingServer: false,
  },
});
