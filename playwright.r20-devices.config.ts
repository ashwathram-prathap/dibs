import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// R19I: OVERNIGHT.md device profiles (iPhone SE/15 Pro/15 Pro Max, Pixel 7, Galaxy S9+, iPads,
// 320px, phone landscape, desktop 1280/1440/2560, in-app user agents), full flow end to end.
// Firefox runs in the separate local R19I matrix; document local launch blockers without a CI fallback.
const port = process.env.R19I_DEVICE_PORT || '5247';
export default defineConfig({
  ...base,
  testMatch: ['flow.spec.ts', 'round11-edge.spec.ts', 'round19i.spec.ts'],
  projects: (base.projects || []).filter(
    (p: any) => p.use?.browserName !== 'firefox' && !String(p.testMatch || '').includes('specials'),
  ),
  workers: Number(process.env.R19I_WORKERS || 6),
  outputDir: '.tmp/r20/device-artifacts',
  reporter: [['list'], ['json', { outputFile: 'review/round20/device-tests.json' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:' + port },
  webServer: {
    command: `npx vite preview --mode security-test --host 127.0.0.1 --port ${port}`,
    url: 'http://127.0.0.1:' + port,
    reuseExistingServer: false,
    env: { DIBS_TEST_OUT_DIR: process.env.DIBS_TEST_OUT_DIR || '.tmp/r20/browser-dist' },
  },
});
