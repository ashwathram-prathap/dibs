import './test-traffic';
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SECURITY_HEADERS } from '../shared/security';
const checks: any[] = [];
console.log('Starting exact-policy browser checks');
for (const [name, engine] of [
  ['Chromium', chromium],
  ['WebKit', webkit],
] as const) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    console.log(name, 'application flow');
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/content.security.policy|violates.*directive/i.test(m.text())) violations.push(m.text());
    });
    await page.addInitScript(() => {
      (window as any).__violations = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as any).__violations.push(e.violatedDirective + ': ' + e.blockedURI),
      );
      Object.defineProperty(navigator, 'canShare', { value: () => false });
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.route('http://127.0.0.1:5173/**', async (route) => {
      const response = await route.fetch();
      // Test the EXACT deployed CSP, without WebKit's screenshot-only hash.
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          ...Object.fromEntries(
            Object.entries(SECURITY_HEADERS).map(([k, v]) => [k.toLowerCase(), v]),
          ),
        },
      });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByLabel('ENTRY:', { exact: true }).fill('Axolotl');
    await page.getByRole('button', { name: 'CALL DIBS' }).click();
    await page.getByRole('article', { name: 'Certificate of Dibs for Axolotl' }).waitFor();
    await page.goto('http://127.0.0.1:5173/certificate/fixture-1');
    await page.evaluate(() => document.fonts.ready);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Story PNG' }).click();
    const file = await download;
    const detected = await page.evaluate(() => (window as any).__violations);
    checks.push({
      engine: name,
      check: 'exact production CSP: filing, fonts, certificate, PNG download',
      passed:
        violations.length === 0 &&
        detected.length === 0 &&
        file.suggestedFilename().endsWith('.png'),
      violations: [...violations, ...detected],
    });
    await context.close();
    const turnstile = await browser.newContext();
    const widget = await turnstile.newPage();
    widget.setDefaultTimeout(15000);
    console.log(name, 'Turnstile script');
    const errors: string[] = [];
    const diagnostics: string[] = [];
    widget.on('console', (m) => diagnostics.push(m.text().slice(0, 500)));
    widget.on('requestfailed', (r) => diagnostics.push(r.url() + ' ' + r.failure()?.errorText));
    widget.on('console', (m) => {
      if (/content.security.policy|violates.*directive/i.test(m.text())) errors.push(m.text());
    });
    await widget.route('https://dibs.here/__turnstile-check', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/html', ...SECURITY_HEADERS },
        body: '<!doctype html><html><head><title>CSP check</title></head><body><div id="widget"></div></body></html>',
      }),
    );
    await widget.goto('https://dibs.here/__turnstile-check');
    try {
      await Promise.race([
        widget.addScriptTag({
          url: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Turnstile script network timeout')), 15000),
        ),
      ]);
      console.log(name, 'Turnstile render');
      await widget.evaluate(`(() => {
        window.turnstile.render('#widget', { sitekey: '1x00000000000000000000AA', action: 'claim', callback: function(token) { window.__verified = !!token; }, 'error-callback': function(code) { window.__widgeterror = code; } });
      })()`);
      await widget.waitForFunction(
        () => (window as any).__verified || (window as any).__widgeterror,
        {},
        { timeout: 15000 },
      );
      checks.push({
        engine: name,
        check:
          'real Cloudflare Turnstile script and iframe with official dummy key; exact production CSP',
        passed: errors.length === 0 && (await widget.evaluate(() => !!(window as any).__verified)),
        diagnostics,
        violations: errors,
      });
    } catch (e: any) {
      checks.push({
        engine: name,
        check: 'real Turnstile under exact production CSP',
        passed: false,
        error: e.message,
        diagnostics,
        violations: errors,
      });
    }
    await turnstile.close();
  } finally {
    await browser.close();
  }
}
mkdirSync('review/round5', { recursive: true });
writeFileSync('review/round5/exact-csp-browser.json', JSON.stringify(checks, null, 2) + '\n');
console.log(checks);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
