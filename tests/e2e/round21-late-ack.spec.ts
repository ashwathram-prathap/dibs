import { test, expect } from './security-fixture';
test('navigating while an accepted reply is pending never queues a reward after unmount', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__rewardSounds = 0;
    window.addEventListener('dibs-stamp', () => {
      (window as any).__rewardSounds++;
    });
  });
  await page.goto('/?r19&r19c&r6&r21&r21-slow');
  await page.locator('#answer').fill('Okapi');
  await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
  await page.evaluate(() => {
    history.pushState(null, '', '/how-it-works');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForTimeout(2200);
  expect(await page.evaluate(() => (window as any).__rewardSounds)).toBe(0);
  await expect(page.locator('.compact-payoff')).toHaveCount(0);
});
