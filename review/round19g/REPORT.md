## R19G — shipped November 23, 11:50 PM ET

Production: https://dibs.here · Practice: https://practice.dibs-7hz.pages.dev · API: https://dibs-api.dibs-registry.workers.dev. Tag: `r19g-done`.

Added “Made by Ashwathram Prathap” and X to the shared footer, plus the requested University of Waterloo sentence at the bottom of How it works and About. The portfolio returned HTTP 200 with real content, so the name links directly to https://ashwathram.ca; no fallback was needed. Both links open with `noopener noreferrer`, without tracking. Credits stay out of gameplay content, share images, OG cards and certificate content. No CSP or gameplay changes.

**Verification:** 258 unit/API tests; 48 Chromium/WebKit checks; 24 Firefox checks ([CI](https://github.com/ashwathram-prathap/dibs/actions/runs/45327459806)); 24 practice and 24 final production read-only page checks. All passed. Mobile Lighthouse: **99 performance / 100 accessibility**. Browser coverage includes 320/360/390/1440px in both themes, full claim/certificate/share flows with local fixtures, footer accessibility and overflow checks. This is engine emulation, not physical-device certification. Production smoke submitted no claims or mutating API requests. Website, CSP, existing footer grouping and name/X targets were checked.

**Release:** practice first, then production, outside the daily 8:30–10 PM Toronto freeze. Production Pages `fb8d34d4-6667-4da7-b854-0757cd8d0fe6`; Worker `d4951696-6395-431b-8001-9c4722a26742`. **Rollback:** Pages `fcd4323d-34a2-400b-9cfd-9c8733fc988d`; Worker `7a13baff-c4b2-4576-b004-942601df8dc3`. Fresh private backup: `.backups/production-20261124T044929Z.sql` (see `.backups/last-success.txt` for the authoritative timestamp). First attempt rolled back successfully when WebKit logged an aborted bootstrap request during multi-page test navigation. Isolating each page in its own context resolved the test cancellation; the second release passed every smoke check. Attempt-one rollback evidence is preserved.

**Decisions:** applied the credit sentence to both How it works and About. Kept the existing focused-phone-play footer hiding. Fixed two stale test assumptions exposed after launch (future clue fixture and launch-week golden count), without changing game behavior. Kept the live CSP strict; WebKit captures use the isolated test server because its screenshot helper injects an unauthorized style. Live Chromium captures cover both requested sizes/themes. Cloudflare challenge-frame diagnostics are recorded separately from Dibs console errors. Firefox passed; its initial upload path omitted the raw JSON, so the release evidence uses its successful CI conclusion and completed 24-pass log, and the workflow upload paths are corrected. No large practice load test or schedule reset was needed for this footer-only round. No ntfy alerts or new secrets. Existing unrelated working-tree changes remain uncommitted.

**Evidence:** `review/round19g/release-summary.json`, `visual-review.md`, `ui/` (320/360/390/1440, both themes), `practice/`, `production/`; final 390/1440 copies in `review/final/round19g/`. All eight anti-AI checks pass for the changed regions. The unchanged dense About source list, long mobile rules and archive remain the three visually densest pages.

**Five phone checks:** footer name opens the portfolio; X opens the exact profile; switch Paper/Carbon; read the bottom sentence on How it works; read it on About and check footer grouping. No owner action is required.

| Verification | Result |
|---|---|
| Chromium, 320/360/390/1440, light/dark | Pass |
| WebKit, 320/360/390/1440, light/dark | Pass |
| Firefox Linux, same widths/themes | Pass |
| Practice/production, Chromium/WebKit, 360/1440, light/dark | Pass |
| Physical-device/native app checks | Not rerun for this text-only round |

---
