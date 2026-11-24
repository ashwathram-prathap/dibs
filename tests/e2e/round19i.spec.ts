import { test, expect } from './security-fixture';
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
// R19I: a repeat of an answer already struck tonight never costs a second strike. The client
// does not submit known repeats (exact/case); plurals/aliases come back from the server as
// ALREADY_TRIED and are remembered. Phone and desktop, both themes, Chromium/WebKit/Firefox.
const phone = (page: Page) => page.viewportSize()!.width < 768;
async function claim(page: Page, answer: string) {
  await page.locator('#answer').fill(answer);
  await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
}
const strikes = (page: Page) =>
  page.locator('.claim-slots-progress .strike-row').getAttribute('aria-label');
async function shot(page: Page, info: TestInfo, screen: string) {
  await page.evaluate(() => document.fonts.ready);
  const dir = `${process.env.R19I_SHOTS || 'review/round19i/matrix'}/${screen}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${info.project.name}.png`, animations: 'disabled' });
}
async function expectRepeat(page: Page, name: string) {
  const panel = page.locator('.result-panel[role=status]');
  await expect(panel).toHaveText(`You already tried ${name}. No strike.`);
  await expect(panel.locator('strong')).toHaveText(name);
  await expect(panel).not.toHaveClass(/taken/);
  await expect(page.locator('.strike-count')).toHaveCount(0);
  await expect(page.locator('#answer')).toBeFocused();
  // In view, readable, and the page never scrolls sideways.
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (
      e.type() === 'error' &&
      !/downloadable font: download failed.*status=2152398850/.test(e.text())
    )
      errors.push(e.text());
  });
  (page as any).__errors = errors;
});
test.afterEach(async ({ page }) => expect((page as any).__errors).toEqual([]));

test('R19I: a repeat taken guess (exact, case, plural) is free and says so inline', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r19&r19c&r6&persist');
  await page.locator('#answer').waitFor();
  await claim(page, 'Pangolin');
  await expect(page.locator('.strike-count')).toContainText('Strike 1 of 5');
  // Exact and case repeats are never sent.
  for (const again of ['Pangolin', 'pangolin', '  PANGOLIN ']) {
    await claim(page, again);
    await expectRepeat(page, 'Pangolin');
    await expect.poll(() => strikes(page)).toBe('1 of 5 strikes');
    await expect(page.locator('#answer')).toHaveValue(again);
  }
  await shot(page, info, 'repeat-taken');
  // A plural the client can't fold goes to the server, which charges nothing.
  await claim(page, 'Pangolins');
  await expectRepeat(page, 'Pangolin');
  await expect.poll(() => strikes(page)).toBe('1 of 5 strikes');
  // ...and is then remembered locally.
  await claim(page, 'PANGOLINS');
  await expectRepeat(page, 'Pangolin');
  // A different taken answer still costs a strike.
  await claim(page, 'Gecko');
  await expect(page.locator('.strike-count')).toContainText('Strike 2 of 5');
  // Reload: the server file still knows tonight's struck answers.
  await page.reload();
  await page.locator('#answer').waitFor();
  await claim(page, 'gecko');
  await expectRepeat(page, 'gecko');
  await expect.poll(() => strikes(page)).toBe('2 of 5 strikes');
});

test('R19I: a repeat reserved guess is free; after a claim the next-claim block stays usable', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r19&r19c&r6');
  await page.locator('#answer').waitFor();
  await claim(page, 'Dog');
  await expect(page.locator('.strike-count')).toContainText('Strike 1 of 5');
  await expect(page.locator('.result-panel')).toContainText('Reserved by the house');
  await claim(page, 'dog');
  await expectRepeat(page, 'Dog');
  await expect.poll(() => strikes(page)).toBe('1 of 5 strikes');
  await claim(page, 'Okapi');
  await expect(page.locator('.compact-payoff .win-stamp')).toContainText('OKAPI');
  await expect(page.locator('.next-claim-heading')).toHaveText('Claim 2 of 3 next');
  await claim(page, 'DOG');
  await expectRepeat(page, 'Dog');
  await expect.poll(() => strikes(page)).toBe('1 of 5 strikes');
  await expect(page.locator('.claim-slots li.filled')).toHaveCount(1);
  await shot(page, info, 'repeat-reserved-after-claim');
  // Five distinct strikes still end play; repeats in between never count.
  for (const [i, answer] of ['Pangolin', 'Gecko', 'Lemur', 'Tapir'].entries()) {
    await claim(page, answer);
    if (i < 3) {
      await expect(page.locator('.strike-count')).toContainText(`Strike ${i + 2} of 5`);
      await claim(page, answer.toLowerCase());
      await expectRepeat(page, answer);
    }
  }
  await expect(page.locator('.final-strike')).toContainText("That's 5 strikes.");
  await expect(page.locator('#answer')).toHaveCount(0);
});

test('R19I: How it works and the FAQ explain repeat guesses', async ({ page }) => {
  const line = 'Guessing the same taken answer twice never costs a second strike.';
  await page.goto('/how-it-works?r19&r6');
  await expect(page.locator('.how-page .repeat-guess-note')).toHaveText(line);
  await page.goto('/about?r19&r6');
  await expect(
    page.getByRole('heading', { name: 'Can the same guess cost two strikes?' }),
  ).toBeVisible();
  await expect(page.locator('.about-layout')).toContainText('No. ' + line);
  if (phone(page))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
});
