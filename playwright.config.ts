import { defineConfig, devices } from '@playwright/test';
const mobile = [
  'iPhone SE',
  'iPhone 15 Pro',
  'iPhone 15 Pro Max',
  'Pixel 7',
  'Galaxy S9+',
  'iPad Mini',
  'iPad Pro 11 landscape',
];
const projects: any[] = [];
for (const theme of ['light', 'dark']) {
  projects.push({
    name: 'r6-390-' + theme,
    testMatch: 'specials.spec.ts',
    use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, colorScheme: theme },
  });
  for (const name of mobile) {
    const browserName = name.startsWith('i') ? 'webkit' : 'chromium';
    projects.push({
      name: name.replaceAll(' ', '-') + '-' + theme,
      use: { ...devices[name], browserName, colorScheme: theme },
    });
  }
  for (const browserName of ['chromium', 'webkit', 'firefox'])
    for (const width of [1280, 1440, 2560])
      projects.push({
        name: `${browserName}-${width}-${theme}`,
        use: { browserName, viewport: { width, height: 900 }, colorScheme: theme },
      });
  projects.push({
    name: '320-small-' + theme,
    use: {
      browserName: 'chromium',
      viewport: { width: 320, height: 568 },
      colorScheme: theme,
      isMobile: true,
      hasTouch: true,
    },
  });
  projects.push({
    name: 'landscape-phone-' + theme,
    use: {
      browserName: 'webkit',
      viewport: { width: 844, height: 390 },
      colorScheme: theme,
      isMobile: true,
      hasTouch: true,
    },
  });
}
for (const [app, suffix] of [
  ['Instagram', 'Instagram 360.0.0.0'],
  ['TikTok', 'BytedanceWebview/1.0 TikTok/37.0.0'],
  ['X', 'Twitter for iPhone/10.0'],
]) {
  for (const device of ['iPhone 15 Pro', 'Pixel 7']) {
    const profile = devices[device];
    projects.push({
      name: `${app}-${device.replaceAll(' ', '-')}`,
      use: {
        ...profile,
        browserName: device.startsWith('iPhone') ? 'webkit' : 'chromium',
        userAgent: profile.userAgent + ' ' + suffix,
      },
    });
  }
}
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 4,
  timeout: 60000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'review/devices/results.json' }]],
  use: { extraHTTPHeaders: {'x-dibs-test':'1'}, baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: projects.map((p) => ({ ...p, testIgnore: 'round7.spec.ts' })),
  webServer: {
    // A fresh CI checkout builds every complete reference index before starting.
    timeout: 600000,
    command:
      'npx tsx scripts/build-catalog-assets.ts && npx vite build --mode security-test && npm run preview -- --mode security-test --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
});
