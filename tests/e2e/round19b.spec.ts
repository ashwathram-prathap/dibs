import { test, expect } from './security-fixture';
test('R19B offers a LinkedIn score link and image download without posting', async ({ page }) => {
  await page.goto('/?r19&r6&no-analytics=1');
  for (const answer of ['Okapi', 'Quokka', 'Wombat']) {
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
    if (answer !== 'Wombat')
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
  }
  const link = page.getByRole('link', { name: 'Post on LinkedIn' });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute(
    'href',
    /^https:\/\/www.linkedin.com\/sharing\/share-offsite\/\?url=https%3A%2F%2Fdibs.here%2Fsummary/,
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download image', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.jpg$/);
  expect(
    await page.evaluate(() =>
      performance.getEntriesByType('resource').some((r) => r.name.includes('cloudflareinsights')),
    ),
  ).toBe(false);
});

test('R19B short certificate URLs render the certificate and share actions', async ({ page }) => {
  await page.goto('/c/fixture-1?no-analytics=1');
  await expect(page.getByRole('heading', { name: 'On the record.', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Post on LinkedIn' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download image', exact: true })).toBeEnabled();
});
