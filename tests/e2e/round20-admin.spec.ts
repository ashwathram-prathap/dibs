import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const snapshot = {
  day: '2026-11-27',
  asOf: '2026-11-28T04:00:00Z',
  participants: 5,
  claimers: 4,
  exactly1: 1,
  exactly2: 1,
  exactly3: 2,
  reached1: 4,
  reached2: 3,
  reached3: 2,
  struckOut: 2,
  finished: 3,
  finishRate: 0.6,
  medianBetweenClaimsMs: 1000,
  intervalSamples: 5,
  excluded: 1,
  journal: { pendingFiles: 0, error: null },
};
test('admin funnel shows explicit denominators and unavailable fallback', async ({
  page,
}, info) => {
  await page.route('**/api/admin/live', (route) =>
    route.fulfill({
      json: {
        active: 0,
        claimsPerMinute: 0,
        strikesPerMinute: 0,
        filesCompleted: 0,
        errors: 0,
        turnstileFailureRate: 0,
        limits: {},
        usage: {},
        feedback: [],
      },
    }),
  );
  await page.route('**/api/admin/r20-funnel', (route) => route.fulfill({ json: snapshot }));
  await page.goto('/admin/live');
  await page.getByLabel('Admin token', { exact: true }).fill('synthetic-admin-fixture');
  await page.getByRole('button', { name: 'Open Live', exact: true }).click();
  await expect(page.getByText('60.0%', { exact: true })).toBeVisible();
  await expect(page.getByText('Exactly 1 claim', { exact: true })).toBeVisible();
  await expect(page.getByText('Claim intervals sampled', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dir = 'review/round20/admin';
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${info.project.name}.png`, fullPage: true });
  await page.route('**/api/admin/r20-funnel', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  );
  await page.getByRole('button', { name: 'Open Live', exact: true }).click();
  // A changed token starts the next poll immediately without waiting 15 seconds.
  await page.getByLabel('Admin token', { exact: true }).fill('synthetic-other-fixture');
  await page.getByRole('button', { name: 'Open Live', exact: true }).click();
  await expect(
    page.getByText("Tonight's file counts are unavailable.", { exact: true }),
  ).toBeVisible();
});
