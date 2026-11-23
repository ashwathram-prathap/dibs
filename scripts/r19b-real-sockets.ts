import './test-traffic';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { chromium, webkit, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'after';
const bundled = await build({
  stdin: {
    contents: `import {publish,watchRegistry} from './src/live'; publish({today:{category:null,nextDrop:'2026-11-24T02:00:00Z'},rows:[],me:{user:null},reset:true}); window.stopRegistry=watchRegistry(message=>console.error(message));`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_DEMO': '"false"' },
});
const evidence = [];
for (const engine of [chromium, webkit]) {
  let connects = 0,
    boots = 0;
  const raw = new Set<any>();
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/api/bootstrap')) {
      boots++;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          today: { category: null, nextDrop: '2026-11-24T02:00:00Z' },
          rows: [],
          me: { user: null },
        }),
      );
    } else if (req.url === '/client.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(bundled.outputFiles[0].text);
    } else if (req.url === '/slow.png')
      setTimeout(() => {
        res.setHeader('content-type', 'image/png');
        res.end(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
            'base64',
          ),
        );
      }, 300);
    else {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><title>Local socket proof</title><script type="module" src="/client.js"></script><img src="/slow.png" alt="Local delay">',
      );
    }
  });
  server.on('connection', (s) => {
    raw.add(s);
    s.on('close', () => raw.delete(s));
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    connects++;
    setTimeout(() => {
      if (!socket.destroyed) wss.handleUpgrade(req, socket, head, () => {});
    }, 1000);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + (server.address() as any).port + '/?no-analytics=1');
    await page.waitForTimeout(1600);
    const initial = { connects, boots, errors: [...errors] };
    if (phase === 'after') {
      expect(connects).toBe(1);
      expect(boots).toBe(1);
      expect(errors).toEqual([]);
    }
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect.poll(() => boots).toBeGreaterThan(initial.boots);
    evidence.push({ browser: engine.name(), initial, restoredBoots: boots, errors });
    if (phase === 'after') expect(errors).toEqual([]);
  } finally {
    await browser.close();
    for (const s of raw) s.destroy();
    wss.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
writeFileSync('review/round19b/real-sockets-' + phase + '.json', JSON.stringify(evidence, null, 2));
console.log(evidence);
