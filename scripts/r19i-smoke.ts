// R19I read-only smoke (R19H checks plus the repeat-guess copy) of the deployed site in today's actual live state.
// Never submits a claim, never starts verification and never sends a non-GET API request:
// Turnstile and every mutating /api request are blocked at the network layer and recorded.
import './test-traffic';
import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.ok(['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin));
const stage = origin.includes('practice') ? 'practice' : 'production';
const results: any[] = [];
const challengeDiagnostics: any[] = [];
let liveState: any = null;
for (const [engine, label] of [
  [chromium, 'chromium'],
  [webkit, 'webkit'],
] as const) {
  const browser = await engine.launch();
  try {
    for (const [width, height] of [
      [360, 780],
      [390, 844],
      [1440, 900],
    ])
      for (const colorScheme of ['light', 'dark'] as const)
        for (const path of ['/', '/how-it-works', '/about']) {
          const context = await browser.newContext({
            viewport: { width, height },
            colorScheme,
            reducedMotion: 'reduce',
            timezoneId: 'America/Toronto',
          });
          const page = await context.newPage();
          const errors: string[] = [];
          const blocked: string[] = [];
          // Strictly read-only: no verification widget, no session, no claim.
          await page.route('https://challenges.cloudflare.com/**', (route) => {
            blocked.push('turnstile ' + route.request().url().split('?')[0]);
            return route.abort();
          });
          await page.route(origin + '/api/**', (route) => {
            const method = route.request().method();
            if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return route.continue();
            blocked.push(method + ' ' + route.request().url());
            return route.abort();
          });
          page.on('pageerror', (e) => errors.push(e.message));
          page.on('console', (m) => {
            if (m.type() !== 'error') return;
            const source = m.location().url;
            const text = m.text();
            if (
              source.includes('challenges.cloudflare.com') ||
              /challenges\.cloudflare\.com|%c%[do]|Fetch API cannot load data:,|net::ERR_FAILED/.test(
                text,
              )
            )
              challengeDiagnostics.push({ source, text });
            else errors.push(text);
          });
          const bootstrap = page.waitForResponse(
            (r) => r.url() === origin + '/api/bootstrap' && r.status() === 200,
          );
          await page.goto(origin + path);
          const boot = await (await bootstrap).json();
          await expect(page.locator('.loading')).toBeHidden();
          await page.evaluate(() => document.fonts.ready);
          const open = !!boot.today?.category;
          if (path === '/') {
            liveState ||= {
              category: boot.today?.category?.name || null,
              categoryId: boot.today?.category?.id || null,
              closesAt: boot.today?.closesAt || null,
              nextDrop: boot.today?.nextDrop,
              checkedAt: new Date().toISOString(),
            };
            if (open) {
              // Fresh visitor on today's open category: three empty slots, separate strikes.
              await expect(page.locator('.slots-heading')).toHaveText('Your 3 claims tonight');
              await expect(page.locator('.claim-slots li.open')).toHaveCount(3);
              await expect(page.locator('.claim-slots-progress .strike-row')).toHaveAttribute(
                'aria-label',
                '0 of 5 strikes',
              );
              await expect(page.locator('#answer')).toBeVisible();
              await expect(
                page.getByRole('button', { name: 'CALL DIBS', exact: true }),
              ).toBeVisible();
              await expect(page.locator('.next-claim-heading')).toHaveCount(0);
              if (width < 768) {
                await expect(page.locator('.board-disclosure summary')).toHaveText(
                  /^Leaderboard\s·\s(live\sstandings|you're\s#\d+\sso\sfar)$/,
                );
                await expect(page.locator('table.leaderboard')).toHaveCount(0);
              } else {
                await expect(page.locator('.board-disclosure')).toHaveCount(0);
                await expect(page.locator('#leaderboard')).toBeVisible();
              }
            } else {
              await expect(page.locator('.closed-office .game-explanation')).toContainText(
                '3 claims a night.',
              );
            }
          } else if (path === '/about') {
            await expect(
              page.getByRole('heading', { name: 'Can the same guess cost two strikes?' }),
            ).toBeVisible();
            await expect(page.locator('.about-layout')).toContainText(
              'No. Guessing the same taken answer twice never costs a second strike.',
            );
          } else {
            await expect(page.locator('.how-page .repeat-guess-note')).toHaveText(
              'Guessing the same taken answer twice never costs a second strike.',
            );
            await expect(page.locator('.how-page .game-intro > :first-child')).toHaveText(
              'You get 3 claims every night.',
            );
            await expect(page.locator('.how-page .game-explanation')).toContainText(
              '3 claims a night.',
            );
          }
          // R19G credit stays intact.
          await expect(
            page.locator('footer').getByRole('link', {
              name: 'Ashwathram Prathap',
              exact: true,
              includeHidden: true,
            }),
          ).toHaveAttribute('href', 'https://ashwathram.ca');
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            'Page overflow',
          );
          const dir = `review/round19i/${stage}/${label}-${width}-${colorScheme}`;
          mkdirSync(dir, { recursive: true });
          // WebKit capture injects a style the live CSP correctly blocks; Chromium captures only.
          if (engine === chromium)
            await page.screenshot({
              path: `${dir}/${path.replaceAll('/', '') || 'home'}.png`,
              fullPage: true,
            });
          assert.deepEqual(errors, [], 'Browser console must be clean: ' + errors.join(' | '));
          const mutations = blocked.filter((b) => !b.startsWith('turnstile'));
          assert.deepEqual(mutations, [], 'Smoke must be read-only');
          results.push({
            engine: label,
            width,
            colorScheme,
            path,
            state: open ? 'open' : 'closed',
            passed: true,
            consoleErrors: errors,
            blockedRequests: blocked,
          });
          await context.close();
        }
  } finally {
    await browser.close();
  }
}
writeFileSync(
  `review/round19i/${stage}-smoke.json`,
  JSON.stringify(
    {
      passed: true,
      at: new Date().toISOString(),
      liveState,
      readOnly:
        'Turnstile and every non-GET /api request were blocked; no claim, verification or session request was sent.',
      results,
      challengeDiagnostics,
    },
    null,
    2,
  ),
);
console.log({ stage, passed: true, checks: results.length, liveState });
