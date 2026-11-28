# Owner amendment continuation, 28 November 2026

Resumed at 00:34 ET from pushed candidate `2712add`. `.gitignore` load-test protection was already committed in the previous attempt. The only initially modified tracked file was the owner's `scripts/r11-practice.ts`; it remains untouched. Regenerated R7/R11/R14/R19B fixtures were restored after testing.

Fresh checks: 291/291 unit/API tests; TypeScript; build 13,852 files, largest 18,386,687 bytes; 4/4 admin UI checks; 36/36 hosted read-only practice checks; actual practice Worker rollback/forward recovery preserving existing mirrored scores and schedule. Lighthouse hosted practice mobile 99 performance / 100 accessibility, desktop 100/100. This is a continuation of the unchanged UI candidate, not a claim that the broad failing first-attempt sweep passed. Firefox/physical devices and inherited share assertions stay documented in VALIDATION.md/AUDIT.md.

Production smoke blocks all identity endpoints and WebSocket connections. The displayed anonymous bootstrap envelope is assembled locally from actual public `/today` and `/leaderboard` responses, with null identity; no production player/session is created. This proves shipped rendering and public read endpoints, not production identity creation. Unit/API tests cover bootstrap.

Actual deploy-module hashing uses an absolute Wrangler output directory; timestamp README/maps are excluded. No catalog format, ordinals, scoring, golden draw or existing asset bytes changed. D1 backup is required immediately before release and remains explicitly incomplete for journal-storage loss. Existing journals stay authoritative; process restart/retry tests and application rollback preserve them. Full loss restore, deletion reconciliation, hosted mixed concurrent clients, physical devices and durable cross-machine campaign accounting are owner-amended follow-ups.

Friday mirror at 00:35 ET: 4 participating claimers, 12 claims, 4 finished, versus the first attempt's 3/9/3. The active R19I watermark is unavailable, so causality is not yet established. Seven future days through Dec 4 remain uploaded. Recheck against the new authoritative aggregate after shipping.

Official Pages/DO/D1 limits rechecked Nov 28:
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/

No hosted load: separate credentials empty; full shared-account duration forecast/headroom missing. No >50-player local pass or hosted capacity is claimed. Existing COSTS.md assumptions remain unchanged.

Production Pages/Worker deployment and public smoke completed at 00:41 ET. The additional authenticated funnel probe initially reached the old DO handler (401 cookie error). Cloudflare defaults to deferred DO code updates for up to 300 seconds; practice explicitly uses immediate updates. Waiting for the new active handler and verifying its aggregate before tagging. Source rechecked Nov 28: https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/ . The initial release-guard field mismatch (`worker` versus captured `workerVersion`) stopped before any production deployment and was corrected in `e1ae655`.
