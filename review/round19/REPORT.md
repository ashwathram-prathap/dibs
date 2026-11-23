# R19 release report

Shipped to **https://dibs.here** at 2026-11-23T12:45:12.183Z, before the November 23 **3 PM ET cutoff**. API: https://dibs-api.dibs-registry.workers.dev. Practice: https://practice.dibs-7hz.pages.dev. Opening remains **Monday, November 23 at 9 PM ET** (2026-11-24T02:00:00.000Z). Tag: `r19-done`.

## What shipped

- System is the default theme, with live system/visibility updates, explicit Paper/Carbon choices, matching status-bar colours and the prepaint script. Exports use the resolved theme. Reduced motion, stronger contrast, forced colours, rem typography and enlarged layouts are covered.
- Plain generated names from more than 10,000 combinations; old eight-hex suffixes removed on reads and in storage. Visible clashes receive stable short decimal numbers. Founder and withdrawn labels are preserved. Production migration: users: 0 changed / 3 inspected; r17_players: 0 changed / 0 inspected; r17_files: 0 changed / 0 inspected.
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
| Unit / API | 206 passed |
| R19 Chromium/WebKit matrix | 224 passed, 320–1440px, both themes |
| Existing active regression suite | 344 passed |
| Local full device flows | 76 passed |
| Final export regression | 104 passed |
| Linux Firefox | 324 passed; [CI](https://github.com/ashwathram-prathap/dibs/actions/runs/45172552115) |
| No-orphan audit | 294 screen/theme/width/engine cases; 5355 blocks; zero failures or overflow |
| Expanded Settings | 120 cases at 130%/200%; every descendant fits |
| Supplemental checks | 36 sets: streak states, stamp examples, 200% desktop zoom-equivalent viewports |
| Practice closed → live | Six fresh Chromium/WebKit browsers claimed; displayed-code recovery passed |
| Production read-only smoke | Eight phone/desktop/theme/engine checks; no console errors |
| Production Slow-4G Lighthouse | 97 performance / 100 accessibility / 100 best practices / 100 SEO |
| Build / TypeScript | Passed; production fixture exclusion and structured data verified |
| Preservation | Existing player rows unchanged except requested name cleanup; schedule unchanged |

| Emulated device / engine | Result |
| --- | --- |
| iPhone-SE-light | PASS — 2 checks |
| iPhone-15-Pro-light | PASS — 2 checks |
| iPhone-15-Pro-Max-light | PASS — 2 checks |
| Pixel-7-light | PASS — 2 checks |
| Galaxy-S9+-light | PASS — 2 checks |
| iPad-Mini-light | PASS — 2 checks |
| iPad-Pro-11-landscape-light | PASS — 2 checks |
| chromium-1280-light | PASS — 2 checks |
| chromium-1440-light | PASS — 2 checks |
| chromium-2560-light | PASS — 2 checks |
| webkit-1280-light | PASS — 2 checks |
| webkit-1440-light | PASS — 2 checks |
| webkit-2560-light | PASS — 2 checks |
| 320-small-light | PASS — 2 checks |
| landscape-phone-light | PASS — 2 checks |
| iPhone-SE-dark | PASS — 2 checks |
| iPhone-15-Pro-dark | PASS — 2 checks |
| iPhone-15-Pro-Max-dark | PASS — 2 checks |
| Pixel-7-dark | PASS — 2 checks |
| Galaxy-S9+-dark | PASS — 2 checks |
| iPad-Mini-dark | PASS — 2 checks |
| iPad-Pro-11-landscape-dark | PASS — 2 checks |
| chromium-1280-dark | PASS — 2 checks |
| chromium-1440-dark | PASS — 2 checks |
| chromium-2560-dark | PASS — 2 checks |
| webkit-1280-dark | PASS — 2 checks |
| webkit-1440-dark | PASS — 2 checks |
| webkit-2560-dark | PASS — 2 checks |
| 320-small-dark | PASS — 2 checks |
| landscape-phone-dark | PASS — 2 checks |
| Instagram-iPhone-15-Pro | PASS — 2 checks |
| Instagram-Pixel-7 | PASS — 2 checks |
| TikTok-iPhone-15-Pro | PASS — 2 checks |
| TikTok-Pixel-7 | PASS — 2 checks |
| X-iPhone-15-Pro | PASS — 2 checks |
| X-Pixel-7 | PASS — 2 checks |
| Samsung-Internet-360 | PASS — 2 checks |
| Edge-1440 | PASS — 2 checks |
| firefox-1280-light | PASS — 2 checks |
| firefox-1440-light | PASS — 2 checks |
| firefox-2560-light | PASS — 2 checks |
| firefox-1280-dark | PASS — 2 checks |
| firefox-1440-dark | PASS — 2 checks |
| firefox-2560-dark | PASS — 2 checks |

Device profiles include the required iPhones, Pixel, small Galaxy, iPads, desktop widths through 2560px, Samsung Internet and Edge user agents, landscape phones and in-app approximations. Cached-preview API tests also cover WhatsApp, X, Facebook, iMessage and Discord fetchers. These are engine/device emulations and crawler tests, not physical-device or installed-app certification. Standalone behaviour is emulated; operating-system text scaling is represented by root font scaling and desktop zoom-equivalent CSS viewports. Local Firefox could not launch its profile after three approaches, so the complete Firefox checks ran on Linux CI. The retired R7 specification test remains excluded by the established regression configuration; current replacement suites run.

The first broad unit run hit three catalog-processing timeouts while browser jobs were active. All tests then passed with one worker and unchanged assertions/time limits. The final R19 matrix has no retries/flaky passes. Main-screen text audits found no unavoidable multiword exceptions; inherently one-word labels are not sentences.

## Claim timing

Median tap-to-stamp, with sample range in parentheses. Three fresh sessions per browser and version; one first and two later claims per session. Both versions use the same real practice backend and official Cloudflare test keys. Each session performed exactly one verification and three proof-bearing claims.

| Browser | R18 first | R19 first | R18 later | R19 later |
| --- | --- | --- | --- | --- |
| chromium | 4.42 s (4.37–4.47) | 0.93 s (0.86–1.35) | 0.83 s (0.81–1.40) | 0.83 s (0.82–0.84) |
| webkit | 4.51 s (4.50–4.58) | 1.86 s (1.84–2.38) | 0.91 s (0.86–1.39) | 0.83 s (0.82–0.85) |

Chromium meets the first-claim target. WebKit improves substantially but its 1.86-second median (1.84–2.38 seconds) at exactly three seconds of dwell remains above the approximate 1.5-second target. Both browsers meet the later-claim target. The tested WebKit build lacks requestIdleCallback, so it uses the requested 1.5-second fallback before executing the third-party check. The loader is fetched earlier to reduce that delay; the remaining first-claim miss is documented rather than hidden by a longer dwell time.

The harness applies 150 ms RTT plus 1.6 Mbps encoded-response transfer delay and 75 ms each way for WebSocket messages, with no CPU slowdown. It waits exactly three seconds after the answer field appears. This is a reproducible transport simulation in both engines, not physical mobile-network measurement. Raw samples: [before](claim-timing-before.json), [after](claim-timing-after.json). Intermittent network failures interrupted two later rehearsal attempts; the completed R18 baseline was retained because its source and transport were unchanged, and the final R19 run completed separately. Practice cleanup, real keys, notifications and every schedule row were verified restored.

Cloudflare widget mode was **not changed**. Exact path: **Cloudflare dashboard → account → Turnstile → existing Dibs widget → Settings → Widget mode**. Managed mode may require interaction based on risk; Non-interactive and Invisible still perform background verification and do not guarantee a fixed latency. [Cloudflare dashboard instructions](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/) and [widget behaviour](https://developers.cloudflare.com/turnstile/concepts/widget/). Prewarming and proof reuse remove repeated work regardless of mode.

## Settings cause and before/after proof

The real backup string made the restore and deletion **single-line inputs scroll internally**, even when the outer document fit. On the reproduced MacBook-sized Chromium case each input had scrollWidth 269px versus clientWidth 264px. 40 of 40 before cases failed. Real codes, open disclosures, Samsung-size viewports and desktop sizes were used. After the fix all 120 three-engine cases passed at 130%/200%, including 1470/1440 desktops and 360/384/412 Samsung sizes. The fix uses wrapping textareas, a full-width code block with Copy below, minimum-width resets and reflow; overflow hiding alone is not used. [Before](settings/before.json), [after](settings/after.json), Firefox evidence in the CI artifact.

## Release, rollback and constraints

| Term | Meaning |
| --- | --- |
| System theme | Follow the device's light/dark preference until a player chooses otherwise. |
| Session proof | A signed, player-bound verification pass reused for 30 minutes. |
| Finished-player percentile | The share of completed real scores below yours, with half credit for ties. |
| Rollback point | The previous Pages and Worker versions recorded before release. |

| Version | Pages deployment | Worker version |
| --- | --- | --- |
| Rollback | `0a3fd4eb-3a49-4320-a8bb-0a7b51cdf8d3` | `f3b136b2-b2e9-4907-9d5d-9fd0d7a0d1b0` |
| Released | `18a0cd31-6207-45dd-804f-d2e9b577256b` | `e9102cfd-ca70-4967-8407-7f00b23569a1` |

Production was backed up before deployment. `npx tsx scripts/r19-smoke.ts --rollback-now` restores the recorded application versions. The idempotent name cleanup intentionally remains in data; the private backup preserves its previous values. No production test player, claim or feedback was created. R11 gates were not modified; this uses the explicitly authorized R12 §5 release route with additional R19 evidence/cutoff gates. No paid plans or public announcements. **Zero ntfy alerts sent.** No new secrets were created; existing secret values remain only in ignored files and Cloudflare.

The optional 200-player practice load test was skipped: its allowed 7:05 PM ET start is after this release's 3 PM cutoff. Local concurrency/API tests and the smaller remote rehearsal passed. Account write headroom was checked before each rehearsal.

## Design evidence and owner checks

[Visual index](index.html). Final every-route light/dark screenshots at 390/1440 are in `review/final/round19/`; payoff at 390/768/1440/1920, phone payoff at the five requested sizes and 1.0/1.3 scale, streaks, Settings, theme states, Day/claim exports and OG proof are in `review/round19/`. The final [Firefox screenshot run](https://github.com/ashwathram-prathap/dibs/actions/runs/45175559122) passed and its 148 images are included locally. Full-size images and verbose runner artifacts stay local; compact evidence is committed.

The sticky Share bar was chosen to keep large, readable certificate text while guaranteeing visible actions at 130% text. Mobile navigation uses shorter visible labels with full accessible names. Feedback day limits use UTC; per-player limits use a rolling hour.

The three weakest remaining screens are the long Office/privacy page, the tall phone Day Certificate (its actions remain fixed and visible), and the intentionally sparse empty archive. No invented records were added.

First five phone checks:

1. Return Theme to System, switch the device theme, and repeat from the home-screen app.
2. Expand Backup code and Delete my data with large text; scroll vertically and confirm every code character is visible.
3. After opening, type and claim; check the compact payoff, named close time and Remind me sheet.
4. Finish a day; confirm Share and Copy remain visible above the tabs, then try native share and fallback.
5. Check the streak, clean player name, and live finished-player comparison after ten people finish.
