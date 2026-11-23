import { test, expect } from './security-fixture';
import { bellX, rarityLabel } from '../../shared/rarity';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const shot = async (page: any, project: string, name: string) => {
  const dir = `review/round19e/ui/${project}`;
  mkdirSync(dir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
};
test('R19E scored payoff keeps points, percentile, wording and marker aligned', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [answer, p, points] of [
    ['Camel', 0.065, 10],
    ['Chameleon', 0.1264, 15],
    ['Blobfish', 0.4161, 45],
    ['Sarcastic fringehead', 0.6777, 75],
    ['Obscure sample', 1, 110],
    ['Unknown sample', null, 55],
  ] as const) {
    await page.goto(`/?r19&r19e&r6&p=${p ?? 'missing'}`);
    await page.locator('#answer').fill(answer);
    await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    const payoff = page.locator('.claim-payoff');
    await expect(payoff).toContainText(`+${points} points`);
    if (p === null) {
      await expect(payoff).toContainText('standard score (no readership data for this answer)');
      await expect(page.locator('.payoff-curve .rarity-marker')).toHaveCount(0);
    } else {
      await expect(payoff).toContainText(rarityLabel(p, 'animals'));
      await expect(page.locator('.payoff-curve .rarity-curve')).toHaveAttribute(
        'data-percentile',
        String(p),
      );
      expect(
        Number(await page.locator('.payoff-curve .rarity-curve').getAttribute('data-marker-x')),
      ).toBeCloseTo(bellX(p));
    }
    await shot(page, info.project.name, answer.replaceAll(' ', '-'));
  }
});
test('R19E FAQ states the actual score range and stays accessible', async ({ page }, info) => {
  await page.goto('/about?r19');
  await expect(page.locator('main')).toContainText(
    'Rarer answers score more: from 10 for the most familiar to 110 for the rarest.',
  );
  await shot(page, info.project.name, 'faq');
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => v.id)).toEqual([]);
});
