import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readCategory } from './category-file';
// Keep original reference metadata next to immutable catalog rows, without bundling it into JS.
const category = readCategory('categories/cities.json');
const manifest = JSON.parse(readFileSync('public/catalog/cities/manifest.json', 'utf8'));
const path = `public/catalog/cities/${manifest.version}/clue-types.json`;
if (!existsSync(path))
  writeFileSync(path, JSON.stringify(category.answers.map((a: any) => a.country || null)));
