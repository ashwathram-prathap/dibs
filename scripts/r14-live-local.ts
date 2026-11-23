import './test-traffic';
import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const origin = 'http://127.0.0.1:5178';
const checks: any[] = [];
try {
  const reset = await fetch(origin + '/api/admin/practice-reset', {
    method: 'POST',
    headers: {
      origin,
      authorization: 'Bearer r14-local-admin',
      'content-type': 'application/json',
    },
    body: '{}',
  });
  expect(reset.status).toBe(200);
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Toronto',
    reducedMotion: 'reduce',
  });
  await p.addInitScript(() => {
    (window as any).turnstile = {
      render: (_box: any, options: any) => {
        setTimeout(() => options.callback('test'), 0);
        return 'test';
      },
      remove: () => {},
    };
  });
  await p.goto(origin);
  await p.locator('#answer').waitFor();
  await p.evaluate(() => document.fonts.ready);
  await expect(p.locator('#leaderboard')).toContainText('No scores yet. Be first.');
  await p.screenshot({ path: 'review/round14/practice-local-empty.png', fullPage: true });
  for (const [i, answer] of ['Okapi', 'Quokka', 'Wombat'].entries()) {
    await p.locator('#answer').fill(answer);
    const pending = p.waitForResponse((r) => r.url().endsWith('/api/claim'));
    await p.locator('#answer').press('Enter');
    const r = await pending;
    const data = await r.json();
    expect(r.status(), JSON.stringify(data)).toBe(201);
    expect(data.claim.points).toBeGreaterThanOrEqual(10);
    checks.push({
      answer,
      claimPoints: data.claim.points,
      total: data.file.points,
      rank: data.file.rank,
    });
    if (i === 0) {
      await p.locator('.claim-payoff').waitFor();
      const box = (await p.locator('.claim-payoff').boundingBox())!;
      checks.push({ payoffBottom: box.y + box.height, visible: box.y + box.height <= 844 });
      expect(box.y + box.height).toBeLessThanOrEqual(844);
      await p.screenshot({ path: 'review/round14/practice-local-payoff.png', fullPage: true });
    }
    if (i < 2) await p.getByRole('button', { name: 'Next claim', exact: true }).click();
  }
  await p.locator('.day-certificate').waitFor();
  await p.screenshot({ path: 'review/round14/practice-local-done.png', fullPage: true });
  await p.reload();
  await p.locator('.day-certificate').waitFor();
  await expect(p.locator('.leaderboard')).toContainText(
    String(checks.filter((c) => c.total !== undefined).at(-1).total),
  );
  await p.screenshot({ path: 'review/round14/practice-local-populated.png', fullPage: true });
  await p.getByText('More ways to share', { exact: true }).click();
  const download = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Feed PNG', exact: true }).click();
  await (await download).saveAs('review/round14/practice-local-share-card.png');
  const stranger = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await stranger.addInitScript(() => {
    (window as any).turnstile = {
      render: (_box: any, options: any) => {
        setTimeout(() => options.callback('test'), 0);
        return 'test';
      },
      remove: () => {},
    };
  });
  await stranger.goto(origin);
  await stranger.locator('#answer').fill('Okapi');
  await stranger.locator('#answer').press('Enter');
  await expect(stranger.locator('.result-panel')).toContainText(
    'Taken. −10 points. 4 strikes left.',
  );
  await stranger.screenshot({ path: 'review/round14/practice-local-strike.png', fullPage: true });
  checks.push({ passed: true });
} finally {
  await b.close();
  writeFileSync('review/round14/local-live-flow.json', JSON.stringify(checks, null, 2));
}
