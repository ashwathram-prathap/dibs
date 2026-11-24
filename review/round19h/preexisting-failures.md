# Pre-existing R19C failures (not caused by R19H)

Both tests fail identically on the untouched pre-R19H build (`.tmp/r19h/before-dist`, built from commit 46ebc9c, the current production code) using the original `tests/e2e/round19c.spec.ts` from HEAD, at 320×568 and 390×844 in Chromium:

| Test | Failure on the pre-R19H build |
|---|---|
| Certificates keep points and consistent curves; streak tally counts | `44px tap targets`: one `INPUT` measures 20×48 px on the certificate page |
| Share and visitor landing work in browser, standalone, LinkedIn and Instagram; no spoilers | share-cell height mismatch (194 vs 80 px) in the R19F compact phone Share/More layout |

R19H changes no certificate or share code, so these are excluded from the R19H matrix with `--grep-invert` and reported as open, not as passes. They need their own follow-up: either the certificate control's touch target or the stale R19C assumption about the post-R19F share grid.

## Also pre-existing: admin archive at exactly 767 px (Chromium)

`Admin archive confirms, downloads both formats, deletes only the exported ids and keeps text inert` fails at 767×900 in Chromium (both themes) on the untouched pre-R19H build as well (`dialog.accept: Cannot accept dialog which is already handled`, then the "Archived 1 notes" status is missing; reproduced twice per theme with `--repeat-each 2`). It is an admin-only page that R19H does not touch, and the R19C matrix never covered 767 px. It passes at every other R19H width in the dry run. Excluded from the R19H gate and left open for follow-up.
