# R8 runtime limits

Verified against Cloudflare documentation on November 22, 2026:

- The outer Free Worker has 10 ms CPU per request and 128 MB memory. Its uncompressed bundle limit is now 64 MiB; compressed size is informational. Startup must finish within one second. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- The SQLite Registry Durable Object runs catalog lookups. Its default CPU allowance is 30 seconds per invocation, including on Free. Network waits do not count as active CPU. [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)

The 03:08 practice benchmark sampled 6,600 successful lookups across all 33 catalogs. Warm p95 was below Cloudflare clock resolution. The largest cold download took 2.279 seconds. Sanitized runtime samples recorded outer Worker CPU at most 1 ms and Registry CPU at most 211 ms, including cold initialization. Sampling did not capture every request. The deployed bundle was 15,307.83 KiB uncompressed and startup took 166 ms. See `practice-all-registers-benchmark.json` and `practice-all-registers-runtime.json`; later catalog revisions require a new benchmark.
