# R19C verification

`release-gates.json` records the final result. Production release is blocked unless every gate passes and it is before November 23, 2026, 3 PM ET. Production stays closed until 9 PM ET.

| Requirement | Implementation and evidence |
| --- | --- |
| 1–4, 12: Settings and swatches | Shared SelectControl, short timezone faces, one chevron position, equal computed control geometry, opaque modal sheet/popover, sticky header and page scroll lock. Settings swatches match the selected Paper/Carbon/System target; the header swatch shows the next theme. Matrix: settings-closed/open/scrolled. |
| 5: Requested screenshots | Matrix includes 360×780, 390×844 and 1470×956 in both themes; raw images and screen contact sheets under matrix/. |
| 6: Shared invitations | Spoiler-safe summary/certificate invitation, primary Play, returning-player result, closed answers and Play now. Browser, standalone, Instagram and LinkedIn emulation in every matrix configuration. |
| 7: Final payoff | All three claims and fifth strike require an explicit results action; third gold, reload, screen-reader focus and reduced-motion checks. |
| 8: Certificate consistency and data | Five certificate variants; equal curve height, points for missing readings, separate marker label and clipped vermilion tail. popularity-coverage.json records all 33 catalog categories; common-iguana-source.json identifies the retained measured article. Original v1 score assets remain available for rollback. |
| 9: Share controls | Equal computed font/weight/height/borders and row widths. Desktop 2×2, phone primary plus responsive secondary row. |
| 10: Streaks | SVG stroke-count assertions for 0–5 and 8; baseline headers appear in the Settings screenshots. |
| 11: Full coverage | 15 physical viewport sizes × 2 themes × 2 text scales × 2 zoom levels × Chromium/WebKit/Firefox. Zoom uses a halved CSS viewport and doubled device scale. Every layout audit checks horizontal overflow, clipped and overlapping visible text, control target size, and phone primary-action position; console errors fail tests. |
| 13: Feedback | Shared select/textarea geometry, inline required and length errors, focus and ARIA attributes, live count, sending state and replacement success view. |
| 14: Feedback archive | Five unit tests cover authentication, privacy, exact-ID deletion with a later arrival, write/re-read/permissions failure safety, CSV formula safety and dry run. Browser tests cover confirmation, both downloads, exact deletion and inert player text. Practice CLI dry-run proof is archive-practice-dry-run.json; private exports stay ignored. |

The matrix has 1,440 Chromium/WebKit tests and 720 Firefox CI tests. The broader current regression suite has 416 tests; its inherited R7 legacy fixture suite remains excluded as in R19. The unit/API suite has 230 tests. See final JSON summaries for actual pass counts.

Practice rehearsal uses six fresh browsers, official test verification, suppressed rehearsal notifications, and then restores real verification, notifications and every modified schedule. The final read-only production smoke checks the closed state, launch date, reminders, theme, settings, feedback, metadata, previews and console errors. Rollback IDs are recorded before any production change.

The R12 evening load test is intentionally skipped: its earliest permitted time (7:05 PM ET) is after R19C's 3 PM deployment cutoff. R12 explicitly permits this skip. No R11 gate is changed and no notification is sent by this round's release driver.

Certificate screenshots isolate the complete certificate and temporarily hide external page chrome during capture; all layout and interaction assertions run with the normal chrome. Share screenshots isolate the grid and its hint. The other screen captures retain the full viewport.

The full R19C runner retains explicit screen captures and failure screenshots/error contexts. Playwright traces are opt-in with R19C_TRACE=1: parallel custom-context teardown produced ZIP stream-length errors in tracing, independently of page assertions. The regression runner still retains failure traces. No assertion is skipped for this instrumentation workaround.

The OVERNIGHT final visual pass reuses the same six release tests at 390px and 1440px, in both themes and both local engines (48 additional assertions suites). Its complete screen captures are in `review/final/round19c/`; these remain local alongside the raw matrix, while contact sheets and compact release evidence are committed.

Direct computed-colour assertions verify AA contrast for every share control, invitation Play, claim/result action and the inline feedback error in both themes; they account for transparent controls inheriting the paper behind them. Settings checks deliberately hold the lazy leaderboard module so the loading layout is covered too. `practice-score-assets.json` verifies all 66 v1/v2 scoring files against the local build, and the production release repeats that read-only check.

The text-overlap audit normalizes a shared transform when comparing text within the same tilted stamp: axis-aligned viewport boxes otherwise overlap even when the text does not. `overlap-audit-proof.json` records the real separated stamp and an intentionally overlapping label in Chromium and WebKit; the audit distinguishes both. Unrelated elements retain their viewport overlap checks. Short landscape invitations start at the invitation itself, with the heading and scorecard above the fixed Play action.

At very narrow zoomed widths, curve axis labels wrap into separate rows in normal flow. The matrix checks every complete axis for clipping, overlap and containment even when the certificate extends below the viewport.

Rapid Escape/Enter reopening is tested in every Settings configuration. A queued native close from an earlier opening must not close the newly opened dialog; `settings-reopen.json` records the reproduced race and focused repeated checks.

Firefox CI runs all 720 cases in four shards and merges Playwright blob reports into one JSON report. The four-mode sharing scenario has a 180-second Firefox budget on two-core runners; every flow and assertion remains required. Geometry equality uses 0.005px tolerance for Firefox floating-point noise (observed differences of 0.000015px for swatches and 0.000122px for curves).
