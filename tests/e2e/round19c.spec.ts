import { test, expect } from './security-fixture';
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function shot(page: Page, info: TestInfo, screen: string) {
  await settle(page);
  const directory = `review/round19c/matrix/raw/${screen}`;
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
    const labels: { element: Element; text: string; rect: DOMRect }[] = [];
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
        labels.push({ element: el, text: node.textContent.trim().slice(0, 40), rect: r });
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
        if (
          Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 &&
          Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1
        )
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
      .getByRole('button', {
        name: answer === 'Wombat' ? 'See my results' : 'Next claim',
        exact: true,
      })
      .click();
  }
  await page.locator('.day-certificate').waitFor();
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
}
test.beforeEach(async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  (page as any).__errors = errors;
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
    expect(swatch!.width).toBe(14);
    expect(swatch!.height).toBe(10);
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
});

test('Feedback uses shared controls and inline required/length validation, then replaces the form', async ({
  page,
}, info) => {
  await page.goto('/?r19&r19c&r7-closed#feedback');
  const dialog = page.locator('.feedback-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Send note' }).click();
  await expect(page.locator('#feedback-validation')).toHaveText('Write a note first.');
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
    await audit(page, '.claim-section', '.win-actions > .primary');
    await shot(page, info, 'claim-' + (i + 1));
    if (i < 2) await page.getByRole('button', { name: 'Next claim', exact: true }).click();
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
    if (height !== undefined) expect(h).toBe(height);
    height = h;
    await audit(page, '.certificate-page');
    await shot(page, info, 'certificate-' + name);
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
  for (const mode of ['browser', 'standalone', 'LinkedInApp', 'Instagram']) {
    const context = await browser.newContext({
      ...info.project.use,
      userAgent:
        mode === 'LinkedInApp' || mode === 'Instagram'
          ? `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ${mode}`
          : undefined,
    } as any);
    const p = await context.newPage();
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (e) => {
      if (e.type() === 'error') errors.push(e.text());
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
        return {
          height: r.height,
          width: r.width,
          y: r.y,
          font: s.fontSize,
          weight: s.fontWeight,
          border: s.borderTopWidth,
        };
      }),
    );
    for (const c of cells) {
      expect(c.height).toBeCloseTo(cells[0].height, 0);
      expect(c.font).toBe(cells[0].font);
      expect(c.weight).toBe(cells[0].weight);
      expect(c.border).toBe(cells[0].border);
      for (const other of cells.filter((o) => Math.abs(o.y - c.y) < 1))
        expect(c.width).toBeCloseTo(other.width, 0);
    }
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
