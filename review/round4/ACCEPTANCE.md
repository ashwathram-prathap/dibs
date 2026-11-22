# Round 4 acceptance

- SHARE uses a pre-rendered story PNG plus text/URL. Unsupported files use a text-only native sheet and offer PNG export. Cancellation is retained; rejected sharing falls back to download.
- Both summaries and certificates expose X, WhatsApp, Facebook, Instagram/TikTok story, Copy link, Copy text, Story PNG and Feed PNG. Caption/link clipboard failures expose selectable text. Download failures keep an inline PNG and an open-image link for long-press saving.
- PNGs: 1080×1920 story, 1080×1350 feed. Pixel checks confirm blank story margins at top 160 and bottom 260. Self-hosted fonts and public Pages address; no local origin. See export-checks.json.
- Permanent summary URLs work for 3-dibs and 5-strike/zero-dibs files, including reloads. Public summaries omit voided claims. Moderation invalidates preview caches. The countdown is recomputed outside the cached result.
- Per-record Open Graph and Twitter images: 1200×630, summary_large_image, versioned URLs, permanent spoiler-free titles/descriptions and score-only preview imagery. The manually saved PNGs intentionally include the player's answers. The 30-day/eight-shard Round 2 budget still applies.
- Local real workerd fetch tests for WhatsApp, X, Facebook, iMessage and Discord: 1–39 ms, at most 43623 bytes. Cached responses have identical bytes; no D1 writes on repeat.
- Live generic card: 57–162 ms, 38292 bytes. Live certificate and summary misses return 404. A real per-record production measurement is BLOCKED until the first genuine game: today is closed, archive is empty, and ledger has no records. No production fixtures were inserted. Rerun the crawler fetch on the first genuine certificate and summary.
- Platform taps and first attributed arrivals contain only an allowlisted platform. One aggregate counter update per event; zero D1 writes. Live stats exposes all nine counters with actual zero totals. No test events were submitted to production.
- 462 distinct Playwright checks passed (including the targeted rerun documented in devices.md), across 42 configurations; 35 unit/Worker checks; TypeScript and production build passed. Lighthouse Slow 4G mobile: 100 performance / 100 accessibility. Production assets contain no development fixtures.
- Final visual review: light/dark at 390 and 1440; ruled panels, ink palette, deliberate form labels, no gradients, pills, decorative icons, stock art or generic hero. Corrected the narrow stats column and aligned the day-summary share sheet. Contact sheets and full-size PNGs are saved.

## Decisions and limitations

Canonical address remains https://dibs-7hz.pages.dev under OVERNIGHT.md. No custom domain changes. Preview spoilers stay hidden even after category close so each cached image can stay immutable. First attributed arrival uses a local boolean, never a visitor ID; blocked storage permits only per-page deduplication. Native share counts record the sheet, since the OS does not expose the selected app. Instagram/TikTok is a combined export target, not a claimed direct-post integration.

No social posting, third-party widgets/tracking scripts, paid services or fabricated player counts. Physical-device integration remains a manual check. The conservative 10,000-visitor scenario exceeds free DO limits after attribution; see free-tier.md. No database migrations or new secrets were needed.

## Review artifacts

Screenshots and exports: ../final/ (share-sheet, public-summary, stats-platforms, certificate-story/feed, day-summary-story/feed, and OG PNGs). Full device flows: ../devices/. Firefox screenshots: CI artifact. Three weakest screens remain the empty archive, sparse prelaunch stats, and text-heavy office notice; none shows a detected layout defect.
