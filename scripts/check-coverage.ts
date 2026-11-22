import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalize } from '../worker/domain';
const report: any[] = [];
const definitions = JSON.parse(readFileSync('scripts/category-sources.json', 'utf8'));
const nonWikidata = new Set([
  'animals',
  'plants',
  'birds',
  'arthropods',
  'cities',
  'foods',
  'fruits-vegetables',
  'countries',
  'airports',
  'mountains',
  'rivers',
  'lakes',
  'islands',
  'stations',
  'asteroids',
]);
const scheduled = JSON.parse(
  readFileSync('review/round8/production-registers-before.json', 'utf8'),
);
for (const f of readdirSync('categories').filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync('categories/' + f, 'utf8'));
  const path = 'review/coverage/' + c.slug + '.txt';
  const words = existsSync(path)
    ? [
        ...new Set(
          readFileSync(path, 'utf8')
            .trim()
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ]
    : [];
  const keys = new Set(
    c.answers.flatMap((a: any) => [normalize(a.display), ...a.aliases.map(normalize)]),
  );
  const missing = words.filter((w) => !keys.has(normalize(w)));
  const score = words.length ? (words.length - missing.length) / words.length : 0;
  const independentPath = 'review/coverage/' + c.slug + '-independent.json';
  const independent = existsSync(independentPath)
    ? JSON.parse(readFileSync(independentPath, 'utf8'))
    : null;
  const independentMissing = (independent?.answers || []).filter(
    (w: string) => !keys.has(normalize(w)),
  );
  const sourceComplete =
    !!c.provenance.completeSources &&
    (nonWikidata.has(c.slug) ||
      (c.provenance.wikidataNamePolicy === 'english-article-title-v3+en-mul-labels-aliases-v3' &&
        c.provenance.classificationRevision ===
          (definitions.find((d: any) => d.slug === c.slug)?.cacheKey || 'base')));
  const ready =
    words.length >= 150 &&
    (c.slug !== 'airports' || c.provenance.scopeValidation === 'article-descriptions-v2') &&
    score >= (c.slug === 'animals' ? 1 : 0.98) &&
    sourceComplete &&
    !!c.provenance.rankingComplete &&
    independent?.answers?.length >= 50 &&
    !independentMissing.length;
  const live = scheduled.find((r: any) => r.id === c.id);
  report.push({
    slug: c.slug,
    entries: c.answers.length,
    scope: c.provenance.scopeNote,
    obvious: words.length,
    score,
    missing,
    ready,
    independentChecked: independent?.answers?.length || 0,
    independentMissing,
    sourceComplete,
    rankingComplete: !!c.provenance.rankingComplete,
    unmeasured: c.provenance.unmeasured,
    house: c.answers
      .filter((a: any) => a.pageviews?.days > 0)
      .sort(
        (a: any, b: any) =>
          b.pageviews.total / b.pageviews.days - a.pageviews.total / a.pageviews.days,
      )
      .slice(0, 10)
      .map((a: any) => a.display),
    status: live?.status === 'approved' ? 'scheduled (existing, unchanged)' : 'unscheduled',
    date: live?.date || null,
  });
}
writeFileSync('review/coverage/results.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync(
  'review/coverage/catalog-report.md',
  '# R8 catalog gates\n\nLive dates and approval status are preserved per the final R8 instruction. A scheduled row can still FAIL the new gate: existing approval is not new certification. No failing category may be newly approved. Unknown pageviews are not invented. Countries contains the complete 249 ISO countries and territories rather than fabricated entries to reach 300.\n\n| Category | Entries | Scope | Obvious coverage | Independent matches | Ranking complete | Ready | Status / date | House words |\n|---|---:|---|---|---:|---|---|---|---|\n' +
    report
      .map(
        (r) =>
          `| ${r.slug} | ${r.entries} | ${r.scope || 'Legacy subset; unverified'} | ${r.obvious ? (r.score * 100).toFixed(1) + '% / ' + r.obvious : 'MISSING'} | ${r.independentChecked - r.independentMissing.length}/${r.independentChecked || 50} | ${r.rankingComplete ? 'yes' : 'NO'} | ${r.ready ? 'yes' : 'NO'} | ${r.status}${r.date ? ' / ' + r.date : ''} | ${r.house.join(', ')} |`,
      )
      .join('\n') +
    '\n',
);
console.log(
  report
    .filter((r) => r.obvious)
    .map((r) => ({
      slug: r.slug,
      score: r.score,
      missing: r.missing,
      independentMissing: r.independentMissing.length,
      rankingComplete: r.rankingComplete,
    })),
);
