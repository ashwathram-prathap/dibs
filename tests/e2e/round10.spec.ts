import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
test('R10 closed office aligns its grid and has a correctly timed reminder', async ({
  page,
}, info) => {
  await page.goto('/?r7-closed');
  await page.locator('.closed-office').waitFor();
  await expect(page.locator('.closed-office .official-seal')).toHaveCount(0);
  await expect(page.locator('.drop-countdown > p')).toContainText('9:00 PM ET');
  const edges = await page.locator('.closed-office,footer,.masthead').evaluateAll((els) =>
    els.map((e) => ({
      left: e.getBoundingClientRect().left,
      right: e.getBoundingClientRect().right,
    })),
  );
  expect(
    edges.every(
      (e) => Math.abs(e.left - edges[0].left) < 1 && Math.abs(e.right - edges[0].right) < 1,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (page.viewportSize()!.width >= 900) {
    const nav = (await page.locator('.masthead nav').boundingBox())!,
      hero = (await page.locator('.closed-office').boundingBox())!;
    expect(nav.y + nav.height).toBeLessThanOrEqual(hero.y);
    expect((await page.locator('.drop-countdown').boundingBox())!.width).toBeGreaterThan(400);
  }
  const dir = 'review/round10/devices/' + info.project.name;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: dir + '/closed.png', fullPage: true });
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});
