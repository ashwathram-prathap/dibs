# R13 release — shipped November 22, 2026

Live: [production](https://dibs.here), [practice](https://practice.dibs-7hz.pages.dev), [API](https://dibs-api.dibs-registry.workers.dev). All eight production smoke checks passed: closed, correct Monday 9 PM ET schedule, reminders, both themes and no console errors. The three production in-app emulations also loaded successfully. Production Lighthouse: **93 performance / 100 accessibility**. The one final ntfy attempt returned **200**; no retry or additional alert was sent.

Production Pages: `7b183b0b-56d9-451e-b06d-355456765434`; Worker: `ab8ed32f-391a-40e0-bf1c-1b698743b379`. Practice Pages: `7316957f-e638-48ab-8ad2-6bc1b3081275`. Rollback Pages: `e6ee74b7-65f8-43b1-93ee-6b2e824bacc0`; Worker: `552aa70f-999f-4c65-88c2-4da89113bbd5`. Full deployment metadata is in [deployments.json](deployments.json). The required direct command chain and freeze check passed; no rollback was needed. Release tag: `r13-done`.

The layout pass restores PAPER COPY / CARBON COPY, puts the countdown/category/result first and restores the R7 hero scale, including the distinct 18.5vw phone countdown with 18px phone and 20px desktop body copy. Rules follow the claim input and collapse after the first guess. Long headings fit without splitting words; overlay keyboards receive enough scroll space to keep the input and button visible, including after refocusing.

Three original stamp sounds replace the oscillator blips. Mapping tests enforce silence for invalid/no-strike responses, the fifth strike and unrelated controls. Playback waits for audio readiness, deduplicates claims and prevents overlap; the remembered sound switch also works when storage is blocked. Music is off by default and never fetched before a tap. The original 32-second, 256,556-byte soft electric-piano loop is dedicated to CC0, fades, pauses/resumes with tab visibility, ducks under stamps and accounts for WebKit MP3 priming samples at the loop seam. Source, author and licence: [CREDITS](../../public/audio/CREDITS.md); composition source: [r13-audio.ts](../../scripts/r13-audio.ts).

| Sound | Duration | Peak | Gold ping |
| --- | --- | --- | --- |
| Stamp | 145ms | 0.12 (−18.4dBFS) | — |
| Gold | 480ms | 0.12 | 0.048, beginning at 120ms |
| Strike | 115ms | 0.06 (−24.4dBFS) | — |

All have 6ms attack and 12ms release. These are digital levels; actual speaker loudness depends on the device and volume setting.

Validation includes 137 unit/API tests; 360 unique Chromium/WebKit browser checks and 60 Firefox cases; all 15 requested dimensions × two themes × two engines for closed/live/done and every catalog heading; 12 local in-app flows; 40 body-type audits; and independent visual-viewport keyboard tests. The 200% zoom, 130% text sizing, safe-area and in-app checks are emulations, not physical-device or native Dynamic Type certification. Firefox is tested in Linux CI because local Firefox cannot launch on this Mac. Its initial audio failures and successful replacements are retained in [the Firefox summary](firefox-summary.json); the [final CI run](https://github.com/ashwathram-prathap/dibs/actions/runs/45067214703) passed all 18 R13 cases.

The deployed practice first-visit check opened two existing tabs automatically at zero and accepted claims in Chromium and WebKit. Instagram, LinkedIn and iMessage emulations also claimed successfully using official test Turnstile keys. Real practice keys and the original notification setting were restored after that QA window.

Lighthouse mobile: local closed 92/100 and live 95/100 (performance/accessibility); final deployed practice 96/100. An initial practice score of 87 was traced to R12's staging `no-transform` header disabling JS/CSS compression. It now protects HTML only, preserving the practice analytics-injection protection and enabling ordinary asset compression; production behavior is unchanged. No music file is fetched by these page-load checks.

Visual evidence: [hero matrix](hero-matrix.png), 12 `vs-r7-*.png` comparisons, waveform PNGs and WAVs, geometry/type/countdown JSON, and [visual review](visual-review.md). Forty final full-page captures are saved locally in `review/final/round13/`. The least expressive screens remain the empty archive, long Office explanation and lengthy completed results list.

The production launch remains Monday November 23 at 9:00 PM ET (`2026-11-24T02:00:00.000Z`). The accepted R11 infrastructure gates were not edited. The guarded 200-player deployed load test was skipped because this release finished before the permitted Sunday 7:05 PM ET window; it must not consume the remaining daily D1 write allowance. Physical phone checks remain useful: hero visibility with the keyboard, both themes, the three stamp sounds at mid volume, music on/off, and Remind me.
