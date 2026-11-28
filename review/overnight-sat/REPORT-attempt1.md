# Saturday overnight report — 28 November 2026

**R20 is incomplete and production is a NO-GO. R21 was not started.** The mandatory 10,000,000-byte asset limit fails on catalogs that existing days still reference. The instructions prohibit pruning required assets to force a pass and require R20 production smoke before R21. Work stopped after local validation. Hosted practice deployment was blocked by the same asset gate; neither hosted practice nor production was deployed.

## What is live

Production remains **R19I**, tag `r19i-done`. No `r20-done` or `r21-flow-done` tag was created.

- Pages: `8655ae26-06a7-4929-9fe9-de560dbed835`, source commit `2a11d01253aefe03942b0c248bf0aa3b5f1e3da8`.
- Worker version: `26410237-28f6-4707-86fa-21a3af998a54`.
- Worker deployment: `5350bff9-d13c-49e9-8d49-96aa9338b1af`.
- The same IDs were verified at the end using read-only deployment APIs (`review/round20/ending-deployment.json`). They remain the recorded application rollback points; no rollback was needed.
- Seven approved future dates, Nov 28–Dec 4, remain uploaded. Existing scheduled openings and commitments were not changed.

## Local work, not shipped

Committed and pushed `.gitignore` at `1a93f46`, then the local safety candidate at `ba9c97c` and final single-rule/admin evidence support at `621649e`:

- Incremental exact standings and finished-only comparisons; accepted-event day counters; shared day JSON serialized once per broadcast, still approximately 1 Hz.
- Close recheck after asynchronous scoring; private journal watermark after successful mirror batches; durable retry/finalization alarm with its registry date retained across eviction; closed-board refresh after moderation/deletion.
- Admin-only current-day funnel with a 60-second cache, exact/cumulative buckets, participant finish rate, consecutive accepted-claim median and explicit exclusions. Frontend pending RPC ceiling.
- Saturday date/recovery-reserve guards, strict asset boundaries, fail-closed candidate evidence checks and guarded calendar/pruning mutations. Full cross-machine serialization is still a release blocker.
- Read-only real-night/account evidence, reproducible local tests and CPU/cost scripts, architecture and scaling design, DR limitations and full request inventory.
- Recorded the owner's Tue Nov 24 house-word decision in `PUBLIC-READINESS.md`. C2 is resolved by decision, not by a secrecy code change. The final read-only GitHub check returned PUBLIC; this run did not change visibility.

The initial modified review files were stale regenerated R7/R11/R14/R19B fixtures (including old dates and synthetic preview IDs), and were restored as instructed. Tests regenerated some of them again; they were restored again before finishing. The pre-existing `scripts/r11-practice.ts` edit was preserved and not included in our commits. Existing untracked owner specs/scripts/results were left intact. No secrets were committed; staged files were checked against local secret values.

## Why release stopped

The final build contains **13,852 files**, **1,163,929,019 bytes total**, and an **18,386,687-byte** largest file. File count passes; maximum size fails. Required pinned full indexes include Animals 13,828,838 bytes, Cities 13,098,232, Films 18,386,687 and Songs 10,615,746. Scheduled/reference metadata is in `review/round20/required-assets.json`.

Three safe approaches were evaluated: the intact artifact fails; removing only unreferenced output still leaves those required oversized files; a new future format/version does not eliminate the requirement to serve old immutable URLs and compatible rollback clients. No old bytes, ordinals, catalog IDs, committed draw or database row was rewritten to evade the limit. A tested historical-asset delivery/migration design is required.

Other unpassed safety gates remain explicit in `review/round20/AUDIT.md`: complete journal-loss backup/restore with measured RTO/RPO and deletion reconciliation; hosted mixed-version/rollback rehearsal; complete server admission/cache bounds and active-path monitoring; full fresh browser/physical-device gates; and a durable hosted campaign ledger/admission controller. The new date/evidence guard is fail-closed scaffolding, not evidence that these gates passed. No production backup was claimed; the existing backup script exports D1 only and misses unmirrored journal events.

## Capacity and costs

**Hosted R20 capacity is not proven.** No hosted 500/1k/2k/5k/10k stage or >=10-minute soak ran. The empty separate-account credentials were detected correctly, including comment-only content. Local 500-player attempts failed with connection resets; one also exposed the existing shared-network identity limit. They were retained as failures, not relabeled. A 50-player Miniflare diagnostic retained all 150 acknowledged claims, with one contention winner; it is a short local scenario, not hosted capacity.

The measured local complete-player fixture used **1 D1 row write, 9 DO logical row writes, 4 HTTP requests and 9 inbound socket messages (4.45 modeled DO request units)**. R19I's comparable fixture used 8 DO writes; R20 adds a batch checkpoint to prevent restart re-mirroring. Setup/background work is separate, real verification and asset/proxy traffic differ, and real mirrors may write a player repeatedly. This is not a claim of one D1 write per real production player.

Read-only mirrored real-night evidence: Monday 191 participants / 171 claimers / 376 claims / 113 finished; Tuesday 215 / 194 / 432 / 128; Friday about 11:41 PM ET 3 / 3 / 9 / 3. Friday is provisional until close and mirror convergence. Active-path peak load is unavailable; no zero or invented peak was substituted. The owner's earlier 4,481 writes / 144,682 reads per ~106 claimers is an account-window ratio, not proven marginal cost.

Monthly usage illustrations, exclusions, quota exhaustion behavior and dated official sources are in `review/round20/COSTS.md`. The free-tier 50k/day scenario exceeds multiple daily limits. The illustrated paid-plan request components are about $5.15/month at 10k/day and $5.90–$6.50 at 50k/day, excluding unknown CPU, storage growth and operations; **no plan was changed**.

## Remaining owner-requested work

`review/round20/AUDIT.md` tracks every R20 section with paths, status and follow-up acceptance. Onboarding, golden visual completion, yesterday recap, OG legibility, breed ingestion/scope fallback and strike grammar remain unimplemented or incompletely audited after the failed priority safety gate. These are still requested, not marked shipped. Friends, My claims and separate unlimited/archive play remain Dec 3 work.

R21 remains entirely pending: paced/skippable reveals, explicit pinned pool membership, off-register moment and real nightly counts, future 3%-pool golden policy clamped to 50–100 with +50 bonus, simulation against the first two closed nights, compatible policy rollout/rollback, momentum/sharing, the Claimant → Owner → Landlord → Baron → Dibillionaire ladder, and bounded analytics. No effective rule date was invented and existing +100 days were unchanged. Its one-hour R20 live-stability prerequisite was never reached.

## Validation and usage

Final validation details are in `review/round20/VALIDATION.md`; artifact/config/schema hashes are in `review/round20/candidate-evidence.json`, explicitly marked `releaseAllowed: false`.

**Codex token count: unavailable.** This runtime exposes no trustworthy per-session token counter. No estimate is presented as an actual count, and no files outside the project were inspected to obtain one.

No ntfy alert, social post, email, production test player, production restore, billing change or repository visibility change was performed. All tests ran locally; no Actions matrix was triggered.
