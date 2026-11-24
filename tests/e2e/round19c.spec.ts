import { test, expect } from './security-fixture';
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';

function describeConsoleErrors() {
  const original = console.error.bind(console);
  console.error = (...values) =>
    original(
      ...values.map((value) => {
        if (value && typeof value === 'object') {
          if ('message' in value || 'stack' in value)
            return `${value.name || 'Error'}: ${value.message || ''}\n${value.stack || ''}`;
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        }
        return value;
      }),
    );
}

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const values = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((n) => {
        const channel = n / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function shot(page: Page, info: TestInfo, screen: string) {
  await settle(page);
  const directory = `${process.env.R19C_SHOTS || 'review/round19c/matrix'}/raw/${screen}`;
  mkdirSync(directory, { recursive: true });
  const options = {
    path: `${directory}/${info.project.name}.png`,
    animations: 'disabled' as const,
  };
  // Capture the actual certificate/controls, including content below the first viewport.
  if (screen.startsWith('certificate-')) {
    // Isolated certificate proof: keep fixed page navigation out of the component capture.
    const header = page.locator('.masthead');
    const previous = await header.evaluate((el: HTMLElement) => el.style.visibility);
    await header.evaluate((el: HTMLElement) => {
      el.style.visibility = 'hidden';
    });
    try {
      await page.locator('.certificate').screenshot(options);
    } finally {
      await header.evaluate((el: HTMLElement, value) => {
        el.style.visibility = value;
      }, previous);
    }
  } else if (screen.startsWith('share-')) await page.locator('.share-main').screenshot(options);
  else await page.screenshot(options);
}
async function audit(page: Page, scope = 'main', action?: string) {
  await settle(page);
  // Certificates can extend below the viewport. Inspect their entire axes too.
  const curveErrors = await page.locator(scope).evaluate((root) => {
    const errors: string[] = [];
    const certificates = [
      ...(root.matches('.certificate') ? [root] : []),
      ...root.querySelectorAll('.certificate'),
    ];
    for (const certificate of certificates) {
      const bounds = certificate.getBoundingClientRect();
      for (const text of certificate.querySelectorAll('.dibs-stamp strong, .dibs-stamp span')) {
        const box = text.getBoundingClientRect();
        if (box.left < bounds.left - 1 || box.right > bounds.right + 1)
          errors.push('Clipped certificate stamp box: ' + text.textContent);
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const r of range.getClientRects())
          if (r.left < bounds.left - 1 || r.right > bounds.right + 1)
            errors.push('Clipped certificate stamp: ' + text.textContent);
      }
    }
    for (const axis of root.querySelectorAll<HTMLElement>('.rarity-axis')) {
      const bounds = axis.getBoundingClientRect();
      const curve = axis.closest('.rarity-curve')!.getBoundingClientRect();
      const drawing = axis.closest('.rarity-curve')!.querySelector('svg')!.getBoundingClientRect();
      const labels = [...axis.querySelectorAll('.rarity-end')];
      if (bounds.bottom > curve.bottom + 1 || bounds.top < drawing.bottom - 1)
        errors.push('Axis crosses the curve or its container');
      for (const label of labels) {
        const range = document.createRange();
        range.selectNodeContents(label);
        for (const r of range.getClientRects())
          if (r.left < bounds.left - 1 || r.right > bounds.right + 1)
            errors.push('Clipped axis label: ' + label.textContent);
      }
      const [a, b] = labels.map((label) => label.getBoundingClientRect());
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
        errors.push('Axis labels overlap');
    }
    return errors;
  });
  expect(curveErrors, 'complete curve labels, including below the viewport').toEqual([]);
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          !el.closest('svg,details:not([open])') &&
          (r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 2)
        );
      })
      .map((el) => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.slice(0, 35),
        width: el.clientWidth,
        scroll: el.scrollWidth,
      }))
      .slice(-20),
  }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width + 1);
  const clipped = await page.locator(scope).evaluate((root) =>
    [
      ...root.querySelectorAll<HTMLElement>(
        'button, a, summary, label, p, h1, h2, h3, .control-face, textarea, input',
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== 'hidden' &&
          !el.closest('details:not([open])') &&
          !el.classList.contains('sr-only') &&
          el.scrollWidth > el.clientWidth + 2 &&
          ['hidden', 'clip'].includes(s.overflowX)
        );
      })
      .map((el) => el.tagName + '.' + el.className + ':' + el.textContent?.slice(0, 60)),
  );
  expect(clipped, 'clipped text').toEqual([]);
  const overlaps = await page.locator(scope).evaluate((root) => {
    const labels: { element: Element; node: Node; text: string; rect: DOMRect }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode,
        el = node.parentElement;
      if (
        !el ||
        !node.textContent?.trim() ||
        el.closest('svg,.sr-only,details:not([open]) > :not(summary),select,script,style')
      )
        continue;
      const style = getComputedStyle(el);
      if (style.visibility !== 'visible' || style.opacity === '0') continue;
      const range = document.createRange();
      range.selectNode(node);
      for (const r of range.getClientRects()) {
        if (
          !r.width ||
          !r.height ||
          r.bottom < 0 ||
          r.top > innerHeight ||
          r.right < 0 ||
          r.left > innerWidth
        )
          continue;
        const hit = document.elementFromPoint(
          Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2)),
          Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2)),
        );
        if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
        labels.push({ element: el, node, text: node.textContent.trim().slice(0, 40), rect: r });
      }
    }
    const hits: string[] = [];
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i],
          b = labels[j];
        if (
          a.element === b.element ||
          a.element.contains(b.element) ||
          b.element.contains(a.element)
        )
          continue;
        const intersects = (x: DOMRect, y: DOMRect) =>
          Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 &&
          Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1;
        if (!intersects(a.rect, b.rect)) continue;
        // A shared rotation preserves separation, but its axis-aligned bounding boxes
        // can intersect. Check those pairs in the common ancestor's unrotated frame.
        // Unrelated transformed elements still use their actual viewport geometry.
        let common = a.element.parentElement;
        while (common && !common.contains(b.element)) common = common.parentElement;
        let rotated: HTMLElement | null = common;
        while (rotated && root.contains(rotated)) {
          const style = getComputedStyle(rotated);
          if (style.transform !== 'none' || (style.rotate && style.rotate !== 'none')) break;
          rotated = rotated.parentElement;
        }
        if (rotated && root.contains(rotated)) {
          const original = rotated.style.cssText;
          try {
            rotated.style.transform = 'none';
            rotated.style.rotate = 'none';
            const boxes = [a.node, b.node].map((node) => {
              const range = document.createRange();
              range.selectNode(node);
              return [...range.getClientRects()];
            });
            if (!boxes[0].some((x) => boxes[1].some((y) => intersects(x, y)))) continue;
          } finally {
            rotated.style.cssText = original;
          }
        }
        hits.push(a.text + ' / ' + b.text);
      }
    return hits;
  });
  expect(overlaps, 'overlapping visible text').toEqual([]);

  const small = await page.locator(scope).evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>('button, select, textarea, input, summary, a.primary')]
      .filter((el) => {
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== 'hidden' &&
          !el.closest('details:not([open])') &&
          (r.width < 43.5 || r.height < 43.5)
        );
      })
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent?.slice(0, 40),
        w: el.getBoundingClientRect().width,
        h: el.getBoundingClientRect().height,
      })),
  );
  expect(small, '44px tap targets').toEqual([]);
  if (action) {
    const colors = await page.locator(action).evaluate((el) => {
      const style = getComputedStyle(el);
      return { foreground: style.color, background: style.backgroundColor };
    });
    expect(
      contrast(colors.foreground, colors.background),
      'primary action AA contrast',
    ).toBeGreaterThanOrEqual(4.5);
  }
  if (
    action &&
    (page.viewportSize()!.width < 768 ||
      (page.viewportSize()!.width <= 950 && page.viewportSize()!.height <= 500))
  ) {
    const r = await page.locator(action).boundingBox();
    expect(r).not.toBeNull();
    expect(r!.y, 'primary above viewport').toBeGreaterThanOrEqual(0);
    const nav = await page
      .locator('.masthead nav')
      .evaluate((el) =>
        getComputedStyle(el).position === 'fixed' ? { y: el.getBoundingClientRect().y } : null,
      );
    expect(r!.y + r!.height, 'primary below phone viewport').toBeLessThanOrEqual(
      Math.min(page.viewportSize()!.height, nav?.y ?? Infinity) + 1,
    );
    if (action === '.invitation-action > .primary' && page.viewportSize()!.width >= 768) {
      const heading = (await page.locator('.shared-invitation h1').boundingBox())!;
      const bar = (await page.locator('.invitation-action').boundingBox())!;
      expect(heading.y, 'landscape invitation heading above viewport').toBeGreaterThanOrEqual(0);
      expect(
        heading.y + heading.height,
        'landscape action covers invitation heading',
      ).toBeLessThanOrEqual(bar.y);
    }
  }
}
async function claim(page: Page, answer: string) {
  await page.locator('#answer').fill(answer);
  await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
}
async function done(page: Page) {
  for (const answer of ['Okapi', 'Quokka', 'Wombat']) {
    await claim(page, answer);
    await expect(page.locator('.win-stamp')).toContainText(answer.toUpperCase());
    await page
      .locator(answer === 'Wombat' ? '.win-actions > .primary' : '.next-claim-shortcut')
      .click();
  }
  await page.locator('.day-certificate').waitFor();
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
}
test.beforeEach(async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    // Firefox reports fonts cancelled by the test's own navigation (NS_BINDING_ABORTED).
    if (
      e.type() === 'error' &&
      !/downloadable font: download failed.*status=2152398850/.test(e.text())
    )
      errors.push(e.text());
  });
  (page as any).__errors = errors;
  await page.addInitScript(describeConsoleErrors);
  await page.addInitScript(
    ({ scale }) => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = 16 * scale + 'px';
      });
      const real = window.matchMedia.bind(window);
      window.matchMedia = (query) =>
        query === '(display-mode: standalone)' && sessionStorage.getItem('r19c-standalone') === '1'
          ? Object.assign(real(query), { matches: true })
          : real(query);
    },
    { scale: info.project.metadata.fontScale as number },
  );
});
test.afterEach(async ({ page }) => expect((page as any).__errors).toEqual([]));

test('Settings share aligned controls, sticky opaque header, labels, theme swatches and scroll lock', async ({
  page,
}, info) => {
  let releaseLeaderboard!: () => void;
  const leaderboardReady = new Promise<void>((resolve) => (releaseLeaderboard = resolve));
  await page.route('**/assets/Leaderboard-*.js', async (route) => {
    await leaderboardReady;
    await route.continue();
  });
  await page.goto('/?r19&r19c&r7-closed');
  await page.locator('.closed-office').waitFor();
  try {
    await expect(page.locator('[aria-label="Loading scores"]')).toBeVisible();
    await audit(page, '.closed-office');
  } finally {
    releaseLeaderboard();
  }
  await page.locator('#leaderboard').waitFor();
  await shot(page, info, 'settings-closed');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight / 2));
  // Opening by keyboard/programmatic activation preserves the scrolled page position.
  await page.locator('.header-settings > summary').evaluate((el: HTMLElement) => el.click());
  const panel = page.locator('.header-controls');
  await expect(panel).toHaveAttribute('open', '');
  await page.locator('.timezone-control').waitFor();
  await expect(page.locator('.timezone-control .control-face')).toHaveText('ET · Toronto');
  await settle(page);
  const geometry = await panel.evaluate((root) => {
    const controls = [
      ...root.querySelectorAll<HTMLElement>(
        '.control-face, .sound-toggle, .music-toggle, #file-settings > summary',
      ),
    ].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        height: r.height,
        font: getComputedStyle(el).fontSize,
      };
    });
    const chevrons = [
      ...root.querySelectorAll('.select-control > svg, #file-settings > summary > svg'),
    ].map((el) => el.getBoundingClientRect().right);
    return { controls, chevrons };
  });
  for (const control of geometry.controls) {
    expect(control.left).toBeCloseTo(geometry.controls[0].left, 0);
    expect(control.right).toBeCloseTo(geometry.controls[0].right, 0);
    expect(control.height).toBeCloseTo(geometry.controls[0].height, 0);
    expect(control.font).toBe(geometry.controls[0].font);
  }
  for (const x of geometry.chevrons) expect(x).toBeCloseTo(geometry.chevrons[0], 0);
  for (const choice of ['light', 'dark', 'system']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(choice);
    const target = choice === 'system' ? info.project.use.colorScheme : choice;
    await expect(page.locator('.theme-control .theme-swatch')).toHaveClass(
      'theme-swatch swatch-' + target,
    );
    const swatch = await page.locator('.theme-control .theme-swatch').boundingBox();
    expect(swatch!.width).toBeCloseTo(14, 2);
    expect(swatch!.height).toBeCloseTo(10, 2);
    await expect(page.locator('.theme-toggle .theme-swatch')).toHaveClass(
      'theme-swatch swatch-' + (target === 'light' ? 'dark' : 'light'),
    );
  }
  for (const zone of ['America/Vancouver', 'Asia/Kolkata', 'Europe/London', 'America/Toronto']) {
    await page.getByRole('combobox', { name: 'Timezone' }).selectOption(zone);
    await audit(page, '.header-controls');
  }
  await shot(page, info, 'settings-open');
  await page.locator('#file-settings > summary').click();
  await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
  const header = await page.locator('.settings-heading').boundingBox(),
    bounds = await panel.boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(bounds!.y);
  expect(header!.y).toBeLessThanOrEqual(bounds!.y + 2);
  expect(
    await page.locator('.settings-heading').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + 5, r.top + 5));
    }),
  ).toBe(true);
  await audit(page, '.header-controls');
  await shot(page, info, 'settings-scrolled');
  const scroll = await page.evaluate(() => scrollY);
  await page.mouse.move(2, 2);
  await page.mouse.wheel(0, 250);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.locator('.settings-close').click();
  expect(await page.locator('.theme-toggle .theme-swatch').count()).toBe(1);
  for (let i = 0; i < 2; i++) {
    await page.locator('.drop-countdown .text-link').focus();
    await page.locator('.drop-countdown .text-link').press('Enter');
    await expect(page.getByLabel('Timezone', { exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
  }
});

test('Feedback uses shared controls and inline required/length validation, then replaces the form', async ({
  page,
}, info) => {
  await page.goto('/?r19&r19c&r7-closed#feedback');
  const dialog = page.locator('.feedback-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Send note' }).click();
  await expect(page.locator('#feedback-validation')).toHaveText('Write a note first.');
  const errorColors = await dialog.evaluate((el) => ({
    text: getComputedStyle(el.querySelector('#feedback-validation')!).color,
    background: getComputedStyle(el).backgroundColor,
  }));
  expect(
    contrast(errorColors.text, errorColors.background),
    'feedback error AA contrast',
  ).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('#feedback-note')).toBeFocused();
  await expect(page.locator('#feedback-note')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#feedback-limit')).toHaveText('0 / 500');
  await audit(page, '.feedback-dialog');
  await shot(page, info, 'feedback-required');
  await page.locator('#feedback-note').fill('x'.repeat(523));
  await dialog.getByRole('button', { name: 'Send note' }).click();
  await expect(page.locator('#feedback-validation')).toHaveText(
    "Keep it under 500 characters. You're at 523.",
  );
  await page.locator('#feedback-note').fill('The settings are clearer.');
  await dialog.getByRole('button', { name: 'Send note' }).click();
  await expect(dialog).toContainText('Thanks, the clerk got your note.');
  await expect(dialog.locator('form')).toHaveCount(0);
  await shot(page, info, 'feedback-sent');
});

test('Each claim gets its payoff; third gold and fifth strike wait for the player; reload opens done', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r19&r19c&r6&gold-third&persist');
  await page.locator('#answer').waitFor();
  await settle(page);
  // R19H: phones show a collapsed board disclosure, so measure the play section itself.
  const beforeWidget = (await page.locator('.claim-section').boundingBox())!.height;
  const verificationSlot = page.locator('.claim-section .turnstile');
  expect(await verificationSlot.evaluate((slot) => getComputedStyle(slot).minHeight)).toBe('80px');
  expect((await verificationSlot.boundingBox())!.height).toBeCloseTo(80, 2);
  await verificationSlot.evaluate((slot) => {
    const widget = document.createElement('div');
    widget.style.height = '65px';
    widget.setAttribute('data-test-verification', '');
    slot.append(widget);
  });
  await settle(page);
  expect((await page.locator('.claim-section').boundingBox())!.height).toBeCloseTo(beforeWidget, 2);
  await verificationSlot.locator('[data-test-verification]').evaluate((widget) => widget.remove());
  for (const [i, answer] of ['Okapi', 'Quokka', 'Wombat'].entries()) {
    await claim(page, answer);
    await expect(page.locator('.claim-payoff')).toContainText(
      `Yours. ${answer} has your name on it for good.`,
    );
    await expect(page.locator('.payoff-curve .rarity-curve')).toBeVisible();
    expect(
      await page.locator('.win-stamp').evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    await expect(page.locator('.day-certificate')).toHaveCount(0);
    await audit(page, '.claim-section', i < 2 ? '.next-claim-shortcut' : '.win-actions > .primary');
    await shot(page, info, 'claim-' + (i + 1));
    // R19H: claims 1 and 2 keep the input focused; no Next claim tap is required.
    if (i < 2) await expect(page.locator('#answer')).toBeFocused();
  }
  await expect(page.locator('.gold-result')).toBeVisible();
  await expect(page.locator('.final-claim-note')).toHaveText("That's 3 of 3. Your day is filed.");
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.file-closed-stamp[role=status]')).toHaveText('Done for today');
  await page.reload();
  await expect(page.locator('.day-certificate')).toBeVisible();
  await expect(page.getByRole('button', { name: 'See my results', exact: true })).toHaveCount(0);
  await page.goto('/?r19&r19c&r6&strike-flow');
  for (let i = 0; i < 5; i++) {
    await claim(page, 'Pangolin');
    await expect(page.locator('.strike-count')).toContainText(`Strike ${i + 1}`);
    if (i === 3) {
      const positions = await page.locator('.input-row .primary').evaluate(async (el) => {
        const rows: number[] = [];
        for (let n = 0; n < 8; n++) {
          await new Promise(requestAnimationFrame);
          rows.push(el.getBoundingClientRect().y);
        }
        return rows;
      });
      expect(
        Math.max(...positions) - Math.min(...positions),
        'submit target must stay still under a parked pointer',
      ).toBeLessThanOrEqual(0.5);
    }
  }
  await expect(page.locator('.final-strike')).toContainText("Taken. −10 points. That's 5 strikes.");
  await expect(page.locator('.day-certificate')).toHaveCount(0);
  await audit(page, '.claim-section', '.final-strike > .primary');
  await shot(page, info, 'strike-five');
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.day-certificate')).toBeVisible();
});

test('Certificates keep points and consistent curves; streak tally counts', async ({
  page,
}, info) => {
  let height: number | undefined;
  for (const [name, p, gold] of [
    ['measured', '.5', ''],
    ['missing', 'missing', ''],
    ['familiar', '0', ''],
    ['deep-cut', '.99', ''],
    ['golden', '.94', '&gold'],
  ]) {
    await page.goto(`/certificate/fixture-1?r19&r19c&p=${p}${gold}`);
    await page.locator('.certificate').waitFor();
    await expect(page.locator('.cert-bottom')).toContainText('points');
    if (p === 'missing') {
      await expect(page.locator('.cert-bottom')).toContainText(
        'rarity not measured for this answer',
      );
      await expect(page.locator('.rarity-marker')).toHaveCount(0);
      await expect(page.locator('.dibs-stamp')).toContainText('Registered');
    } else {
      expect(
        await page.locator('.rarity-curve').evaluate((el) => {
          const you = el.querySelector('.rarity-you')!.getBoundingClientRect();
          return [...el.querySelectorAll('.rarity-end')].some((n) => {
            const r = n.getBoundingClientRect();
            return (
              you.left < r.right && you.right > r.left && you.top < r.bottom && you.bottom > r.top
            );
          });
        }),
      ).toBe(false);
    }
    const h = (await page.locator('.rarity-curve').boundingBox())!.height;
    if (height !== undefined) expect(h).toBeCloseTo(height, 2);
    height = h;
    await audit(page, '.certificate-page');
    await shot(page, info, 'certificate-' + name);
    const wasLowPower = await page.evaluate(() => {
      const was = document.documentElement.classList.contains('low-power');
      document.documentElement.classList.add('low-power');
      return was;
    });
    await audit(page, '.certificate-page');
    if (!wasLowPower)
      await page.evaluate(() => document.documentElement.classList.remove('low-power'));
  }
  for (const n of [0, 1, 2, 3, 4, 5, 8]) {
    await page.goto('/?r19&r19c&r7-closed&streak=' + n);
    await page.locator('.closed-office').waitFor();
    await expect(page.locator('.streak-chip svg path')).toHaveCount(Math.min(n, 5));
    if (n) await expect(page.locator('.streak-chip strong')).toHaveText(String(n));
  }
});

test('Share and visitor landing work in browser, standalone, LinkedIn and Instagram; no spoilers', async ({
  page,
  browser,
}, info) => {
  // Four complete flows need more time on the two-core Firefox CI runners.
  if (info.project.use.browserName === 'firefox') test.setTimeout(180000);
  for (const mode of ['browser', 'standalone', 'LinkedInApp', 'Instagram']) {
    const context = await browser.newContext({
      ...info.project.use,
      userAgent:
        mode === 'LinkedInApp' || mode === 'Instagram'
          ? `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ${mode}`
          : undefined,
    } as any);
    const p = await context.newPage();
    await p.addInitScript(describeConsoleErrors);
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (e) => {
      if (e.type() === 'error') errors.push(e.text() + ' at ' + p.url());
    });
    await p.addInitScript(
      ({ scale, mode }) => {
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = 16 * scale + 'px';
        });
        if (mode === 'standalone') {
          const real = window.matchMedia.bind(window);
          window.matchMedia = (q) =>
            q === '(display-mode: standalone)'
              ? Object.defineProperty(real(q), 'matches', { value: true })
              : real(q);
          Object.defineProperty(navigator, 'standalone', { value: true });
        }
      },
      { scale: info.project.metadata.fontScale as number, mode },
    );
    await p.goto('/?r19&r19c&r6');
    await done(p);
    const cells = await p.locator('.share-buttons > *').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        let background = s.backgroundColor,
          ancestor = el.parentElement;
        while (background === 'rgba(0, 0, 0, 0)' && ancestor) {
          background = getComputedStyle(ancestor).backgroundColor;
          ancestor = ancestor.parentElement;
        }
        return {
          height: r.height,
          width: r.width,
          y: r.y,
          font: s.fontSize,
          family: s.fontFamily,
          weight: s.fontWeight,
          border: s.borderTop,
          radius: s.borderRadius,
          color: s.color,
          background,
        };
      }),
    );
    for (const c of cells) {
      expect(c.height).toBeCloseTo(cells[0].height, 0);
      expect(c.font).toBe(cells[0].font);
      expect(c.family).toBe(cells[0].family);
      expect(c.weight).toBe(cells[0].weight);
      expect(c.border).toBe(cells[0].border);
      expect(c.radius).toBe(cells[0].radius);
      expect(contrast(c.color, c.background), 'share text AA contrast').toBeGreaterThanOrEqual(4.5);
      for (const other of cells.filter((o) => Math.abs(o.y - c.y) < 1))
        expect(c.width).toBeCloseTo(other.width, 0);
    }
    const splitLabels = await p.locator('.share-buttons').evaluate((root) => {
      if (innerWidth < 280) return []; // Extreme zoom can require word wrapping.
      const split: string[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (const match of (node.textContent || '').matchAll(/LinkedIn|Download/g)) {
          const range = document.createRange();
          range.setStart(node, match.index!);
          range.setEnd(node, match.index! + match[0].length);
          if ([...range.getClientRects()].filter((r) => r.width > 0).length > 1)
            split.push(match[0]);
        }
      }
      return split;
    });
    expect(splitLabels, 'share labels fit without splitting a word at normal phone widths').toEqual(
      [],
    );
    await audit(p, '.day-summary', '.share-buttons > .primary');
    await shot(p, info, 'share-' + mode);
    for (const route of ['/summary/fixture-summary', '/c/fixture-1']) {
      await p.goto(route + '?r19&r19c&visitor');
      await expect(p.locator('.shared-invitation h1')).toContainText('What can you claim?');
      await expect(p.locator('.shared-invitation')).toContainText('180 points');
      await expect(p.locator('main')).not.toContainText(/Okapi|Pangolin|Wombat|Quokka/);
      await audit(p, 'main', '.invitation-action > .primary');
      await shot(
        p,
        info,
        'landing-' + (route.startsWith('/c/') ? 'certificate' : 'summary') + '-' + mode,
      );
      await p.locator('.invitation-action > .primary').click();
      await expect(p.locator('#answer')).toBeFocused();
    }
    await p.goto('/summary/fixture-summary?r19&r19c&visitor&revealed&strikeout');
    await expect(p.locator('.shared-invitation')).toContainText('struck out');
    await expect(p.locator('.summary-answers')).toContainText('Okapi');
    await expect(p.getByRole('link', { name: 'Play now', exact: true })).toBeVisible();
    await audit(p, 'main', '.invitation-action > .primary');
    await shot(p, info, 'landing-closed-' + mode);
    if (mode === 'browser') {
      await p.goto('/?r19&r19c&r6&persist');
      await done(p);
      await p.goto('/summary/fixture-summary?r19&r19c&visitor&persist');
      await p.locator('.invitation-action > .primary').click();
      await expect(p.locator('.day-certificate')).toBeVisible();
      await expect(p.locator('#answer')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
    await context.close();
  }
});

test('Admin archive confirms, downloads both formats, deletes only the exported ids and keeps text inert', async ({
  page,
}, info) => {
  const note = {
    id: 'note-one',
    topic: 'game',
    text: '<img src=x onerror=alert(1)> Player note',
    created_at: '2026-11-23T10:00:00Z',
    player_hash: 'a'.repeat(64),
  };
  const arrived = { ...note, id: 'note-later', text: 'Arrived during export' };
  let removed: string[] = [];
  await page.route('**/api/admin/live', (route) =>
    route.fulfill({
      json: {
        active: 0,
        claimsPerMinute: 0,
        strikesPerMinute: 0,
        filesCompleted: 0,
        errors: 0,
        turnstileFailureRate: 0,
        limits: {},
        usage: {},
        feedback: [note, arrived],
      },
    }),
  );
  await page.route('**/api/admin/feedback-archive', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-admin');
    if (route.request().method() === 'GET') await route.fulfill({ json: { notes: [note] } });
    else {
      removed = route.request().postDataJSON().ids;
      await route.fulfill({ json: { removed: 1 } });
    }
  });
  await page.goto('/admin/live?r19&r19c');
  await page.locator('#live-token').fill('test-admin');
  await page.getByRole('button', { name: 'Open Live', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archive all', exact: true })).toBeVisible();
  await expect(page.locator('.admin-live article img')).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Archive all', exact: true });
  page.once('dialog', (d) => d.dismiss());
  await button.click();
  expect(removed).toEqual([]);
  const names: string[] = [];
  page.on('download', (d) => names.push(d.suggestedFilename()));
  page.once('dialog', (d) => d.accept());
  await button.click();
  await expect(page.getByRole('status').filter({ hasText: 'Archived 1 notes' })).toBeVisible();
  await expect.poll(() => names.length).toBe(2);
  expect(names.some((n) => n.endsWith('.json'))).toBe(true);
  expect(names.some((n) => n.endsWith('.csv'))).toBe(true);
  expect(removed).toEqual(['note-one']);
  await expect(page.locator('.admin-live article')).toHaveCount(1);
  await expect(page.locator('.admin-live article')).toContainText('Arrived during export');
  await audit(page, '.admin-live');
  await shot(page, info, 'admin-feedback');
});

// ---------------------------------------------------------------------------------------------
// R19H: make all three claims obvious.
// ---------------------------------------------------------------------------------------------
const phoneWidth = (page: Page) => page.viewportSize()!.width < 768;
async function slots(page: Page) {
  return page
    .locator('.claim-slots li')
    .evaluateAll((items) =>
      items.map((li) =>
        li.classList.contains('filled') ? li.querySelector('.slot-stamp')!.textContent : null,
      ),
    );
}
async function strikesLabel(page: Page) {
  return page.locator('.claim-slots-progress .strike-row').getAttribute('aria-label');
}
async function expectNextBlockVisible(page: Page) {
  await settle(page);
  const box = await page.locator('.next-claim').evaluate((block) => {
    const r = block.getBoundingClientRect();
    const viewport = window.visualViewport!;
    const nav = document.querySelector<HTMLElement>('.masthead nav');
    let bottom = viewport.offsetTop + viewport.height;
    if (nav && getComputedStyle(nav).position === 'fixed') {
      const n = nav.getBoundingClientRect();
      if (n.height && n.top > innerHeight / 2) bottom = Math.min(bottom, n.top);
    }
    const tables = [...document.querySelectorAll('table.leaderboard')].filter((t) => {
      const b = t.getBoundingClientRect();
      return b.height > 0 && b.top < innerHeight;
    }).length;
    return { top: r.top, bottom: r.bottom, viewportBottom: bottom, tables };
  });
  expect(box.top, 'next-claim block starts in view').toBeGreaterThanOrEqual(-1);
  expect(box.bottom, 'whole next-claim block in view').toBeLessThanOrEqual(box.viewportBottom + 1);
  if (phoneWidth(page)) expect(box.tables, 'no leaderboard table above the fold').toBe(0);
}

test('R19H: slots fill from the server file, strikes stay separate and the next claim needs no tap', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?r19&r19c&r6');
  await page.locator('#answer').waitFor();
  await expect(page.locator('.slots-heading')).toHaveText('Your 3 claims tonight');
  await expect.poll(() => slots(page)).toEqual([null, null, null]);
  await expect.poll(() => strikesLabel(page)).toBe('0 of 5 strikes');
  await expect(page.locator('.claim-slots')).toHaveAccessibleName('Your 3 claims tonight');
  await expect(page.locator('.next-claim-heading')).toHaveCount(0);
  await audit(page, '.claim-section');
  await shot(page, info, 'r19h-claim-0');
  // Strike first: strikes never fill claim slots.
  await claim(page, 'Pangolin');
  await expect(page.locator('.strike-count')).toContainText('Strike 1 of 5');
  await expect.poll(() => slots(page)).toEqual([null, null, null]);
  await expect.poll(() => strikesLabel(page)).toBe('1 of 5 strikes');
  await claim(page, 'Okapi');
  await expect(page.locator('.compact-payoff .win-stamp')).toContainText('OKAPI');
  await expect.poll(() => slots(page)).toEqual(['Okapi', null, null]);
  await expect(page.locator('.next-claim-heading')).toHaveText('Claim 2 of 3 next');
  const shortcut = page.locator('.next-claim-shortcut');
  await expect(shortcut).toHaveText('Claim #2 →');
  await expect(shortcut).toHaveAttribute('type', 'button');
  expect((await shortcut.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  if (phoneWidth(page)) {
    const [s, form] = await Promise.all([
      shortcut.boundingBox(),
      page.locator('.next-claim form').boundingBox(),
    ]);
    expect(s!.width).toBeGreaterThanOrEqual(form!.width - 1);
  }
  await expect(page.locator('#answer')).toBeFocused();
  await expect(page.locator('.next-claim .result-panel')).toHaveCount(0);
  // Nothing separates the payoff from the slots and the next-claim block.
  expect(
    await page
      .locator('.claim-paper > *')
      .evaluateAll((els) => els.slice(0, 3).map((e) => e.className)),
  ).toEqual([
    expect.stringContaining('compact-payoff'),
    expect.stringContaining('claim-slots-progress'),
    'next-claim',
  ]);
  await expectNextBlockVisible(page);
  await audit(page, '.claim-section', '.next-claim-shortcut');
  await shot(page, info, 'r19h-claim-1');
  // The shortcut only focuses: typed text survives and nothing submits.
  await page.locator('#answer').fill('Quo');
  await page.locator('#answer').blur();
  await shortcut.click();
  await expect(page.locator('#answer')).toBeFocused();
  await expect(page.locator('#answer')).toHaveValue('Quo');
  await expect.poll(() => slots(page)).toEqual(['Okapi', null, null]);
  // Reserved strike, then a typo with a suggestion: neither fills a slot.
  await claim(page, 'Dog');
  await expect(page.locator('.strike-count')).toContainText('Strike 2 of 5');
  await expect(page.locator('.compact-payoff')).toHaveCount(0);
  await claim(page, 'Axolot');
  await expect(page.getByRole('button', { name: 'Did you mean AXOLOTL?' })).toBeVisible();
  await expect.poll(() => strikesLabel(page)).toBe('2 of 5 strikes');
  await expect.poll(() => slots(page)).toEqual(['Okapi', null, null]);
  await claim(page, 'Quokka');
  await expect.poll(() => slots(page)).toEqual(['Okapi', 'Quokka', null]);
  await expect(page.locator('.next-claim-heading')).toHaveText('Last claim: make it count');
  await expect(shortcut).toHaveText('Last claim →');
  await expect(page.locator('#answer')).toBeFocused();
  await expectNextBlockVisible(page);
  await audit(page, '.claim-section', '.next-claim-shortcut');
  await shot(page, info, 'r19h-claim-2');
  await claim(page, 'Wombat');
  // Final: the R19C third-claim moment, focus on See my results, no form or fourth claim.
  await expect(page.locator('.final-claim-note')).toHaveText("That's 3 of 3. Your day is filed.");
  await expect(page.getByRole('button', { name: 'See my results', exact: true })).toBeFocused();
  await expect(page.locator('#answer')).toHaveCount(0);
  await expect(page.locator('.next-claim, .claim-nudge')).toHaveCount(0);
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.day-certificate')).toBeVisible();
  await expect(page.locator('.day-certificate .file-progress')).toContainText('Claims 3 of 3');
});

for (const wins of [0, 1, 2])
  test(`R19H: fifth strike after ${wins} claims ends play without filling slots`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?r19&r19c&r6&persist');
    await page.locator('#answer').waitFor();
    for (const answer of ['Okapi', 'Quokka'].slice(0, wins)) {
      await claim(page, answer);
      await expect(page.locator('.compact-payoff')).toBeVisible();
    }
    for (let i = 1; i <= 5; i++) {
      await claim(page, 'Pangolin');
      if (i < 5) {
        await expect(page.locator('.strike-count')).toContainText(`Strike ${i} of 5`);
        await expect.poll(async () => (await slots(page)).filter(Boolean)).toHaveLength(wins);
        await expect.poll(() => strikesLabel(page)).toBe(`${i} of 5 strikes`);
      }
    }
    await expect(page.locator('.final-strike')).toContainText("That's 5 strikes.");
    await expect(page.getByRole('button', { name: 'See my results', exact: true })).toBeFocused();
    await expect(page.locator('#answer, .claim-nudge, .next-claim-heading')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.day-certificate')).toBeVisible();
    await expect(page.locator('.next-claim-heading')).toHaveCount(0);
  });

test('R19H: same-night return says how many claims are left and focuses the input', async ({
  page,
}) => {
  await page.goto('/?r19&r19c&r6&persist');
  await page.locator('#answer').waitFor();
  await expect(page.locator('.next-claim-heading')).toHaveCount(0);
  await claim(page, 'Pangolin');
  await expect(page.locator('.strike-count')).toBeVisible();
  await page.reload();
  await expect(page.locator('.next-claim-heading')).toHaveText('You have 3 claims left tonight');
  await expect(page.locator('#answer')).toBeFocused();
  await claim(page, 'Okapi');
  await expect(page.locator('.next-claim-heading')).toHaveText('Claim 2 of 3 next');
  await page.reload();
  await expect(page.locator('.next-claim-heading')).toHaveText('You have 2 claims left tonight');
  await expect.poll(() => slots(page)).toEqual(['Okapi', null, null]);
  await expect(page.locator('.next-claim-shortcut')).toHaveCount(0);
  // Back navigation returns to the same prompt; navigation keeps its own focus.
  await page.goto('/leaderboard?r19&r19c&r6&persist');
  await page.locator('.leaderboard-section').first().waitFor();
  const play = page.locator('.masthead nav a[href="/"]');
  await play.focus();
  await play.press('Enter');
  await expect(page.locator('.next-claim-heading')).toHaveText('You have 2 claims left tonight');
  await expect(page.locator('#answer')).not.toBeFocused();
  await page.goBack();
  await page.goForward();
  await expect(page.locator('.next-claim-heading')).toHaveText('You have 2 claims left tonight');
  // In-app links drop the fixture query; reload the fixture address before the next claim.
  await page.goto('/?r19&r19c&r6&persist');
  await claim(page, 'Quokka');
  await expect(page.locator('.compact-payoff')).toBeVisible();
  await page.reload();
  await expect(page.locator('.next-claim-heading')).toHaveText('You have 1 claim left tonight');
  // A closed category (server close time passed) never gets the prompt.
  await page.goto('/?r19&r19c&r6&persist&closes=2020-01-01T02:00:00.000Z');
  await page.locator('#answer').waitFor();
  await expect(page.locator('.next-claim-heading')).toHaveCount(0);
  await expect(page.locator('#answer')).not.toBeFocused();
  // A completed file never gets the prompt.
  await page.goto('/?r19&r19c&r6&persist');
  await claim(page, 'Wombat');
  await expect(page.locator('.final-claim-note')).toBeVisible();
  await page.reload();
  await expect(page.locator('.day-certificate')).toBeVisible();
  await expect(page.locator('.next-claim-heading')).toHaveCount(0);
});

test('R19H: one inline nudge after 20 visible seconds; typing, hiding and completion cancel it', async ({
  page,
}) => {
  await page.clock.install();
  // Close is the server's next drop; the nudge names its time without hard-coding "tomorrow".
  await page.goto('/?r19&r19c&r6');
  await page.locator('#answer').waitFor();
  await claim(page, 'Okapi');
  await expect(page.locator('.compact-payoff')).toBeVisible();
  const nudge = page.locator('.claim-nudge');
  await page.clock.runFor(19000);
  await expect(nudge).toHaveCount(0);
  await page.clock.runFor(1500);
  await expect(nudge).toHaveText(
    /^2 more claims before \d{1,2}:\d{2}\s[AP]M\s[A-Z]+\s(today|tomorrow|[A-Z][a-z]+day,\s[A-Z][a-z]{2}\s\d+)\.$/,
  );
  // Inline, not a modal, and the input keeps focus.
  await expect(page.locator('#answer')).toBeFocused();
  expect(await nudge.evaluate((el) => el.closest('dialog, [role=dialog]'))).toBeNull();
  // Typing cancels it; only one nudge per claim.
  await page.locator('#answer').pressSequentially('Q');
  await expect(nudge).toHaveCount(0);
  await page.clock.runFor(30000);
  await expect(nudge).toHaveCount(0);
  await page.locator('#answer').fill('');
  // Next claim: hiding the page resets the visible-time count.
  await claim(page, 'Quokka');
  await expect(page.locator('.next-claim-heading')).toHaveText('Last claim: make it count');
  await page.clock.runFor(15000);
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (value ? 'hidden' : 'visible'),
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await page.clock.runFor(30000);
  await expect(nudge).toHaveCount(0);
  await setHidden(false);
  await page.clock.runFor(19000);
  await expect(nudge).toHaveCount(0);
  await page.clock.runFor(1500);
  await expect(nudge).toHaveText(/^1 more claim before /);
  // Completion removes it and never schedules another.
  await claim(page, 'Wombat');
  await expect(page.locator('.final-claim-note')).toBeVisible();
  await page.clock.runFor(30000);
  await expect(nudge).toHaveCount(0);
});

test('R19H: phones get one collapsed leaderboard disclosure with the real rank', async ({
  page,
}) => {
  await page.goto('/?r19&r19c&r6');
  await page.locator('#answer').waitFor();
  const disclosure = page.locator('.board-disclosure');
  if (!phoneWidth(page)) {
    await expect(disclosure).toHaveCount(0);
    await expect(page.locator('#leaderboard table.leaderboard')).toBeVisible();
    return;
  }
  await expect(disclosure).toHaveCount(1);
  await expect(page.locator('table.leaderboard')).toHaveCount(0);
  await expect(disclosure.locator('summary')).toHaveText('Leaderboard · live standings');
  await claim(page, 'Okapi');
  await expect(disclosure.locator('summary')).toHaveText("Leaderboard · you're #4 so far");
  await expect(page.locator('table.leaderboard, .payoff-board')).toHaveCount(0);
  // The disclosure sits below the next-claim block.
  const [block, summary] = await Promise.all([
    page.locator('.next-claim').boundingBox(),
    disclosure.locator('summary').boundingBox(),
  ]);
  expect(summary!.y).toBeGreaterThanOrEqual(block!.y + block!.height - 1);
  // Keyboard operation.
  await disclosure.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(disclosure.locator('table.leaderboard')).toBeVisible();
  const table = (await disclosure.locator('table.leaderboard').boundingBox())!;
  const form = (await page.locator('.next-claim form').boundingBox())!;
  expect(table.y).toBeGreaterThan(form.y + form.height - 1);
  await audit(page, '.claim-section');
  await page.keyboard.press('Enter');
  await expect(disclosure).not.toHaveAttribute('open', '');
  // Final payoff keeps standings collapsed; the done screen shows full standings.
  await claim(page, 'Quokka');
  await claim(page, 'Wombat');
  await expect(page.locator('table.leaderboard')).toHaveCount(0);
  await page.getByRole('button', { name: 'See my results', exact: true }).click();
  await expect(page.locator('.board-disclosure')).toHaveCount(0);
  await expect(page.locator('#leaderboard table.leaderboard')).toBeVisible();
});

test('R19H: lost acknowledgement retry, live updates and another tab finishing stay consistent', async ({
  page,
}) => {
  await page.goto('/?r19&r19c&r6&lost-ack');
  await page.locator('#answer').waitFor();
  await claim(page, 'Okapi');
  await expect(page.locator('.next-claim .result-panel')).toContainText('Try again');
  await expect(page.locator('#answer')).toHaveValue('Okapi');
  // Retrying the same answer reuses the request ID and gets the original claim once.
  await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
  await expect(page.locator('.compact-payoff .win-stamp')).toContainText('OKAPI');
  await expect.poll(() => slots(page)).toEqual(['Okapi', null, null]);
  // Live updates do not re-render or re-announce the result.
  const mutations = await page.locator('.compact-payoff').evaluate(async (el) => {
    let count = 0;
    const observer = new MutationObserver((records) => (count += records.length));
    observer.observe(el, { subtree: true, childList: true, characterData: true });
    window.dispatchEvent(new Event('r19h-live-update'));
    await new Promise((r) => setTimeout(r, 400));
    window.dispatchEvent(new Event('r19h-live-update'));
    await new Promise((r) => setTimeout(r, 400));
    observer.disconnect();
    return count;
  });
  expect(mutations).toBe(0);
  // Another tab completes the file: this tab moves to the done screen without a fourth claim.
  await page.evaluate(() => window.dispatchEvent(new Event('r19h-remote-complete')));
  await expect(page.locator('.day-certificate')).toBeVisible();
  await expect(page.locator('#answer, .claim-nudge, .next-claim')).toHaveCount(0);
});

test('R19H: with the keyboard open after a nonfinal claim, input and CALL DIBS stay reachable', async ({
  page,
}) => {
  test.skip(!phoneWidth(page), 'Software keyboards apply to phone widths');
  await page.goto('/?r19&r19c&r6');
  await page.locator('#answer').waitFor();
  await claim(page, 'Okapi');
  await expect(page.locator('.compact-payoff')).toBeVisible();
  await expect(page.locator('#answer')).toBeFocused();
  // Emulate a software keyboard taking ~45% of the screen (DOM focus alone proves no keyboard).
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width, height: Math.round(height * 0.55) });
  await settle(page);
  await page.waitForTimeout(150);
  const fit = await page.evaluate(() => {
    const v = window.visualViewport!;
    const bottom = v.offsetTop + v.height;
    const input = document.querySelector('#answer')!.getBoundingClientRect();
    const button = [
      ...document.querySelectorAll('.next-claim form .primary'),
    ][0]!.getBoundingClientRect();
    return {
      input: input.top >= 0 && input.bottom <= bottom + 1,
      button: button.top >= 0 && button.bottom <= bottom + 1,
    };
  });
  expect(fit).toEqual({ input: true, button: true });
  await page.locator('#answer').fill('Quokka');
  await page.locator('#answer').press('Enter');
  await expect(page.locator('.next-claim-heading')).toHaveText('Last claim: make it count');
  await expect(page.locator('#answer')).toBeFocused();
});
