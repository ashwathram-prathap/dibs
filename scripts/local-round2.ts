import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const dir = 'review/round2';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript({
  content:
    "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('local')},10);return 'test'},remove:function(){}};Object.defineProperty(navigator,'canShare',{value:function(){return false}});",
});
const page = await context.newPage();
const failures: string[] = [];
page.on('pageerror', (e) => failures.push(e.message));
await page.goto('http://127.0.0.1:5174');
await page.getByRole('heading', { name: 'Animals', exact: true }).waitFor();
await page.getByLabel('ENTRY:', { exact: true }).fill('Axolotl');
await page.getByRole('button', { name: 'CALL DIBS' }).click();
await page.getByText('Someone already called dibs on AXOLOTL', { exact: false }).waitFor();
const answers = JSON.parse(readFileSync('categories/animals.json', 'utf8')).answers;
const ledger = (await (
  await fetch('http://127.0.0.1:8787/api/ledger?category=animals')
).json()) as any;
const used = new Set(ledger.rows.map((r: any) => r.display));
const answer = answers.find((a: any) => !used.has(a.display));
await page.getByLabel('ENTRY:', { exact: true }).fill(answer.display);
await page.getByRole('button', { name: 'CALL DIBS' }).click();
await page.getByRole('article').waitFor();
await page.waitForTimeout(1400);
await page.screenshot({ path: dir + '/real-local-claim.png', fullPage: true });
const visible = await page.locator('.ledger').innerText();
if (!visible.includes(answer.display.toUpperCase()) && !visible.includes(answer.display))
  throw Error('Own claim missing from ledger');
await page.reload();
await page.getByRole('article').waitFor();
const me = await page.evaluate(async () => await (await fetch('/api/me')).json());
if (me.claim.display !== answer.display) throw Error('Identity lost');
const og = await fetch('http://127.0.0.1:8787/api/og/' + me.claim.id);
if (!og.ok) throw Error(await og.text());
writeFileSync(dir + '/og.png', Buffer.from(await og.arrayBuffer()));
const second = await page.evaluate(
  async () =>
    (
      await fetch('/api/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'another', turnstileToken: 'local' }),
      })
    ).status,
);
if (second !== 403) throw Error('Daily lock failed: ' + second);
await context.clearCookies();
await page.goto('http://127.0.0.1:5174');
await page.getByLabel('ENTRY:', { exact: true }).fill('Narwhal');
await context.clearCookies();
await page.getByRole('button', { name: 'CALL DIBS' }).click();
await page.getByText('Cookies are required to keep your place.', { exact: false }).waitFor();
writeFileSync(
  dir + '/local-integration.json',
  JSON.stringify(
    {
      passed: true,
      checks: [
        'real local D1 claim',
        'taken explanation',
        'immediate ledger insertion',
        'cookie persistence',
        'daily limit',
        'blocked cookie fallback',
        'OG PNG',
      ],
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) throw Error(failures.join('\n'));
await browser.close();
console.log('Round 2 local integration passed');
