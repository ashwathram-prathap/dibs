import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const shot = async (page: any, project: string, name: string) => {
  const dir = `review/round19f/ui/${project}`;
  mkdirSync(dir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
};
test('R19F closed hero and scoring rules are clear before the first guess', async ({
  page,
}, info) => {
  await page.goto('/?r7-closed&r19');
  // The development fixture's closed mode is intentionally deterministic.
  {
    await expect(page.locator('.closed-copy')).toBeVisible();
    await expect(page.locator('.launch-description')).toHaveText(
      'One category a day. Name something nobody else has claimed. Your name stays on it.',
    );
    const description = await page.locator('.launch-description').boundingBox(),
      clock = await page.locator('.closed-copy .drop-countdown').boundingBox();
    expect(description!.y + description!.height).toBeLessThanOrEqual(clock!.y);
    await shot(page, info.project.name, 'closed');
  }
  await page.goto('/how-it-works?r19');
  await expect(page.locator('main')).toContainText(
    'Rarer answers score more. Taken or reserved answers cost a strike. Typos and answers not on the list never do.',
  );
  await expect(page.locator('main')).toContainText(
    'Each day the house holds the 10 best-known answers. Guessing one costs a strike.',
  );
  await shot(page, info.project.name, 'rules');
  await page.goto('/about?r19');
  await expect(page.locator('main')).toContainText(
    "Rarity uses English Wikipedia readership. Answers without data get the category's standard score.",
  );
  await shot(page, info.project.name, 'faq');
});
test('R19F golden results keep one phone Share action in flow and show owner answers in exports', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    (window as any).__drawn = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...rest) {
      const m = this.getTransform(),
        w = this.measureText(value).width;
      (window as any).__drawn.push({
        value,
        x: m.a * x + m.e,
        y: m.d * y + m.f,
        right: m.a * (x + w) + m.e,
        width: this.canvas.width,
        height: this.canvas.height,
      });
      return fill.call(this, value, x, y, ...rest);
    };
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (t: string) => {
          (window as any).__copied = t;
        },
      },
    });
  });
  await page.goto('/?r19&r6&gold-third&owner-sealed');
  for (const answer of ['Okapi', 'Quokka', 'Wombat']) {
    await page.locator('#answer').fill(answer);
    await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    if (answer !== 'Wombat')
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
  }
  await expect(page.locator('.golden-notice')).toContainText('Golden ticket.');
  await shot(page, info.project.name, 'gold-payoff');
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  const share = page.getByRole('button', { name: 'SHARE', exact: true });
  await expect(share).toBeEnabled();
  await expect(page.locator('.day-certificate')).toContainText('Golden ticket found');
  await expect(page.locator('.day-certificate .cert-footer')).toContainText('dibs.here/summary/');
  await shot(page, info.project.name, 'results-default');
  const phone = await page.evaluate(
    () => matchMedia('(max-width:767px), (max-width:950px) and (max-height:500px)').matches,
  );
  if (phone) {
    await expect(share).toBeInViewport();
    expect(await page.locator('.share-main').evaluate((el) => getComputedStyle(el).position)).toBe(
      'static',
    );
    await expect(page.getByRole('button', { name: 'Copy result', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'More', exact: true }).click();
  } else {
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeHidden();
    await expect(page.locator('.share-buttons > :visible')).toHaveCount(4);
    const grid = await page
      .locator('.share-buttons')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(grid.split(' ')).toHaveLength(2);
  }
  await page.locator('.copy-result').click();
  await expect.poll(() => page.evaluate(() => (window as any).__copied || '')).toContain('Okapi');
  expect(await page.evaluate(() => (window as any).__copied)).not.toContain("today's Dibs");
  const drawings = await page.evaluate(() => (window as any).__drawn);
  expect(drawings.some((d: any) => d.value.includes('One category. Three claims.'))).toBe(true);
  expect(
    drawings.some((d: any) => d.value.includes('Wombat') && d.value.includes('Golden ticket')),
  ).toBe(true);
  for (const d of drawings) {
    expect(d.x, d.value).toBeGreaterThanOrEqual(30);
    expect(d.right, d.value).toBeLessThanOrEqual(d.width - 30);
  }
  await shot(page, info.project.name, 'results');
  await page.getByLabel('Hide my answers', { exact: true }).check();
  await expect(share).toBeEnabled();
  await page.locator('.copy-result').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__copied || ''))
    .not.toContain('Okapi');
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.evaluate(() => {
    history.pushState(null, '', '/summary/fixture-summary');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('.day-certificate')).toContainText('Okapi');
  await expect(page.locator('.day-certificate')).toContainText('Golden ticket found');
  await page.getByLabel('Hide my answers', { exact: true }).uncheck();
  await expect(share).toBeEnabled();
  if (phone) await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.locator('.copy-result').click();
  await expect.poll(() => page.evaluate(() => (window as any).__copied || '')).toContain('Okapi');
});
test('R19F certificate renders full printed URL and all percentile bands', async ({
  page,
}, info) => {
  for (const p of ['0', '.94', '1', 'missing']) {
    await page.goto(`/certificate/fixture-1?r19&r19c&p=${p}&gold`);
    const certificate = page.locator('.certificate');
    await expect(certificate).toContainText(
      p === 'missing'
        ? '155 points · standard score (no readership data for this answer)'
        : '160 points',
    );
    await expect(certificate).toContainText('Form D-1 · Golden ticket');
    await expect(certificate.locator('.cert-footer')).toContainText('dibs.here/c/fixture-1');
    await shot(page, info.project.name, `certificate-${p}`);
  }
  const issues = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});

test('R19F native image payload follows Android versus Apple sharing rules', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__shared = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: any) => {
        (window as any).__shared = {
          keys: Object.keys(data),
          text: data.text,
          size: data.files?.[0].size,
        };
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as any).__caption = text;
        },
      },
    });
  });
  await page.goto('/certificate/fixture-1?r19&r19c&p=.94');
  const button = page.getByRole('button', { name: 'SHARE', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(() => page.evaluate(() => (window as any).__shared)).not.toBeNull();
  const data = await page.evaluate(() => ({
    shared: (window as any).__shared,
    caption: (window as any).__caption,
    android: /Android/i.test(navigator.userAgent),
  }));
  expect(data.shared.keys).toEqual(data.android ? ['files', 'text'] : ['files']);
  expect(data.shared.size).toBeLessThan(350000);
  expect(data.android ? data.shared.text : data.caption).toContain(
    'https://dibs.here/certificate/fixture-1?s=native',
  );
  if (!data.android)
    await expect(page.locator('.share-hint[role=status]')).toHaveText('Caption copied');
});
