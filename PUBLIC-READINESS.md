# Public-readiness review — 24 November 2026

**House-word blocker resolved by owner decision; this run did not change visibility.** No visibility setting was changed. The requested `public-ready` tag identifies this review checkpoint, not a passing security assessment or authorization to publish.

| Check | Result | Evidence / remaining work |
| --- | --- | --- |
| A: R19I production before 5 PM ET | PASS | Deployed and smoke-tested at 3:21 PM ET; `r19i-done`; [release report](review/round19i/REPORT.md). |
| A: local verification | PASS with documented browser blocker | 269 unit/API tests, 492 Chromium/WebKit matrix checks and 324 device checks passed; mobile Lighthouse 99/100. Firefox failed to launch after three distinct local attempts. Older certificate/share tap-target failures are documented separately. No tests ran in Actions. |
| B: automatic test workflows | PASS | All 15 non-calendar workflows are manual only; files retained. |
| B: scheduled calendar efficiency | PASS | Daily schedule retained; read-only preflight, dependency cache, no browser execution, 12-minute cap. Measured historical median 9.1 minutes; projected idle runs 1–2 minutes. [Details](review/public-readiness/actions.md). |
| C1: full-history scanner | PASS for tested scope | Gitleaks 8.30.1 scanned all 316 commits; 32 candidates were public catalog metadata or fixed development fixtures. No real credential found. |
| C1: exact local values and backup formats | PASS for tested scope | 6,347 historical blob versions / 3,258,970,453 bytes, plus commit metadata/messages; eight distinct locally available secret values compared without printing them. Zero exact credential matches. All 115 backup-format findings were fixed fixtures or deliberately invalid rate-limit inputs. |
| C2: golden-ticket unpredictability | PASS | 256-bit server `crypto.getRandomValues` seed; private D1 storage; SHA-256 commitment binds category, seed and selected IDs; reveal only after close. Public code does not supply the seed. |
| C2: house words are public game rules | **RESOLVED BY DECISION (Tue Nov 24)** | Owner accepted house words as public game rules; source secrecy is no longer required. Tracked `worker/house-words.json` contains 33 category lists; the catalog builder deterministically uses the ten highest-ranked rows. Historical lists and ranking data remain available in Git. The live manifest correctly strips its house list, but publishing this source would still expose reserved answers. |
| C2: privileged operations require auth | PASS | Server-held bearer credential, constant-time comparison and rate limits protect privileged handlers; no credential literals found. 34 local security/specials/journal/backup tests passed. |
| C3: required private files | PASS | All listed files/directories are ignored and absent from every scanned commit. Added ignores for `SPEC-REVIEW-NOTES.md` and `PENDING-SPECS-FOR-REVIEW.md`. |
| C3: current tracked build notes | PASS | Scanned all 15 tracked FIXES/SPEC/OVERNIGHT files. Redacted the contact-email placeholder on `FIXES-R8.md:87`; no real personal contact, tokenized admin URL or ntfy topic remains in these current files. Historical placeholder text remains; history was not rewritten. |
| C4: ownership | PASS | Exact requested all-rights-reserved LICENSE; package is private and UNLICENSED; lock metadata agrees. Third-party attribution files remain intact. |
| C5: public-facing README | PASS | Game, architecture, free-tier hosting, Codex/Claude build story, rights statement and credits; no admin instructions or credential details. |
| Repository visibility (Nov 28 read-only check) | PUBLIC | Observed with `gh repo view`; this run made no visibility change. |

## Owner decision recorded

On Tue Nov 24 the owner accepted house words as public game rules. C2 is resolved by that decision, not by a code change or a new secrecy claim. The lists remain derivable from source/history. Golden selections remain private until close under the existing rules. A Nov 28 read-only GitHub check returned PUBLIC; this run made no visibility change. Earlier scanner results retain their original scope and date and are not a new full-history audit.

No real secret was found, so no credential rotation is requested by this audit. The exact-value comparison covers locally available secrets; encrypted GitHub Actions secret values are not retrievable. Automated scans cannot guarantee absence of all conceivable secrets. [Scope and counts](review/public-readiness/history-summary.json), [scanner findings](review/public-readiness/gitleaks-findings.json), [backup-format findings](review/public-readiness/backup-format-findings.json), and [code audit](review/public-readiness/code-audit.json) contain no secret values. Findings are recorded only as file, commit and type.

## Visibility status — no action taken

The original Nov 24 review recorded PRIVATE. The read-only Nov 28 check returned PUBLIC. This run did not perform any visibility operation or infer when or by whom the change occurred. The owner's house-word decision is recorded above; the older security-scan results keep their original date and scope.

No ntfy alert was sent. Existing unrelated working-tree changes were preserved.
