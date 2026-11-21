# Round 2 free-tier budget

Checked November 21, 2026. Measurements use local workerd/SQLite D1 result metadata, including indexes and triggers. No remote D1 queries were run.

## Limits and architecture

Cloudflare currently includes 100,000 Worker requests/day; WebSocket upgrades count once and subsequent messages do not. Static Pages assets are unlimited. Cache hits still consume HTTP requests, so HTTP polling would exceed the free allowance. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

A single SQLite Durable Object coordinates public reads globally, persists snapshots, and hibernates between WebSocket messages. Clients poll every 15 seconds for two minutes, then 60 seconds; hidden tabs stop sending. Failed sockets fall back to 120-second HTTP refreshes. The requested later “15 seconds after two minutes” conflicts with item 6; the cheaper 60-second rule wins. `/today` and `/ledger` also use the Workers Cache API with canonical shared keys. The ledger cursor filters after that cache; the global coordinator queries indexed `claim_no > since` only once per shared refresh. Cold starts restore the persisted snapshot rather than scanning the whole ledger again.

D1 Free includes 5 million rows read and 100,000 written per UTC day, plus 5 GB account storage. Index and trigger writes count. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

Durable Objects Free includes 100,000 request units/day, 13,000 GB-s/day, 5 million SQL rows read/day, 100,000 SQL rows written/day and 5 GB storage. Incoming socket messages count at 20:1; idle hibernating time is excluded. One 128 MB object even continuously active for 24 hours is at most 11,060 GB-s. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Measured actions

| Action | D1 rows read | D1 rows written |
| --- | ---: | ---: |
| First cold page load, empty active category | 1 | 0 |
| Warm page load / pending identity | 0 | 0 |
| Warm ledger poll (any player cursor) | 0 | 0 |
| One successful new-player claim | 9 | 15 |
| Eventual IP/privacy cleanup per successful claim | 4 | 2 |
| Taken answer | 6 | 0 |
| Invalid answer | 1 | 0 |
| Certificate view after claim | 0 | 0 |
| Cold full-ID certificate / printed prefix | 4 / 5 | 0 |
| First / repeated OG render after claim | 0 | 0 |
| Handle re-roll | 0 | 0 |

Evidence: `d1-actions.json`; `npm test` repeats measurements. Identity and attempt counters use DO storage. Only claim submission creates D1 player data. Existing signed cookies get a one-time D1 lookup on migration, then use private DO session storage. New clients never perform that lookup. Public certificate misses and archive misses are shared, cached lookups.

## Five-minute daily visits

Model: one visit, one claim attempt, one exported share, one certificate view and its OG image per player; eight HTTP requests/player including the second document's bootstrap. Eleven socket poll messages/visit. The DO request column includes one extra certificate-cache lookup per newly generated image (at most C), plus up to nine daily alarms outside the rounded table. Static assets and local suggestions add zero Worker requests. Successful claims are bounded by the actual 2,046–2,200-answer catalogs. Conservatively allow two full 2,200-answer registers inside a UTC billing day: `C = min(players, 4400)`.

Reads budget: `43,200 + 40C + 6(players−C) + 10players`. The shared-read allowance covers 8,640 refreshes at five rows each, claim reads are rounded up, and cold certificate reads are included even though own claims are already cached. Writes budget 15 per successful claim plus four per claim (conservatively above the two measured) for eventual privacy/rate-limit cleanup. Draft uploads/admin maintenance are separate and must not share a busy traffic day.

| Daily players | Worker requests | DO request units | D1 reads (budget) | D1 writes (budget) |
| --- | ---: | ---: | ---: | ---: |
| 100 | 800 | 955 | 48,200 | 1,900 |
| 1,000 | 8,000 | 9,550 | 93,200 | 19,000 |
| 10,000 | 80,000 | 89,900 | 352,800 | 83,600 |

At 10,000 visits this leaves 20,000 Worker HTTP requests for retries/other navigation. It is not a promise of unlimited browsing, rerolls or hostile traffic. DO storage writes also have headroom: session creation, one attempt, successful claim/session/certificate updates, 8,640 snapshot refreshes and image persistence plus aggregate share counters total under 100,000/day, including 30-day session expiry and daily certificate-cache cleanup for this workload. Public certificate reads are keyed by claim; arbitrary player cursors cannot amplify D1 reads.

PNG previews are rendered once, coalesced for simultaneous requests, and stored in DO SQLite for 30 days. Later links use the common Dibs card rather than rendering an old claim again. HTML certificates and client PNG exports remain available. At the measured 43,057-byte card, 31 full 2,200-claim registers occupy about 2.94 GB before SQLite overhead. The retention is deliberate: indefinite image retention cannot fit any finite free tier.

First-load compressed payload measured from the production build: **250,401 bytes**, including JS, CSS, HTML, the three Latin WOFF2 fonts and favicon, excluding grain PNG. Catalogs load only after typing; they are static Pages files. The initial bundle has no fixtures. Both supplement faces are now WOFF2; OTF/WOFF sources remain only for rebuilding and server-side outlines.

The bootstrap returns the latest 50 filings, keeping the initial payload bounded even near sellout. Earlier records load in 50-row pages from the same shared cache.


## What exhausted the earlier quota

The recorded error was the **daily rows-read quota**, code 7500, not a player spike. `review/d1-quota.json` records the prior diagnosis: draft replacement deleted parent answer rows before child foreign-key lookup indexes existed, repeatedly scanning other registers. That cause is inferred from the schema and query plan, not a recovered billing trace. Migration 0002 supplies both child indexes. Migration 0004 now bounds privacy cleanup to unsanitized rows rather than rescanning the full archive.

Uploads now use at most 18 JSON batches per answer table (under 50 D1 statements per request), an atomic replacement transaction, and a content fingerprint: retrying the same draft is a no-op. `scripts/upload-drafts.ts` defaults to local, runs categories sequentially, reserves worst-case deletion/insertion/index writes before sending, and stops at 45,000 writes/day. It never retries failures automatically or approves a category. Its durable local journal is `.upload-state.json`; keep it when cleaning up. One Animals replacement reserves 30,810 writes. Remote mode is locked until the specified quota reset. New/approved catalogs are capped at 2,200 answers to preserve the stated traffic budget; all existing draft files already fit.

Quota errors become a clerk-voice closed page. The coordinator remembers a D1 quota failure until its UTC reset, preventing a retry loop. The browser retains no raw provider error. Image storage has eight 400 MB payload ceilings (3.2 GB total) as well as its 30-day retention; if that ceiling is reached, subsequent social previews use the common Dibs card. Each image shard remains below 1 GB; their combined 3.2 GB ceiling plus the separate read/session object leaves account headroom. Inactive private session caches expire at 30 days and certificate response caches at one day; D1 records persist. Long-term D1 storage still needs periodic archiving; this daily throughput projection is not unlimited retention.

The limits page separately specifies a **500 MB per-D1-database ceiling** on Free. The DO limits page has inconsistent wording (10 GB in its general table, 1 GB for Free in its failure description); this implementation budgets below the stricter 1 GB per object. See [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/). Cache/image retention is bounded; permanent D1 records need archiving before the database approaches 500 MB.


The DO storage envelope is `4P + 9C + 8,640 + 300` writes/day: new or touched sessions, attempts, one aggregate share write, expired sessions; successful session/certificate writes; image body, byte budget and expiry; eventual image/certificate expiry; shared snapshots and maintenance reserve. This is **10,240 / 21,940 / 88,540 writes/day** at 100 / 1,000 / 10,000 players. The deliberately loose read envelope `100,000 + 60P + 40C` stays below **876,000/day** at 10,000 (including paginated 30-day cache expiry), below the 5 million limit. Image shard operations add brief active work; reserving one second per image request plus each cold image's internal lookup is 1,844 GB-s at the largest workload. Combined with the conservative always-active coordinator bound, this is under 12,904 GB-s/day. Actual hibernation reduces that substantially. These are workload projections, not measured remote latency guarantees.

Certificate cache misses now use an indexed exact primary-key lookup; printed prefixes use a bounded primary-key range. The former OR/LIKE query was removed so certificate costs do not grow with archive size. The projection allows ten reads per cold certificate, including short links.

The final asset sum is 250,401 bytes; with the measured local bootstrap response it is 251,150 compressed bytes, excluding grain. `payload.json` lists the files and measurement.
