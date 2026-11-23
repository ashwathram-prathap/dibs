import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:5201' },
  webServer: {
    ...(base.webServer as any),
    url: 'http://127.0.0.1:5201',
    command:
      'npx vite build --mode security-test && npx vite preview --mode security-test --host 127.0.0.1 --port 5201',
  },
  testMatch: ['flow.spec.ts', 'sharing.spec.ts', 'round19b.spec.ts'],
  projects: [
    ...(base.projects?.filter(
      (p) =>
        !p.name?.startsWith('r6-') &&
        (process.env.R19B_FIREFOX
          ? p.name?.startsWith('firefox-')
          : !p.name?.startsWith('firefox-')),
    ) || []),
    ...(process.env.R19B_FIREFOX
      ? []
      : [
          {
            name: 'Edge-desktop',
            use: {
              browserName: 'chromium' as const,
              viewport: { width: 1440, height: 900 },
              userAgent: devices['Desktop Chrome'].userAgent + ' Edg/131.0.0.0',
            },
          },
          {
            name: 'Samsung-Internet',
            use: {
              ...devices['Galaxy S9+'],
              browserName: 'chromium' as const,
              userAgent: devices['Galaxy S9+'].userAgent + ' SamsungBrowser/27.0',
            },
          },
          ...['Discord', 'LinkedIn'].map((app) => ({
            name: app + '-iPhone',
            use: {
              ...devices['iPhone 15 Pro'],
              browserName: 'webkit' as const,
              userAgent: devices['iPhone 15 Pro'].userAgent + ' ' + app,
            },
          })),
        ]),
  ],
  reporter: [['list'], ['json', { outputFile: 'review/round19b/matrix-browser-results.json' }]],
});
