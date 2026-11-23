import { defineConfig } from '@playwright/test';
import base from './playwright.r19-devices.config';
const firefox = !!process.env.R19_FIREFOX;
const projects = [...base.projects!];
if (!firefox) {
  for (const browserName of ['chromium', 'webkit'] as const)
    for (const colorScheme of ['light', 'dark'] as const)
      projects.push({
        name: `${browserName}-390-${colorScheme}`,
        use: { browserName, colorScheme, viewport: { width: 390, height: 844 } },
      });
}
export default defineConfig({
  ...base,
  projects,
  testMatch: ['flow.spec.ts', 'round19e.spec.ts'],
  outputDir: '.tmp/r19e/browser-artifacts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5210' },
  reporter: [
    ['list'],
    ['json', { outputFile: `review/round19e/${firefox ? 'firefox-' : ''}browser-results.json` }],
  ],
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5210',
    url: 'http://127.0.0.1:5210',
    reuseExistingServer: false,
  },
});
