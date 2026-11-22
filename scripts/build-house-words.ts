// Keep ranked house names inside the Worker bundle, never in Pages assets.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const house: Record<string, string[]> = {};
for (const name of readdirSync('categories')
  .filter((n) => n.endsWith('.json'))
  .sort()) {
  const category = JSON.parse(readFileSync('categories/' + name, 'utf8'));
  house[category.slug] = category.answers.filter((a:any)=>a.pageviews?.days>0)
    .sort(
      (a, b) =>
        b.pageviews.total / b.pageviews.days - a.pageviews.total / a.pageviews.days ||
        a.display.localeCompare(b.display),
    )
    .slice(0, 10)
    .map((a) => a.display);
}
writeFileSync('worker/house-words.json', JSON.stringify(house, null, 2) + '\n');
