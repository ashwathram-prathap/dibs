import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'review/round18/';
const read = (p: string) => JSON.parse(readFileSync(dir + p, 'utf8'));
const smoke = read('production-smoke.json'),
  gates = read('release-gates.json'),
  crawlers = read('crawlers/results.json'),
  keep = read('production-preservation.json');
assert.ok(
  smoke.passed &&
    gates.passed &&
    crawlers.passed &&
    keep.existingPlayerRowsUnchanged &&
    keep.scheduleUnchanged,
);
const rollback = read('rollback.json'),
  deployed = read('deployment.json'),
  lh = gates.mobileLighthouse;
const devices: Record<string, { passed: number; failed: number; skipped: number }> = {};
function collect(suite: any) {
  for (const spec of suite.specs || [])
    for (const test of spec.tests || []) {
      const name = test.projectName.replace(/-(light|dark)$/, '');
      const row = (devices[name] ||= { passed: 0, failed: 0, skipped: 0 });
      row[
        test.status === 'expected' ? 'passed' : test.status === 'skipped' ? 'skipped' : 'failed'
      ]++;
    }
  for (const child of suite.suites || []) collect(child);
}
collect(read('regression-results.json'));
collect(read('firefox-ci/firefox-regression-results.json'));
const deviceTable =
  '| Device / browser profile | Result |\n| --- | --- |\n' +
  Object.entries(devices)
    .map(
      ([name, result]) =>
        `| ${name} | ${result.failed ? 'FAIL' : 'PASS'} — ${result.passed} passed, ${result.failed} failed |`,
    )
    .join('\n');
writeFileSync(dir + 'device-results.json', JSON.stringify(devices, null, 2));
const report = `# R18 release report

Shipped to https://dibs.here on ${deployed.recordedAt}, before the Nov 23, 3 PM ET cutoff. Opening remains **Monday, November 23 at 9:00 PM ET**. Tag: \`r18-done\`. No production test claims or feedback were submitted. No ntfy alert was sent.

## Shipped

- Vertical Settings; phone bottom sheet with sticky Close and safe areas; one backup explanation; signed-cookie own-code read, Copy, Restore, and separated deletion.
- Native feedback modal / phone sheet, focus trap and Escape, readable full-width fields, helper text, success and error states.
- Footer brand row plus a single four-link group / phone 2×2 grid. Matching reminder rows.
- Warm textured carbon and paper; single frames; simpler labels; Archivo, Instrument Sans and restricted IBM Plex Mono throughout CSS, canvas and OG images. \`BRAND.md\` records the system. The R7 clock uses the original font file, weight and proportions, crisp edges, tabular digits and positive gaps.
- Share is primary and Copy result secondary, only on results/certificates.
- Home WebSite/VideoGame structured data, public IndexNow key and nonblocking deploy/archive notifications; unique archive metadata; sitemap/robots remain valid 200 responses when the internal archive API fails.

## Verification

| Check | Result |
| --- | --- |
| Unit/API | ${gates.counts.unit} passed |
| Requested-width Chromium/WebKit layout suite | ${gates.counts.browser} passed |
| Full local device regression | ${gates.counts.regression} passed |
| Firefox on Linux | ${gates.counts.firefox} passed ([CI run](${gates.firefoxRun})) |
| Fresh practice closed → live | 6 browsers passed; displayed-code recovery passed |
| Final practice UI | Chromium/WebKit × 390/1440 × both themes passed |
| Slow-4G mobile Lighthouse | Performance ${lh.performance}, accessibility ${lh.accessibility}, best practices ${lh['best-practices']} |
| Production smoke | 8 Chromium/WebKit × phone/desktop × theme checks passed; no console errors |
| Preservation | Existing player rows and schedule unchanged |
| Build, TypeScript, font roles, emoji audit | Passed |

${deviceTable}

Device profiles include iPhone SE / 15 Pro / 15 Pro Max, Pixel 7, Galaxy S9+, iPad Mini / Pro landscape, Chromium/WebKit desktop 1280/1440/2560, narrow/landscape phones, and in-app user-agent approximations. These are engine/device emulations, not physical-device certification. Practice is deliberately noindex, explaining its Lighthouse SEO score of 66.

## Crawler output

${crawlers.results.map((r: any) => `- ${r.bot} \`/${r.endpoint}\`: **${r.status}**, \`${r.contentType}\`, ${r.redirects} redirects, valid response, no challenge. [Headers](crawlers/${r.bot}-${r.endpoint.replace('.', '-')}.headers.txt) · [Body](crawlers/${r.bot}-${r.endpoint.replace('.', '-')}.body.txt)`).join('\n')}

XML was parsed, all lastmod values were checked as W3C dates, and both bot agents fetched both endpoints. These user-agent checks do not establish Cloudflare's verified-bot classification. The historical Search Console error cannot be conclusively explained without its crawl logs; the demonstrated archive-API failure path is fixed.

## Rollback and deployment

| | Pages deployment | Worker version |
| --- | --- | --- |
| Rollback | \`${rollback.pages}\` | \`${rollback.workerVersion}\` |
| Released | \`${deployed.pages}\` | \`${deployed.workerVersion}\` |

\`npx tsx scripts/r18-smoke.ts --rollback-now\` restores those recorded versions. Production was backed up before deployment. No migration or schedule change was required. The first attempt was immediately rolled back after smoke found that the static home bypassed middleware-generated JSON-LD. The corrected build embeds it in the static HTML; refreshed tests and the final production smoke passed. [First-attempt rollback evidence](attempt-1/rollback-result.json).

## Owner checks and limits

**Cloudflare security-setting verification is blocked:** the available token can read the zone but returns 403 for Bot Management, WAF and security settings; the connected dashboard browser was unavailable. No settings were changed. See [the exact dashboard paths and bot exclusions](DECISIONS.md#cloudflare-setting-audit-owner-verification-required). After checking them, resubmit the sitemap in Search Console / Bing if needed.

The optional expanded-catalog glyph audit found pre-existing non-Latin coverage gaps; all four relevant fonts are byte-identical to R17. No catalog data was altered. The new remote 200-player load run was skipped because its permitted 7:05 PM ET start is after this release's 3 PM cutoff. Local concurrency/load tests passed. [Decisions and details](DECISIONS.md).

## Visual evidence

Open [the visual review index](index.html): requested Settings/feedback/footer widths in both themes, scrolled Settings, before/after play/done/certificates, R7 clock comparisons and export samples. Every route has final screenshots at 390/1440 in \`review/final/round18/\`. Raw images and verbose test/Lighthouse reports remain local to avoid bloating the repository.

The three weakest remaining screens are the long Office/legal page, the long expanded phone day certificate, and the deliberately sparse empty archive. They passed layout checks; no invented records were added to fill the archive.

First phone checks: open and scroll Backup code; open/close Send feedback with the keyboard; check the 9 PM ET countdown and reminder rows; switch paper/carbon; after opening, claim and try native Share / Copy result.
`;
writeFileSync(dir + 'REPORT.md', report);
const note = `<!-- R18 -->\n# R18 shipped — Nov 23\n\nLive: https://dibs.here. Settings, feedback, footer, carbon/type system, R7 clock and SEO fixes shipped before 3 PM ET. Opening stays Monday 9 PM ET. ${gates.counts.unit} unit/API, ${gates.counts.browser + gates.counts.regression + gates.counts.firefox} browser checks, six fresh practice claims and eight production smoke checks passed. Mobile Lighthouse ${lh.performance} performance / ${lh.accessibility} accessibility. Existing player rows and schedule preserved; real practice keys, notifications and schedule restored. No ntfy alert.\n\nOwner action: verify Cloudflare Bot/WAF settings; read access returned 403. Details, rollback IDs, screenshots, physical-device limits, existing catalog glyph gaps and skipped late load-test explanation: [R18 report](review/round18/REPORT.md). Tag: r18-done.\n\nDevice/browser results (emulated profiles, both themes where applicable):\n\n${deviceTable}\n\nRollback Pages: ${rollback.pages}; Worker: ${rollback.workerVersion}.\n<!-- /R18 -->\n\n`;
const old = existsSync('MORNING_REPORT.md') ? readFileSync('MORNING_REPORT.md', 'utf8') : '';
writeFileSync(
  'MORNING_REPORT.md',
  note + old.replace(/^<!-- R18 -->[\s\S]*?<!-- \/R18 -->\s*/, ''),
);
console.log(
  'Wrote R18 report and prepended the private morning note; existing report content preserved.',
);
