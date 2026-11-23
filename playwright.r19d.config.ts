import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import extra from './playwright.r19-devices.config';
const projects = [...base.projects!.filter((p) => !p.name?.startsWith('r6-'))];
for (const p of extra.projects || [])
  if (!projects.some((x) => x.name === p.name)) projects.push(p);
for (const browserName of ['chromium', 'webkit'] as const)
  for (const colorScheme of ['light', 'dark'] as const)
    projects.push({
      name: `${browserName}-390-${colorScheme}`,
      use: { browserName, colorScheme, viewport: { width: 390, height: 844 } },
    });
export default defineConfig({
  ...base,
  projects: projects.filter((p) =>
    process.env.R19D_FIREFOX ? p.name?.startsWith('firefox-') : !p.name?.startsWith('firefox-'),
  ),
  testMatch: ['round19d.spec.ts', 'round19f.spec.ts', 'flow.spec.ts'],
  workers: 4,
  timeout: 90000,
  outputDir: '.tmp/r19d/browser-artifacts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5222', timezoneId: 'America/Toronto' },
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.R19D_REPORT ||
          `review/round19d/${process.env.R19D_FIREFOX ? 'firefox-' : ''}browser-results.json`,
      },
    ],
  ],
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5222',
    url: 'http://127.0.0.1:5222',
    reuseExistingServer: false,
  },
});
