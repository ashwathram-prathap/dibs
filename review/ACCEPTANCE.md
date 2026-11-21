# Dibs acceptance record

The preview is deployed on the default Cloudflare hosts. M1–M4 were implemented without waiting for milestone approval, as OVERNIGHT.md directs. Category publication remains an explicit owner review step; deployment never approves a register.

| SPEC acceptance check | Result | Evidence / remaining action |
| --- | --- | --- |
| Every screen passes the visual checklist at 390×844 and 1440×900, light and dark | PASS | `final/` contains 32 development proofs plus 20 production empty-state views. Paper/ink palette, self-hosted fonts, square rules, serials, no gradients or decorative icon library. `index.html` is the local gallery. `headings/results.json` adds 180 content stress checks of all category names at 320/390/1440px in both themes. |
| A brand-new registry with zero claims looks intentional | PASS | `final/live-*`; ruled blank ledger lines and explicit closed-office copy. `production-state.json` confirms zero users and claims after QA cleanup. |
| No fabricated production numbers or fixtures | PASS | `production-audit.json`; fixture module gated by both development mode and the explicit demo flag. No fixture identities or imports survive the bundle. All three remote registers are drafts. |
| Crisp exported PNGs on iPhone Safari and Android Chrome | PARTIAL / DEVICE BLOCKED | WebKit/Chromium emulation verifies 1080×1350 and 1080×1920 files, self-hosted canvas fonts, long titles and download fallback. Physical phone engines, native sharing and image-save behavior require the owner's phone checks. |
| Concurrency and double-claim tests | PASS | 18 Worker/domain tests, including exactly one 201 plus 49 409 responses for 50 simultaneous requests; simultaneous double-claim rejection, unique serials, shared-IP quota and per-user rate limits. |
| No raw IPs or free-text names stored | PASS | D1 schema has daily salted IP hashes, curated handles and an enforced school list. Cleanup removes old IP hashes. Neither raw IPs nor user-written public names are written. |

## Additional required verification

| Requirement | Result / evidence |
| --- | --- |
| M1 prototype and recording | PASS. All screens, both themes, receipt reveal, visible 1.4→1 stamp impact and 6px mobile shake. `motion/results.json` verifies that the impact is actually visible in the viewport with no overflow. Total sequence 1.3 seconds. `final/claim-moment.webm`. |
| Worker, D1, signed identity and Turnstile | PASS implementation and local integration. First-party Pages gateway, Secure/httpOnly/HMAC cookie, three rerolls, real D1 upload/claim flow, server-side Siteverify with hostname and action checks. Positive production Turnstile interaction remains part of the physical first-claim check after category approval. |
| Ledger, archive, schools, streaks, obscurity and sharing | PASS. Full browser flow, exact Toronto-day streaks and pageview bands. Canvas feed/story images, manual image-open link and Copy text. No share or social post was sent. |
| Thirty measured draft registers | PENDING final catalog validation. See `category-validation.json` and `categories.md` when the build finishes. Only Animals, Plants and Birds have proposed dates. |
| Admin tools and D1 analytics | PASS. Bearer-protected upload, explicit review/approval, hide-user, void-claim and `/stats`; daily counts, mature-cohort D1/D7 retention and content-free share taps. |
| Cloudflare Web Analytics | BLOCKED. Existing OAuth grant returns HTTP 403 for RUM list/create, and the browser access host is unavailable for dashboard setup. Owner: enable free Web Analytics in Cloudflare, put its public beacon token in ignored `.env.local` as `VITE_CF_ANALYTICS_TOKEN`, then `npm run deploy:web`. |
| Open Graph images | PASS. Real local claim and deployed brand PNGs render using bundled Archivo outlines and resvg. Certificate HTML carries per-claim metadata; short links resolve to the original. Native iMessage/social preview caching remains a physical check. |
| Deployment and repository | PASS. Cloudflare Pages + one Worker + D1 + Turnstile, free services only; private GitHub repo, regular commits and milestone tags. No custom domain per OVERNIGHT.md. Preview is unlisted/noindex, not access-controlled. |
| Lighthouse mobile, Slow 4G | PASS. See `lighthouse/mobile.html` and JSON for measured performance ≥90 and accessibility ≥95. |
| Responsive browser matrix | PASS for 30 WebKit/Chromium configurations in both themes: iPhone SE/15 Pro/15 Pro Max, Pixel 7, Galaxy S9+, iPad Mini/Pro landscape, desktop 1280/1440/2560, 320px and phone landscape. `devices/results.json` contains the latest rerun. |
| Firefox | BLOCKED before app load in all six desktop/theme cases. Bundled, project-local/headed, older/manual install and reduced sandbox attempts hit macOS profile/sandbox/framebuffer errors. Owner: rerun the suite on a Mac where Firefox can start, or a Linux test host. `devices/summary.json` preserves the original errors. |
| Native browser/device coverage | BLOCKED by unavailable physical devices. Safari 16 specifically, Samsung Internet, branded Edge, Instagram/TikTok/X/Discord webviews, native keyboards/share sheets and iMessage preview caching need hands-on checks. Engine emulation is not labelled as physical coverage. |
| Accessibility and fallbacks | PASS automated AA checks in both themes, keyboard autocomplete, visible focus, 44px targets, 16px fields, safe areas and dynamic viewport. 20 production page checks have no axe AA violations or horizontal overflow. Reduced motion, low-power static stamp, denied storage and disabled JavaScript all pass. Physical on-screen keyboard clearance remains a device check. |

## Review boundaries

Automated filtering and measured pageviews do not substitute for the owner's category review. Draft sources retain scientific names and disambiguating parentheses. The first proposed dates are November 21–23, 2026 at 9 PM America/Toronto; choose future dates if review happens later. No production register is opened by this handoff.

The three visually weakest views are the empty Schools board (two long ruled tables), empty Archive (limited hierarchy without past volumes), and admin Stats (deliberately utilitarian). Each is usable and consistent with the registry design.
