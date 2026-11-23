import { chromium } from '@playwright/test';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const root = process.argv[2] || 'review/round19c/matrix';
const captures = process.argv[3] || root + '/raw';
const captureLink = relative(root, captures);
mkdirSync(root, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2400, height: 1000 },
  deviceScaleFactor: 1,
});
const manifest: any[] = [];
try {
  for (const screen of readdirSync(captures, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    const files = readdirSync(captures + '/' + screen)
      .filter((f) => f.endsWith('.png'))
      .sort();
    const html = `<!doctype html><meta charset="utf-8"><title>R19C · ${screen}</title><style>*{box-sizing:border-box}body{margin:0;background:#ddd8ca;font:12px sans-serif;color:#171714}h1{font-size:22px;padding:16px;margin:0}.grid{display:grid;grid-template-columns:repeat(10,240px)}a{padding:8px;border:1px solid #aaa;color:inherit;text-decoration:none;overflow-wrap:anywhere}img{display:block;width:224px;height:190px;object-fit:contain;background:#bdb9af}span{display:block;min-height:42px;padding-top:5px}</style><h1>${screen} · ${files.length} device / theme / font / zoom combinations</h1><div class="grid">${files.map((f) => `<a href="${captureLink}/${screen}/${f}"><img src="${captureLink}/${screen}/${f}"><span>${f.slice(0, -4)}</span></a>`).join('')}</div>`;
    const file = root + '/' + screen + '.html';
    writeFileSync(file, html);
    await page.goto('file://' + resolve(file));
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await page.screenshot({ path: root + '/' + screen + '.png', fullPage: true });
    manifest.push({
      screen,
      combinations: files.length,
      contactSheet: screen + '.png',
      gallery: screen + '.html',
    });
  }
  writeFileSync(
    root + '/index.html',
    '<!doctype html><meta charset="utf-8"><title>R19C device review</title><h1>R19C device review</h1><ul>' +
      manifest
        .map(
          (s) =>
            `<li><a href="${s.gallery}">${s.screen}</a> — ${s.combinations} combinations · <a href="${s.contactSheet}">contact sheet</a></li>`,
        )
        .join('') +
      '</ul>',
  );
  writeFileSync(root + '/manifest.json', JSON.stringify(manifest, null, 2));
  console.log({
    screens: manifest.length,
    screenshots: manifest.reduce((n, r) => n + r.combinations, 0),
  });
} finally {
  await browser.close();
}
