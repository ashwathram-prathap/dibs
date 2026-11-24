import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
test('R14 payoff, hidden-answer leaderboard, done score and spoiler-free share', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r6');
  await expect(page.getByRole('link', { name: 'Leaderboard', exact: true })).toBeVisible();
  await expect(page.locator('.streak-chip')).toHaveAttribute('aria-label','0 day streak');
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
    '+60 points · Rarer than 60% of animals',
  );
  await expect(page.locator('.payoff-counters')).toContainText('2 claims left');
  await expect(page.locator('.payoff-counters')).toContainText('4 strikes left');
  await expect(page.locator('.streak-chip')).toHaveAttribute('aria-label','1 day streak');
  const width = page.viewportSize()!.width;
  if ((width === 390 || width === 393) && page.viewportSize()!.height >= 844) {
    const box = (await page.locator('.claim-payoff').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  for (const answer of ['Quokka', 'Wombat']) {
    await page.locator('.next-claim-shortcut').click();
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
  }
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.certificate-score')).toContainText('170 points · #1 of 1 · Streak 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});
