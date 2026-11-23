import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'review/round19/';
const read = (p: string) => JSON.parse(readFileSync(dir + p, 'utf8'));
const gates = read('release-gates.json'),
  smoke = read('production-smoke.json'),
  keep = read('production-preservation.json');
assert.ok(
  gates.passed &&
    smoke.passed &&
    keep.existingPlayerRowsUnchangedExceptAccidentalNameSuffix &&
    keep.scheduleUnchanged,
);
const rollback = read('rollback.json'),
  deployed = read('deployment.json'),
  migration = read('production-handle-migration.json');
const before = read('claim-timing-before.json'),
  after = read('claim-timing-after.json');
const median = (numbers: number[]) => {
  const n = numbers.slice().sort((a, b) => a - b);
  return (n[Math.floor((n.length - 1) / 2)] + n[Math.ceil((n.length - 1) / 2)]) / 2;
};
const timing = (rows: any[], engine: string, first: boolean) => {
  const n = rows
    .filter((r) => r.browser === engine)
    .flatMap((r) => (first ? [r.tapToStampMs[0]] : r.tapToStampMs.slice(1)));
  return `${(median(n) / 1000).toFixed(2)} s (${(Math.min(...n) / 1000).toFixed(2)}–${(Math.max(...n) / 1000).toFixed(2)})`;
};
const timingTable =
  '| Browser | R18 first | R19 first | R18 later | R19 later |\n| --- | --- | --- | --- | --- |\n' +
  ['chromium', 'webkit']
    .map(
      (e) =>
        `| ${e} | ${timing(before, e, true)} | ${timing(after, e, true)} | ${timing(before, e, false)} | ${timing(after, e, false)} |`,
    )
    .join('\n');
const devices: Record<string, { passed: number; failed: number }> = {};
function collect(suite: any) {
  for (const s of suite.specs || [])
    for (const t of s.tests || []) {
      const r = (devices[t.projectName] ||= { passed: 0, failed: 0 });
      r[t.status === 'expected' ? 'passed' : 'failed']++;
    }
  for (const s of suite.suites || []) collect(s);
}
collect(read('device-results.json'));
collect(read('firefox-ci/firefox-device-results.json'));
const deviceTable =
  '| Emulated device / engine | Result |\n| --- | --- |\n' +
  Object.entries(devices)
    .map(([name, r]) => `| ${name} | ${r.failed ? 'FAIL' : 'PASS'} — ${r.passed} checks |`)
    .join('\n');
const lh = read('lighthouse-production/summary.json').find((r: any) => r.strategy === 'mobile');
const beforeSettings = read('settings/before.json');
const failures = beforeSettings.filter(
  (r: any) => r.violations.length || r.documentOverflow,
).length;
const totals = gates.counts;
const report = `# R19 release report

Shipped to **https://dibs.here** at ${deployed.recordedAt}, before the November 23 **3 PM ET cutoff**. API: https://dibs-api.dibs-registry.workers.dev. Practice: https://practice.dibs-7hz.pages.dev. Opening remains **Monday, November 23 at 9 PM ET** (2026-11-24T02:00:00.000Z). Tag: \`r19-done\`.

## What shipped

- System is the default theme, with live system/visibility updates, explicit Paper/Carbon choices, matching status-bar colours and the prepaint script. Exports use the resolved theme. Reduced motion, stronger contrast, forced colours, rem typography and enlarged layouts are covered.
- Plain generated names from more than 10,000 combinations; old eight-hex suffixes removed on reads and in storage. Visible clashes receive stable short decimal numbers. Founder and withdrawn labels are preserved. Production migration: ${migration.result.map((r: any) => `${r.table}: ${r.changed} changed / ${r.read} inspected`).join('; ')}.
- Restrained tally streak chip, milestone rings, one first-claim press animation, payoff reminder and certificate streak labels.
- Ideal normal rarity curves with inverse-CDF markers, honest familiar/deep-cut wording and matching certificate/share text. Desktop payoff has two columns and a small board; phones have one frame, quiet links, a reminder sheet, clear counters and named time zones.
- Verification prewarming, a low-priority loader fetch, reusable in-memory tokens, renewal while visible and a verified 30-minute player-bound HMAC proof. Later claims reuse the proof. A Safari focus/keyboard-dismissal race discovered during testing is fixed.
- Day Certificates and their exports contain no curves. Share/Copy stay visible in a safe-area-aware sticky bar above phone tabs, with matching page padding; desktop actions sit below the certificate. The supporting website curve compares real finished-player totals, counts ties as half, hides below ten finishers, updates live and freezes in the archive.
- Stamp-first how-to examples, fit-aware nonbreaking final pairs in React and canvas, and native wrapping as an enhancement. Office display type was tightened after final visual review.
- Durable feedback caps: 300/day globally, 20/day per IP hash, three/hour per player. Control/zero-width characters and whitespace are normalized; link-only or excessive-link notes are rejected. Admin feedback is inert plain text labelled untrusted. No feedback automation was added.
- Backup codes wrap fully; restore/delete fields are multiline and fit their panel. Flex/grid children and large-text controls reflow without hiding overflow.

## Verification

| Check | Result |
| --- | --- |
| Unit / API | ${totals.unit} passed |
| R19 Chromium/WebKit matrix | ${totals.browser} passed, 320–1440px, both themes |
| Existing active regression suite | ${totals.regression} passed |
| Local full device flows | ${totals.devices} passed |
| Final export regression | ${read('export-regression-results.json').stats.expected} passed |
| Linux Firefox | ${totals.firefox} passed; [CI](${gates.firefoxRun}) |
| No-orphan audit | ${totals.textCases} screen/theme/width/engine cases; ${totals.textBlocks} blocks; zero failures or overflow |
| Expanded Settings | ${totals.settings} cases at 130%/200%; every descendant fits |
| Supplemental checks | 36 sets: streak states, stamp examples, 200% desktop zoom-equivalent viewports |
| Practice closed → live | Six fresh Chromium/WebKit browsers claimed; displayed-code recovery passed |
| Production read-only smoke | Eight phone/desktop/theme/engine checks; no console errors |
| Production Slow-4G Lighthouse | ${lh.scores.performance} performance / ${lh.scores.accessibility} accessibility / ${lh.scores['best-practices']} best practices / ${lh.scores.seo} SEO |
| Build / TypeScript | Passed; production fixture exclusion and structured data verified |
| Preservation | Existing player rows unchanged except requested name cleanup; schedule unchanged |

${deviceTable}

Device profiles include the required iPhones, Pixel, small Galaxy, iPads, desktop widths through 2560px, Samsung Internet and Edge user agents, landscape phones and in-app approximations. These are engine/device emulations, not physical-device or installed-app certification. Standalone behaviour is emulated; operating-system text scaling is represented by root font scaling and desktop zoom-equivalent CSS viewports. Local Firefox could not launch its profile after three approaches, so the complete Firefox checks ran on Linux CI. The retired R7 specification test remains excluded by the established regression configuration; current replacement suites run.

The first broad unit run hit three catalog-processing timeouts while browser jobs were active. All tests then passed with one worker and unchanged assertions/time limits. The final R19 matrix has no retries/flaky passes. Main-screen text audits found no unavoidable multiword exceptions; inherently one-word labels are not sentences.

## Claim timing

Median tap-to-stamp, with sample range in parentheses. Three fresh sessions per browser and version; one first and two later claims per session. Both versions use the same real practice backend and official Cloudflare test keys. Each session performed exactly one verification and three proof-bearing claims.

${timingTable}

Chromium meets the first-claim target. WebKit improves substantially but its 1.86-second median (1.84–2.38 seconds) at exactly three seconds of dwell remains above the approximate 1.5-second target. Both browsers meet the later-claim target. WebKit lacks requestIdleCallback, so it uses the requested 1.5-second fallback before executing the third-party check. The loader is fetched earlier to reduce that delay; the remaining first-claim miss is documented rather than hidden by a longer dwell time.

The harness applies 150 ms RTT plus 1.6 Mbps encoded-response transfer delay and 75 ms each way for WebSocket messages, with no CPU slowdown. It waits exactly three seconds after the answer field appears. This is a reproducible transport simulation in both engines, not physical mobile-network measurement. Raw samples: [before](claim-timing-before.json), [after](claim-timing-after.json). Intermittent network failures interrupted two later rehearsal attempts; the completed R18 baseline was retained because its source and transport were unchanged, and the final R19 run completed separately. Practice cleanup, real keys, notifications and every schedule row were verified restored.

Cloudflare widget mode was **not changed**. Exact path: **Cloudflare dashboard → account → Turnstile → existing Dibs widget → Settings → Widget mode**. Managed mode may require interaction based on risk; Non-interactive and Invisible still perform background verification and do not guarantee a fixed latency. [Cloudflare dashboard instructions](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/) and [widget behaviour](https://developers.cloudflare.com/turnstile/concepts/widget/). Prewarming and proof reuse remove repeated work regardless of mode.

## Settings cause and before/after proof

The real backup string made the restore and deletion **single-line inputs scroll internally**, even when the outer document fit. On the reproduced MacBook-sized Chromium case each input had scrollWidth 269px versus clientWidth 264px. ${failures} of ${beforeSettings.length} before cases failed. Real codes, open disclosures, Samsung-size viewports and desktop sizes were used. After the fix all ${totals.settings} three-engine cases passed at 130%/200%, including 1470/1440 desktops and 360/384/412 Samsung sizes. The fix uses wrapping textareas, a full-width code block with Copy below, minimum-width resets and reflow; overflow hiding alone is not used. [Before](settings/before.json), [after](settings/after.json), Firefox evidence in the CI artifact.

## Release, rollback and constraints

| Version | Pages deployment | Worker version |
| --- | --- | --- |
| Rollback | \`${rollback.pages}\` | \`${rollback.workerVersion}\` |
| Released | \`${deployed.pages}\` | \`${deployed.workerVersion}\` |

Production was backed up before deployment. \`npx tsx scripts/r19-smoke.ts --rollback-now\` restores the recorded application versions. The idempotent name cleanup intentionally remains in data; the private backup preserves its previous values. No production test player, claim or feedback was created. R11 gates were not modified; this uses the explicitly authorized R12 §5 release route with additional R19 evidence/cutoff gates. No paid plans or public announcements. **Zero ntfy alerts sent.** No new secrets were created; existing secret values remain only in ignored files and Cloudflare.

The optional 200-player practice load test was skipped: its allowed 7:05 PM ET start is after this release's 3 PM cutoff. Local concurrency/API tests and the smaller remote rehearsal passed. Account write headroom was checked before each rehearsal.

## Design evidence and owner checks

[Visual index](index.html). Final every-route light/dark screenshots at 390/1440 are in \`review/final/round19/\`; payoff at 390/768/1440/1920, phone payoff at the five requested sizes and 1.0/1.3 scale, streaks, Settings, theme states, Day/claim exports and OG proof are in \`review/round19/\`. Full-size images and verbose runner artifacts stay local; compact evidence is committed.

The sticky Share bar was chosen to keep large, readable certificate text while guaranteeing visible actions at 130% text. Mobile navigation uses shorter visible labels with full accessible names. Feedback day limits use UTC; per-player limits use a rolling hour.

The three weakest remaining screens are the long Office/privacy page, the tall phone Day Certificate (its actions remain fixed and visible), and the intentionally sparse empty archive. No invented records were added.

First five phone checks:
1. Return Theme to System, switch the device theme, and repeat from the home-screen app.
2. Expand Backup code and Delete my data with large text; scroll vertically and confirm every code character is visible.
3. After opening, type and claim; check the compact payoff, named close time and Remind me sheet.
4. Finish a day; confirm Share and Copy remain visible above the tabs, then try native share and fallback.
5. Check the streak, clean player name, and live finished-player comparison after ten people finish.
`;
writeFileSync(dir + 'REPORT.md', report);
const note = `<!-- R19 -->\n# R19 shipped — November 23\n\nLive: https://dibs.here · API: https://dibs-api.dibs-registry.workers.dev. System theme, clean names, streak chip, payoff/score curves, verification prewarming, phone Share, text wrapping, feedback limits and Settings overflow fixes shipped before 3 PM ET. Opening remains Monday 9 PM ET. ${totals.unit} unit/API tests, ${totals.browser + totals.regression + totals.devices + totals.firefox} browser/device checks, ${totals.textCases} text cases, ${totals.settings} Settings cases and eight production smoke checks passed. Lighthouse mobile ${lh.scores.performance}/${lh.scores.accessibility} performance/accessibility. Practice real keys, notifications and schedule restored. No new secrets; no ntfy alert.\n\n${timingTable}\n\nWebKit first claims at exactly three seconds of dwell remain above the approximate 1.5-second target; later claims meet the target in both engines.\n\n[Full R19 report](review/round19/REPORT.md): device table, timing method/limits, Settings cause, screenshots, decisions, five phone checks and three weakest screens. Physical-device checks remain for the owner; the optional late 200-player load test was skipped.\n\nRollback Pages: ${rollback.pages}; Worker: ${rollback.workerVersion}. Tag: r19-done.\n<!-- /R19 -->\n\n`;
const old = existsSync('MORNING_REPORT.md') ? readFileSync('MORNING_REPORT.md', 'utf8') : '';
writeFileSync(
  'MORNING_REPORT.md',
  note + old.replace(/^<!-- R19 -->[\s\S]*?<!-- \/R19 -->\s*/, ''),
);
console.log('Wrote R19 report and prepended the private morning note.');
