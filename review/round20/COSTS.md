# Capacity, quota and cost evidence — 28 November 2026

No hosted operating range is proven for R20. The separate load-test credential file contains no usable account/token pair. Account-wide read-only analytics were obtained with existing Cloudflare authentication for account `5cf62cff0219727f2121253b3924f886`; credentials and email were not included in committed evidence. Free tier is the owner's configured constraint; no plan or billing setting was changed. Independent billing-subscription confirmation remains unavailable.

## Real nights

`real-night-baseline.json` contains aggregate SELECT results only. It queries D1 mirrors, so the Friday window is provisional and the live journal watermark is unavailable on R19I.

| Toronto registry day | Participating files | Claimers | Accepted claims | Finished (3 claims or 5 strikes) | Finish rate |
|---|---:|---:|---:|---:|---:|
| Monday Nov 23 | 191 | 171 | 376 | 113 | 59.2% |
| Tuesday Nov 24 | 215 | 194 | 432 | 128 | 59.5% |
| Friday Nov 27, at about 11:41 PM ET | 3 | 3 | 9 | 3 | 100%, n=3, incomplete night |

This is a later snapshot than the owner's earlier ~106-claimer account-window measurement. It does not invalidate that earlier count or attribute all its 4,481 writes / 144,682 reads to game actions. Friday peak load and active-path verification/connection history cannot be reconstructed from the legacy admin counters. No production test players were created and no production golden draw was inspected.

The UTC Nov 28 account snapshot (`account-usage.json`) includes production, background and administration together. It is not a marginal per-player measurement. Monitoring SELECTs, calendar, old journal replays, setup and other account workloads cannot be separated retrospectively using the available counters. There are seven approved future dates, Nov 28–Dec 4, already uploaded.

## Local marginal scenario

The reproducible `scripts/capacity-budget.ts --r20 --journal --storage --label=after` scenario includes bootstrap, socket upgrade, verification, typo, six distinct guesses (three accepted, one taken, two reserved), leaderboard, share-intent and return. A separate control player establishes the taken answer. It uses synthetic Miniflare fixtures and test verification; storage instrumentation adds IO and must not be used for duration benchmarking.

| Unit | R19I local baseline | R20 local candidate |
|---|---:|---:|
| HTTP requests to the API | 4 | 4 |
| Raw inbound socket messages | 9 | 9 |
| Modeled billed DO requests | 4.45 | 4.45 |
| D1 rows read for marginal flow | 0 | 0 |
| D1 rows written after final mirror | 1 | 1 |
| DO logical rows read | 9 | 10 |
| DO logical rows written | 8 | 9 |

The extra DO write is a batch watermark, not a write on every guess. It saves repeat mirror work after restart; steady-state marginal writes are not claimed lower. Daily fixture setup is separate: 49 D1 reads / 102 D1 writes, and R20 instrumentation observed 8 DO reads / 10 writes including the control setup. New identity network throttling, live authentication, mirror timing, expiry alarms, admin polling, bot traffic, HTML/asset loads, history lookups and per-player behavior can add costs. A long-lived real game may mirror a player several times. These are measured local actions, not a guarantee of 1 D1 write per production player.

Per-player journal UTF-8 history bytes, hosted memory, hosted CPU, final serialized broadcast throughput and network RTT were not fully measured. Local generator RSS is reported separately and is not Worker memory. The resident production day alone is estimated at `86400 * .128 = 11059.2 GB-s/day`, before other objects; this is not a measured duration result.

## Budgets and skipped stages

`shared/load-budget.ts` enforces each-stage and cumulative <=20% limits across all supplied units, reserves the larger of forecast plus safety or 30%, and rejects missing/stale metrics or an incorrect UTC day. A complete durable campaign ledger and hosted admission/deadline controller are still required before using it to send load. Storage also needs a complete account-wide inventory; an absent field is not zero.

Hosted stages 500, 1k, 2k, 5k, 10k and the >=10-minute soak were all skipped because the practice/release asset gate failed. No hosted gameplay load, setup, cleanup or restore-rehearsal traffic was sent. Aggregate production inspection still consumes real read/request quota and is included in account usage, not relabeled as free. The local 500-stage attempts failed at the generator/connection layer; no claim latency or capacity pass can be inferred from them. The 50-player local diagnostic passes its narrow scenario only. No “10k pass” exists.

## Monthly estimates only

A 30-day illustration uses 4–8 billed Worker/Pages requests, 4.45 DO request units, 1 D1 write and 9 DO writes per player from the local scenario, plus one continuously resident day object. The Worker/Pages range is an assumption for proxy/HTML overhead, not a measured billed ratio. CPU, retained storage growth, operational traffic and retries are excluded, so these are usage-component estimates, not quotations or recommended plans.

| Scenario | Free-tier outcome | Published $5 Workers plan illustration |
|---|---|---|
| 5,000 players/day | $0 while within every limit; ~45k DO writes/day plus shared work. No concurrent capacity proven. | Base $5; illustrated request allocations remain included, before excluded costs. |
| 10,000 players/day | ~90k DO writes/day leaves little margin; resident duration leaves <15% nominal headroom. Not a safe/proven free operating range. | About $5.15 for base + rounded excess DO request units; CPU/storage/operational additions unknown. |
| 50,000 players/day | ~200–400k Worker requests, 222.5k DO request units and 450k DO writes/day exceed free daily limits. Cannot sustain this scenario on free. | About $5.90–$6.50 for base + request components; CPU/storage/operational additions unknown. |

Even the arithmetic 30%-reserve ceiling from nine DO writes/player is only about 7,777 players/day before shared writes; it says nothing about simultaneous connections or guesses/second. Free quota exhaustion fails the affected operations until the UTC reset. The API's existing quota response asks players to return after reset; no automatic paid overage or plan upgrade was enabled.

Sources checked Nov 28: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (100k daily free requests, Pages Functions billed as Workers, $5 base and paid request/CPU allocations); [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) (100k requests, 13k GB-s daily, SQL row limits, socket billing, rounding and UTC resets); [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) (5m reads/100k writes daily and index-write accounting); [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) (20k free files, 25 MiB platform asset maximum). The owner's 15k-file/10MB gates are deliberately stricter.
