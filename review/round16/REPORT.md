# R16: owner review and first-paint performance

| Audit environment | Mobile P / A / BP / SEO | Desktop P / A / BP / SEO |
| --- | --- | --- |
| Before: production Lighthouse, 3 runs | 94 / 100 / 100 / 100 each | 100 / 100 / 100 / 100 each |
| After: local production build, 3 runs | 96–98 / 100 / 100 / 100 (median 96) | 100 / 100 / 100 / 100 each |

Public PSI returned HTTP 429 for all six original requests (daily quota exhausted on Google's public service). The owner authorized local Lighthouse on the production build as the substitute. These are lab measurements, not CrUX field data. Final deployed measurements and the single PSI retry are recorded below after release.

## Owner changes

- Restored the registry-style Archivo clock with tabular digits and 0.055em spacing. The digit subset is preloaded; the full font remains available for headings. `44:44:44`, `11:11:11`, and `00:00:00` have 390/1440 proofs in both themes.
- Added at least 32px between the player/header and content headings. Content pages use a centered 65ch measure, 1.55 paragraph leading and explicit paragraph/section/example spacing.
- Links use ink text and vermilion underlines in both themes, thicker on interaction with visible keyboard focus. Footer links and feedback share the treatment and align with the wordmark.
- Paper/Carbon copy is back in the header. Countdown time-zone text links to Settings and focuses its selector. Settings has aligned Sound, Music, time zone, backup code and deletion controls.
- Settings code loads on first opening and stays mounted afterward, preserving active music state when the panel closes/reopens. Music still requires a deliberate tap.

## Audit-by-audit changes

Values below compare the first baseline production mobile run with the median local production-build result. Deployed results are retained separately because network/CDN/analytics behavior differs.

| Finding | Cause | Change and result |
| --- | --- | --- |
| LCP / time to interactive | Main application, stylesheet and full heading font on the critical path | Split archive, certificate, content/admin, settings and leaderboard JS; preload a 12,136-byte clock subset and Instrument. Mobile LCP/TTI 3.1s → 2.7s. Performance 94 → 96. Retained all game and sharing behavior. |
| Render-blocking resources | Separate initial stylesheet | Inline the compiled stylesheet with an exact SHA-256 CSP authorization. Estimated 130ms saving → no render-blocking resource finding. No `unsafe-inline` or `unsafe-eval`. |
| Unused JavaScript | Initial bundle included optional pages, sharing/animation/settings code | Initial compressed entry 128,224 → 81,906 bytes; estimated unused 76,920 → 37,019 bytes. Remaining React/game interaction code is not exercised by a closed-screen audit; it is retained for real play. This diagnostic is improved, not fully eliminated. |
| Unused CSS | One shared stylesheet covers all states and breakpoints | An attempted split changed cascade order, breaking mobile certificates and privacy text sizing. Restored original cascade, retained inline delivery; estimated unused ~14KiB → ~13KiB mobile. Remaining shared responsive/state styles are retained. This diagnostic remains; stripping them for a single viewport would regress other screens. |
| Cache lifetime | Unversioned grain and duplicate third-party analytics resources | New versioned grain assets; hashed scripts and versioned fonts/audio/grain receive one-year immutable caching. Local first-party cache audit passes. The platform analytics beacon's TTL is controlled by Cloudflare. |
| Image delivery | 55KiB PNG paper grain | AVIF 4,125 bytes with WebP 8,838-byte fallback; existing image kept for compatibility. Estimated image savings 52KiB → none. |
| Legacy JavaScript | Two Cloudflare Web Analytics beacons | Removed duplicate build-time injection, kept platform analytics. Local build has no legacy-code finding; Cloudflare's deployed beacon remains outside our code control. |
| Network dependency tree | CSS→font and JS→API dependency chains | Inlined CSS, preloaded critical fonts, reduced initial JS. The local longest chain is 51ms; normal same-origin JS/font dependencies remain. Lighthouse offers no useful additional preconnect origin. |
| Turnstile / JS execution | Verification was fetched before interaction | Verification begins when the player starts typing and is awaited on submit. Real verification and session guards remain; no protection removed. Practice rehearsal explicitly checks no challenge request on the closed screen, then verified successful claims. |
| Accessibility | Existing score 100; layout and lazy-loading could regress it | Browser axe checks cover content and complete play/certificate states, both themes. Keyboard time-zone focus, control labels, hit areas, heading structure, responsive flow and focus rings preserved. Score remains 100. |
| Best practices | Existing score 100; inline CSS could conflict with CSP | CSP hashes derived only from trusted built CSS; security header/unit checks plus browser CSP checks. Fixed response-body cloning before wrapping it in a secure response. Score remains 100. |
| SEO | Existing score 100 | Retained language, title, description, canonical, robots, sitemap, real HTML fallback and structured data. Practice/personal pages remain noindex. Local audits fetch production robots/sitemap read-only. Score remains 100. |

Not every Lighthouse diagnostic is green: unused shared CSS, unused interaction JS and normal same-origin dependencies remain. The numeric targets are met without deleting features or weakening protection. Mobile is not claimed to score 100.

## Verification and visual review

- Unit/API: 169/169 tests across 38 files. Inline stylesheet hash authorization and trusted response-body handling are covered in the SEO tests.
- 28/28 browser-engine/device checks at 200% zoom pass (`zoom200.json`).
- Browser matrix: all 576 cases pass after isolated recovery of four ENOENT trace-teardown errors caused by overlapping local runners. Both affected WebKit profiles passed all 32 cases on rerun. All 72 R16 checks pass against the final focus fix; on narrow screens its repeated activation is tested by keyboard because the open Settings panel overlaps the link. Linux Firefox passes all 96 cases.
- Final browser and CI summaries are `browser-summary.json` and `firefox-summary.json`; raw reports remain local.
- 48 final screen captures at 390/1440, both themes, with no horizontal overflow (`after-metrics.json`, `review/final/round16/`). Owner before/after and digit proofs: `owner-review/`.
- Inspected all 48 final captures through four contact sheets and full-size certificate, content, countdown and Settings examples. The anti-AI checklist passes: paper/ink/stamps, authored icons, no gradients/pills/generic cards, no placeholder copy. The development-proof banner appears only in fixture captures; the production bundle contains no fixture markers.
- The longest phone screens are Office/privacy/sources, completed-day sharing, and the certificate. They are intentionally scrollable; no horizontal clipping. Fixed bottom navigation appears at its viewport position in full-page screenshots.
- Physical iOS 16/Samsung/in-app performance is not certified by emulation. Browser-engine/device-profile tests cover the requested dimensions and flows.

## Release discipline

Practice first, then production before Monday 3PM ET, with rollback recorded immediately before deployment and automatic rollback on a failed production smoke. The launch remains Monday Nov 23 at 9PM ET. Real practice verification/alerts and its original schedule are restored after the test-key rehearsal. The already-completed R14 guarded 200-player load is not repeated for this frontend release. Production player rows and schedule are compared to a private baseline. No paid service or new secret is introduced; no R11 release gate is edited.

`rollback.json`, `deployment.json`, `practice-release.json`, `practice-first-visit.json`, `practice-restored.json`, `production-release.json`, `production-smoke.json` and `production-preservation.json` are the release evidence. Release status is not complete until those checks and the final tag are present.

Rebuild the optimized raster/font assets with Pillow, fonttools and Brotli installed in a project-local Python path, then `python3 scripts/r16-build-assets.py`. Do not re-run the abandoned stylesheet-splitting experiment.
