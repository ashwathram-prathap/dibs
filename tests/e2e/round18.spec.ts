import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
import { BACKUP_EXPLANATION } from '../../shared/copy';
const overflow = (el: HTMLElement) => ({ scroll: el.scrollWidth, client: el.clientWidth });
test('R18 Settings expands down, keeps one explanation, code/copy/restore/delete order and zero overflow', async ({
  page,
}) => {
  await page.goto('/?r7-closed');
  await page.locator('.header-settings > summary').click();
  const panel = page.locator('.header-controls');
  await page.locator('#file-settings > summary').click();
  await expect(page.locator('.your-backup-code output')).toBeVisible();
  const size = await panel.evaluate(overflow);
  expect(size.scroll).toBeLessThanOrEqual(size.client);
  expect(await panel.getByText(BACKUP_EXPLANATION, { exact: true }).count()).toBe(1);
  const children = await panel
    .locator('.sound-toggle,.music-toggle,.timezone-control,#settings-content')
    .evaluateAll((elements) =>
      elements.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, bottom: r.bottom, width: r.width };
      }),
    );
  for (let i = 1; i < children.length; i++) {
    expect(children[i].y - children[i - 1].bottom).toBeGreaterThanOrEqual(19);
    expect(children[i].x).toBe(children[0].x);
    expect(children[i].width).toBe(children[0].width);
  }
  if (page.viewportSize()!.width < 768) {
    const box = await panel.boundingBox();
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(page.viewportSize()!.width);
  }
  await page.getByRole('button', { name: 'Delete my data', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete permanently' })).toBeVisible();
  const expanded = await panel.evaluate(overflow);
  expect(expanded.scroll).toBeLessThanOrEqual(expanded.client);
  await page.getByRole('button', { name: 'Keep my data' }).click();
  await page.locator('.settings-close').click();
  await expect(panel).not.toBeVisible();
  await expect(page.locator('.header-settings > summary')).toBeFocused();
});
test('R18 feedback is a single-column modal with focus trap, Escape, success and error states', async ({
  page,
}) => {
  for (const failed of [false, true]) {
    await page.goto('/?r7-closed' + (failed ? '&feedback-error' : ''));
    await page.locator('#feedback summary').click();
    const dialog = page.getByRole('dialog', { name: 'Send feedback' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(560 + (page.viewportSize()!.width < 768 ? 208 : 0));
    for (const id of ['feedback-topic', 'feedback-note']) {
      const field = page.locator('#' + id),
        label = dialog.locator(`label[for="${id}"]`);
      expect(
        await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
      const a = await label.boundingBox(),
        b = await field.boundingBox();
      expect(b!.y - a!.y - a!.height).toBeCloseTo(8, 0);
    }
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('#feedback summary')).toBeFocused();
    await page.locator('#feedback summary').click();
    await page.locator('#feedback-note').fill('The phone feedback form is readable.');
    await page.getByRole('button', { name: 'Send note', exact: true }).click();
    await expect(dialog.getByRole(failed ? 'alert' : 'status')).toContainText(
      failed ? 'could not be sent' : 'was sent',
    );
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  }
});
test('R18 footer stays grouped; reminder rows are equal, accessible and large enough to tap', async ({
  page,
}) => {
  await page.goto('/?r7-closed');
  await page.locator('.closed-office').waitFor();
  const links = page.locator('.footer-links a,.footer-links summary');
  expect(await links.count()).toBe(4);
  const rows = await links.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y));
  const counts = Object.values(
    rows.reduce((acc: Record<string, number>, y) => {
      acc[y] = (acc[y] || 0) + 1;
      return acc;
    }, {}),
  );
  expect(counts).toEqual(page.viewportSize()!.width < 768 ? [2, 2] : [4]);
  const brand = await page.locator('.footer-brand').evaluate(overflow);
  expect(brand.scroll).toBeLessThanOrEqual(brand.client);
  await page.locator('.reminder-button').click();
  const options = page.locator('.reminder-options > a');
  expect(await options.count()).toBe(3);
  const heights = await options.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height),
  );
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(48);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  for (const name of ['Google Calendar', 'Apple Calendar', 'Outlook'])
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
test('R18 clock is solid Archivo and fits every repeated tabular digit; sharing appears only after play', async ({
  page,
}) => {
  await page.goto('/?r7-closed');
  const clock = page.locator('.closed-office .clock');
  await clock.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const widths = [];
  for (const digit of ['00', '11', '44', '88']) {
    await clock.evaluate((el, d) => (el.textContent = `${d}:${d}:${d}`), digit);
    const css = await clock.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        font: s.fontFamily,
        weight: s.fontWeight,
        filter: s.filter,
        spacing: parseFloat(s.letterSpacing),
        scroll: el.scrollWidth,
        client: el.clientWidth,
        width: el.getBoundingClientRect().width,
      };
    });
    expect(css.font).toContain('Archivo');
    expect(css.weight).toBe('900');
    expect(css.filter).toBe('none');
    expect(css.spacing).toBeGreaterThan(2);
    expect(css.scroll).toBeLessThanOrEqual(css.client);
    widths.push(css.width);
  }
  expect(new Set(widths).size).toBe(1);
  await page.goto('/?r6');
  await page.locator('#answer').waitFor();
  expect(await page.locator('.share-buttons').count()).toBe(0);
  for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
    if (answer !== 'Quokka') {
      expect(await page.locator('.share-buttons').count()).toBe(0);
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
    }
  }
  await expect(page.locator('.share-buttons .primary')).toHaveText('Share');
  await expect(page.locator('.copy-result')).not.toHaveClass(/primary/);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
});
