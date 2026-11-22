# R8 runtime limits

Verified against Cloudflare documentation on November 22, 2026:

- The outer Free Worker has 10 ms CPU per request and 128 MB memory. Its uncompressed bundle limit is now 64 MiB; compressed size is informational. Startup must finish within one second. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- The SQLite Registry Durable Object runs catalog lookups. Its default CPU allowance is 30 seconds per invocation, including on Free. Network waits do not count as active CPU. [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)

The final practice benchmark (05:48–05:49 ET) accepted 6,600 of 6,600 sampled lookups across all 33 catalogs. Warm p95 was below Cloudflare’s timer resolution; the slowest cold download/lookup took 3.346 seconds. The separate local Node timing proxy measured a worst warm exact p95 of 0.114 ms. These are distinct measurements; zero timer ticks do not mean zero CPU or latency.

The sanitized runtime sample recorded 95 outer Worker invocations (maximum 1 ms CPU), 46 Registry Durable Object invocations (maximum 265 ms CPU, including cold initialization), and 220 ImageCache invocations. Every sampled outcome was `ok`. Sampling does not cover every invocation and does not provide a physical-phone memory measurement. The deployed bundle is 27,919.94 KiB uncompressed; startup took 307 ms. See `practice-all-registers-benchmark.json`, `practice-all-registers-runtime.json`, and `local-lookup-benchmark.json`.

The largest full spelling register was separately exercised through the actual browser Worker in Chromium and WebKit. All 12 submitted typos returned valid distance-1-or-2 suggestions in 21–414 ms over local HTTP. This does not certify mobile-network download times or physical-device memory; see `large-spelling-benchmark.json`.
