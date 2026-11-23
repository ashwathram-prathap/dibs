import './test-traffic';
import { readCategory } from './category-file';
import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders: { 'x-test-ip': 'r3-local-' + Date.now() },
  recordVideo: { dir: 'review/final/video', size: { width: 390, height: 844 } },
});
await context.addInitScript({
  content:
    "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('local')},10);return 'test'},remove:function(){}};",
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5174');
await page.getByLabel('ENTRY:', { exact: true }).waitFor();
const initial = await page.evaluate(async () => await (await fetch('/api/bootstrap')).json());
const answers = readCategory('categories/animals.json').answers;
const used = new Set(initial.rows.map((r: any) => r.display));
const fresh = answers.filter((a: any) => !used.has(a.display)).slice(0, 3);
const submit = async (answer: string) => {
  await page.getByLabel('ENTRY:', { exact: true }).fill(answer);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/claim'));
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  const r = await response;
  if (![201, 409].includes(r.status())) throw Error(await r.text());
  await page.waitForTimeout(1500);
};
await page.evaluate(
  "window.turnstile={render:function(el,o){setTimeout(function(){o['error-callback']()},10);return 'error'},remove:function(){}}",
);
await page.getByLabel('ENTRY:', { exact: true }).fill(fresh[0].display);
await page.getByRole('button', { name: 'CALL DIBS' }).click();
await expect(page.getByRole('status')).toHaveText('Verification failed. Please try again.');
await expect(page.getByRole('img', { name: '0 of 5 strikes' })).toBeVisible();
await page.screenshot({ path: 'review/round3/verification-error.png', fullPage: true });
await page.evaluate(
  "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('local')},10);return 'local'},remove:function(){}}",
);
await submit(fresh[0].display);
await submit(fresh[0].display); // Own prior answer is taken too.
await expect(page.getByRole('img', { name: '1 of 5 strikes' })).toBeVisible();
await page.screenshot({ path: 'review/round3/real-mid-game.png', fullPage: true });
await submit(fresh[1].display);
await submit(fresh[2].display);
await expect(page.getByRole('article', { name: 'Day summary' })).toBeVisible();
await page.reload();
await expect(page.getByRole('article', { name: 'Day summary' })).toBeVisible();
const me = await page.evaluate(async () => await (await fetch('/api/me')).json());
expect(me.file.dibs).toBe(3);
expect(me.file.strikes).toBe(1);
expect(me.file.events.map((e: any) => e.kind)).toEqual(['dibs', 'strike', 'dibs', 'dibs']);
const closed = await page.evaluate(
  async () =>
    (
      await fetch('/api/claim', {
        method: 'POST',
        headers: { origin: 'https://dibs.here', 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'Axolotl', turnstileToken: 'local' }),
      })
    ).status,
);
expect(closed).toBe(403);
await page.screenshot({ path: 'review/round3/real-summary.png', fullPage: true });
const video = page.video();
await context.close();
if (video) copyFileSync(await video.path(), 'review/final/claim-moment.webm');
const losing = await browser.newContext();
await losing.addInitScript({
  content:
    "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('local')},10);return 'test'},remove:function(){}};",
});
const loser = await losing.newPage();
await loser.goto('http://127.0.0.1:5174');
for (let i = 1; i <= 5; i++) {
  await loser.getByLabel('ENTRY:', { exact: true }).fill(fresh[0].display);
  await loser.getByRole('button', { name: 'CALL DIBS' }).click();
  await expect(loser.getByRole('img', { name: `${i} of 5 strikes` })).toBeVisible();
}
await loser.reload();
await expect(loser.getByRole('article', { name: 'Day summary' })).toBeVisible();
await expect(loser.getByRole('img', { name: '5 of 5 strikes' })).toBeVisible();
await browser.close();
expect(errors).toEqual([]);
writeFileSync(
  'review/round3/local-integration.json',
  JSON.stringify(
    {
      passed: true,
      checks: [
        'verification failure is explained without a strike or unhandled error',
        'real D1 3 dibs plus strike',
        'server event order',
        'reload persists 3/1 and 0/5',
        'closed 403',
        'UI summary',
        'three-stamp recording',
      ],
      errors,
    },
    null,
    2,
  ),
);
console.log('Round 3 real local D1 integration passed.');
