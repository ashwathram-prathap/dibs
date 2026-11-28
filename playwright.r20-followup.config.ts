import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const full = process.env.R20_FULL;
const projects = process.env.R20_DEVICES
  ? (base.projects || []).filter(
      (p: any) =>
        p.use?.browserName !== 'firefox' && !String(p.testMatch || '').includes('specials'),
    )
  : ['chromium', 'webkit'].flatMap((browserName) =>
      (full ? [320, 360, 390, 768, 1440, 2560] : [390, 1440]).flatMap((width) =>
        ['light', 'dark'].flatMap((colorScheme) =>
          (full && width <= 390 ? [1, 1.3] : [1]).map((scale) => ({
            name: `${browserName}-${width}-${colorScheme}-font${scale}`,
            metadata: { scale },
            use: {
              browserName: browserName as any,
              viewport: {
                width,
                height: process.env.R20_SHARE && width === 320 ? 568 : width < 768 ? 780 : 900,
              },
              colorScheme: colorScheme as any,
            },
          })),
        ),
      ),
    );
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: process.env.R20_SHARE
    ? 'round20-share-consent.spec.ts'
    : process.env.R20_GOLDEN
      ? ['round19d.spec.ts', 'round19d-final.spec.ts']
      : 'round20-followup.spec.ts',
  workers: 4,
  fullyParallel: true,
  timeout: 60000,
  retries: 0,
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: process.env.R20_REPORT || 'review/round20/followup-browser-tests.json' },
    ],
  ],
  outputDir: '.tmp/r20-followup/artifacts',
  use: { baseURL: 'http://127.0.0.1:5254', timezoneId: 'America/Toronto' },
  projects,
  webServer: {
    command: 'npx vite preview --mode security-test --host 127.0.0.1 --port 5254',
    url: 'http://127.0.0.1:5254',
    env: { DIBS_TEST_OUT_DIR: '.tmp/r20-followup/browser-dist' },
  },
});
