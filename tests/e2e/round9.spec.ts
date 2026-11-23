import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
test('one card completes three wins and two strikes, then shares while other answers stay hidden', async ({
  page,
}, info) => {
  const dir = 'review/round9/devices/' + info.project.name;
  mkdirSync(dir, { recursive: true });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'canShare', { value: () => false });
  });
  await page.goto('/?r6');
  await expect(page.locator('#answer')).toBeVisible();
  const screenshot = async (name: string) => {
    await page.screenshot({ path: dir + '/' + name + '.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  };
  await screenshot('load');
  await expect(page.locator('table.ledger')).toHaveCount(0);
  const start = Date.now();
  let wins = 0;
  for (const [i, answer] of ['Pangolin', 'Axolotl', 'Dog', 'Okapi', 'Quokka'].entries()) {
    if (i === 0) await page.locator('#answer').click();
    await page.locator('#answer').fill(answer);
    if (answer === 'Okapi') await page.locator('#answer').press('Enter');
    else await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    if (answer === 'Pangolin' || answer === 'Dog') {
      await expect(page.locator('.strike-count')).toHaveText(
        'Strike ' + (answer === 'Pangolin' ? 1 : 2) + ' of 5',
      );
      await expect(page.locator('#answer')).toBeFocused();
      await expect(page.locator('#answer')).toHaveValue(answer);
    } else {
      wins++;
      if (wins < 3) {
        await expect(page.locator('.win-stamp')).toContainText(answer.toUpperCase());
        await expect(page.locator('.certificate')).toHaveCount(0);
        await screenshot('win-' + wins);
        await page.getByRole('button', { name: 'Next claim' }).click();
        await expect(page.locator('#answer')).toBeFocused();
      }
    }
  }
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.day-certificate')).toBeVisible();
  await expect(page.locator('.file-tally')).toContainText('3/3 claims · 2 strikes');
  await expect(page.locator('table.ledger')).toHaveCount(0);
  await expect(page.locator('#leaderboard')).toBeVisible();
  await screenshot('closed');
  await page.getByText('More ways to share', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Feed JPEG' }).click();
  await (await download).saveAs(dir + '/day-certificate.png');
  await page.getByRole('button', { name: 'Copy text', exact: true }).click();
  await expect(page.locator('.share-hint[role=status]')).not.toBeEmpty();
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await info.attach('file-timing', {
    body: JSON.stringify({
      milliseconds: Date.now() - start,
      maxTapsPerGuess: 2,
      note: 'Next claim focuses the input and is the first tap of the following guess.',
    }),
    contentType: 'application/json',
  });
});
test('invalid and failed requests preserve the entry, and five strikes close directly', async ({
  page,
}) => {
  await page.goto('/?r6&r8');
  await page.locator('#answer').fill('offline proof');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.locator('.result-panel')).toContainText('Try again');
  await expect(page.locator('#answer')).toHaveValue('offline proof');
  await page.locator('#answer').fill('axolot');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(page.getByRole('button', { name: 'Did you mean AXOLOTL?' })).toBeVisible();
  await expect(page.getByRole('img', { name: '0 of 5 strikes' })).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.locator('#answer').fill('Dog');
    await page.locator('#answer').press('Enter');
    if (i < 4) await expect(page.locator('.strike-count')).toHaveText(`Strike ${i + 1} of 5`);
  }
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.day-certificate')).toBeVisible();
  await expect(page.locator('.file-tally')).toContainText('0/3 claims · 5 strikes');
});
test('theme edges work on every route with consistent header placement', async ({ page }, info) => {
  let position: any;
  for (const [name, path] of [
    ['today', '/'],
    ['closed', '/?r7-closed'],
    ['certificate', '/certificate/fixture-1'],
    ['archive', '/archive'],
    ['office', '/about'],
    ['admin', '/admin/live'],
    ['error', '/not-a-page'],
  ]) {
    await page.goto(path);
    await page.locator('.loading').waitFor({ state: 'hidden' });
    await page.locator('.header-settings > summary').click();
    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toBeVisible();
    const box = (await toggle.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const initial = await page.locator('html').getAttribute('data-theme');
    await toggle.click({ position: { x: 2, y: box.height / 2 } });
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      initial === 'light' ? 'dark' : 'light',
    );
    await toggle.click({ position: { x: box.width - 2, y: box.height / 2 } });
    await expect(page.locator('html')).toHaveAttribute('data-theme', initial!);
    if (!position) position = box;
    expect(Math.abs(box.x - position.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y - position.y)).toBeLessThanOrEqual(1);
    const dir = 'review/round9/headers/' + info.project.name;
    mkdirSync(dir, { recursive: true });
    await page.locator('.masthead').screenshot({ path: dir + '/' + name + '.png' });
  }
});
test('390 phone keeps claim controls above an emulated keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto('/?r6');
  await page.locator('#answer').click();
  for (const answer of ['Dog', 'Axolotl', 'Pangolin', 'Okapi', 'Quokka']) {
    await page.locator('#answer').fill(answer);
    const button = page.getByRole('button', { name: 'CALL DIBS' });
    const box = (await button.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(520);
    await button.click();
    if (answer === 'Dog' || answer === 'Pangolin')
      await expect(page.locator('.strike-count')).toBeVisible();
    else if (answer !== 'Quokka') {
      await expect(page.locator('.win-stamp')).toBeVisible();
      await page.getByRole('button', { name: 'Next claim' }).click();
    }
  }
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.day-certificate')).toBeVisible();
});
