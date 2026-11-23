import './test-traffic';
import { chromium, webkit, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
const checks: any[] = [];
const result: any = { origin, checks, passed: false };
assert.equal(origin, 'https://practice.dibs-7hz.pages.dev');
assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
const browsers = await Promise.all([chromium.launch(), webkit.launch()]);
async function capture(p: Page, name: string) {
  for (const theme of ['light', 'dark']) {
    if ((await p.locator('html').getAttribute('data-theme')) !== theme)
      await p.locator('.theme-toggle').click();
    await p.screenshot({ path: `review/round14/${name}-${theme}.png`, fullPage: true });
  }
}
async function claim(p: Page, answer: string, status: number) {
  await p.locator('#answer').fill(answer);
  const waiting = p.waitForResponse((r) => r.url().endsWith('/api/claim'));
  await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
  const r = await waiting;
  const data = await r.json();
  assert.equal(r.status(), status, JSON.stringify(data));
  await p.waitForTimeout(250);
  checks.push({
    answer,
    status,
    points: data.file.points,
    claimPoints: data.claim?.points,
    percentile: data.claim?.percentile,
    rank: data.file.rank,
    players: data.file.players,
  });
  return data;
}
try {
  const p = await browsers[0].newPage({
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Toronto',
    reducedMotion: 'reduce',
  });
  await p.goto(origin);
  await p.locator('#answer').waitFor();
  await p.evaluate(() => document.fonts.ready);
  await expect(p.locator('#leaderboard')).toContainText('No scores yet. Be first.');
  await capture(p, 'leaderboard-empty-390');
  const first = await claim(p, 'Okapi', 201);
  await expect(p.locator('.claim-payoff')).toContainText(`+${first.claim.points} points`);
  await expect(p.locator('.header-player')).toContainText('Streak 1');
  const payoff = (await p.locator('.claim-payoff').boundingBox())!;
  assert.ok(payoff.y + payoff.height <= 844, `Payoff ends at ${payoff.y + payoff.height}`);
  await capture(p, 'payoff-390');
  const other = await browsers[1].newPage({
    viewport: { width: 1440, height: 900 },
    timezoneId: 'America/Toronto',
    reducedMotion: 'reduce',
  });
  await other.goto(origin);
  await other.locator('#answer').waitFor();
  await claim(other, 'Pangolin', 201);
  await other.getByRole('button', { name: 'Next claim', exact: true }).click();
  await claim(other, 'Okapi', 409);
  await expect(other.locator('.result-panel')).toContainText('Taken. −10 points. 4 strikes left.');
  await capture(other, 'strike-1440');
  let done: any;
  for (const answer of ['Quokka', 'Wombat']) {
    await p.getByRole('button', { name: 'Next claim', exact: true }).click();
    done = await claim(p, answer, 201);
  }
  await p.locator('.day-certificate').waitFor();
  await expect(p.locator('.done-score')).toContainText(`${done.file.points} points`);
  await capture(p, 'done-390');
  await p.locator('.day-certificate').screenshot({ path: 'review/round14/certificate-390.png' });
  await p.getByText('More ways to share', { exact: true }).click();
  const download = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Feed PNG', exact: true }).click();
  await (await download).saveAs('review/round14/share-card.png');
  for (const answer of ['Narwhal', 'Capybara']) {
    if (await other.getByRole('button', { name: 'Next claim', exact: true }).count())
      await other.getByRole('button', { name: 'Next claim', exact: true }).click();
    await claim(other, answer, 201);
  }
  await other.locator('.day-certificate').waitFor();
  await capture(other, 'done-1440');
  await p.reload();
  await p.locator('.leaderboard').waitFor();
  await capture(p, 'leaderboard-populated-390');
  await capture(other, 'leaderboard-populated-1440');
  const shared = await api('/summary/' + done.file.summaryId);
  assert.ok(shared.response.ok);
  assert.equal(shared.data.concealed, true);
  assert.ok(
    shared.data.file.claims.every((c: any) => c.display === 'Revealed when the day closes'),
  );
  assert.equal(shared.data.file.points, done.file.points);
  const ledger = await p.evaluate(
    async () => await (await fetch('/api/ledger?category=practice')).json(),
  );
  assert.deepEqual(ledger.rows, []);
  assert.equal(ledger.locked, true);
  for (const page of [p, other])
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  result.payoffBottom = payoff.y + payoff.height;
  result.passed = true;
} catch (e) {
  result.error = String(e);
  process.exitCode = 1;
} finally {
  await Promise.all(browsers.map((b) => b.close()));
  writeFileSync('review/round14/practice-flow.json', JSON.stringify(result, null, 2));
  console.log(result);
}
