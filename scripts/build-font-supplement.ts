// Three orthographic glyphs absent from the distributed Archivo subsets.
// Preserve Archivo's outlines: ʻ uses its left single quote; Ẑ/ẑ combine Z/z and circumflex.
// The derived font has a distinct internal name, under the bundled SIL OFL license.
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
import wawoff2 from 'wawoff2';
for (const weight of [400, 900]) {
  const data = readFileSync(
    `node_modules/@fontsource/archivo/files/archivo-latin-${weight}-normal.woff`,
  );
  const base = opentype.parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', advanceWidth: 500, path: new opentype.Path() }),
  ];
  for (const [char, source] of [
    ['ʻ', '‘'],
    ['Ẑ', 'Z'],
    ['ẑ', 'z'],
  ]) {
    const original = base.charToGlyph(source);
    const path = new opentype.Path();
    path.extend(original.path);
    if (char !== 'ʻ') {
      const accent = base.charToGlyph('ˆ');
      const letterBox = original.getBoundingBox();
      const accentBox = accent.getBoundingBox();
      const dx = (letterBox.x1 + letterBox.x2 - accentBox.x1 - accentBox.x2) / 2;
      const dy = letterBox.y2 + 55 - accentBox.y1;
      for (const command of accent.path.commands) {
        const moved: any = { ...command };
        for (const key of ['x', 'x1', 'x2']) if (key in moved) moved[key] += dx;
        for (const key of ['y', 'y1', 'y2']) if (key in moved) moved[key] += dy;
        path.commands.push(moved);
      }
    }
    glyphs.push(
      new opentype.Glyph({
        name: `uni${char.codePointAt(0)!.toString(16)}`,
        unicode: char.codePointAt(0),
        advanceWidth: original.advanceWidth,
        path,
      }),
    );
  }
  const font = new opentype.Font({
    familyName: 'Dibs Archivo Supplement',
    styleName: weight === 900 ? 'Black' : 'Regular',
    unitsPerEm: base.unitsPerEm,
    ascender: base.ascender,
    descender: base.descender,
    glyphs,
  });
  const otf = Buffer.from(font.toArrayBuffer());
  writeFileSync(`public/fonts/archivo-supplement-${weight}.otf`, otf);
  writeFileSync(`public/fonts/archivo-supplement-${weight}.woff2`, await wawoff2.compress(otf));
}
console.log('Built three Archivo-derived orthographic glyphs at regular and black weights.');
