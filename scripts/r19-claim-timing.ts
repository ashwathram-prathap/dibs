import { gzipSync } from 'node:zlib';
import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { api, origin } from './r19-practice-api';
import { readCategory } from './category-file';
const phase = process.argv[2] || 'after';
const root = resolve(phase === 'before' ? '.tmp/r19-baseline/dist' : 'dist');
const today = await api('/today');
assert.equal(today.data.turnstileSiteKey, '1x00000000000000000000AA');
assert.ok(today.data.category && !today.data.revealed);
const catalog = readCategory('categories/animals.json');
const samples: any[] = [];
const wireSize = (body: Buffer, type: string, headers: Record<string, string> = {}) =>
  Number(headers['content-length']) ||
  (/javascript|json|text\//.test(type) ? gzipSync(body).length : body.length);
// Both engines get the same 150ms RTT and 1.6Mbps response transport shim.
// WebSocket messages receive one-way 75ms delay; assets are the exact built R18/R19 bytes.
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (let sample = 0; sample < 3; sample++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        timezoneId: 'America/Toronto',
      });
      await context.route('**/*', async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (!/^https?:$/.test(url.protocol)) return route.continue();
        if (
          url.origin === origin &&
          !url.pathname.startsWith('/api/') &&
          (url.pathname === '/' || url.pathname.startsWith('/assets/'))
        ) {
          const file = resolve(root, url.pathname === '/' ? 'index.html' : '.' + url.pathname);
          if (!file.startsWith(root) || !existsSync(file)) return route.abort();
          const body = readFileSync(file);
          await new Promise((r) =>
            setTimeout(
              r,
              150 +
                (wireSize(body, /\.(html|js|css)$/.test(file) ? 'text/plain' : 'binary') / 204800) *
                  1000,
            ),
          );
          return route.fulfill({
            status: 200,
            body,
            contentType:
              (
                {
                  '.html': 'text/html',
                  '.js': 'application/javascript',
                  '.css': 'text/css',
                  '.woff2': 'font/woff2',
                } as any
              )[extname(file)] || 'application/octet-stream',
          });
        }
        const response = await route.fetch();
        const body = await response.body();
        await new Promise((r) =>
          setTimeout(
            r,
            150 +
              (wireSize(body, response.headers()['content-type'] || '', response.headers()) /
                204800) *
                1000,
          ),
        );
        return route.fulfill({ response, body });
      });
      await context.routeWebSocket('**/api/live*', (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((m) =>
          setTimeout(() => {
            try {
              server.send(m);
            } catch {}
          }, 75),
        );
        server.onMessage((m) =>
          setTimeout(() => {
            try {
              ws.send(m);
            } catch {}
          }, 75),
        );
      });
      const page = await context.newPage();
      let verified = 0;
      let claimProofs = 0;
      const scriptAt: number[] = [];
      page.on('request', (r) => {
        if (r.url().includes('/turnstile/v0/api.js')) scriptAt.push(Date.now());
        if (r.url().endsWith('/api/claim') && r.postDataJSON()?.sessionToken) claimProofs++;
      });
      page.on('response', (r) => {
        if (r.url().startsWith(origin + '/api/') && r.status() >= 400)
          console.log(
            'API diagnostic',
            engine.name(),
            sample,
            new URL(r.url()).pathname,
            r.status(),
          );
        if (r.url().endsWith('/api/verify-session') && r.ok()) verified++;
      });
      page.on('requestfailed', (r) => {
        if (r.url().startsWith(origin + '/api/'))
          console.log(
            'Transport diagnostic',
            engine.name(),
            sample,
            new URL(r.url()).pathname,
            r.failure()?.errorText,
          );
      });
      page.on('websocket', (ws) => {
        ws.on('framereceived', (e) => {
          try {
            const d = JSON.parse(String(e.payload));
            if (d.rpc && d.body?.sessionToken) verified++;
          } catch {}
        });
        ws.on('framesent', (e) => {
          try {
            const d = JSON.parse(String(e.payload));
            if (d.path === '/claim' && d.body?.sessionToken) claimProofs++;
          } catch {}
        });
      });
      await page.goto(origin);
      await page.locator('#answer').waitFor();
      const liveAt = Date.now();
      await page.waitForTimeout(3000);
      const times = [];
      for (let claim = 0; claim < 3; claim++) {
        if (claim) await page.getByRole('button', { name: 'Next claim', exact: true }).click();
        const index =
          (phase === 'before' ? 2000 : 3000) +
          (engine.name() === 'webkit' ? 300 : 0) +
          sample * 3 +
          claim;
        await page.locator('#answer').fill(catalog.answers[index].display);
        const tap = Date.now();
        await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
        await expect(page.locator(claim === 2 ? '.day-certificate' : '.win-stamp')).toBeVisible({
          timeout: 60000,
        });
        times.push(Date.now() - tap);
      }
      assert.equal(verified, 1, 'Only one Turnstile verification is needed for three claims');
      samples.push({
        browser: engine.name(),
        sample,
        phase,
        tapToStampMs: times,
        verificationRequests: verified,
        proofClaimRequests: claimProofs,
        scriptStartedBeforeTap: scriptAt[0] < liveAt + 3000,
        transport:
          '150ms RTT + 1.6Mbps encoded-response shim; 75ms each way WebSocket; no CPU throttling',
      });
      writeFileSync(`review/round19/claim-timing-${phase}.json`, JSON.stringify(samples, null, 2));
      await context.unrouteAll({ behavior: 'ignoreErrors' });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify(samples, null, 2));
