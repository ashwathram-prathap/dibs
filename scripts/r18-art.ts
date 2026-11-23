import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
const data = readFileSync('public/fonts/archivo-og.woff');
const face = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
for (const name of ['seal-a', 'seal-b']) {
  let svg = readFileSync(`public/art/${name}.svg`, 'utf8');
  svg = svg
    .replace(/<defs>[\s\S]*?<\/defs>/, '')
    .replace(/<g fill="#36392f" font-family=[\s\S]*?<\/g>/, '');
  svg = svg.replace(/<circle[^>]*\br="(?:79|50|53|82|77)"[^>]*\/>/g, '');
  const text = 'Dibs',
    size = 20;
  const glyphs = [...text].map((ch) => face.charToGlyph(ch));
  let x =
    (180 - glyphs.reduce((n, g) => n + ((g.advanceWidth || 0) * size) / face.unitsPerEm, 0)) / 2;
  const paths = glyphs
    .map((g) => {
      const path = g.getPath(x, 151, size).toSVG(2);
      x += ((g.advanceWidth || 0) * size) / face.unitsPerEm;
      return path;
    })
    .join('');
  svg = svg.replace('</svg>', paths + '</svg>');
  writeFileSync(`public/art/${name}.svg`, svg);
}
