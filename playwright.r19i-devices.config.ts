import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// R19I: OVERNIGHT.md device profiles (iPhone SE/15 Pro/15 Pro Max, Pixel 7, Galaxy S9+, iPads,
// 320px, phone landscape, desktop 1280/1440/2560, in-app user agents), full flow end to end.
// Firefox desktop profiles run in CI (local Firefox cannot start its profile on this Mac).
const port = process.env.R19I_DEVICE_PORT || '5247';
export default defineConfig({
  ...base,
  testMatch: ['flow.spec.ts', 'round11-edge.spec.ts', 'round19i.spec.ts'],
  projects: (base.projects || []).filter(
    (p: any) => p.use?.browserName !== 'firefox' && !String(p.testMatch || '').includes('specials'),
  ),
  workers: Number(process.env.R19I_WORKERS || 6),
  outputDir: '.tmp/r19i/device-artifacts',
  reporter: [['list'], ['json', { outputFile: 'review/round19i/device-results.json' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:' + port },
  webServer: {
    command: `npx vite preview --mode security-test --host 127.0.0.1 --port ${port}`,
    url: 'http://127.0.0.1:' + port,
    reuseExistingServer: false,
    env: { DIBS_TEST_OUT_DIR: process.env.DIBS_TEST_OUT_DIR || '.tmp/r19i/after-dist' },
  },
});
