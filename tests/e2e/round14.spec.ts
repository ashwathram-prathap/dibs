import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
test('R14 payoff, hidden-answer leaderboard, done score and spoiler-free share', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r6');
  await expect(page.getByRole('link', { name: 'Leaderboard', exact: true })).toBeVisible();
  await expect(page.locator('.header-player')).toContainText('Streak 0');
  await expect(page.locator('#leaderboard')).toContainText('No scores yet. Be first.');
  await page.locator('#answer').fill('Dog');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('.result-panel')).toContainText('Reserved (too obvious). −10 points.');
  await page.locator('#answer').fill('Okapi');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('.claim-payoff')).toContainText(
    'Yours. Okapi has your name on it for good.',
  );
  await expect(page.locator('.claim-payoff')).toContainText(
    '+60 points · rarer than 60% of animals',
  );
  await expect(page.locator('.claim-payoff')).toContainText('2 claims left · 4 strikes left');
  await expect(page.locator('.header-player')).toContainText('Streak 1');
  const width = page.viewportSize()!.width;
  if ((width === 390 || width === 393) && page.viewportSize()!.height >= 844) {
    const box = (await page.locator('.claim-payoff').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  for (const answer of ['Quokka', 'Wombat']) {
    await page.getByRole('button', { name: 'Next claim', exact: true }).click();
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
  }
  await expect(page.locator('.done-score')).toContainText('170 points · #1 of 1 today');
  await expect(page.locator('.certificate-score')).toContainText('170 points · #1 of 1 · Streak 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});
