import { test, expect } from './security-fixture';
import { bellX } from '../../shared/rarity';
import { mkdirSync } from 'node:fs';
const scale = async (page: any, n = 1.3) => {
  await page.evaluate((n: number) => (document.documentElement.style.fontSize = 16 * n + 'px'), n);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
const claim = async (page: any, answer = 'Okapi') => {
  await page.locator('#answer').fill(answer);
  await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
};
const done = async (page: any) => {
  for (const answer of ['Okapi', 'Quokka', 'Wombat']) {
    await claim(page, answer);
    if (answer !== 'Wombat')
      await page.getByRole('button', { name: 'Next claim', exact: true }).click();
  }
  await page.locator('.day-certificate').waitFor();
};
const shot = async (page: any, folder: string, name: string, fullPage = true) => {
  mkdirSync('review/round19/' + folder, { recursive: true });
  await page.screenshot({ path: `review/round19/${folder}/${name}.png`, fullPage });
};
test('R19 three theme choices follow the system live, in standalone too, without persisting System', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query === '(display-mode: standalone)'
        ? ({
            ...real(query),
            matches: localStorage.getItem('r19-standalone') === 'true',
          } as MediaQueryList)
        : real(query);
  });
  await page.goto('/?r19&r7-closed');
  for (const standalone of [false, true])
    for (const choice of ['system', 'light', 'dark'])
      for (const system of ['light', 'dark'] as const) {
        await page.evaluate(
          ({ choice, standalone }) => {
            if (choice === 'system') localStorage.removeItem('dibs-theme');
            else localStorage.setItem('dibs-theme', choice);
            localStorage.setItem('r19-standalone', String(standalone));
          },
          { choice, standalone },
        );
        await page.emulateMedia({ colorScheme: system });
        await page.goto('/?r19&r7-closed');
        const expected = choice === 'system' ? system : choice;
        await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
          'content',
          expected === 'dark' ? '#16150f' : '#F1ECE2',
        );
        await page.emulateMedia({ colorScheme: system === 'dark' ? 'light' : 'dark' });
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          choice === 'system' ? (system === 'dark' ? 'light' : 'dark') : choice,
        );
      }
  await page.locator('.header-settings > summary').click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('system');
  expect(await page.evaluate(() => localStorage.getItem('dibs-theme'))).toBeNull();
  await page.locator('.settings-close').click();
  await page.locator('.theme-toggle').click();
  expect(await page.evaluate(() => localStorage.getItem('dibs-theme'))).toMatch(/^(light|dark)$/);
  await shot(page, 'themes', info.project.name);
});
test('R19 expanded Settings fits with real backup values and enlarged text', async ({
  page,
}, info) => {
  await page.goto('/?r19&r7-closed');
  await page.locator('.header-settings > summary').click();
  await page.locator('#file-settings > summary').click();
  await page.getByRole('button', { name: 'Delete my data', exact: true }).click();
  await page.locator('#restore-key').fill('DIBS-ABCDE-12345-FABCD-67890');
  await page.locator('#delete-key').fill('DIBS-ABCDE-12345-FABCD-67890');
  for (const size of [1.3, 2]) {
    await scale(page, size);
    expect(
      await page
        .locator('.header-controls')
        .evaluate((panel) =>
          [panel, ...panel.querySelectorAll('*')]
            .filter(
              (el) =>
                el.getBoundingClientRect().width > 0 &&
                (el.scrollWidth > el.clientWidth + 1 ||
                  el.getBoundingClientRect().right > panel.getBoundingClientRect().right + 1),
            )
            .map((el) => el.tagName + '#' + el.id),
        ),
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  await shot(page, 'settings', info.project.name, false);
});
test('R19 payoff uses an honest bell, quiet counters, named zone and one frame', async ({
  page,
}, info) => {
  for (const p of [0.05, 0.5, 0.94]) {
    await page.goto('/?r19&r6&p=' + p);
    await scale(page);
    await claim(page);
    const curve = page.locator('.payoff-curve .rarity-curve');
    await expect(curve).toBeVisible();
    const you = await curve.locator('.rarity-you').boundingBox();
    for (const label of await curve.locator('.rarity-end').all()) {
      const end = await label.boundingBox();
      expect(
        you!.x < end!.x + end!.width &&
          you!.x + you!.width > end!.x &&
          you!.y < end!.y + end!.height &&
          you!.y + you!.height > end!.y,
      ).toBe(false);
    }
    expect(Number(await curve.getAttribute('data-marker-x'))).toBeCloseTo(bellX(p), 6);
    await expect(page.locator('.claim-payoff')).not.toContainText(/rarer than 0%/i);
    await expect(page.locator('.payoff-counters')).toContainText('2 claims left');
    expect(
      await page.locator('.result-panel').evaluate((el) => getComputedStyle(el).borderTopWidth),
    ).toBe('0px');
    await expect(page.locator('.reveal-time')).toContainText('Toronto time');
    await expect(page.locator('.reveal-time')).not.toContainText('your time');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await shot(page, 'payoff', `${info.project.name}-${p}`);
  }
  await page.locator('.header-settings > summary').click();
  await page.getByRole('combobox', { name: 'Timezone', exact: true }).selectOption('Asia/Tokyo');
  await page.locator('.settings-close').click();
  await expect(page.locator('.reveal-time')).toContainText('Japan time');
  await expect(page.locator('.reveal-time')).not.toContainText('GMT');
});
test('R19 streak changes once without moving the header, milestone and reset states', async ({
  page,
}, info) => {
  await page.goto('/?r19&r6&streak=2');
  await page.locator('#answer').waitFor();
  const before = await page.locator('.streak-chip').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
  });
  await claim(page);
  await expect(page.locator('.streak-chip strong')).toHaveText('3');
  await expect(page.locator('.streak-chip')).toHaveClass(/streak-milestone/);
  await expect(page.locator('.streak-payoff')).toContainText('Streak 3.');
  const after = await page.locator('.streak-chip').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
  });
  expect(after).toEqual(before);
  await page.getByRole('button', { name: 'Next claim', exact: true }).click();
  await claim(page, 'Quokka');
  await expect(page.locator('.streak-chip strong')).toHaveText('3');
  await expect(page.locator('.streak-payoff')).toHaveCount(0);
  await shot(page, 'streak', info.project.name);
  await page.goto('/?r19&r6');
  await expect(page.locator('.streak-chip strong')).toHaveText('0');
  await expect(page.locator('.streak-chip')).toHaveClass(/streak-zero/);
  await claim(page);
  await expect(page.locator('.streak-chip strong')).toHaveText('1');
});
test('R19 done keeps Share visible and the score comparison outside the certificate; socket updates propagate', async ({
  page,
}, info) => {
  await page.goto('/?r19&r6');
  await scale(page);
  await done(page);
  await expect(page.locator('.day-certificate .rarity-curve')).toHaveCount(0);
  await expect(page.locator('.day-score-curve')).toContainText(
    "Better than 63% of today's players",
  );
  await expect(page.locator('.day-score-curve')).toContainText('41 finished so far');
  await page.evaluate(() => window.dispatchEvent(new Event('r19-finish')));
  await expect(page.locator('.day-score-curve')).toContainText('42 finished so far');
  await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
  if (page.viewportSize()!.width < 768) {
    for (const selector of ['.share-buttons .primary', '.copy-result']) {
      const b = await page.locator(selector).boundingBox();
      expect(b!.y).toBeGreaterThanOrEqual(0);
      expect(b!.y + b!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
    const actions = await page.locator('.share-buttons').boundingBox(),
      nav = await page.locator('.masthead nav').boundingBox();
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(nav!.y + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await shot(page, 'done', info.project.name, false);
  await page.goto('/?r19&r6&finished=7');
  await done(page);
  await expect(page.locator('.day-score-curve')).toContainText('Your rank: #3 of 7 so far.');
  await expect(page.locator('.day-score-curve .rarity-curve')).toHaveCount(0);
});
test('R19 feedback HTML stays inert plain text in the admin view', async ({ page }) => {
  const payload =
    '<script>window.pwned=true</script><img src=x onerror=alert(1)> https://example.com';
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
        feedback: [{ id: 'test', text: payload, created_at: new Date().toISOString() }],
      },
    }),
  );
  await page.goto('/admin/live?r19&r6');
  await page.locator('#live-token').fill('test');
  await page.getByRole('button', { name: 'Open Live', exact: true }).click();
  await expect(page.locator('.admin-live article p')).toHaveText(payload);
  await expect(page.getByText('Player-submitted, untrusted')).toBeVisible();
  await expect(
    page.locator('.admin-live article script,.admin-live article img,.admin-live article a'),
  ).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
});

test('R19 prepaint theme, higher contrast, forced colours and reduced motion remain usable', async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/assets/index-*.js', (r) => r.abort());
  await page.goto('/?r19&r6');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16150f');
  await page.unroute('**/assets/index-*.js');
  await page.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('#answer').waitFor();
  expect(await page.locator('#answer').evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe(
    '2px',
  );
  await claim(page);
  expect(
    await page
      .locator('.rarity-line')
      .evaluate((e) => parseFloat(getComputedStyle(e).animationDuration)),
  ).toBeLessThanOrEqual(0.001);
  await page.emulateMedia({ forcedColors: 'active' });
  if (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) {
    expect(
      await page.locator('.win-stamp').evaluate((e) => getComputedStyle(e).borderTopStyle),
    ).toBe('solid');
    await expect(page.getByRole('button', { name: 'Next claim', exact: true })).toBeVisible();
  }
  await shot(page, 'preferences', info.project.name, false);
});
