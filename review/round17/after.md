# R17 capacity and release evidence

**A complete game now costs 7 durable writes in the single-batch measurement: 1 D1 + 6 DO.** Flushing after every accepted guess (six separate mirror intervals) costs **6 D1 + 6 DO = 12**, meeting all three write targets. Typo, verification, viewing, sharing and returning add no writes. This is measured storage work, not an inferred count of SQL statements.

| Action / status | D1 read | D1 written | DO read | DO written | API Worker requests | DO requests |
|---|---:|---:|---:|---:|---:|---:|
| /bootstrap / 200 | 0 | 0 | 0 | 0 | 1 | 1 |
| socket upgrade / 101 | 0 | 0 | 0 | 0 | 1 | 1 |
| /verify-session / 200 | 0 | 0 | 0 | 0 | 0 | 0.05 |
| typo / 422 | 0 | 0 | 0 | 0 | 0 | 0.05 |
| claim / 201 | 0 | 0 | 1 | 1 | 0 | 0.05 |
| strike / 409 | 0 | 0 | 1 | 1 | 0 | 0.05 |
| reserved / 409 | 0 | 0 | 1 | 1 | 0 | 0.05 |
| reserved / 409 | 0 | 0 | 1 | 1 | 0 | 0.05 |
| claim / 201 | 0 | 0 | 1 | 1 | 0 | 0.05 |
| claim / 201 | 0 | 0 | 1 | 1 | 0 | 0.05 |
| /leaderboard / 200 | 0 | 0 | 0 | 0 | 1 | 1 |
| /events/share / 200 | 0 | 0 | 0 | 0 | 0 | 0.05 |
| /batch-mirror / 200 | 0 | 1 | 0 | 0 | 0 | 0 |
| /bootstrap / 200 | 0 | 0 | 0 | 0 | 1 | 1 |

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

## Measured exported file sizes

| Export | R16 PNG bytes | R17 light JPEG bytes | R17 dark JPEG bytes |
|---|---:|---:|---:|
| certificate-feed | 146044 | 94607 | 94719 |
| certificate-story | 160778 | 100523 | 100322 |
| summary-feed | 124047 | 81178 | 82446 |
| summary-story | 139300 | 86629 | 87621 |
| OG 1080×567 | 44935 | 71659 | light only |

All JPEGs are under 350 KB (and the 600 KB hard cap). OG JPEG is larger than the former PNG but still comfortably below target. Original browser exports already used flat tones, so compression/format is the measured saving; grain was not presumed to be the confirmed cause. The initial export proof used a stale preview CSP and was regenerated against the current server with the actual typefaces loaded. The final phone-size review confirms crisp Archivo/Instrument/Plex text.

## Final practice evidence and limitations

The clean GitHub runner completed 500 concurrent live sockets arriving in 119.783 seconds: **p50 124.0 ms, p95 137.0 ms, zero unexpected errors, 1,500 acknowledged/retained claims and exactly one contested-answer winner**. It received 29,430 public broadcasts with no private-answer fields. The HTTP run also passed (p50 194.4 ms, p95 266.2 ms). The fresh account-wide headroom check reported 11,781 D1 writes; reserving a conservative 15,000 for the run left 73,219 (73.2%) of the daily allowance, above the required 30%. CI consumed that check within three minutes; its temporary practice-only secret was removed afterward.

Two local-network load attempts failed with connection timeouts; those reports are retained. They were not counted as passes. Two CPU-heavy catalog tests timed out while browser matrices ran concurrently; the unchanged suite passed all 179 tests when rerun without that contention. Opening rehearsal found and fixed the anonymous-socket identity transition and the obsolete socket's close-handler race; the final six-browser closed-to-live run passed. Real practice verification, notifications, original dates and zero test claims are restored. Physical AirDrop remains an owner check, not a failed automated gate.

The 33 generated static rarity assets are at most 333 bytes. There are 168 curve captures, 213 certificate captures (including exports/baselines) and a 48-screen final design pass. Final automated totals: 179 unit/API tests and 882 browser cases (756 Chromium/WebKit/profile cases plus 126 Firefox cases), with no failures or skips in the final runs. The admin's legacy per-request telemetry does not include new journal traffic unless account-wide analytics is configured; quota planning above uses measured journal costs and account-wide headroom rather than those legacy counters.

Upgrade responses do not expose D1 diagnostic headers; the warmed upgrade path performs only cookie/security checks, no D1 query. Its DO storage delta is measured. Batch-mirror calls are shared scheduled work: their storage is included above, while the cron's invocation is counted in daily overhead. The final baseline DO cause totals exclude setup/control writes.

## Shipped

Released **Monday Nov 23 at 3:55 AM ET**, before the 2 PM deadline. Pages `cf4c4790-1cf1-48c3-b224-101f03b8a99c`; Worker `6d7cb066-1179-4773-9456-7140067def1e`. Release source commit `4e70462826efd6fabc17caea48971e04d5905fd2`. Eight read-only production combinations (Chromium/WebKit × 390/1440 × light/dark) passed, along with the test-free v17 bootstrap. The site remains closed until Monday 9 PM ET. Production still has exactly three users, zero claims and zero strikes; all captured legacy rows and the schedule are byte-equivalent after both migrations and the final smoke. Private backups are under `.backups/`.

The first deployment's immediate read check failed and triggered rollback before any Pages release. Its original assertion details were unfortunately obscured by the rollback helper's secondary error. Cloudflare disallowed deploying the original R16 Worker version across the Durable Object migration; the prepared legacy-engine fallback succeeded. Pages was already at the old deployment, which the corrected helper now recognizes as success. The verified compatible rollback point is Pages `18984cdc-6ae5-4bd2-9036-a7ef62611c76`, Worker `f30f06e5-dee9-4e20-8940-5831dea4e05c`. After adding read diagnostics and a route-propagation wait, the retry passed every production check. The original R16 IDs remain in `rollback-original.json`; the directly usable rollback IDs are in `rollback.json`. No production claims were created during verification.

Practice is clean with real Turnstile restored. The temporary GitHub practice credential was deleted. No ntfy was sent. Final screenshots and raw browser/Lighthouse captures remain in this project; the full results are summarized in `browser-summary.json`, `release-outcome.json` and the top of `MORNING_REPORT.md`.
