# Round 2 visual review

The screenshot loop ran after each UI item: first viewport, school removal, early filings/specimen, stamp size, shared wordmark, canonical origin, polling/layout-load changes and quota/closed states. Final dimensions: 390×844 and 1440×900, light and dark. The final gallery is `../index.html`.

| Anti-AI checklist | Review |
| --- | --- |
| No gradients, blobs, glass, blur or glow | PASS; source audit and screenshots. |
| No hero plus three feature cards | PASS; the requested three instructions are contiguous numbered form lines. |
| No rounded/shadowed cards or pill buttons | PASS; square rules; only the allowed solid offset ink on the CTA. |
| No emoji or decorative icon packs | PASS; simple text arrows and registry marks. |
| No generic centred layout or generic CTA | PASS; left-aligned category, plain rule and CALL DIBS. |
| No Inter/system type as visible design | PASS; self-hosted Archivo, Instrument and Plex; outlined shared wordmark. |
| No placeholder content or stock art | PASS; input example is intentional; archive example explicitly says SPECIMEN and has a watermark. |
| Deliberate detail on every screen | PASS; form numbers, rules, serials, specimen watermark or printed stamp. |

Reviewed the first fold, taken text, receipt, certificate, archive specimen, office notice, stats, closed office and quota notice. School screens are retired. Mobile stamps have 10px secondary text, 22px in 1080 PNGs. Closed/over-quota screens also pass axe AA and overflow checks. Local screenshots contain development examples only; production receives no fixture imports.

Lighthouse's initial layout shift came from lower navigation moving out of view after loading. Reserving the first viewport during load removed that shift; the final run scored 96/100 for performance/accessibility. Reduced-motion and low-power stamp fallbacks remain in place.
