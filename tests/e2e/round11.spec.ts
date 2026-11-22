import { test, expect } from './security-fixture';
import AxeBuilder from '@axe-core/playwright';
test('R11 rules, free guesses, explicit counters, reminders, settings and deletion', async ({
  page,
}) => {
  await page.goto('/?r6');
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn stamp sound off' })).toBeVisible();
  for (const [answer, message] of [
    ['dibs', 'The clerk appreciates the enthusiasm.'],
    ['registrar', 'Flattery will get you nowhere.'],
    ['Animals', 'Very funny.'],
  ]) {
    await page.locator('#answer').fill(answer);
    await page.locator('#answer').press('Enter');
    await expect(page.locator('.result-panel')).toContainText(message);
    await expect(page.locator('.strikes-progress')).toContainText('STRIKES 0/5');
  }
  await page.locator('.play-rules summary').click();
  await page.locator('#answer').fill('Dog');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('.result-panel')).toContainText(
    'reserved: the 10 most obvious answers are off-limits.',
  );
  await expect(page.locator('.play-rules')).not.toHaveAttribute('open', '');
  await page.goto('/?r7-closed');
  await page.locator('.reminder-button').click();
  const google = new URL(
    (await page.getByRole('link', { name: 'Google Calendar' }).getAttribute('href'))!,
  );
  expect(google.searchParams.get('dates')).toContain('T205500');
  expect(google.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY');
  await page.locator('.reminder-button').press('Escape');
  await expect(page.locator('.reminder-menu')).not.toHaveAttribute('open', '');
  await page.locator('#file-settings summary').click();
  await page.getByRole('button', { name: 'Delete my file', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yes, permanently delete my file' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep my file' }).click();
  await page.goto('/about');
  await page.locator('main h1').waitFor();
  await expect(page.locator('body')).not.toContainText('privacy@');
  await page.locator('#feedback summary').click();
  await page.locator('#feedback-topic').selectOption('privacy');
});
test('R11 every page has legible type, aligned containers, accessible disclosures and no overflow', async ({
  page,
}, info) => {
  for (const path of [
    '/?r6',
    '/?r7-closed',
    '/about',
    '/archive',
    '/certificate/fixture-1',
    '/admin/live',
    '/admin/schedule',
    '/not-a-page',
  ]) {
    await page.goto(path);
    await page.locator('main h1').waitFor();
    await page.locator('.loading').waitFor({ state: 'hidden' });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (page.viewportSize()!.width >= 900) {
      const small = await page.locator('body *').evaluateAll((els) =>
        els
          .filter(
            (el) =>
              el.getClientRects().length &&
              [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) &&
              parseFloat(getComputedStyle(el).fontSize) < 14,
          )
          .map((el) => ({
            tag: el.tagName,
            class: el.className,
            text: el.textContent?.slice(0, 70),
            px: getComputedStyle(el).fontSize,
          })),
      );
      expect(small, path).toEqual([]);
    }
    const issues = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      path,
    ).toEqual([]);
  }
});
