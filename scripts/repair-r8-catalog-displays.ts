import { readdirSync, writeFileSync } from 'node:fs';
import { readCategory, writeCategory } from './category-file';
import { cleanReferenceRows, repairSourceEncoding } from './catalog-cleaning';
import { normalize } from '../worker/domain';
const report: any[] = [];
const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice(7)
  .split(',');
for (const file of readdirSync('categories').filter((name) => name.endsWith('.json'))) {
  if (only && !only.includes(file.slice(0, -5))) continue;
  const path = 'categories/' + file;
  const category = readCategory(path);
  const original = category.answers;
  const cleaned = cleanReferenceRows(original);
  const changes = original.flatMap((row: any) => {
    const result = cleanReferenceRows([row])[0];
    return !result || result.display !== row.display
      ? [{ before: row.display, after: result?.display || null }]
      : [];
  });
  if (!changes.length) continue;
  const owners = new Map<string, any>();
  let merged = 0;
  for (const row of cleaned) {
    const canonical = normalize(row.display);
    if (!canonical) continue;
    const previous = owners.get(canonical);
    if (previous) {
      previous.aliases.push(row.display, ...row.aliases);
      merged++;
    } else owners.set(canonical, { ...row, canonical });
  }
  const answers = [...owners.values()];
  const keys = new Set(owners.keys());
  for (const row of answers) {
    row.aliases = row.aliases.filter((alias: string) => {
      const key = normalize(repairSourceEncoding(alias));
      if (!key || keys.has(key)) return false;
      keys.add(key);
      return true;
    });
  }
  answers.sort(
    (a, b) =>
      b.pageviews.total / (b.pageviews.days || 1) - a.pageviews.total / (a.pageviews.days || 1) ||
      a.display.localeCompare(b.display),
  );
  category.answers = answers;
  category.total_registrable = answers.length;
  category.provenance.unmeasured = answers.filter((row) => !row.pageviews.days).length;
  category.provenance.displayRepair = {
    at: new Date().toISOString(),
    method:
      'Repair source UTF-8 mojibake, choose plain source aliases or symbol transcriptions, preserve measured readership, deduplicate normalized names and aliases',
    changed: changes.length,
    merged,
  };
  writeCategory(path, category);
  report.push({
    slug: category.slug,
    originalCount: original.length,
    count: answers.length,
    merged,
    changes,
    preservedRankingWindow: category.provenance.ranking,
  });
  console.log(category.slug, changes.length, 'display repairs;', merged, 'duplicate names merged');
}
writeFileSync('review/round8/catalog-display-repairs.json', JSON.stringify(report, null, 2) + '\n');
