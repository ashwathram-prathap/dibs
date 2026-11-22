import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
const bytes = readFileSync('public/fonts/archivo-og.woff'),
  font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const d = font.getPath('D', 25, 78, 80).toPathData(2);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path fill="#F1ECE2" d="M0 0h120v120H0z"/><path fill="#1A1A17" d="${d}"/><path fill="#E1462B" d="M26 90h68v7H26z"/></svg>`;
writeFileSync('public/favicon.svg', svg);
await initWasm(readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'));
for (const size of [16, 32, 48, 180, 192, 512]) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } }),
    png = r.render();
  writeFileSync(
    size < 100 ? `review/round11/icon-${size}.png` : `public/icon-${size}.png`,
    png.asPng(),
  );
  png.free();
  r.free();
}
