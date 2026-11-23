# R15 release evidence

**Shipped at 2026-11-23T04:35:40.246Z** to [dibs.here](https://dibs.here) and [the Worker API](https://dibs-api.dibs-registry.workers.dev/api/today). All **8/8** read-only production smoke checks passed with no console errors. Deployment IDs are in `deployment.json`; rollback IDs are in `rollback.json`. Production remains closed until **Monday November 23, 9:00 PM Toronto / November 24 02:00 UTC**. R14's 200-player load test remains deferred to its separately resumed run. No paid plan or billing setting was enabled.

## Changes and verification

- Shared-network admission: migration 0014 raises the first-claim backstop to 5,000 new players/network/day, adds a rolling 300/10-minute limit, and excludes missing IPs. The three other `claim_guard` clauses are preserved byte-for-byte. Turnstile remains mandatory; the verified session lasts 30 minutes. Local tests admitted 40 different players from one IP in under two minutes, rejected simulated player 5,001 and burst player 301, and admitted the latter after the window. Existing ownership, hidden-player, three-claim and five-strike tests pass.
- Six fresh browsers on one network (three Chromium, three WebKit) automatically crossed the practice opening and claimed successfully using official test Turnstile. Practice rate-limit rows for the current Toronto day were reset; production player data was not reset. Real practice Turnstile and the original notification setting were restored after the rehearsal notification window.
- `/api/admin/network` returns only trusted-header presence and eight hash characters. Local and GitHub CI calls both had the platform header, had distinct hashes, and neither matched the daily hash of `unknown`. No forwarding workaround was necessary. Before the practice reset there were **3 rows / 3 distinct hashes / largest bucket 5 / 7 total players**. That establishes the five-player cap was sufficient to cause the reported problem; it does not establish which network the owner's mother's phone used.
- Launch clues run November 23–29, select one committed golden deterministically, use configured golden counts, and publish no selected ID or answer. Live display and How it works include the clue and cracked handle; the archive marks the clued golden. City country metadata produces a geographic type; categories without retained type metadata use letter count and initial. Tests cover pre-drop API, socket and HTML privacy, deterministic choice, counts, cracked state and close-time disclosure.
- Four labelled navigation destinations, phone bottom bar with safe-area padding and keyboard hiding, Settings disclosure available on every route, softer controls, sentence-case body-font labels, and optically adjusted branding. At 200% zoom on narrow phones the four tabs reflow into two rows to retain readable labels. Normal phone widths retain the four-column bar.
- Ordered spoiler-free result squares, live points/rank/streak, no-rank omission, native-share/copy equality, Copied confirmation and selectable-textarea fallback.
- Muted claim responses are not queued during delayed audio startup, and opening How it works during a pending result stays open. Regression tests cover both timing issues discovered in Firefox.
- Music streams through an audio element and MediaElementSource, starts only after a tap, shows loading state, ducks for stamps and resumes after visibility/interruption. No audio downloads before consent. iOS playback audio-session mode is set only after the music tap.
- The homepage is static; normal initial state uses one bootstrap request. Live updates use server-pushed hibernating WebSockets without client heartbeats. Claim/verification/share messages can use that existing socket. Socket attachments expire at game-day and Toronto calendar-day changes, and expired RPCs close the socket before retrying verification over HTTP; missing-network event limits remain per signed player. A failed socket falls back to 60–75-second polling, paused when hidden or finished. Request failures show the requested packed message and retry with backoff.
- Inline CSP-authorized theme/critical CSS prevents the blank white/unstyled fallback flash. Version checks use a static no-cache manifest and only reload idle pages. Both Chromium and WebKit standalone-mode emulation stayed on the old page while typing, then updated across two actual practice deploys when idle.
- Versioned 180/192/512 icons, maskable safe-zone icon, favicon, circle/squircle contact sheet. **Delete and re-add the home-screen app to refresh its cached icon.**

## Limits audit

| Limit | Before R15 | After R15 |
|---|---|---|
| New successful players per network per Toronto day | 5 | 5,000 |
| New-player rolling burst | None | 300 per network per 10 minutes |
| Claims / strikes | 3 / 5 per player/day | Unchanged; no per-IP strike cap |
| Attempts | 12/minute per player | Unchanged; DO storage on production path, SQL trigger retained |
| Identity/bootstrap/file creation | No independent per-IP cap; first successful claim hit the five-player gate | No independent per-IP cap; session remains in DO until persistence is needed |
| WebSocket/DO connections per IP | None | None; 4 KB messages, snapshot messages at most once/10 seconds, RPC whitelist and per-player mutation/attempt/event limits |
| Share/arrival/session verification/deletion event gate | 30/minute per IP | 30/minute per signed player; anonymous requests retain 30/minute per known IP |
| Feedback | 3/hour per IP | 3/hour per player |
| Missing-answer suggestions | 10/day per IP | 10/day per player |
| Recovery-code trials | 5/15 minutes per IP | Unchanged for known IPs; missing IP does not share a bucket |
| Admin requests | 60/minute/IP; 10 failed authorizations lock 15 minutes | Same for known IPs; missing IP skips shared lockout, never skips authorization |
| Missing-IP hash | Everyone could share `unknown` | No IP bucket; Turnstile and per-player claim limits remain |
| Network monitoring | No 500-player warning | Admin/live warning above 500 new players/day; no network-warning ntfy |
| Capacity ntfy | Threshold-specific suppression | At most one capacity alert/day, including attempted delivery |

## Measured capacity — six-write target is blocked

The realistic scenario is bootstrap, verification, six valid guesses (three claims and three reserved strikes), leaderboard, share, and a return visit. Invalid guesses are excluded. Measurement scripts record actual D1 `rows_read`/`rows_written`, including index maintenance, rather than counting SQL statements.

| Per full game | R14 baseline local | R15 local | R15 deployed practice |
|---|---:|---:|---:|
| HTTP requests to Worker (including socket upgrade) | 11 | 3 | 3 |
| Pages Function API requests | Not hosted | Not hosted | 3 |
| Shared Pages + Worker allowance, conservative | 22 if hosted | 6 if hosted | 6 |
| DO request equivalents | 11 | 3.4 | 3.4 |
| Incoming application socket messages | 0 | 8 | 8 |
| D1 rows written | 58 | 55 | 53 |
| D1 rows read | 491 | 709 | 820 (earlier practice sample: 1,137) |
| DO SQLite KV row writes (local instrumentation) | 60 | 62 | Not isolated remotely |
| DO SQLite KV row reads (local instrumentation) | 66 | 64 | Not isolated remotely |

Normal cold drop setup measured separately costs 74 D1 writes / 38 reads and 7 DO KV writes / 1 read and is shared across visitors, not charged to every player in this table. Launch's larger golden pool adds setup work. Local's extra two per-player writes include the first founder assignment. The practice samples are low-concurrency measurements, not a crowd-capacity guarantee.

**The requested one D1 row per guess / six writes per full player was not achieved.** Three approaches were implemented and measured: (1) move attempt/counter state into the DO, (2) remove redundant D1 request reservations, and (3) cache standings and route claim/session/share calls over the existing socket. Remaining writes include the claim/strike, required indexes and uniqueness constraints, sparse answer references, identity/recovery persistence and the required SQL count trigger. A practice claim cost 13 writes after the first claim; a strike cost 2. Reaching six physical writes needs a different persistent representation and transactional guard design. Removing ownership indexes or bypassing the preserved SQL guards to report six would be unsafe. This is a documented blocked acceptance item under OVERNIGHT rule 5.

At the measured practice costs, before operational overhead:

| Free daily allowance | Raw full-game ceiling | 70% budget ceiling |
|---|---:|---:|
| 100k shared Worker/Pages requests at 6 | 16,666 | 11,666 |
| 100k DO requests at 3.4 | 29,411 | 20,588 |
| 100k D1 writes at 53 | **1,886** | **1,320** |
| 5M D1 reads at 820–1,137 | 4,397–6,097 | 3,078–4,268 |
| 100k DO SQLite writes at 62 estimated KV rows | **1,612** | **1,129** |
| 5M DO SQLite reads at 64 estimated KV rows | 78,125 | 54,687 |

DO SQLite storage has its **own** daily 100k-write/5M-read quota, including KV methods and alarms. The local `--storage` harness counts KV calls/returned rows, including transaction operations and alarm writes, and drains asynchronous metrics before reading totals. These are conservative logical-row estimates, not isolated remote billing measurements; caching and write coalescing can change them. Instrumentation adds IO, so its duration is deliberately not used as a capacity estimate.

DO storage writes are the first estimated limit, closely followed by D1 writes. Use **about 1,000 complete games/day as a provisional planning ceiling**, allowing setup/maintenance in the reserve, until R14's guarded load test establishes concurrent CPU/read/duration behavior. DO duration (13,000 GB-s/day), longer visits, certificate rendering, abuse, cold reconstruction and other account traffic can reduce capacity. This is not a promise that 1,000 simultaneous players pass. Reproduce with `npx tsx scripts/capacity-budget.ts --storage` (and `--before` for the prepared R14 baseline).

**Account-wide alert setup is blocked.** The Worker has no `CF_ANALYTICS_TOKEN`. The implementation now reads DO requests (20:1 incoming hibernating messages), SQLite rows, duration and storage alongside Workers and D1, and the complete query succeeded using the existing CLI session (`account-usage-check.json`). However, that interactive OAuth credential should not be copied into a long-lived Worker secret. Both user-token and account-token permission APIs returned 403; the browser-access host is unavailable. These three setup approaches could not supply a scoped token. Until the owner creates an **Account Analytics Read** token for this account and stores it with `npx wrangler secret put CF_ANALYTICS_TOKEN -c worker/wrangler.jsonc`, automatic quota alerts use measured API/D1/request counters only; DO storage/duration and other account traffic are not covered. Admin/live explicitly labels unavailable readings. No missing metric is shown as zero. The monitor retains its one capacity-alert/day gate; no alert was sent to test it.

For information only: the $5/month Workers plan includes 10M requests, 30M CPU-ms, 1M DO requests, 400k DO GB-s, 50M D1 writes and 25B D1 reads/month. At these sample request/write rates the DO-request allowance is the first simple monthly bound: roughly **294k full games/month (~9.8k/day averaged)**, before duration, CPU, other traffic or overages. D1 writes alone would allow ~943k/month; the included 50M DO SQLite writes would allow ~806k/month at the local estimate. No upgrade was made. Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [D1 pricing and indexed writes](https://developers.cloudflare.com/d1/platform/pricing/).

## Static delivery and media

Controlled wrangler tails, filtered by a unique measurement header, observed **8 non-API Function calls cold / 1 warm before**, and **0 cold / 0 warm after**. API control requests were seen in the after tail, so zero static events is not an inactive-tail inference. Exact paths are in the two `function-*-controlled.json` files. Routes include only genuinely dynamic HTML/API/certificate/summary/calendar/SEO endpoints. Static cache/security checks verify CSP, HSTS, one-year immutable hashed assets, 30-day audio/fonts, and no-cache HTML/manifest/version. Specific cache rules detach the general no-cache header before setting their value, avoiding Cloudflare's comma-joined conflicts. A post-release check found legacy font URLs still cached at production's edge with old one-year metadata. Cache purge was denied by the existing CLI credential; versioned font URLs now bypass that stale entry, using byte-identical font files and the correct 30-day origin policy. The versioned icon bytes matched the release; its four-hour edge cache is compatible with filename versioning. [Header behavior](https://developers.cloudflare.com/pages/configuration/headers/).

| Rendered audio | Bytes | Integrated LUFS | True peak dBTP |
|---|---:|---:|---:|
| Opus/WebM | 280,902 | −16.00 | −1.81 |
| AAC/M4A | 264,139 | −16.04 | −1.96 |
| Stamp | generated PCM | −23.45 | −3.03 |
| Gold | generated PCM | −22.64 | −3.03 |
| Strike | generated PCM | −24.15 | −6.02 |

Transient LUFS uses a repeat every 600 ms for a measurable integrated window; it is not directly interchangeable with continuous music loudness. Music gain is 0.30 and ducks to 15% of that during a stamp. Phone-range fundamentals/presence, compression and measured output replace the formerly quiet MP3. The encoded peak ceiling is slightly more conservative than −1 dBTP. Throttled 4G emulation uses 150 ms latency and 200 KB/s; `throttled-media.json` records first `playing` event latency (235–330 ms in the final run) and eight light/dark cold/warm filmstrips. These are browser measurements, not physical speaker latency or a listening test on a Samsung/iPhone. The requested perceived 30% music-to-stamp ratio and mid-volume phone-speaker audibility remain unverified; the owner needs to perform that listening check.

## Test and release records

- Unit/API: **169 passed, 38 files**.
- R14 Chromium/WebKit matrix rerun: **400 passed**; post-loading-layout change targeted matrix: **33 passed**; final audio/disclosure regressions: **60 passed**; font-URL-only revision: **24 passed**. The 400-check matrix predates only that byte-identical font URL revision.
- New R15 browser checks: **18 passed** (six device/theme/browser profiles).
- Firefox CI: **66 passed, zero flaky**, final source `4595d5e` in run `45112368269`; exact totals are in `verification.json`. Earlier accepted runs also passed all 66 checks.
- Hero/category matrix: 60 engine/size/theme combinations, 32 category labels, keyboard and 130% text checks. Done matrix: 60 combinations. `hero-matrix.json`, `done-matrix.json` and screenshots hold the exact results.
- Phone 200% reflow: **28 passed**, seven phone sizes in both themes on Chromium/WebKit, with no horizontal overflow and all four tabs contained.
- Standalone across real practice deploys: **2 engines passed**, typing protected and idle update confirmed.
- Lighthouse deployed practice: **97 performance / 100 accessibility / 100 best practices** on simulated Slow 4G; SEO is intentionally lower on the noindex practice host. The loading shift fix raised the local score from 71 to 95. No app/API errors or failed analytics beacons remain in the accepted practice run. Final practice release smoke also passed both engines and themes. One font-release practice attempt logged a third-party Turnstile cross-origin frame error; the immediate full rerun passed. The six fresh-browser claim rehearsal used official test Turnstile keys, and real keys were restored afterward.
- Production backup completed at `20261123T041516Z` in ignored `.backups/`; rollback IDs are in `rollback.json`. Migration verification reads production `sqlite_master` and compares exact trigger text. Read-only browser smoke passed all eight engine/width/theme combinations; rollback was not needed. Post-smoke reads still showed 3 users / 0 claims / 0 strikes, unchanged. Final production cache/security headers passed, including all eight versioned font URLs.

| Coverage | Result |
|---|---|
| Chromium phone, tablet, landscape and desktop matrix | Pass |
| WebKit phone, tablet, landscape and desktop matrix | Pass |
| Firefox desktop, both themes | Pass (CI evidence below) |
| Phone 200% reflow, both engines/themes | 28 pass |
| Physical Samsung/iPhone speakers and embedded apps | Not exercised; owner check |

Automated coverage includes iPhone SE/15 Pro/15 Pro Max, Pixel 7, Galaxy S9+, iPad Mini/Pro, 320–2560px desktop/landscape and in-app user-agent profiles. These are browser engine/device emulations; actual Safari 16, Samsung Internet, Edge and embedded social apps were not physically exercised. The R14 200-player load test remains deferred as explicitly requested.

Full-resolution images: `review/round15/matrix/`, `review/round15/filmstrip/`, `review/final/round15/`; icon contact sheet: `review/round15/icons.png`. The weakest views are the necessarily tall 200%-zoom small-phone navigation, the dense mobile Office page, and the wide-screen archive's sparse content before launch.

Decisions: static route allowlist supersedes the earlier broad include/exclude instruction because the later R15 requirement explicitly asks for a fully static homepage. Missing metadata is omitted from clues rather than inferred. Practice's automatic Pages analytics injection was replaced with the same existing public beacon token injected only into production builds, avoiding preview CORS errors and preserving production analytics. `.env.local` holds that public build setting and remains ignored. The existing practice admin value was copied to the repository secret named `R15_PRACTICE_ADMIN` for the required independent network check; no new secret value was created. The optional account-wide analytics token could not be provisioned; the exact owner setup is documented above. Git CLI routing initially failed, so connector Git-tree commits were pushed, exact tree hashes checked and local commit objects reconciled. CLI access recovered for the large generated catalog commit. The pre-existing homepage title was retained and committed with its matching check; the generated food-catalog version now matches its manifest (answer content unchanged). No published history was rewritten.

First phone checks: re-add the installed app for its new icon; check the closed Monday 9 PM countdown; use all four tabs and Settings/backup; play on shared Wi-Fi at the launch and copy the answer-free result; try music at mid volume, background/foreground the app and confirm ducking. No announcement, email or social post was sent. No manual ntfy alert was sent.
