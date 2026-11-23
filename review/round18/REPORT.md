# R18 release report

Shipped to https://dibs.here on 2026-11-23T11:00:01.228Z, before the Nov 23, 3 PM ET cutoff. Opening remains **Monday, November 23 at 9:00 PM ET**. Tag: `r18-done`. No production test claims or feedback were submitted. No ntfy alert was sent.

## Shipped

- Vertical Settings; phone bottom sheet with sticky Close and safe areas; one backup explanation; signed-cookie own-code read, Copy, Restore, and separated deletion.
- Native feedback modal / phone sheet, focus trap and Escape, readable full-width fields, helper text, success and error states.
- Footer brand row plus a single four-link group / phone 2×2 grid. Matching reminder rows.
- Warm textured carbon and paper; single frames; simpler labels; Archivo, Instrument Sans and restricted IBM Plex Mono throughout CSS, canvas and OG images. `BRAND.md` records the system. The R7 clock uses the original font file, weight and proportions, crisp edges, tabular digits and positive gaps.
- Share is primary and Copy result secondary, only on results/certificates.
- Home WebSite/VideoGame structured data, public IndexNow key and nonblocking deploy/archive notifications; unique archive metadata; sitemap/robots remain valid 200 responses when the internal archive API fails.

## Verification

| Check | Result |
| --- | --- |
| Unit/API | 197 passed |
| Requested-width Chromium/WebKit layout suite | 112 passed |
| Full local device regression | 1550 passed |
| Firefox on Linux | 228 passed ([CI run](https://github.com/ashwathram-prathap/dibs/actions/runs/45157548109)) |
| Fresh practice closed → live | 6 browsers passed; displayed-code recovery passed |
| Final practice UI | Chromium/WebKit × 390/1440 × both themes passed |
| Practice Slow-4G mobile Lighthouse | Performance 99, accessibility 100, best practices 100 |
| Production Slow-4G mobile Lighthouse | Performance 98, accessibility 100, best practices 100, SEO 100 |
| IndexNow deploy notifications | 202 accepted; 202 accepted |
| Production smoke | 8 Chromium/WebKit × phone/desktop × theme checks passed; no console errors |
| Preservation | Existing player rows and schedule unchanged |
| Build, TypeScript, font roles, emoji audit | Passed |

| Device / browser profile | Result |
| --- | --- |
| r6-390 | PASS — 2 passed, 0 failed |
| iPhone-SE | PASS — 86 passed, 0 failed |
| iPhone-15-Pro | PASS — 86 passed, 0 failed |
| iPhone-15-Pro-Max | PASS — 86 passed, 0 failed |
| Pixel-7 | PASS — 86 passed, 0 failed |
| Galaxy-S9+ | PASS — 86 passed, 0 failed |
| iPad-Mini | PASS — 86 passed, 0 failed |
| iPad-Pro-11-landscape | PASS — 86 passed, 0 failed |
| chromium-1280 | PASS — 86 passed, 0 failed |
| chromium-1440 | PASS — 86 passed, 0 failed |
| chromium-2560 | PASS — 86 passed, 0 failed |
| webkit-1280 | PASS — 86 passed, 0 failed |
| webkit-1440 | PASS — 86 passed, 0 failed |
| webkit-2560 | PASS — 86 passed, 0 failed |
| 320-small | PASS — 86 passed, 0 failed |
| landscape-phone | PASS — 86 passed, 0 failed |
| Instagram-iPhone-15-Pro | PASS — 43 passed, 0 failed |
| Instagram-Pixel-7 | PASS — 43 passed, 0 failed |
| TikTok-iPhone-15-Pro | PASS — 43 passed, 0 failed |
| TikTok-Pixel-7 | PASS — 43 passed, 0 failed |
| X-iPhone-15-Pro | PASS — 43 passed, 0 failed |
| X-Pixel-7 | PASS — 43 passed, 0 failed |
| firefox-390 | PASS — 86 passed, 0 failed |
| firefox-1440 | PASS — 86 passed, 0 failed |

Device profiles include iPhone SE / 15 Pro / 15 Pro Max, Pixel 7, Galaxy S9+, iPad Mini / Pro landscape, Chromium/WebKit desktop 1280/1440/2560, narrow/landscape phones, and in-app user-agent approximations. These are engine/device emulations, not physical-device certification. Practice is deliberately noindex, explaining its Lighthouse SEO score of 66.

## Crawler output

- Googlebot `/sitemap.xml`: **200**, `application/xml; charset=utf-8`, 0 redirects, valid response, no challenge. [Headers](crawlers/Googlebot-sitemap-xml.headers.txt) · [Body](crawlers/Googlebot-sitemap-xml.body.txt)
- Googlebot `/robots.txt`: **200**, `text/plain; charset=utf-8`, 0 redirects, valid response, no challenge. [Headers](crawlers/Googlebot-robots-txt.headers.txt) · [Body](crawlers/Googlebot-robots-txt.body.txt)
- Bingbot `/sitemap.xml`: **200**, `application/xml; charset=utf-8`, 0 redirects, valid response, no challenge. [Headers](crawlers/Bingbot-sitemap-xml.headers.txt) · [Body](crawlers/Bingbot-sitemap-xml.body.txt)
- Bingbot `/robots.txt`: **200**, `text/plain; charset=utf-8`, 0 redirects, valid response, no challenge. [Headers](crawlers/Bingbot-robots-txt.headers.txt) · [Body](crawlers/Bingbot-robots-txt.body.txt)

XML was parsed, all lastmod values were checked as W3C dates, and both bot agents fetched both endpoints. These user-agent checks do not establish Cloudflare's verified-bot classification. The historical Search Console error cannot be conclusively explained without its crawl logs; the demonstrated archive-API failure path is fixed.

## Rollback and deployment

| | Pages deployment | Worker version |
| --- | --- | --- |
| Rollback | `cf4c4790-1cf1-48c3-b224-101f03b8a99c` | `6d7cb066-1179-4773-9456-7140067def1e` |
| Released | `0a3fd4eb-3a49-4320-a8bb-0a7b51cdf8d3` | `f3b136b2-b2e9-4907-9d5d-9fd0d7a0d1b0` |

`npx tsx scripts/r18-smoke.ts --rollback-now` restores those recorded versions. Production was backed up before deployment. No migration or schedule change was required. The first attempt was immediately rolled back after smoke found that the static home bypassed middleware-generated JSON-LD. The corrected build embeds it in the static HTML; refreshed tests and the final production smoke passed. [First-attempt rollback evidence](attempt-1/rollback-result.json).

## Owner checks and limits

**Cloudflare security-setting verification is blocked:** the available token can read the zone but returns 403 for Bot Management, WAF and security settings; the connected dashboard browser was unavailable. No settings were changed. See [the exact dashboard paths and bot exclusions](DECISIONS.md#cloudflare-setting-audit-owner-verification-required). After checking them, resubmit the sitemap in Search Console / Bing if needed.

The optional expanded-catalog glyph audit found pre-existing non-Latin coverage gaps; all four relevant fonts are byte-identical to R17. No catalog data was altered. The new remote 200-player load run was skipped because its permitted 7:05 PM ET start is after this release's 3 PM cutoff. Local concurrency/load tests passed. [Decisions and details](DECISIONS.md).

## Visual evidence

Open [the visual review index](index.html): requested Settings/feedback/footer widths in both themes, scrolled Settings, before/after play/done/certificates, R7 clock comparisons and export samples. Every route has final screenshots at 390/1440 in `review/final/round18/`. Raw images and verbose test/Lighthouse reports remain local to avoid bloating the repository.

The three weakest remaining screens are the long Office/legal page, the long expanded phone day certificate, and the deliberately sparse empty archive. They passed layout checks; no invented records were added to fill the archive.

First phone checks: open and scroll Backup code; open/close Send feedback with the keyboard; check the 9 PM ET countdown and reminder rows; switch paper/carbon; after opening, claim and try native Share / Copy result.
