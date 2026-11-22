import { chromium, webkit, devices, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const results = [];
for (const [name, engine, device, suffix, answer] of [
  ['Instagram', webkit, 'iPhone 15 Pro', 'Instagram 360.0.0.0', 'Pangolin'],
  ['LinkedIn', chromium, 'Pixel 7', 'LinkedInApp/4.1.0', 'Wombat'],
  ['iMessage', webkit, 'iPhone 15 Pro', 'Mobile/15E148', 'Narwhal'],
] as const) {
  const b = await engine.launch();
  const row: any = { name, checks: [] };
  try {
    const c = await b.newContext({
      ...devices[device],
      userAgent: devices[device].userAgent + ' ' + suffix,
    });
    const p = await c.newPage();
    let verified = false,
      challengeLoaded = false;
    p.on('response', (r) => {
      if (r.url().endsWith('/api/verify-session') && r.ok()) verified = true;
    });
    p.on('request', (r) => {
      if (r.url().includes('challenges.cloudflare.com')) challengeLoaded = true;
    });
    if (process.argv.includes('--production-only')) {
      await p.goto('https://dibs.here');
      await p.locator('.closed-office').waitFor();
      await expect(p.locator('.game-explanation')).toContainText('One category a day.');
      row.checks.push('Production loads closed');
      await p.screenshot({ path: `review/round14/${name}-production.png`, fullPage: true });
      row.passed = true;
      continue;
    }
    // Production must stay closed: exercise the same deployed game on practice.
    await p.goto('https://practice.dibs-7hz.pages.dev');
    await p.locator('#answer').waitFor();
    await expect.poll(() => verified, { timeout: 30000 }).toBe(true);
    if (!challengeLoaded) throw Error('Turnstile did not load');
    row.checks.push('Cloudflare Turnstile loads and verifies on practice');
    await p.locator('#answer').fill(answer);
    const response = p.waitForResponse((r) => r.url().endsWith('/api/claim'));
    await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
    const r = await response;
    if (r.status() !== 201) throw Error('Claim ' + r.status());
    await p.locator('.win-stamp').waitFor();
    row.checks.push('Practice claim succeeds');
    row.passed = true;
    await p.screenshot({ path: `review/round14/${name}-practice.png`, fullPage: true });
  } catch (e) {
    row.error = String(e);
    row.passed = false;
  } finally {
    await b.close();
    results.push(row);
  }
}
writeFileSync(
  process.argv.includes('--production-only')
    ? 'review/round14/in-app-production.json'
    : 'review/round14/in-app-practice.json',
  JSON.stringify(results, null, 2),
);
console.log(results);
if (results.some((r) => !r.passed)) process.exitCode = 1;
