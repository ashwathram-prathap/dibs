import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
for (const variant of ['first', 'second', 'third', 'two', 'strikes']) {
  test(`R19D stored golden scores on every surface: ${variant}`, async ({ page }, info) => {
    await page.goto(`/?r19&r6&gold-${variant === 'strikes' ? 'second' : variant}`);
    for (const [i, answer] of ['Okapi', 'Quokka', 'Wombat'].entries()) {
      if (variant === 'strikes') {
        await page.locator('#answer').fill(['Pangolin', 'Gecko', 'Lemur'][i]);
        await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
        await expect(page.locator('.result-panel.taken')).toBeVisible();
      }
      await page.locator('#answer').fill(answer);
      await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
      const golden =
        variant === 'two'
          ? i !== 1
          : i === ['first', 'second', 'third'].indexOf(variant === 'strikes' ? 'second' : variant);
      if (golden) {
        await expect(page.locator('.points-earned')).toContainText('160 points');
        await expect(page.locator('.points-earned')).toContainText('60 + 100 golden bonus');
        await expect(page.locator('.golden-notice')).toContainText('One of 3 hidden tonight.');
        const stamp = await page.locator('.win-stamp').evaluate((el) => ({
          duration: getComputedStyle(el, '::after').animationDuration,
          iterations: getComputedStyle(el, '::after').animationIterationCount,
        }));
        expect(stamp).toEqual({ duration: '0.6s', iterations: '1' });
        const dir = `review/round19d/golden/${info.project.name}`;
        mkdirSync(dir, { recursive: true });
        await page.screenshot({
          path: `${dir}/${variant}-payoff-${i + 1}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
      await page
        .locator(i === 2 ? '.win-actions > .primary' : '.next-claim-shortcut')
        .click();
    }
    await expect(page.locator('.day-certificate')).toContainText('Golden ticket found');
    const total = variant === 'two' ? 380 : variant === 'strikes' ? 250 : 280;
    await expect(page.locator('.certificate-score')).toContainText(`${total} points`);
    const rows = page.locator('.golden-row');
    await expect(rows).toHaveCount(variant === 'two' ? 2 : 1);
    for (const row of await rows.all()) {
      await expect(row).toContainText('160 points');
      await expect(row).toContainText('60 + 100 golden bonus');
      await expect(row).toContainText('Golden ticket · +100');
    }
    await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `review/round19d/golden/${info.project.name}/${variant}-day.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.evaluate(() => {
      history.pushState(null, '', '/leaderboard');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    const marker = page.locator('.leaderboard .own-score .gold-marker');
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute('aria-label', 'found a golden ticket');
    expect(Number(await page.locator('.leaderboard .own-score td').nth(1).textContent())).toBe(
      total,
    );
    await page.screenshot({
      path: `review/round19d/golden/${info.project.name}/${variant}-leaderboard.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
test('R19D reduced motion disables the single gold shimmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r19&r6&gold-first');
  await page.locator('#answer').fill('Okapi');
  await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
  await expect(page.locator('.golden-notice')).toBeVisible();
  expect(
    await page.locator('.win-stamp').evaluate((el) => getComputedStyle(el, '::after').display),
  ).toBe('none');
});

test('R19D changing the selected zone refreshes prepared images and answer hiding is remembered', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__filings = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...rest) {
      if (value.includes('filed ')) (window as any).__filings.push(value);
      return fill.call(this, value, x, y, ...rest);
    };
  });
  await page.goto('/?r19&r6&gold-first');
  for (const [i, answer] of ['Okapi', 'Quokka', 'Wombat'].entries()) {
    await page.locator('#answer').fill(answer);
    await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await page
      .locator(i === 2 ? '.win-actions > .primary' : '.next-claim-shortcut')
      .click();
  }
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Hide my answers', { exact: true })).not.toBeChecked();
  await page.evaluate(() => {
    localStorage.setItem('dibs-timezone', 'Asia/Tokyo');
    (window as any).__filings = [];
    dispatchEvent(new Event('dibs-zone'));
  });
  await expect(page.locator('.file-tally')).toContainText('Japan time');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__filings.some(
          (s: string) => s.includes('Japan time') && !s.includes('GMT'),
        ),
      ),
    )
    .toBe(true);
  await page.getByLabel('Hide my answers', { exact: true }).check();
  await page.goto('/certificate/fixture-1?r19&r19c&gold');
  await expect(page.getByLabel('Hide my answers', { exact: true })).toBeChecked();
  await expect(page.locator('.cert-answer')).toHaveText('Okapi');
  await page.goto('/certificate/fixture-1?r19&r19c&gold&visitor');
  await expect(page.locator('.cert-answer')).toHaveText('SEALED');
});
