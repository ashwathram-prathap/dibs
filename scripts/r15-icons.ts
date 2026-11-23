import './test-traffic';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { chromium } from '@playwright/test';
const data = readFileSync('public/fonts/archivo-og.woff');
const font = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
const path = font.charToGlyph('d').getPath(0, 0, 330);
const box = path.getBoundingBox();
const width = box.x2 - box.x1,
  height = box.y2 - box.y1;
// Visible ink bounds include the underline; use those bounds, not the font advance.
const inkHeight = height + 36;
const glyph = `<g transform="translate(${256 - width / 2 - box.x1} ${256 - inkHeight / 2 - box.y1})"><path fill="#1A1A17" d="${path.toPathData(2)}"/><path fill="#E1462B" d="M${box.x1} ${box.y2 + 18}h${width}v18h-${width}z"/></g>`;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path fill="#F1ECE2" d="M0 0h512v512H0z"/>${glyph}</svg>`;
writeFileSync('public/favicon.svg', svg);
const browser = await chromium.launch();
const page = await browser.newPage();
// Optical centre uses the pixel mass of visible ink, independent of font advances.
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(`<style>body{margin:0}svg{width:100%;height:100%}</style>${svg}`);
const rendered = PNG.sync.read(await page.screenshot());
let mass = 0,
  inkX = 0,
  inkY = 0;
for (let y = 0; y < 512; y++)
  for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4;
    const weight = Math.max(
      0,
      (241 - rendered.data[i] + (236 - rendered.data[i + 1]) + (226 - rendered.data[i + 2])) / 3,
    );
    mass += weight;
    inkX += x * weight;
    inkY += y * weight;
  }
const dx = 256 - inkX / mass,
  dy = 256 - inkY / mass;
svg = svg.replace(glyph, `<g transform="translate(${dx} ${dy})">${glyph}</g>`);
writeFileSync('public/favicon.svg', svg);
writeFileSync(
  'review/round15/icon-centering.json',
  JSON.stringify({ method: 'visible-ink pixel mass', dx, dy, safeZoneRadius: 204.8 }, null, 2),
);
const images: string[] = [];
for (const size of [48, 180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>body{margin:0}svg{width:100%;height:100%}</style>${svg}`);
  const path = size === 48 ? 'review/round15/icon-48.png' : `public/icon-${size}.v2.png`;
  await page.screenshot({ path });
  images.push(
    `<figure><img width="${Math.min(size, 180)}" src="data:image/png;base64,${readFileSync(path).toString('base64')}"><figcaption>${size}px</figcaption></figure>`,
  );
}
// The visible ink is inside a centred 80% safe-zone circle (radius 204.8).
await page.screenshot({ path: 'public/icon-512-maskable.v2.png' });
for (const shape of ['circle', 'squircle'])
  images.push(
    `<figure><img width="180" style="border-radius:${shape === 'circle' ? '50%' : '25%'}" src="data:image/png;base64,${readFileSync('public/icon-512-maskable.v2.png').toString('base64')}"><figcaption>Android ${shape}</figcaption></figure>`,
  );
await page.setViewportSize({ width: 1100, height: 330 });
await page.setContent(
  `<style>body{background:#ddd;font:16px sans-serif;display:flex;align-items:center}figure{margin:12px}figcaption{margin-top:12px}</style>${images.join('')}`,
);
await page.screenshot({ path: 'review/round15/icons.png' });
await browser.close();
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
manifest.name = 'Dibs';
manifest.icons = [192, 512].map((n) => ({
  src: `/icon-${n}.v2.png`,
  sizes: `${n}x${n}`,
  type: 'image/png',
  purpose: 'any',
}));
manifest.icons.push({
  src: '/icon-512-maskable.v2.png',
  sizes: '512x512',
  type: 'image/png',
  purpose: 'maskable',
});
writeFileSync('public/manifest.webmanifest', JSON.stringify(manifest, null, 2));
