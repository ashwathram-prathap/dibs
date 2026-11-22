import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const root = 'review/final';
const submit = async (page: any, answer: string) => {
  await page.getByLabel('ENTRY:', { exact: true }).fill(answer);
  await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
};
for (const [zone, expected] of [
  ['America/Toronto', '9:00 PM ET'],
  ['America/Vancouver', '7:00 PM PT'],
  ['Europe/London', 'Tue 2:00 AM GMT'],
  ['Asia/Kolkata', 'Tue 7:30 AM GMT+5:30'],
  ['Australia/Sydney', 'Tue 1:00 PM GMT+11'],
  ['invalid', '9:00 PM ET'],
  ['', '9:00 PM ET'],
])
  test(`local drop in ${zone || 'empty zone'}`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'r7-chromium-390-light');
    const context = await browser.newContext({
      timezoneId: zone && zone !== 'invalid' ? zone : 'America/Vancouver',
    });
    const page = await context.newPage();
    if (!zone || zone === 'invalid')
      await page.addInitScript((value) => {
        const original = Intl.DateTimeFormat.prototype.resolvedOptions;
        Intl.DateTimeFormat.prototype.resolvedOptions = function () {
          return { ...original.call(this), timeZone: value };
        };
      }, zone);
    try {
      await page.goto('/?r7-closed=1');
      await expect(page.locator('.drop-countdown .local-drop')).toHaveText(expected);
      await page.getByRole('link', { name: 'Office notice', exact: true }).click();
      await expect(page.locator('.rules')).toContainText(expected);
    } finally {
      await context.close();
    }
  });
for (const skew of [-10, 10])
  test(`rolls over with ${skew} minute clock skew and delayed server`, async ({ page }) => {
    await page.clock.install({ time: new Date(Date.parse('2026-11-24T01:59:55Z') + skew * 60000) });
    await page.goto('/?r7-clock=1&r7-rollover=1');
    await expect(page.locator('h1.category')).toHaveText('Animals');
    await expect(page.locator('.clock')).toHaveText(/00:00:0[1-5]/);
    await page.clock.runFor(5000);
    await expect(page.locator('.clock')).toHaveText('Opening…');
    await page.clock.runFor(10000);
    await expect(page.locator('h1.category')).toHaveText('Universities');
    await expect(page.locator('.clock')).toHaveText(/23:59:\d\d/);
  });
test('closed office and slim round strip', async ({ page }, info) => {
  mkdirSync(root, { recursive: true });
  await page.goto('/?r7-closed=1');
  await expect(page.locator('.drop-countdown .clock')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${root}/${info.project.name}-closed.png`, fullPage: true });
  await page.goto('/');
  await expect(page.locator('.round-countdown')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const box = await page.getByRole('button', { name: 'CALL DIBS' }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(info.project.use.viewport!.height);
  await page.screenshot({ path: `${root}/${info.project.name}-mid-round.png`, fullPage: true });
});
for (const kind of ['clean', 'gold-two-strikes', 'five-strikes'])
  test(`Day Certificate ${kind}`, async ({ page }, info) => {
    await page.addInitScript(() => {
      (window as any).printed = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        (window as any).printed.push(text);
        return original.call(this, text, ...(args as [number, number]));
      };
      Object.defineProperty(navigator, 'share', { value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            (window as any).copied = text;
          },
        },
      });
    });
    await page.goto(kind === 'clean' ? '/' : '/?r6=1');
    const order: string[] = [];
    if (kind === 'five-strikes') {
      for (let i = 0; i < 5; i++) {
        await submit(page, i % 2 ? 'Pangolin' : 'Dog');
        order.push(i % 2 ? 'Pangolin' : 'DOG');
        await expect(page.getByRole('img', { name: `${i + 1} of 5 strikes` })).toBeVisible();
      }
    } else {
      for (const answer of ['Axolotl', 'Okapi', 'Quokka']) {
        if (kind === 'gold-two-strikes' && answer !== 'Okapi') {
          const miss = answer === 'Axolotl' ? 'Pangolin' : 'Dog';
          await submit(page, miss);
          order.push(miss === 'Dog' ? 'DOG' : miss);
          await expect(page.locator('.clerk-message')).toContainText(
            miss === 'Dog' ? 'held by the Registry' : 'already called dibs',
          );
        }
        await submit(page, answer);
        order.push(answer);
        await expect(page.locator('.certificate')).toBeVisible();
        // A certificate must survive well beyond every former auto-dismiss timeout.
        await page.waitForTimeout(1800);
        await expect(page.locator('.certificate')).toBeVisible();
        await expect(page.locator('.claim-imprint')).toBeVisible();
        await page
          .getByRole('button', {
            name: answer === 'Quokka' ? 'See my file' : 'Next dibs',
            exact: true,
          })
          .click();
      }
    }
    await expect(page.locator('.day-certificate')).toBeVisible();
    const rows = page.locator('.summary-answers li');
    await expect(rows).toHaveCount(order.length);
    for (let i = 0; i < order.length; i++) await expect(rows.nth(i)).toContainText(order[i]);
    if (kind === 'gold-two-strikes') {
      await expect(rows.nth(0)).toContainText('Taken by Rust Finch #12 at');
      await expect(rows.nth(1)).toContainText('DIBS / GOLD / DEEP CUT');
      await expect(rows.nth(3)).toContainText('Held by the Registry');
    }
    await page.getByRole('button', { name: 'Copy text', exact: true }).click();
    const copied = await page.evaluate(() => (window as any).copied);
    expect(copied).toContain('9 PM ET');
    expect(copied).not.toMatch(/Axolotl|Pangolin|DOG|Rust Finch/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${root}/${info.project.name}-${kind}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
      [],
    );
    for (const format of ['Story', 'Feed']) {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: format + ' PNG', exact: true }).click();
      await (
        await download
      ).saveAs(`${root}/${info.project.name}-${kind}-${format.toLowerCase()}.png`);
    }
    const printed = await page.evaluate(() => (window as any).printed.join(' '));
    for (const entry of order) expect(printed).toContain(entry.toUpperCase());
    expect(printed).toContain('Teal Otter #41');
    expect(printed).toContain('DAY STREAK');
  });

test('clock pauses when hidden, resyncs on return, and limits announcements', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?r7-closed=1');
  const live = page.locator('.drop-countdown [aria-live]');
  await expect(live).not.toBeEmpty();
  const spoken = await live.textContent();
  await page.clock.runFor(30000);
  await expect(live).toHaveText(spoken!);
  const visible = await page.locator('.clock').textContent();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(90000);
  await expect(page.locator('.clock')).toHaveText(visible!);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1000);
  await expect(page.locator('.clock')).toHaveText(/03:57:\d\d/);
  await expect(live).not.toHaveText(spoken!);
});
