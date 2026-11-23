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
  projects,
  testMatch: ['round19f.spec.ts', 'flow.spec.ts'],
  workers: 4,
  timeout: 90000,
  outputDir: '.tmp/r19f/browser-artifacts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5220', timezoneId: 'America/Toronto' },
  reporter: [['list'], ['json', { outputFile: 'review/round19f/browser-results.json' }]],
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5220',
    url: 'http://127.0.0.1:5220',
    reuseExistingServer: false,
  },
});
