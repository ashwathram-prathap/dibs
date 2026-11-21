import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const browser = await chromium.launch();
for (const width of [390, 1440])
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    for (const state of ['closed', 'quota']) {
      await page.route('**/api/bootstrap', (route) =>
        route.fulfill({
          status: state === 'quota' ? 503 : 200,
          contentType: 'application/json',
          body: JSON.stringify(
            state === 'quota'
              ? {
                  code: 'REGISTRY_CLOSED',
                  message:
                    'Registry closed for the day. The clerk’s filing allowance is spent. Please return after 7 PM Toronto time.',
                }
              : {
                  today: {
                    category: null,
                    claimed: 0,
                    open: 0,
                    nextDrop: new Date(Date.now() + 3600000).toISOString(),
                    turnstileSiteKey: '',
                  },
                  me: { user: null, claim: null, streak: 0, streakDates: [] },
                  rows: [],
                },
          ),
        }),
      );
      await page.routeWebSocket('**/api/live', (socket) => {});
      await page.goto('http://127.0.0.1:5174');
      await expect(
        page.getByText(
          state === 'quota'
            ? 'Registry closed for the day.'
            : 'The next category drops tonight at 9 PM ET. Come back to call dibs.',
          { exact: true },
        ),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `review/final/${state}-${width}-${theme}.png`,
        fullPage: true,
      });
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.unroute('**/api/bootstrap');
    }
    await context.close();
  }
await browser.close();
