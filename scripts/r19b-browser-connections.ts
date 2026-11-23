import './test-traffic';
import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const results: any[] = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  const context = await b.newContext({ viewport: { width: 390, height: 844 } });
  let boots = 0;
  let done = true;
  const snapshot = () => ({
    today: {
      category: {
        id: 'local-fixture',
        name: 'Animals',
        slug: 'animals',
        date: '2026-11-23',
        drop_at: '2026-11-23T12:00:00Z',
        total_registrable: 2000,
      },
      nextDrop: '2026-11-24T02:00:00Z',
      claimed: 3,
      open: 1997,
      turnstileSiteKey: 'local-test',
      serverTime: new Date().toISOString(),
      revealed: false,
    },
    rows: [],
    me: {
      user: { id: 'local-player', handle: 'Local fixture', rerolls_used: 0 },
      claim: null,
      streak: 1,
      streakDates: [],
      file: done
        ? {
            summaryId: 'local-summary',
            category_id: 'local-fixture',
            closed: true,
            dibs: 3,
            strikes: 0,
            points: 140,
            rank: boots,
            players: 30,
            events: [],
            claims: [],
            completedAt: new Date().toISOString(),
          }
        : null,
    },
    leaderboard: {
      rows: [],
      own: { rank: boots, handle: 'Local fixture', points: 140, claims: 3, own: true },
      total: 30,
    },
  });
  await context.route('**/api/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/api/bootstrap') {
      boots++;
      await new Promise((resolve) => setTimeout(resolve, 200));
      return r.fulfill({ json: snapshot() });
    }
    return r.fulfill({
      json: path === '/api/leaderboard' ? snapshot().leaderboard : { code: null },
    });
  });
  await context.addInitScript(() => {
    (window as any).__name = (value: any) => value;
    (window as any).sockets = [];
    class Socket {
      static OPEN = 1;
      readyState = 0;
      onopen: any;
      onclose: any;
      onmessage: any;
      onerror: any;
      sent: any[] = [];
      constructor() {
        (window as any).sockets.push(this);
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.();
        }, 20);
      }
      send(s: string) {
        this.sent.push(s);
      }
      close() {
        if (this.readyState === 3) return;
        this.readyState = 3;
        this.onclose?.();
      }
    }
    Object.defineProperty(window, 'WebSocket', { value: Socket });
  });
  try {
    const p = await context.newPage();
    await p.goto('http://127.0.0.1:5203/?no-analytics=1');
    await p.locator('.day-certificate').waitFor();
    const initial = boots;
    await p.evaluate(() => (window as any).sockets.at(-1).close());
    await expect.poll(() => boots).toBeGreaterThan(initial);
    const rank = await p.evaluate(
      async () => (await import('/src/live.ts' as string)).getSnapshot().me.file.rank,
    );
    expect(rank).toBeGreaterThan(1);
    await context.setOffline(true);
    const count = await p.evaluate(() => (window as any).sockets.length);
    await p.waitForTimeout(1200);
    expect(await p.evaluate(() => (window as any).sockets.length)).toBe(count);
    await context.setOffline(false);
    await expect
      .poll(() => p.evaluate(() => (window as any).sockets.length))
      .toBeGreaterThan(count);
    const second = await context.newPage();
    await second.goto('http://127.0.0.1:5203/?no-analytics=1');
    await second.locator('.day-certificate').waitFor();
    await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      (window as any).sockets.at(-1).close();
    });
    const asleep = await p.evaluate(() => (window as any).sockets.length);
    await p.waitForTimeout(1200);
    expect(await p.evaluate(() => (window as any).sockets.length)).toBe(asleep);
    await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
      .poll(() => p.evaluate(() => (window as any).sockets.length))
      .toBeGreaterThan(asleep);
    await p.close();
    await second.close();
    done = false;
    const verify = await context.newPage();
    await verify.route('https://challenges.cloudflare.com/**', () => new Promise(() => {}));
    await verify.goto('http://127.0.0.1:5203/?no-analytics=1', { waitUntil: 'domcontentloaded' });
    await verify.locator('#answer').fill('Axolotl');
    const began = Date.now();
    await verify.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    await expect(verify.getByText('Verification is slow. Retry', { exact: true })).toBeVisible({
      timeout: 13000,
    });
    await expect(verify.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    const timeoutMs = Date.now() - began;
    expect(timeoutMs).toBeLessThan(12000);
    await verify.screenshot({
      path: `review/round19b/verification-${engine.name()}.png`,
      fullPage: true,
    });
    await verify.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(verify.getByText('Verification is slow. Retry', { exact: true })).toHaveCount(0);
    results.push({
      browser: engine.name(),
      passed: true,
      slowBootstrapMs: 200,
      finishedRank: rank,
      offlineOnline: true,
      backgroundWake: true,
      multipleTabs: true,
      verificationTimeoutMs: timeoutMs,
    });
  } finally {
    await b.close();
    writeFileSync('review/round19b/browser-connections.json', JSON.stringify(results, null, 2));
  }
}
