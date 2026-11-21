import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';
const fonts = [
  'archivo-og.woff',
  'archivo-og-latin-ext.woff',
  'archivo-og-vietnamese.woff',
  'archivo-supplement-900.otf',
].map((name) => {
  const b = readFileSync('public/fonts/' + name);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
});
const missing = new Set<string>();
const characters = new Set<string>();
let entries = 0;
for (const name of readdirSync('categories').filter((name) => name.endsWith('.json'))) {
  for (const answer of JSON.parse(readFileSync('categories/' + name, 'utf8')).answers) {
    entries++;
    for (const c of answer.display + answer.display.toUpperCase()) {
      characters.add(c);
      if (!fonts.some((font) => font.charToGlyphIndex(c))) missing.add(c);
    }
  }
}
const result = {
  entries,
  uniqueCharacters: characters.size,
  missing: [...missing],
  passed: !missing.size,
};
writeFileSync('review/font-coverage.json', JSON.stringify(result, null, 2));
console.log(result);
if (missing.size) process.exitCode = 1;
