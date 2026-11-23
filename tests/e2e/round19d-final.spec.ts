import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
test('R19D final golden callout precedes Share and golden labels retain gold borders', async ({
  page,
}, info) => {
  await page.goto('/?r19&r6&gold-two');
  for (const [i, answer] of ['Okapi', 'Quokka', 'Wombat'].entries()) {
    await page.locator('#answer').fill(answer);
    await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await page
      .getByRole('button', { name: i === 2 ? 'See my results' : 'Next claim', exact: true })
      .click();
  }
  const share = page.getByRole('button', { name: 'SHARE', exact: true });
  await expect(share).toBeEnabled();
  const notice = await page.locator('.day-companions > .golden-notice').boundingBox();
  const button = await share.boundingBox();
  expect(notice!.y + notice!.height).toBeLessThanOrEqual(button!.y);
  const ink = await page
    .locator('.golden-row .mini-stamp')
    .first()
    .evaluate((el) => ({
      color: getComputedStyle(el).color,
      border: getComputedStyle(el).borderColor,
    }));
  expect(ink.border).toBe(ink.color);
  const problems = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    problems.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dir = `review/round19d/golden/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/final-golden-day.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
