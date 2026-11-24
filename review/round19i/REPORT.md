# R19I release — 24 November 2026

Production deployed and read-only smoke passed at **3:21 PM ET**, before the 5 PM deadline. The implementation in `5a747d3` and `2a11d01` matches FIXES-R19I: resolved-answer deduplication, legacy strikes, concurrent submits, request retries, no repeat writes, client guard and explanatory copy.

| Verification | Result |
| --- | --- |
| Local unit/API suite | 269 tests / 57 files passed |
| TypeScript checks and production build | Passed |
| Local Chromium/WebKit R19I + R19H matrix | 492 passed; 12 desktop software-keyboard cases skipped |
| Local device flow suite | 324 passed, including mobile, tablet, desktop, landscape and emulated in-app browsers |
| Firefox | BLOCKED: browser cannot find its profile; reproduced with default profile, project-local temporary profile, and fresh local browser install. 252 launch failures, no application test results. No CI fallback. |
| Practice closed-to-live and three-claim rehearsal | Passed at 360, 390 and 1440px; real reserved repeat sent zero claim requests and stayed at one strike |
| Practice restoration | Real verification, notification setting and schedule restored; all 39 old claims preserved; nine practice QA claims added |
| Practice mobile Lighthouse | Performance 99, accessibility 100; simulated slow 4G |
| Practice and production read-only smoke | 36 checks each; light/dark, Chromium/WebKit, home/how-to/FAQ, no application console errors |
| Production build integrity | Canonical and cache-bypassed asset hashes match practice-proven artifact |

The broad exploratory browser run also found an existing certificate 20px checkbox/tap-target failure, with related share-page audit failures, outside the R19I/R19H release scope. Its interrupted raw log is retained locally at `.tmp/public-readiness/browser.log`. The focused matrix did not include those older certificate/share/admin tests; this is not a claim that the entire historical browser suite passes. Firefox remains explicitly blocked under OVERNIGHT's three-attempt rule.

No production gameplay, verification or session POST was sent by the smoke checks. No load test was run: the permitted 7:05 PM ET reset window is later than this release. No ntfy alert was sent. R11 release gates were not changed.

Screenshots and detailed reports remain in `review/round19i/` locally; repeat-message captures were visually reviewed at phone and desktop sizes. Compact release evidence is tracked beside this report.

Rollback: Pages `bb67de3d-540b-4668-9b13-f7e79b4e7ecb`; Worker `68bc3cae-a113-42f7-946b-a7eddd750c4d`.

Released: Pages `8655ae26-06a7-4929-9fe9-de560dbed835`; Worker `26410237-28f6-4707-86fa-21a3af998a54`.
