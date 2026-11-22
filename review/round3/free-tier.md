# Round 3 free-tier measurements

Measured on November 21, 2026 using real local workerd/D1 metadata, including triggers and indexes. Evidence: `d1-actions.json`. The pending-identity architecture writes **zero D1 rows on browsing**, and invalid answers write zero D1 rows. A taken guess writes exactly one strike row in a `WITHOUT ROWID` table. File limits are SQLite triggers, not cache-based checks. An indexed per-player event position preserves order under concurrency.

| Action | Measured D1 reads | D1 writes |
| --- | ---: | ---: |
| Warm new-player browse | 0 | 0 |
| New-player successful dibs | 22–65 depending on prior progress | 13 |
| Later successful dibs | up to 65 in this suite | 7 |
| Taken guess | 13–15 in this suite | 1 |
| Invalid answer | 2 | 0 |
| Closed file, cached | 0 | 0 |
| Privacy cleanup, two successful dibs from one player | 7 | 3 |

The claim table no longer maintains a duplicate category-order index or a one-player uniqueness index. Its remaining user/category index supports atomic limits. Taken guesses persist their rate-limit attempt once in DO storage; their progress is read back from authoritative D1 on reload, avoiding a second session write. Public boards are maintained only on completed files and read from shared storage; polling never rescans every strike. No rarity weight enters ranking.

## A stated 10,000-player workload fits; an unrestricted maximum does not

The old one-attempt projection is superseded. The following model allows up to three successful dibs per player, **one taken guess per daily player on average**, one summary share, one certificate/OG visit, a five-minute live connection, and the previous navigation allowance. It assumes no invalid/retry flood. Catalog capacity bounds successful dibs: conservatively two 2,200-answer registers can overlap one UTC day, so `C=min(3P,4400)` and distinct successful players `U=min(P,C)`. Taken guesses `S=P`.

Worker requests: `7P+C+S`. DO requests: Worker requests plus `0.55P+C` for socket messages and cold image lookups, plus a small daily alarm reserve. D1 reads reserve `43200+100C+60S+50P` for shared refresh, attempts, reloads, certificates and cleanup. D1 writes reserve `11C+6U+S`, including four eventual cleanup writes per claim (more than measured). DO writes reserve `3P+10C+S+8640+floor(C/3)+floor(S/5)+300`: sessions/touches/expiry, attempts and successful progress/cache writes, image creation/expiry, shares, snapshots and completed-file board updates. DO reads remain below five million with the prior bounded cache-retention architecture; active-duration envelope remains 12,904 GB-s from the Round 2 conservative always-active coordinator plus image work.

| Players/day | Worker requests | DO request units | D1 reads | D1 writes | DO writes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 | 1,100 | 1,455 | 84,200 | 4,000 | 12,460 |
| 1,000 | 11,000 | 14,550 | 453,200 | 40,000 | 44,140 |
| 10,000 | 84,400 | 94,300 | 1,583,200 | 84,800 | 96,406 |

**The unconditional 10,000-player maximum is not confirmed.** If all 10,000 players use five strikes, the same conservative model reaches **124,400 Worker requests, 134,300 DO units, 124,800 D1 writes and 144,406 DO writes**. These exceed free limits. Removing redundant claim indexes, using single-write strike rows, and eliminating duplicate strike session writes reduced cost, but do not make that workload fit. Extra navigation, invalid entries and repeated exports also consume headroom. This is a documented capacity limitation, not a claim that all legal game workloads fit free tiers. No plan or billing settings were changed. A later high-traffic architecture would need fewer request/storage operations; do not launch a 10,000-player all-five-strike campaign under this budget.

Limits checked against [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): 100,000 daily Worker/DO requests, 100,000 daily D1/DO SQL writes, 5 million D1 reads, 13,000 DO GB-s; D1 database size and retained images remain bounded as documented in Round 2. The stricter prior five-million DO-read allowance remains the planning ceiling.

## Category rollout

New catalogs reserve `4*answers + 3*normalized keys + 10` writes, including indexes. Replacements reserve double. A server-side durable daily reservation rejects uploads beyond **45,000 writes per UTC day**, even if a local journal or GitHub cache is lost. Reservations happen before sending writes; failed/uncertain uploads are not automatically retried. Admin approval has a small additional journal reserve. Uploads defer after a known busy traffic day; upload and peak gameplay budgets must not be combined. Current production is a closed preview with no fabricated claims.

Initial rollout: five verified/approved catalogs, 30,860 upload/admin writes reserved in the local journal. Remaining 25 run sequentially at 00:20 UTC daily via the private repository workflow. Each upload receives content and normalized-key verification before approval. Progress lives in `.upload-state.json` and downloadable workflow artifacts. Dates move forward if verification finishes too late. No upload is represented as complete before its successful remote verification.
