import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
const seal = Buffer.from(readFileSync('public/art/seal.svg')).toString('base64'),
  icon = Buffer.from(readFileSync('public/favicon.svg')).toString('base64');
await p.setContent(
  `<html><body style="margin:0;font:16px monospace;background:#f1ece2;color:#1a1a17"><h1 style="padding:20px">REGISTRY SEAL / R10</h1>${['light', 'dark'].map((theme) => `<section style="padding:24px;background:${theme === 'dark' ? '#16150f' : '#f1ece2'};color:${theme === 'dark' ? '#f1ece2' : '#1a1a17'}"><div style="display:flex;gap:30px;align-items:center">${[32, 64, 200, 600].map((size) => `<div><p>${size}px</p><img style="filter:${theme === 'dark' ? 'invert(1) sepia(.15)' : 'none'}" width="${size}" height="${size}" src="data:image/svg+xml;base64,${seal}"></div>`).join('')}</div><p>Simplified icon · 32px / 48px</p><img width="32" src="data:image/svg+xml;base64,${icon}"> <img width="48" src="data:image/svg+xml;base64,${icon}"></section>`).join('')}</body></html>`,
);
await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
await p.screenshot({ path: 'review/round10/seal-sizes.png', fullPage: true });
await b.close();
