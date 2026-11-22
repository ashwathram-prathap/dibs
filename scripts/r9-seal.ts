import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
const { parse } = opentype;
const bytes = readFileSync('public/fonts/archivo-og.woff');
const font = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const curved = (text: string, r: number, size: number, bottom = false) => {
  const widths = [...text].map(
    (ch) => ((font.charToGlyph(ch).advanceWidth || 0) * size) / font.unitsPerEm + 1.6,
  );
  let at = -widths.reduce((a, b) => a + b, 0) / 2;
  let out = '';
  for (const [i, ch] of [...text].entries()) {
    const offset = at + widths[i] / 2;
    const theta = bottom ? Math.PI / 2 - offset / r : -Math.PI / 2 + offset / r;
    const x = 90 + r * Math.cos(theta),
      y = 90 + r * Math.sin(theta),
      rotation = (theta * 180) / Math.PI + (bottom ? -90 : 90);
    out += `<path transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotation.toFixed(2)})" d="${font
      .charToGlyph(ch)
      .getPath(-widths[i] / 2, 0, size)
      .toPathData(2)}"/>`;
    at += widths[i];
  }
  return out;
};
let svg = readFileSync('public/art/seal-b.svg', 'utf8');
svg =
  svg.slice(0, svg.indexOf('<g fill="#36392f" font-family')) +
  `<g fill="#36392f">${curved('REGISTRY OF DIBS', 65, 10)}${curved('FIRST COME, FIRST SERVED', 68, 7, true)}<path d="${[
    ...'EST. 2026',
  ]
    .map((ch, i) =>
      font
        .charToGlyph(ch)
        .getPath(68 + i * 5, 139, 8)
        .toPathData(2),
    )
    .join(' ')}"/></g></svg>`;
writeFileSync('public/art/seal.svg', svg);
writeFileSync('public/favicon.svg', svg);

writeFileSync(
  'shared/engraving.generated.ts',
  'export const sealMarkup = ' +
    JSON.stringify(svg) +
    ';\nexport const plateMarkup: Record<string,string> = ' +
    JSON.stringify(
      Object.fromEntries(
        ['animals-b', 'cities', 'foods', 'countries'].map((name) => [
          name,
          readFileSync('public/art/' + name + '.svg', 'utf8'),
        ]),
      ),
    ) +
    ';\n',
);
