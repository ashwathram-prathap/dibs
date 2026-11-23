import { defineConfig } from '@playwright/test';
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
  projects: base.projects?.filter((p) => !p.name?.startsWith('r6-')),
  reporter: [['list'], ['json', { outputFile: 'review/round19b/matrix-browser-results.json' }]],
});
