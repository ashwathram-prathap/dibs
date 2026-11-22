# R14 release evidence

R14 adds server-saved rarity points, immediate claim feedback, a live score-only leaderboard, Toronto drop-date streaks, and points/rank/streak on certificates and shares. Production must remain closed until November 23 at 9 PM ET. The production release deadline is November 23 at 3 PM ET.

## Scoring and privacy decisions

- Measured pageviews are normalized by observed days and ranked within the category. Equal popularity readings share a middle percentile. The top decile earns 10; the remaining percentiles scale to 100, rounded to 5. Missing readings use the category's median measured score; an entirely unmeasured legacy category uses 50. Golden claims add 100. The file total is `max(0, sum(saved claim points) - 10 × strikes)`.
- Claims save their points, percentile and bonus once. Existing pre-R14 claims receive the honest median fallback, with their original golden bonus retained. The additive migration is compatible with the prior Worker.
- Ties use the earliest timestamp at which the player reached their current total; identical timestamps have a stable ID fallback. The leaderboard contains actual claim or strike participants, including strike-only players at zero. Hidden users and files with any voided claim are excluded. Deleted players retain anonymous scores as Withdrawn player.
- All public answer surfaces stay concealed until the category closes, even for a player whose own file is complete. Their private file can show their own answers. Shared PNGs conceal answers until close.
- Streaks use drop dates in America/Toronto. A previous-day streak stays visible during the current drop's opportunity to play; missing a completed drop resets it. Future dates cannot contribute.

## Verification

Compact result files in this folder record unit/API tests, browser tests, the 60-case hero and done matrices, 40 body-type checks, 12 emulated webview checks, local real-API play, and D1 cost measurements. Full visual captures remain local in this folder and `review/final/round14/`. Practice screenshots with populated scores use test players created by the rehearsal; fixture screenshots are development-only design proofs.

The final release record will include the guarded practice load, closed-to-live rehearsal, deployed mobile Lighthouse, production smoke, deployment IDs and rollback point. Those remote release checks are pending until the required 7:05 PM ET window. No production test players are created.

## Capacity finding

The leaderboard uses a 25-second Durable Object cache with socket updates and sharded persistent score rows. Steady leaderboard polling measured zero D1 reads and writes. Claim storage remains the limiting cost: the measured scenario of three claims and two strikes per player is approximately 54 D1 writes. Ten thousand fully active players would therefore use about 540,000 writes, before background overhead, exceeding the free account-wide allowance of 100,000 writes/day. See `capacity-estimate.json` and `static-d1-cost.json` for the measured inputs and read estimate. The 200-player contention test does not certify that larger workload. No upgrade or payment is authorized or made. [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Physical-device validation remains a human follow-up: Safari/WebKit, Android and in-app checks here use browser/device emulation. The existing R11 infrastructure gate file is preserved unchanged; R12 and R14 explicitly authorize the direct deployment workflow.
