# Actions minutes — FIXES-PUBLIC Part B

- All 15 workflows other than `category-rollout.yml` are `workflow_dispatch` only. Removed the remaining push triggers from `r15-check.yml` and `r15-release-tag.yml`; retained all workflow files and existing manual inputs.
- Calendar rollout retains its daily `17 7 * * *` UTC schedule. A dependency-free, read-only preflight now runs immediately after checkout. Ready calendars with unchanged uploaded recipes skip setup, dependency install, builds, deploys, cleanup and artifact uploads.
- Preflight still requires work for changed/missing/unuploaded recipes, pending days in the seven-day build window, matching new requests and the 48-hour fallback. It rejects unpinned source snapshots, malformed responses and failed authentication instead of silently skipping.
- Added npm dependency caching keyed to `package-lock.json`, disabled browser downloads, and removed the Playwright import from the calendar API client. The rollout invokes no browser, Playwright or test matrix.
- Overall timeout is 12 minutes (was 25); checkout/install/verify/upload steps are bounded to 1–2 minutes; asset build is bounded to eight minutes.
- Added the required local-only browser/test-matrix rule to OVERNIGHT.md. No workflow was dispatched for this task.

Measured recent full job runtimes: **9.93, 9.08 and 7.65 minutes** (run IDs 45464018942, 45246590475 and 45060912430), median **9.1 minutes/run**. The latest build alone took 7m09s and checkout 42s. New idle runs are estimated at **1–2 runner minutes**, mostly checkout; a real build should still take about **7–10 minutes**, capped at 12. These are projections for the updated workflow, not a claim of an observed CI run. The local production preflight took **1.291 seconds** and returned `needed: false` without writes.

Validation: 20 local calendar/preflight/API tests passed; YAML parsed successfully; every workflow trigger checked; schedule, cache, timeout, preflight ordering and absence of browser/test commands verified; formatting and diff checks passed.
