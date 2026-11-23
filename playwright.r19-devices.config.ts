import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';
const firefox = !!process.env.R19_FIREFOX;
const projects = (base.projects || []).filter((p) =>
  firefox
    ? p.name?.startsWith('firefox-')
    : !p.name?.startsWith('firefox-') && !p.name?.startsWith('r6-'),
);
if (!firefox)
  projects.push(
    {
      name: 'Samsung-Internet-360',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 360, height: 780 },
        browserName: 'chromium',
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      },
    },
    {
      name: 'Edge-1440',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      },
    },
  );
export default defineConfig({
  ...base,
  testMatch: 'flow.spec.ts',
  projects,
  outputDir: '.tmp/r19/device-artifacts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5199' },
  reporter: [
    ['list'],
    ['json', { outputFile: `review/round19/${firefox ? 'firefox-' : ''}device-results.json` }],
  ],
  webServer: {
    command: 'npm run preview -- --mode security-test --port 5199',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
  },
});
