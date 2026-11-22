import { readCategory } from './category-file';
import { readdirSync, readFileSync } from 'node:fs';
const bad = /[\u2190-\u27bf\u{1f000}-\u{1ffff}]|\p{Extended_Pictographic}/u;
const failures: string[] = [];
for (const dir of ['src', 'shared', 'worker'])
  for (const file of readdirSync(dir).filter((f) => /\.(tsx?|css)$/.test(f))) {
    const path = dir + '/' + file;
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (path === 'src/share.ts' && line.includes('file.events.map')) return;
        if (path === 'src/Icon.tsx' && /[■□★]/.test(line)) return;
        if (bad.test(line)) failures.push(path + ':' + (i + 1));
      });
  }
for (const file of readdirSync('categories').filter((file) => file.endsWith('.json'))) {
  const category = readCategory('categories/' + file);
  if (category.provenance?.identityPolicy !== 'complete-reference-v2') continue;
  for (const answer of category.answers)
    if (bad.test(answer.display)) failures.push('categories/' + file + ': ' + answer.display);
}
if (failures.length) throw Error('Emoji-capable UI glyphs: ' + failures.join(', '));
console.log('No emoji-capable glyphs outside encoded share text and its SVG renderer.');
