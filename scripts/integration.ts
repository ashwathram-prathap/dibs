import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('review/integration', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await page.addInitScript({
  content:
    "window.turnstile={render:function(el,opts){setTimeout(function(){opts.callback('local-integration-token')},10);return 'local-widget'},remove:function(){}}",
});
try {
  await page.goto('http://127.0.0.1:5174');
  await page.getByRole('heading', { name: 'Animals', exact: true }).waitFor();
  await page.getByLabel('ENTRY:', { exact: true }).fill('Axolotl');
  await page.getByRole('button', { name: 'CALL DIBS' }).click();
  await page.getByRole('article', { name: 'Certificate of Dibs for Axolotl' }).waitFor();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'review/integration/real-local-claim.png', fullPage: true });
  await page.reload();
  await page.getByRole('article', { name: 'Certificate of Dibs for Axolotl' }).waitFor();
  const me = await page.evaluate(async () => await (await fetch('/api/me')).json());
  if (me.claim.display !== 'Axolotl') throw new Error('Signed identity did not survive reload');
  const response = await page.evaluate(async () => {
    const r = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: 'Narwhal', turnstileToken: 'local' }),
    });
    return r.status;
  });
  if (response !== 403) throw new Error('Second claim unexpectedly accepted');
  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await blocked.newPage();
  await p.goto('http://127.0.0.1:5174');
  await p.getByLabel('ENTRY:', { exact: true }).fill('Narwhal');
  await blocked.clearCookies();
  await p.getByRole('button', { name: 'CALL DIBS' }).click();
  await p.getByText('Cookies are required to keep your place.', { exact: false }).waitFor();
  await p.screenshot({ path: 'review/integration/cookies-blocked.png', fullPage: true });
  await blocked.close();
  writeFileSync(
    'review/integration/result.json',
    JSON.stringify(
      {
        status: 'pass',
        checks: [
          'real category claim through Vite proxy and Worker D1',
          'signed cookie survives reload',
          'second daily claim rejected',
          'cookie-blocked clerk message',
        ],
        turnstile:
          'Client widget stub and localhost-only server bypass; live widget verification is separately configured.',
      },
      null,
      2,
    ),
  );
  console.log('Real local integration passed');
} finally {
  await browser.close();
}
