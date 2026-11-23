import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir = 'review/round19d/';
const read = (name: string) => JSON.parse(readFileSync(dir + name, 'utf8'));
const unit = read('unit-results.json');
assert.ok(unit.success && unit.numFailedTests === 0);
const browsers = Object.fromEntries(
  ['browser-results', 'firefox-browser-results', 'visual-browser-results'].map((name) => {
    const { stats } = read(name + '.json');
    assert.ok(stats.expected > 0 && !stats.unexpected && !stats.flaky && !stats.skipped, name);
    return [name, stats];
  }),
);
const completed = read('completed.json');
assert.ok(completed.passed && completed.beforeHardStop);
const deployed = read('deployment.json'),
  rollback = read('rollback.json');
const smoke = read('production-smoke.json');
assert.ok(smoke.passed);
for (const name of [
  'practice-first-visit.json',
  'practice-restored.json',
  'practice-state-after.json',
  'production-state-after.json',
  'export-proof.json',
  'og-proof.json',
  'samsung-theme.json',
])
  assert.ok(read(name).passed, name);
const canvas = read('export-proof.json'),
  og = read('og-proof.json');
const sizes = [
  ...canvas.results.flatMap((r: any) => r.bytes),
  ...og.results.map((r: any) => r.bytes),
];
assert.ok(sizes.every((n) => n < 350000));
const lh = read('lighthouse-practice/mobile.json');
assert.ok(lh.categories.performance.score >= 0.9 && lh.categories.accessibility.score >= 0.95);
const time = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Toronto',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(completed.at));
const summary = {
  passed: true,
  completedAt: completed.at,
  completedET: time + ' ET',
  deadline: 'Mon Nov 23, 2026 7:45 PM ET',
  launch: deployed.launch,
  codeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tag: 'r19d-done',
  sections: {
    golden:
      'Stored totals and base + bonus on payoff, certificates, summaries, copied results, exports and leaderboard; configured headline, single reduced-motion-safe shimmer and existing gold chime; gold frame, rules, labels, curve and accessible mobile marker; callout above Share.',
    footer:
      'Measure rendered text, shrink to a 14 px minimum, then elide the middle only if needed. Actual practice and production URLs fit without elision.',
    answers:
      'Owner answers on feed/story and consented summary/certificate links, with a shared remembered Hide my answers setting. Prepared images alone do not grant public consent. Struck guesses and other players remain excluded.',
    zone: 'Filing date and time use the selected named zone; changing the zone regenerates prepared images. R19F edition dates remain game dates.',
    images: `${sizes.length} image checks in both themes; largest ${Math.max(...sizes)} bytes.`,
    individual:
      'Holder answer headline, stored score with bonus, readable rarity, mini curve and gold variant; non-holder unshared links stay sealed.',
    samsung:
      'Existing first-paint color-scheme and theme-color implementation verified with touch and force-dark; certificate pixels match normal rendering in Paper and Carbon.',
  },
  tests: {
    unit: unit.numPassedTests,
    browsers,
    imageCount: sizes.length,
    maxImageBytes: Math.max(...sizes),
    lighthousePerformance: lh.categories.performance.score * 100,
    lighthouseAccessibility: lh.categories.accessibility.score * 100,
  },
  production: deployed,
  rollback,
  backup: readFileSync('.backups/last-success.txt', 'utf8').trim(),
  deferredFeatures: [],
  ntfyAlertsSent: 0,
  loadTest: {
    status: 'skipped',
    reason:
      'Finished before the R12 7:05 PM ET practice-load window; R12 explicitly permits skipping instead of waiting. The local 200-arrival test passed.',
  },
  limitations: [
    'Browser/device and Samsung Internet checks are emulations, not physical devices.',
    'Native share payloads and activation use API stubs; actual practice downloads and links were exercised.',
    'Production remains closed and has no fabricated test claims; its smoke test is read-only.',
  ],
  verificationNotes: [
    'The final complete matrix supersedes earlier interrupted runs and artifact-directory collisions; each runner now has its own output directory.',
    'The full unit suite runs serially to avoid catalog-decompression contention.',
    'Normal calendar tests use a fixed time outside the separately tested launch freeze.',
    'Gold marker semantics and desktop callout order were corrected after accessibility and screenshot review.',
  ],
};
writeFileSync(dir + 'release-summary.json', JSON.stringify(summary, null, 2));
const deviceRows = Object.entries(browsers)
  .map(([name, stats]: [string, any]) => `| ${name} | ${stats.expected} passed |`)
  .join('\n');
const report = `## R19D — shipped ${time} ET, Mon Nov 23\n\nProduction: https://dibs.here · Practice: https://practice.dibs-7hz.pages.dev. All R19D sections are complete, built on R19E/F. Launch remains **9:00 PM Toronto time**; this round's sole production deadline was **7:45 PM ET**.\n\nGolden tickets now retain stored totals everywhere, with bonus breakdowns, gold accents, the existing chime and one reduced-motion-safe shimmer. The desktop gold callout is above Share and the leaderboard marker has an accessible role. Owner-shared images/links show answers unless Hide my answers is selected; consent persists, while struck guesses and other players' answers remain private. Footer text fits its frame, and filing dates/times use the selected zone and regenerate when that setting changes. Paper/Carbon link previews remember the sharing theme.\n\n**Verification:** ${unit.numPassedTests} unit/API tests; ${Object.values(browsers).reduce((n: number, s: any) => n + s.expected, 0)} browser checks; ${sizes.length} image checks, all under 350 KB (maximum ${Math.max(...sizes)} bytes). Lighthouse mobile: **${lh.categories.performance.score * 100} performance / ${lh.categories.accessibility.score * 100} accessibility**. Practice closed→live, actual printed links, owner consent and restoration passed. Production read-only smoke passed. Samsung force-dark certificate pixels match normal rendering in both themes.\n\n| Browser verification | Result |\n|---|---|\n${deviceRows}\n\nThe local matrix covers iPhone SE/15 Pro/15 Pro Max, Pixel 7, Galaxy S9+, iPads, 320–2560 px, landscape, Samsung/Edge user agents and Instagram/TikTok/X webviews. Firefox runs on Linux CI. These are emulations, not physical-device tests.\n\n**Rollback:** Pages \`${rollback.pages}\`; Worker \`${rollback.workerVersion}\`. Released Pages \`${deployed.pages}\`; Worker \`${deployed.workerVersion}\`. Backup: ${summary.backup}. Full IDs and evidence: \`review/round19d/release-summary.json\`.\n\n**Decisions:** Keep R19F game-edition dates; add the correct selected-zone filing date explicitly. Preserve complete normal printed URLs, truncating only pathological strings after the readable minimum. No scoring or catalog changes. No new secrets or ntfy alerts. The post-7:05 PM practice load test was skipped as R12 permits; no features were deferred.\n\n**Review:** Before/after images are in \`review/round19d/\`; golden permutations and export sizes in \`review/round19d/golden/\`. Phone checks: golden 160-point breakdown; gold line above Share; Hide my answers across summary/certificate; changed filing timezone; Paper/Carbon toggle. The densest views remain the seven-event OG card, a long rarity sentence on a small phone, and the full desktop results page.\n\n---\n\n`;
writeFileSync('MORNING_REPORT.md', report + readFileSync('MORNING_REPORT.md', 'utf8'));
console.log({
  passed: true,
  completedET: summary.completedET,
  unit: summary.tests.unit,
  images: sizes.length,
});
