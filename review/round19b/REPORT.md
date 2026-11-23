# R19B — shipped November 23, 2026, 9:12 AM ET

| Item / classification | Evidence | Impact | Status |
|---|---|---|---|
| Sharing — confirmed defects | Failing local bot fixtures; practice `/c` returned 302; caption regression reproduced | Missing previews, stale Animals homepage, answer disclosure | Fixed: explicit crawler allows/noindex, direct HTML, evergreen v19b art, player metadata, answer-free captions, native image/LinkedIn/download controls |
| Answer confidentiality — confirmed defect | Non-owner summary exposed answer ID, eligibility and claim rarity | Catalog could resolve concealed answers | Fixed: explicit allowlists; recursive payload tests cover owner/non-owner, close, moderation, deletion and caches |
| Backup credentials — confirmed defect | Malformed code incurred 32 reads; delete lacked matching throttle | Guessing and expensive requests | Fixed: cheap format/body rejection and shared durable 5-attempt/15-minute quota before lookup/mirror; restart/expiry tested |
| Direct runtime protections — confirmed defect/source concern | Fifth anonymous socket accepted; route checks extended | Socket/identity abuse | Fixed: socket/network/admin limits and origin/auth/body/frame guards; distinct signed players on shared networks tested |
| Connections — confirmed defects | Missing visible reconnect/finished sync; loader hung; dropped-ack cases | Stale ranks, stuck verification, duplicate retry risk | Fixed: bounded jitter/backoff and bootstrap, stable request IDs, no automatic replay, 10-second timeout/retry |
| Initial handshake — confirmed defect | Production WebKit smoke failed; real local sockets reproduced cancellation | Initial pageshow closed a connecting socket | Fixed and revalidated: one handshake, restored-page sync, zero errors in both engines |
| Lazy routes — confirmed defect | Aborted chunk caused blank route | Old tabs could fail after deployment | Fixed: explicit “A new version is available. Reload”; no reload loop |
| DayRegistry correctness — missing tests | Concurrent limits, discarded ack, restart, bonus and tonight/DST fixtures | Launch correctness | Added and passed; no scoring redesign |
| Analytics — source concern/confirmed regression | Exclusion and real-visitor tests; no-transform disabled compression | Test visits and slower HTML | Fixed: conditional beacon, inert configuration, shared QA flags and gzip HTML (~22 KB versus 111 KB) |
| Cloudflare settings — source concern | Read-only settings/rules APIs returned 403 | Cannot certify dashboard configuration | Actual preview-bot requests passed; no toggles changed; owner audit below |
| Deployment readiness — confirmed defect | Immediate post-deploy HTML was old | Premature smoke/rollback | Bounded readiness now requires exact entry and all script hashes; success/failure tests pass |

Deferred to R20: high-load capacity/leaderboard scans, bounded caches, mirror lag, disaster recovery/deletion audits, immutable assets/monitoring/release tooling, catalog/accessibility cleanup and yesterday recap. One practice opening reached the safe reload fallback; cause remains unconfirmed. Diagnostic repeat passed all six browsers, all 11 scripts matched, and 20 local timing variants passed. Retain that asset-reliability concern. The 200-player practice load test was skipped because R12 permits it only after 7:05 PM ET, beyond this round’s 3 PM deploy deadline; no new capacity claim is made.

Live: [Dibs](https://dibs.here), [Worker API](https://dibs-api.dibs-registry.workers.dev), [practice](https://practice.dibs-7hz.pages.dev). Started at `581eec7e3f9c961d8db8d4bbceb7217426806852`. Production release finished at **09:12:57 ET**, with all eight Chromium/WebKit phone/desktop, light/dark smoke cases passing, zero console errors, and all 11 JavaScript hashes matching. Launch remains Monday **9 PM ET**.

Released Pages: `76d06f11-70b3-4f0c-8100-84499cdc9316`; Worker version: `47ead7cf-8182-4421-bcc3-7f3139baf519`.
Rollback Pages: `18a0cd31-6207-45dd-804f-d2e9b577256b`; Worker version: `e9102cfd-ca70-4967-8407-7f00b23569a1`. Both IDs were recorded before deployment.

Attempt 1 rolled back both components at 08:49:04 ET, four seconds after the WebKit failure; the handshake fix was then reproduced locally and fully retested. Attempt 2 rolled back at 09:05:06 ET after rejecting old HTML. Attempt 3 observed old HTML three times, then the new coherent build on the fourth check. All rollback and release records are preserved in `review/round19b/`.

Validation: **225 unit/API tests in 50 files**, both TypeScript projects, **400 Chromium/WebKit full-flow checks**, **60 Firefox checks**, 80 additional sharing checks, six fresh practice browsers through closed→live/verified claim, backup restore and completed scorecard, 20 opening races, and native socket/reconnection tests passed. Slow-4G mobile Lighthouse: **91 performance / 100 accessibility / 100 best practices**. Earlier timeout/failed-run evidence is retained. [Final Firefox CI](https://github.com/ashwathram-prathap/dibs/actions/runs/45188126964) tests the unchanged final application source.

| Browser/device group | Full-flow checks | Result |
|---|---:|---|
| iPhone SE/15 Pro/15 Pro Max, iPad Mini/Pro landscape, WebKit | 100 | Pass |
| Pixel 7/Galaxy S9+, Chromium | 40 | Pass |
| Desktop Chromium/WebKit, 1280/1440/2560, both themes | 120 | Pass |
| 320px and landscape phones | 40 | Pass |
| Instagram/TikTok/X profiles, iPhone and Android | 60 | Pass |
| Edge/Samsung Internet/Discord/LinkedIn profiles | 40 | Pass |
| Desktop Firefox, Ubuntu CI | 60 | Pass |

Profiles emulate devices/user agents; physical phones, iOS 16 specifically and LinkedIn’s installed native share target remain owner checks. Practice verified all five bots × home/summary/certificate (15 cases). Production verified five homepage/image cases: direct 200, correct tags, 1200×627 JPEG, 66,159 bytes, under three seconds. Production leaderboard/archive were empty, so real score URLs could not be checked without prohibited fake players.

Owner audit: Cloudflare website `dibs.here` → **Security → Settings → Bot traffic → Bot Fight Mode**, and **Security → Security rules → Custom rules**; managed rules are under Security → Settings. Older navigation uses Security → Bots/WAF. Check any Block/Managed Challenge rules against preview routes. [Bot settings](https://developers.cloudflare.com/use-cases/solutions/stop-malicious-bots/), [security rules](https://developers.cloudflare.com/security/rules/). LinkedIn caches previews; refresh stale links using [Post Inspector](https://www.linkedin.com/post-inspector/).

Decisions: aggregate finished-player comparison percentile remains public; answer rarity, IDs, flags and words stay concealed. Admin **Live**, counting players who claimed or finished, is the player-count source of truth. Historical Web Analytics test traffic is not erased. No production secrets/golden selections were inspected, no synthetic players or destructive production tests were used, no secrets were created, and zero ntfy/social messages were sent. Practice real verification keys, notifications and schedule were restored. Unrelated working-tree changes remain unstaged.

Visuals: 56 final page/recovery captures in `review/final/round19b/`; full-flow device evidence in `review/devices/`; production/practice/sharing proof in `review/round19b/`. Light/dark at 390/1440 reviewed with the anti-AI checklist; no horizontal overflow. Weakest: long Office notice, long completed-day page, empty pre-launch archive.

Five phone checks: make one real claim after opening; confirm native sharing offers the scorecard image for LinkedIn; try Download image/Copy result; recover your own file using its backup code; background/wake the tab and verify finished-rank updates.
