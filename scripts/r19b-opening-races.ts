import './test-traffic';
import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const results: any[] = [];
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (let batch = 0; batch < 2; batch++)
      await Promise.all(
        Array.from({ length: 5 }, async (_, index) => {
          const i = batch * 5 + index,
            opens = Date.now() + 7000;
          const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          let calls = 0;
          const errors: string[] = [];
          const snapshot = () => {
            const open = Date.now() >= opens;
            return {
              today: {
                category: open
                  ? {
                      id: 'practice',
                      name: 'Animals',
                      slug: 'animals',
                      date: '2026-11-23',
                      drop_at: new Date(opens).toISOString(),
                      total_registrable: 2000,
                    }
                  : null,
                nextDrop: new Date(open ? opens + 86400000 : opens).toISOString(),
                claimed: 0,
                open: 2000,
                serverTime: new Date().toISOString(),
                turnstileSiteKey: 'fixture',
              },
              me: {
                user: open ? { id: 'local-' + i, handle: 'Local fixture', rerolls_used: 0 } : null,
                claim: null,
                file: null,
                streak: 0,
                streakDates: [],
              },
              leaderboard: { rows: [], own: null, total: 0 },
              rows: [],
            };
          };
          await context.route('**/api/**', async (route) => {
            const path = new URL(route.request().url()).pathname;
            const data = snapshot();
            if (path === '/api/bootstrap') {
              calls++;
              await new Promise((r) => setTimeout(r, (calls % 3) * index * 40));
              return route.fulfill({ json: data });
            }
            return route.fulfill({
              json:
                path === '/api/leaderboard'
                  ? data.leaderboard
                  : path === '/api/verify-session'
                    ? { sessionToken: 'local-fixture', expires: Date.now() + 300000 }
                    : {},
            });
          });
          await context.addInitScript(() => {
            (window as any).__name = (x: any) => x;
            class Socket {
              static OPEN = 1;
              readyState = 0;
              onopen: any;
              onclose: any;
              onmessage: any;
              onerror: any;
              constructor() {
                setTimeout(() => {
                  this.readyState = 1;
                  this.onopen?.();
                }, 25);
              }
              send() {}
              close() {
                this.readyState = 3;
                this.onclose?.();
              }
            }
            Object.defineProperty(window, 'WebSocket', { value: Socket });
            let callback: any;
            (window as any).turnstile = {
              render: (_box: any, options: any) => {
                callback = options.callback;
                return 'widget';
              },
              execute: () => queueMicrotask(() => callback('local-token')),
              remove: () => {},
              reset: () => {},
            };
          });
          const page = await context.newPage();
          page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
          });
          page.on('pageerror', (e) => errors.push(e.stack || e.message));
          try {
            await page.goto('http://127.0.0.1:5203/?no-analytics=1');
            await page.locator('.closed-office').waitFor();
            await expect(page.locator('#answer')).toBeVisible({ timeout: 15000 });
            await expect(page.locator('.route-recovery')).toHaveCount(0);
            results.push({ browser: engine.name(), case: i, calls, passed: true, errors });
          } catch (e) {
            results.push({
              browser: engine.name(),
              case: i,
              calls,
              passed: false,
              errors,
              error: String(e),
            });
            throw e;
          } finally {
            await context.close();
            writeFileSync('review/round19b/opening-races.json', JSON.stringify(results, null, 2));
          }
        }),
      );
  } finally {
    await browser.close();
  }
}
console.log({
  passed: results.every((r) => r.passed),
  cases: results.length,
  consoleErrors: results.flatMap((r) => r.errors),
});
