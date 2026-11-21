# Dibs acceptance — Round 2

Round 2 supersedes the earlier visual proofs and feature list. All categories remain drafts. The preview stays on default Cloudflare hosts, with no plan/billing/domain change or announcement.

| Check | Result | Evidence / remaining action |
| --- | --- | --- |
| First phone viewport explains the game and contains the input/button | PASS | Fresh-page 390×844 bounding-box test; `final/today-390-*.png`. |
| Schools removed from UI, exports and API | PASS | Runtime types, queries, navigation and picker removed; 0003 drops the ignored legacy column. Local migration passed; remote is queued. |
| Honest low traffic and archive | PASS | First filings with numbered open lines and actual pool count; only claimed closed days enter the archive; empty archive is labelled and watermarked SPECIMEN. |
| Legible stamp, consistent wordmark, public origin | PASS | Shared outlined wordmark; stamp label 10px mobile / 22px canvas; canvas text and source regression tests reject local origins. |
| No fixture data in production | PASS | `production-audit.json`; production bundle scan. Catalogs are real static answer lists, not player records. |
| Atomic claims and safe cached reads | PASS | 29 unit/integration tests, including 50 contenders → one 201 and 49 409, double claims, IP limit, cached moderation, idempotent uploads, quota notice, polling pause/backoff and cursor safety. |
| Real local D1 browser flow | PASS | `round2/local-integration.json`; claim/taken, reload identity, immediate ledger update, blocked cookie fallback, daily lock and OG PNG. |
| Free-tier model at 10,000 five-minute visitors | PASS for documented workload | `round2/free-tier.md` and `d1-actions.json`; 80,000 Worker HTTP requests, 89,900 DO request units, 352,800 D1 reads and conservative 83,600 writes/day. Existing 2,046–2,200-answer catalogs and UTC day overlap are explicit. |
| Quota recovery and category upload safety | PASS locally | Clerk-voice quota page and reset circuit; indexed cleanup; sequential upload budget, bounded JSON batches, identical-content no-op and no automatic retry. Remote D1 work waits until 7 PM Toronto. |
| Browser/device matrix | PASS emulation | 120 tests across 30 WebKit/Chromium configurations in both themes. `round2/devices.md` and `browser-summary.json` survive raw-capture cleanup. |
| Firefox | BLOCKED before app load | Default launch, project-local temporary profile and clean reinstall all fail with “Could not find profile folder.” Rerun on a host where Firefox launches. |
| Native device/browser behavior | NOT PHYSICALLY VERIFIED | Safari 16, Samsung Internet, branded Edge, social webviews, native keyboards/share sheets and iMessage previews still require a physical device. Engine emulation is not physical coverage. |
| Accessibility, exports and motion | PASS automated checks | axe AA, no horizontal overflow, keyboard selection, both PNG sizes and fallback download across the browser matrix. `final/certificate-feed.png`, `certificate-story.png`, `claim-moment.webm`. |
| Lighthouse mobile / Slow 4G | PASS | 96 performance / 100 accessibility against the local production build and local API; `lighthouse/mobile.html`. SEO is intentionally limited by private-preview noindex. |
| Thirty measured categories | PASS | 30 drafts / 65,846 measured answers; `category-validation.json`, `categories.md`; 270 original/uppercase glyphs covered. |
| Design review | PASS | Screenshot loop at 390×844 and 1440×900, both themes; `round2/visual-checks.md`, `index.html`. |
| Live D1/Turnstile behavior | DEFERRED | No remote queries or migrations before reset. Owner must apply the listed migration command after November 21, 7 PM Toronto, then verify the closed office and admin tools. No category was opened. |
| Cookieless Cloudflare Web Analytics | EXISTING BLOCK | Beacon provisioning lacked RUM permission in the previous run. No account permission or billing changes made. Share taps are counted independently in DO storage. |

No raw IP or free-text public handle is stored. Daily salted hashes are scrubbed through indexed cleanup. Pending identities/attempts live in private SQLite caches; D1 player records are written on claims. Public records survive cache eviction. Social image previews use bounded 30-day caching; older previews use the common Dibs card.

The three least polished views are the utilitarian admin Stats page, the intentionally quiet closed-office page, and certificates with exceptionally long scientific names. The final gallery shows the current design; obsolete raw proofs are removed during cleanup.
