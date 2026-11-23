# R17 capacity and release evidence

**A complete game now costs 7 durable writes in the single-batch measurement: 1 D1 + 6 DO.** Flushing after every accepted guess (six separate mirror intervals) costs **6 D1 + 6 DO = 12**, meeting all three write targets. Typo, verification, viewing, sharing and returning add no writes. This is measured storage work, not an inferred count of SQL statements.

| Action / status | D1 read | D1 written | DO read | DO written | Transport |
|---|---:|---:|---:|---:|---|
| /bootstrap / 200 | 0 | 0 | 0 | 0 | http |
| /verify-session / 200 | 0 | 0 | 0 | 0 | socket |
| typo / 422 | 0 | 0 | 0 | 0 | socket |
| claim / 201 | 0 | 0 | 1 | 1 | socket |
| strike / 409 | 0 | 0 | 1 | 1 | socket |
| reserved / 409 | 0 | 0 | 1 | 1 | socket |
| reserved / 409 | 0 | 0 | 1 | 1 | socket |
| claim / 201 | 0 | 0 | 1 | 1 | socket |
| claim / 201 | 0 | 0 | 1 | 1 | socket |
| /leaderboard / 200 | 0 | 0 | 0 | 0 | http |
| /events/share / 200 | 0 | 0 | 0 | 0 | socket |
| /batch-mirror / 200 | 0 | 1 | 0 | 0 | shared batch |
| /bootstrap / 200 | 0 | 0 | 0 | 0 | http |

| Matched complete game | R16 | R17 one batch | R17 six intervals |
|---|---:|---:|---:|
| D1 rows written | 55 | 1 | 6 |
| DO rows written | 70 | 6 | 6 |
| Total durable writes | 125 | 7 | 12 |
| D1 rows read, warm new player | 800 | 0 | 0 |
| DO rows read | 71 | 6 | 6 |
| API HTTP / incoming socket messages | 4 / 9 | 4 / 9 | 4 / 9 |
| Conservative account Worker invocations | 8 | 8 | 8 |
| Billed-equivalent DO requests | 4.45 | 4.45 | 4.45 |

The six-interval trace is `capacity-spread.json`. A returning player after eviction needs identity/history reads; warm zero does not mean all reads are free. Identity is committed with the first event rather than writing anonymous visits to D1. The file mirror also carries streak state, advancing its date only on the first claim of that day. The final accepted response already contains the complete file/summary; the UI avoids a redundant completion bootstrap when that reference is present.

## Free limits and games/day

| Quota | Daily free allocation | R16 games/day | R17 games/day before shared overhead |
|---|---:|---:|---:|
| D1 writes | 100,000 | 1,818 | 100,000 single batch; 16,666 six intervals |
| DO writes | 100,000 | 1,428 | 16,666 |
| D1 reads | 5,000,000 | 6,250 | warm path not binding; cold/administrative reads are separate |
| DO reads | 5,000,000 | 70,422 | 833,333 warm; replay adds six event rows per prior complete player |
| Account Worker requests | 100,000 | 12,500 | 12,500 |
| DO requests | 100,000 | 22,471 | 22,471 |
| DO duration | 13,000 GB-s | not measured per game | shared wall time; see below |

Requests bind first for the defined socket workload: roughly **12,320 games/day after 1,440 minute-cron Worker invocations**, before unrelated traffic, certificate previews, recovery, additional visits and other account usage. This exceeds the 8,000-game goal. All-HTTP fallback needs more requests and has a lower ceiling; this is not a promise of unlimited retries or share-preview traffic.

Limits checked against [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) on Nov 23. Daily limits reset at midnight UTC. Pages Functions share the Worker request allowance; incoming socket messages count 20:1 for DO requests.

## 10,000 complete players

- Account Worker invocations: **80,000** for the measured socket flow, plus approximately 1,440 cron invocations and extra visits/previews. About 18,560 remain before other account traffic.
- DO requests: **44,500** player-equivalent requests, plus current-day flush, close and legacy monitoring/schedule cron calls (budget roughly 6,000 shared calls/day).
- D1 writes: **10,000–60,000**, depending on one to six distinct mirror intervals per player, plus approximately 74 daily special/catalog setup writes and one final board snapshot. No per-guess identity, streak, counter or session writes.
- D1 reads: warm new-player scenario **0** per game; allow at least 10,000 for returning-player identity reads, about 1,440 previous-board checks and shared schedule/monitoring/initialization. One restart may retry up to 10,000 mirror rows and repeat initialization; it cannot lose claims. Reserve headroom rather than treating the warm measurement as a universal zero.
- DO writes: **60,000**, plus two SQLite table-creation rows for a fresh category. No per-game alarm or snapshot writes.
- DO reads: **60,000** in the warm workload; each full restart adds up to 60,000 journal rows. The event log is authoritative and loaded before accepting new claims.
- DO duration: production deliberately keeps **one** live category object in memory with a 60-second in-memory flush timer. A full 24-hour day at 128 MB is **11,059.2 GB-s**, leaving **1,940.8 GB-s** of the 13,000 shared allowance for practice, other objects and brief close overlap. It is shared across players, not multiplied by 10,000. Practice stays hibernatable. Closed days are not awakened by every cron once their final board is stored. This avoids repeated idle cron replay consuming the read allowance. Forced eviction remains safe and is tested. These are conservative duration bounds; the local instrumented test is not a production billing measurement.

This is a quota projection, not a 10,000-simultaneous-browser throughput test. Persistent storage bytes and accumulated historical days remain finite (5 GB); indefinite retention at 10,000 daily players is not claimed. Recovery/admin scans, privacy deletion and unusual retries consume the account reserves.

## Correctness, interface and sharing

Ten journal tests cover real runtime restart, contention, replay, exact close-time mirror/board, next-day streak, recovery, cross-day deletion, moderation/founder assignment, no-peek and both additive migrations preserving seeded legacy data. Legacy claims/strikes/users/points remain untouched. Public individual certificates hide both percentile and points before close; owner responses retain stored rarity. Public summaries show only curve positions, never answer text before close.

Rarity density uses actual measured percentile ranks, 48 Gaussian-smoothed bins, not a fabricated bell. Percentile ranks naturally produce a broad plateau. Static JSONs are below 2 KB and excluded from Functions. Marker animation is 600 ms and respects reduced motion. Both themes, exact 390/1440 holder/sealed/closed screenshots, 320–2560 profile curves, 200% desktop zoom and 390x844 payoff fit are recorded. Axe reports no AA violations on those certificate states. The final 48-screen design pass found no horizontal overflow or anti-AI checklist hits; serials, rules and stamps remain deliberate details. The longest mobile certificate, dense admin calendar and long rules page remain the weakest visual screens, without broken layout.

Native file share is pre-rendered and files-only, then URL/text, then explicit copy/download fallback; cancellation is normal. JPEG is 1080px wide at quality 0.85 (0.8 fallback only if needed), flat paper/carbon tone; OG remains light. Real-device AirDrop still requires the owner's Apple-device check; emulation cannot certify the physical transfer.

Practice load, browser results, export byte sizes and production outcome are recorded alongside this report and in MORNING_REPORT.md. No billing changes and no ntfy alert were sent.
