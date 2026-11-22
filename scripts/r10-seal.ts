import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
const bytes = readFileSync('public/fonts/archivo-og.woff');
const font = opentype.parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const monogram = font.charToGlyph('d').getPath(0, 0, 116);
monogram.extend(font.charToGlyph('.').getPath(76, 0, 116));
const box = monogram.getBoundingBox();
const mark = `<path transform="translate(${150 - (box.x1 + box.x2) / 2} ${142 - (box.y1 + box.y2) / 2})" d="${monogram.toPathData(3)}"/>`;
const body = `<defs><path id="upper" d="M 34 150 A 116 116 0 0 1 266 150"/><path id="lower" d="M 22 150 A 128 128 0 0 0 278 150"/></defs><g fill="none" stroke="#1a1a17"><circle cx="150" cy="150" r="143" stroke-width="3"/><circle cx="150" cy="150" r="136" stroke-width="1"/><circle cx="150" cy="150" r="101" stroke-width="2"/></g><g fill="#1a1a17"><circle cx="27" cy="150" r="3"/><circle cx="273" cy="150" r="3"/>${mark}<text font-family="Archivo" font-weight="900" font-size="14" letter-spacing="1.5"><textPath href="#upper" startOffset="50%" text-anchor="middle">REGISTRY OF DIBS</textPath></text><text font-family="Archivo" font-weight="900" font-size="14" letter-spacing="1.5"><textPath href="#lower" startOffset="50%" text-anchor="middle">FIRST COME · FIRST SERVED</textPath></text><text x="150" y="214" text-anchor="middle" font-family="Archivo" font-weight="900" font-size="12" letter-spacing="1.4">EST. 2026</text></g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><style>@font-face{font-family:Archivo;src:url(data:font/woff;base64,${bytes.toString('base64')});font-weight:900}</style>${body}</svg>`;
writeFileSync('public/art/seal.svg', svg);
const simple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="140" fill="#f1ece2" stroke="#1a1a17" stroke-width="12"/><g fill="#1a1a17" transform="translate(-30 -23) scale(1.2)">${mark}</g></svg>`;
writeFileSync('public/favicon.svg', simple);
await initWasm(readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'));
// Resolve the exact textPaths once, using the same bundled font, for the font-free Worker renderer.
delete font.tables.gsub;
const renderer = new Resvg(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">${body}</svg>`,
  { font: { fontBuffers: [new Uint8Array(font.toArrayBuffer())], loadSystemFonts: false } },
);
const outline = renderer.toString().replace('<svg width="300" height="300"', '<svg');
writeFileSync(
  'shared/engraving.generated.ts',
  'export const sealMarkup = ' + JSON.stringify(outline) + ';\n',
);
renderer.free();
for (const size of [180, 192, 512]) {
  const r = new Resvg(simple, { fitTo: { mode: 'width', value: size } });
  const png = r.render();
  writeFileSync(`public/icon-${size}.png`, png.asPng());
  png.free();
  r.free();
}
