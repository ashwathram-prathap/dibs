# R14 release evidence

## Completed after R15 — November 22, 11:47 PM ET

R15 already shipped the R14 feature work. The remaining practice load passed at **11:45 PM ET**, after the required 7:05 PM reset window. This completion preserves every R15 application change and its production deployment; no production deployment, rollback, migration or player mutation was performed. `r14-done` marks this follow-up on top of `r15-done`.

| Practice load | Result |
|---|---|
| Players / arrival window | 200 / 59.703 seconds (66.185 seconds including request drain) |
| Claim requests / leaderboard polls | 1,096 / 492 |
| Claim p50 / p95 | 1,122 / 1,693 ms |
| Leaderboard p50 / p95 | 89 / 289 ms |
| Unexpected errors | 0 (0%) |
| Contested answer | Exactly one winning claim; ownership held in the final day and winner's leaderboard row |
| Expected claim responses | 1 success, 597 taken/reserved, 498 invalid/clerk-note responses |

**Headroom:** immediately before the load, account-wide daily D1 analytics reported **611 writes**. Adding the conservative **20,000-write allowance** gives **20,611 / 100,000**, leaving **79,389 (79.389%)**, above the required 30%. The guard now reads the UTC-day aggregate across all databases, fails closed if usage is missing, and supports a read-only budget preflight. Application D1 counters increased from 168 to 1,395 during the load; these exclude cleanup and are not account billing. The immediate post-run account aggregate had not yet advanced, so no isolated billed-write delta is claimed.

**Scope and restoration:** this is the existing HTTP contention workload, with official practice-only Turnstile test credentials, 3–8 guesses per player, and leaderboard polling including 25-second revisits. It measures end-to-end requests from this Mac, not browser socket gameplay, mobile network latency or CPU. Public leaderboard responses passed the no-answer/identity-field check. Existing practice records were backed up privately before reset. Test users, claims and strikes are cleared; real Turnstile and original notification settings are restored, and the existing practice schedule is unchanged. Rehearsal notifications were suppressed and no manual ntfy alert was sent.

Production remains on R15 Pages `829e86fa-9529-4ba0-9ac6-cbaf92edd4ab` and Worker `66b24b3a-5551-469c-9854-703d2f59bc20`, closed until **Monday November 23, 9 PM ET**. Read-only before/after checks match deployment IDs and player counts (3 users, 0 claims, 0 strikes). R15's rollback record remains authoritative in `../round15/rollback.json`; the older R14 rollback file is historical.

Evidence: `load-test.json` (all latency samples), `account-write-budget.json`, `account-usage-after.json`, `load-rehearsal.json`, `completion-verification.json`, and `deployment.json`. Reproduction: back up practice, then `npx tsx scripts/r14-load-rehearsal.ts`; the script checks headroom before setup and again before load, and restores practice in `finally`. No product code changed in this completion; validation consists of the deployed load, restoration/readback assertions and script formatting/diff checks. The R15 browser/unit/smoke results remain in `../round15/REPORT.md`.

**Capacity remains limited:** this contention pass does not certify 10,000 active players. R15's measured full-game costs imply about **530,000 D1 writes and 8.2–11.37 million reads for 10,000 full games**, before overhead. Its provisional planning ceiling of roughly **1,000 full games/day** and separate Durable Object limits remain in force. No paid plan was enabled; scoped account-alert credentials and physical-device checks remain R15 follow-ups.

## Original implementation record

R14 adds server-saved rarity points, immediate claim feedback, a live score-only leaderboard, Toronto drop-date streaks, and points/rank/streak on certificates and shares. Production must remain closed until November 23 at 9 PM ET. The production release deadline is November 23 at 3 PM ET.

## Scoring and privacy decisions

- Measured pageviews are normalized by observed days and ranked within the category. Equal popularity readings share a middle percentile. The top decile earns 10; the remaining percentiles scale to 100, rounded to 5. Missing readings use the category's median measured score; an entirely unmeasured legacy category uses 50. Golden claims add 100. The file total is `max(0, sum(saved claim points) - 10 × strikes)`.
- Claims save their points, percentile and bonus once. Existing pre-R14 claims receive the honest median fallback, with their original golden bonus retained. The additive migration is compatible with the prior Worker.
- Ties use the earliest timestamp at which the player reached their current total; identical timestamps have a stable ID fallback. The leaderboard contains actual claim or strike participants, including strike-only players at zero. Hidden users and files with any voided claim are excluded. Deleted players retain anonymous scores as Withdrawn player.
- All public answer surfaces stay concealed until the category closes, even for a player whose own file is complete. Their private file can show their own answers. Shared PNGs conceal answers until close.
- Streaks use drop dates in America/Toronto. A previous-day streak stays visible during the current drop's opportunity to play; missing a completed drop resets it. Future dates cannot contribute.

## Verification

Local verification passed: 152 unit/API tests, 400 Chromium/WebKit cases, 66 Firefox cases, both 60-case hero/done matrices, 40 body-type checks, and 12 emulated webview flows. The local production frontend scored 92 performance and 100 accessibility on mobile Lighthouse. One PNG download event timeout in an earlier run passed ten focused repetitions and the subsequent complete 400-case run; the history is retained in `share-download-investigation.json`. Local real-API play and D1 cost measurements also passed. Full visual captures remain local in this folder and `review/final/round14/`. Practice screenshots with populated scores use test players created by the rehearsal; fixture screenshots are development-only design proofs.

R15 completed deployment, closed-to-live rehearsal, deployed mobile Lighthouse and production smoke; see `../round15/REPORT.md`. The deferred guarded practice load is now complete above. No production test players were created.

## Capacity finding

The leaderboard uses a 25-second Durable Object cache with socket updates and sharded persistent score rows. Steady leaderboard polling measured zero D1 reads and writes. Claim storage remains the limiting cost: the measured scenario of three claims and two strikes per player is approximately 54 D1 writes. Ten thousand fully active players would therefore use about 540,000 writes, before background overhead, exceeding the free account-wide allowance of 100,000 writes/day. See `capacity-estimate.json` and `static-d1-cost.json` for the measured inputs and read estimate. The 200-player contention test does not certify that larger workload. No upgrade or payment is authorized or made. [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Physical-device validation remains a human follow-up: Safari/WebKit, Android and in-app checks here use browser/device emulation. The existing R11 infrastructure gate file is preserved unchanged; R12 and R14 explicitly authorize the direct deployment workflow.
