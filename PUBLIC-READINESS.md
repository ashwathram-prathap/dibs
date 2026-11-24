# Public-readiness review — 24 November 2026

**Overall: FAIL — keep the repository private.** No visibility setting was changed. The requested `public-ready` tag identifies this review checkpoint, not a passing security assessment or authorization to publish.

| Check | Result | Evidence / remaining work |
| --- | --- | --- |
| A: R19I production before 5 PM ET | PASS | Deployed and smoke-tested at 3:21 PM ET; `r19i-done`; [release report](review/round19i/REPORT.md). |
| A: local verification | PASS with documented browser blocker | 269 unit/API tests, 492 Chromium/WebKit matrix checks and 324 device checks passed; mobile Lighthouse 99/100. Firefox failed to launch after three distinct local attempts. Older certificate/share tap-target failures are documented separately. No tests ran in Actions. |
| B: automatic test workflows | PASS | All 15 non-calendar workflows are manual only; files retained. |
| B: scheduled calendar efficiency | PASS | Daily schedule retained; read-only preflight, dependency cache, no browser execution, 12-minute cap. Measured historical median 9.1 minutes; projected idle runs 1–2 minutes. [Details](review/public-readiness/actions.md). |
| C1: full-history scanner | PASS for tested scope | Gitleaks 8.30.1 scanned all 316 commits; 32 candidates were public catalog metadata or fixed development fixtures. No real credential found. |
| C1: exact local values and backup formats | PASS for tested scope | 6,347 historical blob versions / 3,258,970,453 bytes, plus commit metadata/messages; eight distinct locally available secret values compared without printing them. Zero exact credential matches. All 115 backup-format findings were fixed fixtures or deliberately invalid rate-limit inputs. |
| C2: golden-ticket unpredictability | PASS | 256-bit server `crypto.getRandomValues` seed; private D1 storage; SHA-256 commitment binds category, seed and selected IDs; reveal only after close. Public code does not supply the seed. |
| C2: house words cannot be derived from source | **FAIL** | Tracked `worker/house-words.json` contains 33 category lists; the catalog builder deterministically uses the ten highest-ranked rows. Historical lists and ranking data remain available in Git. The live manifest correctly strips its house list, but publishing this source would still expose reserved answers. |
| C2: privileged operations require auth | PASS | Server-held bearer credential, constant-time comparison and rate limits protect privileged handlers; no credential literals found. 34 local security/specials/journal/backup tests passed. |
| C3: required private files | PASS | All listed files/directories are ignored and absent from every scanned commit. Added ignores for `SPEC-REVIEW-NOTES.md` and `PENDING-SPECS-FOR-REVIEW.md`. |
| C3: current tracked build notes | PASS | Scanned all 15 tracked FIXES/SPEC/OVERNIGHT files. Redacted the contact-email placeholder on `FIXES-R8.md:87`; no real personal contact, tokenized admin URL or ntfy topic remains in these current files. Historical placeholder text remains; history was not rewritten. |
| C4: ownership | PASS | Exact requested all-rights-reserved LICENSE; package is private and UNLICENSED; lock metadata agrees. Third-party attribution files remain intact. |
| C5: public-facing README | PASS | Game, architecture, free-tier hosting, Codex/Claude build story, rights statement and credits; no admin instructions or credential details. |
| Repository visibility | PRIVATE | Owner alone controls any future visibility change. |

## Remaining blocker and decision

House-word secrecy cannot be fixed by deleting the generated list from the current commit: the previous list is in history and the same words can be recomputed from the ranked source data. Stripping the deployed manifest is already implemented and does not solve source disclosure. No history was rewritten, and no live or future reservation rules were changed by this review.

Before publication, either explicitly decide that reserved house words are public game rules, or implement and verify a server-private selection design for future days whose choices cannot be reconstructed from the published history. The latter changes the existing “ten most obvious answers” policy and needs a separate gameplay change. Until one of those resolutions is accepted and re-audited, the house-word requirement fails and this repository should stay private.

No real secret was found, so no credential rotation is requested by this audit. The exact-value comparison covers locally available secrets; encrypted GitHub Actions secret values are not retrievable. Automated scans cannot guarantee absence of all conceivable secrets. [Scope and counts](review/public-readiness/history-summary.json), [scanner findings](review/public-readiness/gitleaks-findings.json), [backup-format findings](review/public-readiness/backup-format-findings.json), and [code audit](review/public-readiness/code-audit.json) contain no secret values. Findings are recorded only as file, commit and type.

## Owner-only visibility steps — do not perform yet

After resolving the failed requirement and reviewing this report:

1. Open the `ashwathram-prathap/dibs` repository in GitHub.
2. Go to **Settings → General → Danger Zone → Change visibility**.
3. Choose **Change to public** and review GitHub's visibility warnings, including exposure of the complete commit history.
4. Type the repository name when requested and confirm the visibility change yourself.
5. Verify the public README, LICENSE and third-party attribution links.

This task did not execute those steps. No ntfy alert was sent. Existing unrelated working-tree changes were preserved.
