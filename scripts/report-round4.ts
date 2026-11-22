import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
const local = JSON.parse(readFileSync('review/round4/playwright-local.json', 'utf8'));
const firefox = JSON.parse(readFileSync('review/round4/playwright-firefox.json', 'utf8'));
const recheck = JSON.parse(readFileSync('review/round4/playwright-recheck.json', 'utf8'));
if (recheck.stats.expected !== 3 || recheck.stats.unexpected)
  throw Error('Landscape recheck incomplete');
const cases = new Map<string, { project: string; passed: boolean; host: string }>();
function walk(s: any, host: string) {
  for (const spec of s.specs || [])
    for (const t of spec.tests || []) {
      cases.set(t.projectName + ':' + spec.file + ':' + spec.title, {
        project: t.projectName,
        passed: t.status === 'expected',
        host,
      });
    }
  for (const sub of s.suites || []) walk(sub, host);
}
walk(local, 'macOS');
walk(firefox, 'Ubuntu CI');
walk(recheck, 'macOS');
const projects = new Map<string, { passed: number; failed: number; host: string }>();
for (const result of cases.values()) {
  const p = projects.get(result.project) || { passed: 0, failed: 0, host: result.host };
  if (result.passed) p.passed++;
  else p.failed++;
  projects.set(result.project, p);
}
const passed = [...projects.values()].reduce((n, p) => n + p.passed, 0);
const failed = [...projects.values()].reduce((n, p) => n + p.failed, 0);
if (failed || passed !== 462)
  throw Error(`Incomplete browser verification: ${passed} passed / ${failed} failed`);
let md =
  '# Round 4 browser verification\n\nEngine/device and user-agent emulation; native share APIs are stubbed to exercise file, text, cancellation and blocked-sheet behavior. Intent destinations are intercepted locally; tests do not post to social platforms.\n\n| Configuration | Passed | Failed | Host |\n| --- | ---: | ---: | --- |\n';
for (const [name, p] of projects) md += `| ${name} | ${p.passed} | ${p.failed} | ${p.host} |\n`;
md +=
  '\nAll 462 distinct checks passed after a targeted rerun. The first local matrix had 395 passes and one landscape failure when an index.html edit triggered Vite reload and reset its fixture to zero dibs. Three isolated repeats passed after edits stopped; raw original and recheck JSON are retained. Firefox cannot launch on this Mac (default and project-local profiles both fail before app load); the existing Ubuntu workflow supplies Firefox coverage. Physical Safari 16, Samsung Internet, branded Edge, real Instagram/TikTok/X native webviews and OS share targets still require a phone check; user-agent emulation does not prove OS integration.\n';
writeFileSync('review/round4/devices.md', md);
writeFileSync(
  'review/round4/browser-summary.json',
  JSON.stringify(
    {
      passed,
      failed,
      projects: Object.fromEntries(projects),
      firefoxRun: 'https://github.com/ashwathram-prathap/dibs/actions/runs/44968953895',
    },
    null,
    2,
  ),
);
const lh = JSON.parse(readFileSync('review/lighthouse/mobile.json', 'utf8'));
const perf = lh.categories.performance.score * 100,
  access = lh.categories.accessibility.score * 100;
const previews = JSON.parse(readFileSync('review/round4/preview-fetches.json', 'utf8'));
const live = JSON.parse(readFileSync('review/round4/live-fetches.json', 'utf8')).filter(
  (x: any) => x.scope,
);
const range = (rows: any[]) =>
  `${Math.min(...rows.map((r: any) => r.milliseconds))}–${Math.max(...rows.map((r: any) => r.milliseconds))} ms`;
writeFileSync(
  'review/round4/ACCEPTANCE.md',
  `# Round 4 acceptance\n
- SHARE uses a pre-rendered story PNG plus text/URL. Unsupported files use a text-only native sheet and offer PNG export. Cancellation is retained; rejected sharing falls back to download.
- Both summaries and certificates expose X, WhatsApp, Facebook, Instagram/TikTok story, Copy link, Copy text, Story PNG and Feed PNG. Caption/link clipboard failures expose selectable text. Download failures keep an inline PNG and an open-image link for long-press saving.
- PNGs: 1080×1920 story, 1080×1350 feed. Pixel checks confirm blank story margins at top 160 and bottom 260. Self-hosted fonts and public Pages address; no local origin. See export-checks.json.
- Permanent summary URLs work for 3-dibs and 5-strike/zero-dibs files, including reloads. Public summaries omit voided claims. Moderation invalidates preview caches. The countdown is recomputed outside the cached result.
- Per-record Open Graph and Twitter images: 1200×630, summary_large_image, versioned URLs, permanent spoiler-free titles/descriptions and score-only preview imagery. The manually saved PNGs intentionally include the player's answers. The 30-day/eight-shard Round 2 budget still applies.
- Local real workerd fetch tests for WhatsApp, X, Facebook, iMessage and Discord: ${range(previews)}, at most ${Math.max(...previews.map((r: any) => r.bytes))} bytes. Cached responses have identical bytes; no D1 writes on repeat.
- Live generic card: ${range(live)}, ${live[0].bytes} bytes. Live certificate and summary misses return 404. A real per-record production measurement is BLOCKED until the first genuine game: today is closed, archive is empty, and ledger has no records. No production fixtures were inserted. Rerun the crawler fetch on the first genuine certificate and summary.
- Platform taps and first attributed arrivals contain only an allowlisted platform. One aggregate counter update per event; zero D1 writes. Live stats exposes all nine counters with actual zero totals. No test events were submitted to production.
- ${passed} distinct Playwright checks passed (including the targeted rerun documented in devices.md), across ${projects.size} configurations; 35 unit/Worker checks; TypeScript and production build passed. Lighthouse Slow 4G mobile: ${perf} performance / ${access} accessibility. Production assets contain no development fixtures.
- Final visual review: light/dark at 390 and 1440; ruled panels, ink palette, deliberate form labels, no gradients, pills, decorative icons, stock art or generic hero. Corrected the narrow stats column and aligned the day-summary share sheet. Contact sheets and full-size PNGs are saved.

## Decisions and limitations

Canonical address remains https://dibs-7hz.pages.dev under OVERNIGHT.md. No custom domain changes. Preview spoilers stay hidden even after category close so each cached image can stay immutable. First attributed arrival uses a local boolean, never a visitor ID; blocked storage permits only per-page deduplication. Native share counts record the sheet, since the OS does not expose the selected app. Instagram/TikTok is a combined export target, not a claimed direct-post integration.

No social posting, third-party widgets/tracking scripts, paid services or fabricated player counts. Physical-device integration remains a manual check. The conservative 10,000-visitor scenario exceeds free DO limits after attribution; see free-tier.md. No database migrations or new secrets were needed.

## Review artifacts

Screenshots and exports: ../final/ (share-sheet, public-summary, stats-platforms, certificate-story/feed, day-summary-story/feed, and OG PNGs). Full device flows: ../devices/. Firefox screenshots: CI artifact. Three weakest screens remain the empty archive, sparse prelaunch stats, and text-heavy office notice; none shows a detected layout defect.
`,
);
const existing = readFileSync('MORNING_REPORT.md', 'utf8').split('\n## Round 4\n')[0];
const section = `
## Round 4

Deployed to https://dibs-7hz.pages.dev and https://dibs-api.dibs-registry.workers.dev. Sharing, both image formats, permanent summary links, spoiler-free cached cards, anonymous platform taps/arrivals and the stats breakdown are complete. No new secrets, migrations, payments, social posts or production test events.

Checks: **462 distinct Playwright checks passed** (one dev-reload interruption passed three isolated reruns), **35/35 unit/Worker**, build/type checks and production fixture audit passed. Lighthouse Slow 4G: **${perf} performance / ${access} accessibility**. Local per-result previews: ${range(previews)}, under 300 KB; live generic card: ${range(live)}, ${live[0].bytes} bytes. Full acceptance and decisions: review/round4/ACCEPTANCE.md. Screenshots and both PNG formats: review/final/; compact visual sheets: review/round4/contact-sheet-*.png.

| Device/browser group | Result |
| --- | --- |
| iPhone SE / 15 Pro / Pro Max, iPad Mini / Pro landscape, light + dark | PASS (WebKit emulation) |
| Pixel 7 / Galaxy S9+, light + dark | PASS (Chromium emulation) |
| Desktop Chromium / WebKit, 1280 / 1440 / 2560, light + dark | PASS |
| Desktop Firefox, 1280 / 1440 / 2560, light + dark | PASS (Ubuntu CI; Mac launch blocked) |
| 320px and landscape phone, light + dark | PASS |
| Instagram / TikTok / X user agents, iPhone + Android | PASS |

Full per-profile counts: review/round4/devices.md. Physical native sheets/webviews/keyboards are not proven by emulation. Live per-record crawler checks remain blocked until a genuine game exists (today closed, archive and ledger empty); repeat using the first genuine certificate/summary. Do not create fake production claims to test previews.

Decisions: retained Pages address; preview answers stay hidden permanently; native means system sheet, not inferred app; first arrival uses a boolean local flag with per-page fallback. The 30-day bounded OG cache is unchanged. The conservative 10,000-visitor scenario now exceeds free DO limits: review/round4/free-tier.md. No plan was upgraded.

Five phone checks: (1) finish a real day and SHARE, (2) cancel/reopen the native sheet, (3) export Instagram/TikTok story and check safe areas, (4) open from each in-app browser and long-press its fallback PNG, (5) paste the genuine summary/certificate links into private drafts to inspect previews without posting. Weakest visuals: empty archive, sparse prelaunch stats, text-heavy office notice.
`;
writeFileSync('MORNING_REPORT.md', existing + section, { mode: 0o600 });
chmodSync('MORNING_REPORT.md', 0o600);
console.log(`Round 4 report written; ${passed} browser checks and ${perf}/${access} Lighthouse.`);
