# R20 validation

The first-attempt report and invalidated broad sweep remain preserved in REPORT-attempt1.md (overnight directory), AUDIT-attempt1.md and the original JSON artifacts. The initial owner-amended release passed 291 unit/API checks, 4 admin UI checks, 36 hosted practice and 36 production read-only smoke checks, application rollback/forward, TypeScript/build and Lighthouse mobile 99/100. It is tagged r20-done.

The follow-up candidate has 294 unit/API checks (fresh final rerun required after recap redaction), 144 browser checks across 320–2560px/both themes/1.3 phone font scale, 64 golden cross-surface browser checks, the OVERNIGHT emulated device matrix, 74 server JPEG/layout fixtures (0/1/2/5 strikes) and 18 crop artifacts at 552/300/504 widths. Final pass counts are in followup-*-tests.json and FOLLOWUP.md. TypeScript and the production artifact build pass. Hosted practice Lighthouse is mobile 96 performance / 100 accessibility, desktop 100/100; practice is intentionally noindex.

Prior unchanged core evidence: 456 continuation checks with 12 desktop keyboard skips, 324 device-flow checks, exact standings/journal/privacy tests. These are not a claim that every historical suite passed. The first sweep's 553 failures included mismatched fixture/CSP assets from an overlapping rebuild; a separate old equal-width Share assertion conflicts with the current compact Share/More design. Certificate target/admin archive and physical keyboard gaps remain recorded in the historical reports.

Firefox failed local launch in three configurations; no application pass or Actions fallback. Physical Safari/Android keyboards, native in-app browsers, complete hosted mixed-version/DR and broad active-path capacity remain unverified. All tests ran locally, using frozen fixture assets; production smoke intercepts identity endpoints and sockets and reads only real public data.

Screenshots: followup/ for onboarding/recap, ../round19d/golden/ for cross-surface golden output, og/ and og/crops/ for actual image fixtures. Local recordings/evidence for R21 live under ../r21-flow/. No production test player, secret, private answer list, draw or seed was exported.
