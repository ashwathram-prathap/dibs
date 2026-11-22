# Round 4 sharing budget

Round 2's OG envelope remains unchanged: eight image shards, at most 400 MB of PNG payload each (3.2 GB combined), 30-day retention, and the common Dibs card after expiry or at capacity. A single result's image is rendered on its first fetch and reused across crawler user agents. Cache keys and metadata image URLs include an R4 revision so new shares do not reuse old answer-bearing cards. Moderation invalidates metadata and images. Per-result permanent links survive image expiry.

Measured local certificate and summary images are approximately 42 KB, under 300 KB. Cold render+fetch took under 100 ms locally; see `preview-fetches.json`. The deployed generic card is 38,292 bytes, with measured 57–162 ms responses: `live-fetches.json`. These are observations, not latency guarantees. Production is prelaunch and has no genuine certificate/summary to measure yet.

Share and arrival requests write a single aggregate DO counter record (day → platform → totals), with **zero D1 writes**. There are no event rows, player identifiers, captions, IPs or referrers in those counters. GETs and image generation do not increment them. A public summary adds one small permanent reference per closed file, pointing to existing game records. Indexed D1 reads rebuild its cached public view after expiry or moderation; no new D1 schema or writes are needed.

The Round 3 workload remains the baseline: `P` daily players, successful dibs `C=min(3P,4400)`, strikes `S=P`, one shared-result page/image per player. Conservatively assume every player first arrives from a share (`A=P`). A bound on completed files is `F=min(P,floor(C/3)+floor(S/5))`. Add A Worker and DO requests, A aggregate writes, F summary-reference writes, and at most floor(S/5) terminal-strike session writes. Normal taken guesses still avoid a second session write. Rendering either a certificate or summary uses the existing one-image allowance; visiting both costs extra. The Round 3 D1 read envelope has ample room for the small indexed summary lookup, and D1 writes are unchanged.

| Daily visitors | Worker requests | DO request units* | DO writes* |
| --- | ---: | ---: | ---: |
| 100 | 1,200 | 1,555 | 12,680 |
| 1,000 | 12,000 | 15,550 | 46,340 |
| 10,000 | 94,400 | 104,300 | 111,872 |

*Plus the existing small alarm reserve for request units. Writes are conservative planning envelopes, not production usage measurements. No bulk category upload allowance may be added to a busy gameplay day.

The full 10,000-visitor scenario now exceeds the 100,000/day free DO request/write allowance, even before repeated taps or extra navigation. It must not be advertised as supported on this plan. Normal smaller prelaunch traffic fits. All-five-strike traffic remains the separate, larger Round 3 limitation. No paid services, plans or limits were enabled. Permanent metadata grows with completed files and needs retention planning alongside the existing permanent D1 registry; image retention itself remains bounded.

References: [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [Worker pricing](https://developers.cloudflare.com/workers/platform/pricing/). The 8-shard storage ceiling and retention follow `review/round2/free-tier.md`.
