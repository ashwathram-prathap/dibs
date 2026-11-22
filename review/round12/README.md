# R12 — shipped November 22, 2026

**Live:** https://dibs.here · https://practice.dibs-7hz.pages.dev · API https://dibs-api.dibs-registry.workers.dev
**Launch remains Monday, November 23, 9:00 PM ET.** Production is closed; no production claims were made. No owner action is needed for this copy release.

Plain explanation and the full Animals example now lead closed/live/done. Backup code replaces file key, with recovery instructions; old codes and URL fragments still work. Rules, metadata, sharing and reminders share config-backed copy. Clerk notes pass full-catalog name/alias checks and contain no invented player behaviour. The Office/privacy copy is shorter. Practice analytics injection was removed after it caused CORS errors ([Cloudflare reference](https://developers.cloudflare.com/web-analytics/faq/)).

**Checks:** 130 unit/API tests; 252 Chromium/WebKit checks across phones, tablets, 320–2560px desktops, landscape and in-app profiles; 42 Firefox checks in [CI](https://github.com/ashwathram-prathap/dibs/actions/runs/45060852009). Lighthouse mobile: closed **98 performance / 100 accessibility**, live **90 / 100**. Timed practice closed→live and claims passed in Chromium and WebKit. Instagram and LinkedIn emulations loaded production closed and successfully played practice with official test Turnstile; real practice keys are restored. Production smoke passed on Chromium/WebKit at 390/1440px, both themes: correct schedule, explanation, reminders, theme toggle and no runtime console errors.

| Device/browser group | Result |
|---|---|
| iPhone SE, 15 Pro, 15 Pro Max / WebKit | Pass, light + dark |
| Pixel 7, Galaxy S9+ / Chromium | Pass, light + dark |
| iPad Mini, iPad Pro landscape / WebKit | Pass, light + dark |
| Desktop 1280, 1440, 2560 / Chromium, WebKit, Firefox | Pass, light + dark |
| 320px phone and landscape phone | Pass, light + dark |
| Instagram, TikTok, X profiles | Pass |
| Instagram + LinkedIn deployed emulations | Pass |

**Deployments:** Pages `e6ee74b7-65f8-43b1-93ee-6b2e824bacc0`; Worker `552aa70f-999f-4c65-88c2-4da89113bbd5`; practice Pages `ad093219-d11c-43d1-9584-41d6acc1211c`.
**Rollback:** previous Pages `4e34b840-5164-4946-94fd-c41eca2aae80` (https://4e34b840.dibs-7hz.pages.dev); Worker `651c02c8-307b-4c18-a3da-c808371a331d`. An unplanned ad-hoc Pages deployment appeared during QA; its smoke failure caused immediate rollback to these IDs. The failure was isolated to Playwright WebKit screenshot capture injecting a CSP-blocked stylesheet (normal page load had no error); final smoke observes runtime errors without WebKit screenshot injection. The final release used the exact direct production commands from FIXES-R12. No Cloudflare Git auto-deploy configuration existed or was changed.

**Deferred:** the 200-player practice load was skipped because this round finished before 7:05 PM ET, as explicitly allowed. Account-wide preflight writes were 98,040 / 100,000; no load requests were sent. Deployed p50/p95/errors/one-winner: **not measured**. `scripts/r12-load.ts` preserves the committed test, adds the time gate and requires over 30% daily write reserve. The R11 release-gates file is unchanged; its two accepted blocks were not marked passed.
**Notification:** exactly one final ntfy attempt, HTTP 200; delivered. Practice automatic rehearsal alerts were suppressed during QA and the original topic restored afterward. No new credentials were created.

**Jargon audit**

| Before | After |
|---|---|
| File key / recovery key | Backup code + device/browser explanation |
| Restore file / Next dibs | Restore claims / Next claim |
| Filing… / filed under | Claiming… / Your name |
| File closed | Done for today + certificate ready |
| First filings / live ledger | Today’s claims |
| Cleanest files | Today’s results |
| Entry / holder | Answer / player |
| Delete my file / Withdrawn filer | Delete my data / Withdrawn player |
| Tell the clerk | Send feedback |
| Carbon copy / paper copy | Dark mode / light mode |
| Clerk/cabinet request errors | What failed + what to do |
| Reserved / golden ticket | Plain definitions in How it works |

Registrar, Office, ledger and certificate decoration remain as flavour; SHA-256, commitment and source licences remain in the optional verification/source material.

**Word counts** (all main-screen copy including disclosures, same fixture states; navigation, timezone options and footer excluded):

| Screen | Before | After |
|---|---:|---:|
| closed | 105 | 171 |
| live | 62 | 201 |
| done | 192 | 274 |
| office | 476 | 441 |

The exact section-2 explanation takes precedence over the later two-sentence target. Required instructions/example increase the game-screen totals; surrounding copy was trimmed. FAQs stay within two sentences; long proper-name suggestion buttons retain their full answer for clarity.

**Evidence:** `review/round12/` has before/after closed/live/done/Office captures at 390/1440px in light/dark, practice/release checks, rollback IDs, word counts and browser summaries; final captures also in `review/final/round12/`. Full Lighthouse reports remain local. The longest remaining screens are the phone results table, Office sources and the certificate; no clipping/overflow or accessibility violation remained in the release matrix. First phone checks: read the explanation/example; confirm Monday’s opening; open Remind me; switch themes; find Backup code & settings.

Existing unrelated source changes and the newly added FIXES-R13.md were left unmodified; tests refreshed some older QA artifacts, which were excluded from R12 commits. The pre-existing generated foods catalog is preserved. This round implements R12 only.

---
