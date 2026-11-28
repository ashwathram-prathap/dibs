import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(
    (scale) => {
      document.addEventListener(
        'DOMContentLoaded',
        () => (document.documentElement.style.fontSize = `${16 * scale}px`),
      );
    },
    Number(info.project.metadata.scale || 1),
  );
});
async function shot(page: any, info: any, name: string) {
  const dir = `review/round20/followup/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test('first-visit rules wait for identity, contain focus, dismiss and never repeat on reload', async ({
  page,
}, info) => {
  await page.goto('/?r19&r19c&r19e&r6&r20-new');
  const d = page.getByRole('dialog', { name: 'How to play' });
  await expect(d).toBeVisible();
  await expect(d).toHaveAttribute('aria-modal', 'true');
  await expect(d).toContainText('Typos never do.');
  const b = await d.boundingBox();
  expect(b!.height).toBeLessThan(page.viewportSize()!.height);
  expect(await d.evaluate((e) => e.scrollHeight <= e.clientHeight)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await d.evaluate((e) => e.contains(document.activeElement))).toBe(true);
  await shot(page, info, 'onboarding');
  if (info.project.name.startsWith('chromium-390-light'))
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(d).not.toBeVisible();
  await expect(page.locator('#answer')).toBeFocused();
  await page.reload();
  await expect(page.locator('#answer')).toBeVisible();
  await expect(d).not.toBeVisible();
  await page.goto('/how-it-works?r19&r6&r20-new');
  await page.getByRole('button', { name: 'Quick rules' }).click();
  await expect(d).toBeVisible();
  await page.getByRole('button', { name: "Let's play" }).click();
  await expect(d).not.toBeVisible();
});
test('returning, shared landing and denied-storage visits are not interrupted', async ({
  page,
}, info) => {
  for (const path of ['/?r19&r19c&r6', '/certificate/fixture-original?r19&r19c&r6&r20-new']) {
    await page.goto(path);
    await expect(page.locator('.loading')).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'How to play' })).not.toBeVisible();
  }
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
  });
  await page.goto('/?r19&r19c&r6&r20-new');
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'How to play' })).not.toBeVisible();
});
test('closed-first visit dismisses at opening without blocking the claim path', async ({
  page,
}, info) => {
  await page.goto('/?r19&r19c&r6&r20-new&r7-clock&r7-closed');
  const d = page.getByRole('dialog', { name: 'How to play' });
  await expect(d).toBeVisible();
  await expect(d).not.toBeVisible({ timeout: 9000 });
});
test('yesterday recap stays below play, shows stored results and remembers dismissal', async ({
  page,
}, info) => {
  await page.goto('/?r19&r19c&r6&r20-recap');
  await expect(page.locator('.previous-night')).toContainText('Yesterday: #3 of 41');
  const input = await page.locator('#answer').boundingBox(),
    card = await page.locator('.previous-night').boundingBox();
  expect(card!.y).toBeGreaterThan(input!.y);
  await page.locator('.previous-night summary').click();
  await expect(page.locator('.previous-night')).toContainText('Quokka · 110 points');
  await expect(page.locator('.previous-night')).toContainText('Echidna · Unclaimed');
  await expect(page.getByRole('link', { name: 'Full board and reveal' })).toHaveAttribute(
    'href',
    '/archive?date=2026-11-26',
  );
  await shot(page, info, 'recap');
  await page.getByRole('button', { name: "Dismiss yesterday's reveal" }).click();
  await expect(page.locator('.previous-night')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.locator('.previous-night')).toHaveCount(0);
});
