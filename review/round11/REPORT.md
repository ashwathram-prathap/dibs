# Round 11 — production held

Section 0 was implemented first, against `r7-done`. The R7 paper, ink, vermilion, large Archivo category and stamp are restored. Later functionality remains. No R11 production deployment or production claim was made.

**Release is blocked.** Two required practice gates are blocked: the deployed load test lacks safe free-tier write headroom, and ntfy rejected the rehearsal alert with its daily message quota exhausted. The post-deployment production smoke test was therefore not attempted. Its successful-claim portion can only run at the first production drop, Monday November 23 at 9 PM ET; new deployments freeze at 5 PM ET that day. Production data and schedule were not changed to manufacture a smoke-test pass.

## Ready to review

- Practice: https://practice.dibs-7hz.pages.dev
- Owner/friends rehearsal: **Sunday November 22, 9:00 PM ET**, at the same practice link. Real Turnstile is restored after QA; test keys were used only on practice.
- Production remains https://dibs.here, with the prior deployment.
- [96 scored whole-page comparisons](visual-review.md), [image index](vs-r7/index.html), [200px share grid](vs-r7/share-grid-200px.png).
- Final captures are also in `review/final/round11/`. Generated PNGs, raw browser results and Lighthouse reports stay local; compact evidence and reproduction scripts are committed.

## What changed

- Removed per-category card tints, engravings and the seal. Retired the obsolete practice-only seal/engraving proof route. Kept a plain D favicon. Carbon-copy dark surfaces use `#16150F` and `#1F1E18`; primary actions use `#E1462B` with crisp offset shadows.
- Unified the container and header navigation. Completed files and certificates have desktop companions. Office rules, FAQ, disclosures and sources have deliberate spacing. Desktop text is at least 14px, including loading text and calendar labels; no 13px exception list is needed.
- Added explicit dibs/strike counters, ink answer names with separate view links, RESERVED wording, default-on remembered action sounds, a stronger physical stamp, reduced-motion fade, short gold glint, category notes and a shared hand-drawn Registrar signature.
- Added confirmed, verified and rate-limited self-serve deletion. The original identity, recovery key and feedback are removed; unrelated anonymous holders preserve historical claims as Withdrawn filer. Cookies and cached records are invalidated. Privacy questions use Tell the clerk.
- Remind me offers Google, explicitly labelled Apple-file download and Outlook. The daily reminder is five minutes before the authoritative drop, including DST transitions. Production and practice schedule strings/ICS agree with their own API.
- Fixed an intermittent cold-coordinator response that returned an empty private file after a successful claim. Fixed a numeric zero leaking before ordinary ledger entries and invalid guesses poisoning the live completion counter. Added cache versioning so old share artwork cannot retain the removed seal.
- Added fail-closed production checks before both deploy commands, with the Monday 5 PM ET deadline.

## Acceptance evidence

| Case | Result | Evidence / limits |
|---|---|---|
| R7 visual comparison, every criterion | PASS | 96 screen/width/theme pairs; each R11 score meets or exceeds R7. Subjective author review, not independent user research. R7 has no Live/calendar routes; those comparisons explicitly use its 404 shell. |
| Brand/share cards at 200px | PASS | Clean, five-strike and gold feed/story exports, plus OG cards. |
| Unit/API suite | PASS | 127 tests, including withdrawal, cache invalidation, cold coordinator, concurrency, reminders and live metrics. |
| Chromium/WebKit regression matrix | PASS | 216 checks: 320–2560px, portrait/landscape, named phones/tablets and simulated in-app browsers, both themes. |
| Firefox | PASS | 36 checks in private Linux CI; local Firefox cannot launch its profile. CI reference is recorded in `verification.json`. |
| Sharing/accessibility edge suite | PASS | 40 checks: keyboard-only full play, live announcements, 200% zoom, reduced motion, sound persistence, native/cancel/fallback sharing, clipboard/download fallbacks, timezone change, empty submit and every visible disclosure’s contents. |
| First visit: closed → live without reload | PASS | Chromium/WebKit × phone/desktop × both themes; plus two timed desktop/phone rehearsals. |
| Win ×3 → Day Certificate → ledger | PASS | All eight live combinations in `practice-matrix.json`. |
| Native share | PASS | Actual file payload intercepted; no share was posted. |
| X / WhatsApp / Facebook, copy and story/feed PNG | PASS | Intent URLs and event interception; live PNG downloads and copy fallback. Nothing posted. |
| Taken / RESERVED / five strikes | PASS | Live race, RESERVED and closure checks; completed miss records and local browser matrix. |
| Invalid / empty / whitespace / 200 characters / emoji | PASS | No strike charged; live matrix and edge suite. |
| Typo reject and confirm | PASS | Reject in the eight-case matrix; confirm in live edge flow. |
| Mixed case / accents / plural aliases | PASS | `oKaPi`, accented canonical input and `Quokkas`; catalog alias regression tests. |
| Gold stamp and certificates | PASS | Known private practice draws, actual browser stamp and Day/individual certificates; local gold export fixtures. |
| Simultaneous players / double tap / replay | PASS | One winner, loser names winner; repeated request returns the same claim; changed-answer replay rejected. |
| Offline / slow / retry | PASS | Entry retained, retry wins once, slow action disabled. |
| File-key restore / deletion | PASS | All eight combinations restore in a second browser and perform verified deletion. |
| Stale session / blocked cookies | PASS | Practice-reset recovery and actionable cookie guidance. Cookie blocking retested by stripping Set-Cookie and clearing the cookie jar. |
| No-peek API / HTML / socket | PASS | Claimed answers hidden before closure; ledger available after closure. |
| Timezone / reminders / theme / sound | PASS | Vancouver walkthrough, persisted timezone change, schedule/ICS contract, both themes and stored mute choice. |
| Archive / Office / 404 / errors | PASS | Full page/browser matrix and visual captures. |
| Retired design proof route | PASS | Eight final Chromium/WebKit × width/theme checks: old seal/engraving page now uses the already-reviewed 404; home, real verification and tonight’s schedule remain intact. |
| Authenticated Live / calendar | PASS | 12 read-only page/theme/width checks, no overflow, no sub-14px desktop text, no axe AA violations. |
| Canadian answers | PASS | 119 expected entries across nine categories, including every R11 named food and city. No production data mutation. |
| Five persona walkthroughs | PASS | `personas.json`; automated engine/device and accessibility simulations, not physical devices or a VoiceOver/NVDA listening study. |
| Lighthouse mobile Slow 4G | PASS | Performance **94**, accessibility **100**, best practices **100**, LCP **2.4s**. Practice SEO 66 is expected from its noindex configuration. |
| Timed rehearsal opening and immediate claims | PASS | 09:40:39 ET and 09:59:01 ET; tabs opened within about two seconds and both claims succeeded. |
| Real ntfy Drop is live delivery | BLOCKED | Repeated HTTP 429; `messages r=0`, daily message quota exhausted. Provider returned Retry-After 18,760 seconds at 14:59:06Z (approximately 3:11:46 PM ET). No paid plan enabled. |
| Public practice rehearsal tonight | PASS | Scheduled for `2026-11-23T02:00:00Z`; exact practice link above. |
| Deployed 200-player load gate | BLOCKED | Account-wide D1 analytics reported **98,036 writes** before the test; conservative estimate **20,000** more. No load requests sent against the deployed service. Application counters alone were rejected because practice resets clear them but do not reset Cloudflare quota. |
| Local 200-player fallback | PASS, supplemental | **200** arrivals in **59.7s**, **1,096** guesses (3–8 each), p50 **3ms**, p95 **9ms**, **0** unexpected errors, **1** winning claim, **617** measured D1 writes. Isolated Miniflare, no network latency; it does **not** clear the deployed load gate. |
| Production real-claim smoke | NOT RUN | Production was not deployed because practice gates failed. Its first successful-claim opportunity is Monday 9 PM ET, after the 5 PM deployment freeze. |

## Open issues and next steps

There are **zero identified open high-severity bugs in the R11 candidate**. Production still runs the prior version; candidate fixes have not been applied there. The cold-coordinator progress bug, invalid-guess metric bug, mobile stamp omission, tiny calendar label and stale share-art cache are fixed. Validation blocks still prevent release:

1. **Medium / operational:** ntfy daily publish quota. Recheck after the provider's retry window. Tonight's practice cron remains armed; delivery is not promised until verified.
2. **Release validation block:** deployed load test. Wait for the UTC daily write reset, refresh account-wide analytics, then run the committed guarded practice test with official test keys and restore real verification afterward. Do not run it during the friends' rehearsal or leave practice in test mode.
3. **Pending post-deployment check:** production smoke remains unperformed. Preserve the Monday 9 PM opening and 5 PM deployment freeze when planning a later release; never open production early to test. If deployed smoke fails, follow the requested immediate rollback.

Production rollback point (also rechecked unchanged): Pages `db61c5be-dde1-4250-8ca6-0426731019f4`; Worker `31a7a485-a7f8-459d-9b2e-03fc7cc9dcfb`, deployment `8b28b1b8-2544-427a-bdc9-bc0952c39e9e`. No rollback was necessary because no R11 production release occurred.

## Decisions and phone review

Section 0 takes precedence over the conflicting light-card tint instruction: plain paper wins. Anonymous history uses a separate unrelated holder per category so deletion does not preserve a cross-day identity. The 8:55 reminder is a daily local-Toronto event; Outlook offers a single event with an explicit repeat note. Generated captures are local review artifacts, and no posts or invitations were sent.

The weakest remaining layouts are the long mobile Office privacy section, the intentionally sparse 404, and the dense 60-day calendar. All meet their baseline and accessibility checks.

First five phone checks: the 9 PM practice opening without reload; one win and one RESERVED strike with sound; three wins and the Day Certificate; native share/PNG fallback and Remind me; file-key restore followed by Delete my file on a disposable practice file.
