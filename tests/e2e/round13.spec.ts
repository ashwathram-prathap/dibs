import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
test('R13 hero first, R7 scale, phone action visible, explanation collapses', async ({ page }) => {
  await page.goto('/?r6');
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator('h1.category'),
    input = page.locator('#answer'),
    intro = page.locator('.game-intro');
  await expect(input).toBeVisible();
  expect((await hero.boundingBox())!.y).toBeLessThan((await input.boundingBox())!.y);
  if (page.viewportSize()!.width >= 768)
    expect((await input.boundingBox())!.y).toBeLessThan((await intro.boundingBox())!.y);
  else await expect(page.locator('.play-rules')).not.toBeVisible();
  const width = page.viewportSize()!.width;
  if (width === 390 || width === 393) {
    const button = (await page
      .getByRole('button', { name: 'CALL DIBS', exact: true })
      .boundingBox())!;
    expect(button.y + button.height).toBeLessThan(844);
  }
  expect(
    await hero.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(width <= 600 ? width * 0.154 - 1 : Math.min(192, width * 0.134) - 1);
  await input.fill('dibs');
  await input.press('Enter');
  if (width >= 768) {
    await expect(page.locator('.play-introduction')).not.toHaveAttribute('open', '');
    await page.locator('.play-introduction summary').click();
    await expect(intro).toBeVisible();
    // A result arriving after the disclosure opens must not remount and close it.
    await expect(page.locator('.result-panel')).toBeVisible();
    await expect(intro).toBeVisible();
  }
  await page.goto('/?r7-closed');
  await expect(page.locator('.closed-office .clock')).toBeVisible();
  expect(
    await page
      .locator('.closed-office .clock')
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    // R18 preserves expanded Archivo and positive digit gaps; fit the whole row on phones.
  ).toBeGreaterThanOrEqual(
    width < 768 ? Math.max(44, (width - 40) / 5.2) - 1 : Math.min(164, width * 0.12) - 1,
  );
  expect((await page.locator('.closed-office .clock').boundingBox())!.y).toBeLessThan(
    (await page.locator('.game-intro').boundingBox())!.y,
  );
  await expect(page.locator('.closed-office .drop-countdown > p')).toBeVisible();
  await expect(page.locator('.theme-toggle')).toHaveText(/Carbon copy|Paper copy/);
  const initial = await page.locator('html').getAttribute('data-theme');
  await page
    .getByRole('button', {
      name: initial === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
    })
    .click();
  await expect(page.locator('.theme-toggle')).toHaveText(
    initial === 'light' ? 'Paper copy' : 'Carbon copy',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});
test('R13 sound mapping, double tap and music only after tap', async ({ page }) => {
  const audioRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/audio/')) audioRequests.push(r.url());
  });
  await page.addInitScript(() => {
    (window as any).stamps = [];
    (window as any).musicLoops = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      (window as any).musicLoops.push({ loop: this.loop, preload: this.preload });
      return play.call(this);
    };
    window.addEventListener('dibs-stamp', (e: any) => (window as any).stamps.push(e.detail));
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r6');
  await page.locator('#answer').waitFor();
  expect(audioRequests).toEqual([]);
  for (const answer of ['dibs', 'axolot', 'notarealword']) {
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
    await expect(page.locator('.result-panel')).toBeVisible();
  }
  expect(await page.evaluate(() => (window as any).stamps)).toEqual([]);
  await page.locator('.header-settings').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await page.getByRole('button', { name: 'Turn stamp sound off' }).click();
  await page.locator('.settings-close').click();
  await page.locator('#answer').fill('Dog');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('.strike-count')).toHaveText('Strike 1 of 5');
  expect(await page.evaluate(() => (window as any).stamps)).toEqual([]);
  await page.locator('.header-settings').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await page.getByRole('button', { name: 'Turn stamp sound on' }).click();
  await page.locator('.settings-close').click();
  await page.locator('#answer').fill('Dog');
  await page.locator('#answer').press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).stamps)).toEqual([0.115]);
  await expect(page.locator('.strike-count')).toHaveText('Strike 2 of 5');
  await expect(page.locator('#answer')).not.toHaveAttribute('readonly', '');
  await page.waitForTimeout(150);
  await page.locator('#answer').fill('Axolotl');
  await page
    .getByRole('button', { name: 'CALL DIBS', exact: true })
    .evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
  await expect.poll(() => page.evaluate(() => (window as any).stamps)).toEqual([0.115, 0.48]);
  // The gold tail lasts 480 ms; separate the next intentional claim from overlap suppression.
  await page.waitForTimeout(500);
  await page.locator('.next-claim-shortcut').click();
  await page.locator('#answer').fill('Okapi');
  await page.locator('#answer').press('Enter');
  await expect
    .poll(() => page.evaluate(() => (window as any).stamps))
    .toEqual([0.115, 0.48, 0.145]);
  await page.locator('.header-settings').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await page.getByRole('button', { name: /Turn music on/ }).click();
  await expect.poll(() => audioRequests.length).toBe(1);
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => (window as any).musicLoops.length)).toBe(1);
  await page.locator('.settings-close').click();
  await expect(page.locator('.music-toggle')).not.toBeVisible();
  await page.locator('.header-settings > summary').click();
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.music-toggle')).toHaveText('Music: On');
  const loop = await page.evaluate(() => (window as any).musicLoops[0]);
  expect(loop.loop).toBe(true);
  expect(loop.preload).toBe('none');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => (window as any).musicLoops.length)).toBe(2);
  await page.reload();
  await page.locator('#answer').waitFor();
  expect(audioRequests.length).toBe(1);
  await page.locator('.header-settings > summary').click();
  await expect(page.getByRole('button', { name: /Resume music/ })).toBeVisible();
});

test('R13 overlay keyboard keeps the whole form reachable after rules collapse', async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?r6');
    await page.locator('#answer').fill('dibs');
    await page.locator('#answer').press('Enter');
    await expect(page.locator('.result-panel')).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 280 });
      visualViewport!.dispatchEvent(new Event('resize'));
    });
    const input = (await page.locator('#answer').boundingBox())!;
    const button = (await page.locator('.input-row .primary').boundingBox())!;
    expect(input.y).toBeGreaterThanOrEqual(0);
    expect(button.y + button.height).toBeLessThanOrEqual(280);
    await page.locator('#answer').blur();
    await page.locator('#answer').focus();
    const refocused = (await page.locator('.input-row .primary').boundingBox())!;
    expect(refocused.y + refocused.height).toBeLessThanOrEqual(280);
    await page.evaluate(() => {
      delete (visualViewport as any).height;
      visualViewport!.dispatchEvent(new Event('resize'));
    });
  }
});
