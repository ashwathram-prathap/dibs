import { readFileSync, writeFileSync, appendFileSync, chmodSync } from 'node:fs';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const baseline = [
  read('review/round7/playwright-local.json'),
  read('review/round7/playwright-firefox.json'),
];
const targeted = [
  read('review/round7/browser-results.json'),
  read('review/round7/browser-firefox.json'),
];
const checks = new Map<string, { project: string; passed: boolean; host: string }>();
function walk(s: any, host: string) {
  for (const spec of s.specs || [])
    for (const test of spec.tests || []) {
      if (test.status === 'skipped') continue;
      checks.set(test.projectName + ':' + spec.file + ':' + spec.title, {
        project: test.projectName,
        passed: test.status === 'expected',
        host,
      });
    }
  for (const child of s.suites || []) walk(child, host);
}
baseline.forEach((r, i) => walk(r, i ? 'Linux CI' : 'macOS'));
targeted.forEach((r, i) => walk(r, i ? 'Linux CI' : 'macOS'));
const units = read('review/round7/unit-results.json');
const practice = read('review/round7/live-practice.json'),
  production = read('review/round7/live-production.json');
const before = read('review/round7/production-before.json'),
  after = read('review/round7/production-after.json');
const preserved =
  JSON.stringify(before.map((r: any) => r.results)) ===
  JSON.stringify(after.map((r: any) => r.results));
const perf = read('review/round7/lighthouse-production/mobile.json');
const practicePerf = read('review/round7/lighthouse-practice/mobile.json');
if (
  [...checks.values()].some((c) => !c.passed) ||
  units.numFailedTests ||
  !preserved ||
  [...practice.checks, ...production.checks].some((c) => !c.passed)
)
  throw Error('R7 evidence is not all green');
const profiles = new Map<string, { passed: number; host: string }>();
for (const c of checks.values()) {
  const p = profiles.get(c.project) || { passed: 0, host: c.host };
  p.passed++;
  profiles.set(c.project, p);
}
const ci = process.argv[2];
const table =
  '| Profile | Pass | Fail | Host |\n| --- | ---: | ---: | --- |\n' +
  [...profiles].map(([p, r]) => `| ${p} | ${r.passed} | 0 | ${r.host} |`).join('\n');
writeFileSync(
  'review/round7/devices.md',
  `# Round 7 browser verification\n\n${checks.size}/${checks.size} distinct checks passed. Full matrix: 434 Chromium/WebKit + 72 Firefox. Targeted R7 checks: 42 local + 7 Firefox. The 28 local/7 Firefox skipped entries repeat timezone cases outside the one dedicated timezone project; all seven timezone/fallback cases execute in Chromium.\n\n[Full Firefox run](https://github.com/ashwathram-prathap/dibs/actions/runs/44976589223). [Final R7 Firefox run](https://github.com/ashwathram-prathap/dibs/actions/runs/${ci}). Mac Firefox remains unable to find its profile even with project-local temporary storage; Linux supplies coverage.\n\n${table}\n\nThese are browser-engine, viewport and user-agent checks. Physical iOS Safari 16, Samsung Internet, branded Edge, native social-app webviews, OS keyboards and native sharing destinations still require owner device smoke checks. Live verification uses read-only requests; no production/practice claims were filed and no player resets were used.\n`,
);
const summary = {
  passed: true,
  unitTests: units.numPassedTests,
  browserChecks: checks.size,
  practiceChecks: practice.checks.length,
  productionChecks: production.checks.length,
  productionDataAndSchedulePreserved: preserved,
  performance: perf.categories.performance.score * 100,
  accessibility: perf.categories.accessibility.score * 100,
  practicePerformance: practicePerf.categories.performance.score * 100,
  practiceAccessibility: practicePerf.categories.accessibility.score * 100,
  firefoxRun: ci,
};
writeFileSync('review/round7/acceptance.json', JSON.stringify(summary, null, 2) + '\n');
const report = `\n\n## Round 7 — local drop clock and the complete Day Certificate\n\n- **Live:** https://dibs.here · API https://dibs-api.dibs-registry.workers.dev (canonical redirect) · practice https://practice.dibs-7hz.pages.dev. Deployed and verified practice first, then production; the final outage/H1 cleanup repeated that sequence.\n- **Done:** local time/weekday labels and ET fallback; dominant closed/completed countdown; compact open-round strip; one hidden-tab-aware server-synced ticker; minute-limited announcements; 18-second unavailable-server rollover/backoff with no reload; certificates persist until tapped; ordered wins/misses and holder details; full Day Certificate story/feed defaults with handle/streak/gold/deep-cut; spoiler-free text/OG square rows; ten golden tickets Nov 23–29, then three. Single-dibs copies remain linked.\n- **Validation:** ${units.numPassedTests} unit/API tests; ${checks.size} distinct browser checks; ${practice.checks.length} live practice and ${production.checks.length} live production checks. Lighthouse Slow 4G mobile: production ${summary.performance} performance / ${summary.accessibility} accessibility; practice ${summary.practicePerformance} / ${summary.practiceAccessibility}. Type checks and fixture/palette bundle audit pass. Firefox runs linked in review/round7/devices.md.\n- **Preservation:** schema-only migration 0008 adds fields for future misses. Production before/after queries match: 3 users, 0 claims, 0 strikes, all existing category dates/statuses/drop times unchanged, no committed golden sets changed. No player records edited/reset and no live claims filed. No new secrets or paid services.\n- **Decisions:** retain existing commitment sets (practice remains three); unrecorded old misses are labelled honestly, never invented. Caption/OG remains spoiler-free even after close; summary links and PNGs contain all available answers. Use the browser’s IANA timezone rules: Vancouver is 7 PM PT for this November drop due to B.C.’s permanent UTC−7 change (https://news.gov.bc.ca/releases/2026AG0013-000209). Timezone is never stored or transmitted.\n- **Screenshots:** review/final/r7-*; requested 390/1440 light/dark states, all three Day Certificate examples, story/feed PNGs, live deployments and OG copies. Visual checklist: review/round7/visual-review.md. Weakest screens: repeated rejection rows in a five-strike file; honest missing details in old files; the long completed-home ledger.\n- **Remaining device limits:** physical phones/OS keyboards/native social webviews and actual OS share targets are not available here; user-agent emulation is not certification. Mac Firefox fails before app load, with Linux CI covering the same suite. No remote Turnstile claim was attempted in R7, preserving player data; local Worker/D1 and browser fixtures cover full filing flows.\n- **First five phone checks:** local next-drop label; input/button above the fold; a certificate stays until Next dibs; a completed file includes every rejection and its holder; Story PNG includes answers while Copy text does not.\n\n### Round 7 device/browser pass table\n\n${table}\n`;
appendFileSync('MORNING_REPORT.md', report);
chmodSync('MORNING_REPORT.md', 0o600);
console.log(JSON.stringify(summary));
