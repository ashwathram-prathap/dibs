# Round 2 free-tier budget

Checked November 21, 2026. Measurements use local workerd/SQLite D1 result metadata, including indexes and triggers. No remote D1 queries were run.

## Limits and architecture

Cloudflare currently includes 100,000 Worker requests/day; WebSocket upgrades count once and subsequent messages do not. Static Pages assets are unlimited. Cache hits still consume HTTP requests, so HTTP polling would exceed the free allowance. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

A single SQLite Durable Object coordinates public reads globally, persists snapshots, and hibernates between WebSocket messages. Clients poll every 15 seconds for two minutes, then 60 seconds; hidden tabs stop sending. Failed sockets fall back to 120-second HTTP refreshes. The requested later “15 seconds after two minutes” conflicts with item 6; the cheaper 60-second rule wins. `/today` and `/ledger` also use the Workers Cache API with canonical shared keys. The ledger cursor filters after that cache; the global coordinator queries indexed `claim_no > since` only once per shared refresh. Cold starts restore the persisted snapshot rather than scanning the whole ledger again.

D1 Free includes 5 million rows read and 100,000 written per UTC day, plus 5 GB storage. Index and trigger writes count. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

Durable Objects Free includes 100,000 request units/day, 13,000 GB-s/day, 5 million SQL rows read/day, 100,000 SQL rows written/day and 5 GB storage. Incoming socket messages count at 20:1; idle hibernating time is excluded. One 128 MB object even continuously active for 24 hours is at most 11,060 GB-s. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Measured actions

| Action | D1 rows read | D1 rows written |
| --- | ---: | ---: |
| First cold page load, empty active category | 1 | 0 |
| Warm page load / pending identity | 0 | 0 |
| Warm ledger poll (any player cursor) | 0 | 0 |
| One successful new-player claim | 9 | 14 |
| Taken answer | 6 | 0 |
| Invalid answer | 1 | 0 |
| Certificate view after claim | 0 | 0 |
| First / repeated OG render after claim | 0 | 0 |
| Handle re-roll | 0 | 0 |

Evidence: `d1-actions.json`; `npm test` repeats measurements. Identity and attempt counters use DO storage. Only claim submission creates D1 player data. Existing signed cookies get a one-time D1 lookup on migration, then use private DO session storage. New clients never perform that lookup. Public certificate misses and archive misses are shared, cached lookups.

## Five-minute daily visits

Model: one visit, one claim attempt, one exported share, one certificate view and its OG image per player; eight HTTP requests/player including the second document's bootstrap. Eleven socket poll messages/visit. Static assets and local suggestions add zero Worker requests. Successful claims are bounded by the actual 2,046–2,200-answer catalogs. Conservatively allow two full 2,200-answer registers inside a UTC billing day: `C = min(players, 4400)`.

Reads budget: `43,200 + 40C + 6(players−C) + 5players`. The shared-read allowance covers 8,640 refreshes at five rows each, claim reads are rounded up, and cold certificate reads are included even though own claims are already cached. Writes include 14 per successful claim plus three per claim for eventual privacy/rate-limit cleanup. Draft uploads/admin maintenance are separate and must not share a busy traffic day.

| Daily players | Worker requests | DO request units | D1 reads (budget) | D1 writes (budget) |
| --- | ---: | ---: | ---: | ---: |
| 100 | 800 | 855 | 47,700 | 1,700 |
| 1,000 | 8,000 | 8,550 | 88,200 | 17,000 |
| 10,000 | 80,000 | 85,500 | 302,800 | 74,800 |

At 10,000 visits this leaves 20,000 Worker HTTP requests for retries/other navigation. It is not a promise of unlimited browsing, rerolls or hostile traffic. DO storage writes also have headroom: session creation, one attempt, successful claim/session/certificate updates, 8,640 snapshot refreshes and image persistence total under 60,000/day for this workload. Public certificate reads are keyed by claim; arbitrary player cursors cannot amplify D1 reads.

PNG previews are rendered once, coalesced for simultaneous requests, and stored in DO SQLite for 30 days. Later links use the common Dibs card rather than rendering an old claim again. HTML certificates and client PNG exports remain available. At the measured 43,057-byte card, 31 full 2,200-claim registers occupy about 2.94 GB before SQLite overhead. The retention is deliberate: indefinite image retention cannot fit any finite free tier.

First-load compressed payload measured from the production build: **250,328 bytes**, including JS, CSS, HTML, the three Latin WOFF2 fonts and favicon, excluding grain PNG. Catalogs load only after typing; they are static Pages files. The initial bundle has no fixtures. Both supplement faces are now WOFF2; OTF/WOFF sources remain only for rebuilding and server-side outlines.

The bootstrap returns the latest 50 filings, keeping the initial payload bounded even near sellout. Earlier records load in 50-row pages from the same shared cache.
