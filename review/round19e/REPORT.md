# R19E — shipped November 23, 2026

Practice and production are deployed. Production scoring and closed-state smoke checks completed at **3:37:19 p.m. ET**, before the **4:30 PM ET hard stop**. Tonight remains Animals, Monday at 9:00 PM ET. Production still has zero claims.

- Production: https://dibs.here · API: https://dibs.here/api/today
- Practice: https://practice.dibs-7hz.pages.dev · API: https://practice.dibs-7hz.pages.dev/api/today
- Production Pages: `d3c6cd97-d3dc-4360-8846-a50b7c79c5ac`; Worker: `08ac8998-1feb-48f8-a84d-021a8d7cea82`.
- Practice Pages: `c2cda319-499d-4fdd-a637-fcc61576a08c`; Worker: `f3bcf96b-6f99-47fd-a801-baf9e123865b`.
- Rollback Pages: `ae73c4f0-db5a-495d-93fa-5458273b8208`; Worker: `07a0cfa8-23e0-4243-9804-a7f9c7128f1c`.

## What changed

Rarity now ranks against the top 3,000 measured mean-daily-pageview answers per category, configurable in category-plan.json. Smaller measured catalogs use all readings. Measured answers outside the pool receive percentile 1 and 110 points. Missing readings remain unmeasured and use the reference-pool median (normally 55). Saved claim points, percentiles and bonuses are never recalculated.

The familiar decile remains 10 points; the scale above it now reaches the requested 110. FAQ copy matches. Golden-ticket bonuses and strikes are unchanged. The R19 curve marker and R19C wording still use the saved percentile, including the unmeasured state.

All 33 current categories plus the historically pinned Foods catalog are covered: 34 catalog versions, 169 score/curve assets. New paths include `r19e-pool-v1`; old immutable paths are retained. All 66 previously deployed legacy scoring binaries match their recorded hashes exactly. The scheduled November 28 Foods version was recovered from its exact historical source and retained with checksum verification.

| Animals example | Before | After |
|---|---:|---:|
| Dog / Cat / Lion | 10 | 10 |
| Camel / Deer | 10 | 10 |
| Chameleon | 10 | 15 |
| Blobfish | 10 | 45 |
| Sarcastic fringehead | 10 | 75 |
| Rarest measured answers | 100 | 110 |

Okapi, Axolotl and Quokka remain 10 because the retained pageview measurements put them among highly popular answers. These sanity targets were checked, not forced. The appendix contains 30 before/after samples for every catalog version (1,020 rows).

## Verification

| Check | Result |
|---|---|
| Unit/API suite | 238 passed across 52 files |
| Chromium/WebKit device and theme matrix | 168 passed, 42 profiles |
| Firefox desktop/theme matrix | 24 passed, six profiles |
| Final visual pass, 390/1440, light/dark, Chromium/WebKit | 48 passed; 248 captures |
| Practice fresh-browser closed → live | Chromium and WebKit passed; two real QA claims |
| Practice historical claims | All nine original claim scores/percentiles/bonuses unchanged |
| Deployed Worker scoring | 30 practice and 210 production samples passed |
| Production closed-state smoke | Eight browser/width/theme combinations passed, zero console errors |
| Production schedule/data | All seven scheduled catalog versions preserved; zero claims |
| Asset integrity | All 169 score/curve files and all 12 JS/CSS files match the build on canonical production; immutable deployment scripts also match |
| Lighthouse practice mobile, simulated Slow 4G | Performance 99, accessibility 100, best practices 100 |
| Lighthouse practice desktop | Performance/accessibility/best practices 100 |
| Lighthouse production mobile | Performance 99; accessibility/best practices/SEO 100 |
| Lighthouse production desktop | All four categories 100 |

Firefox CI: https://github.com/ashwathram-prathap/dibs/actions/runs/45256303486 . Exact evidence lives beside this report, including completed.json, production-release.json, production-worker-scores.json, production-smoke.json, unit-summary.json, browser-summary.json, and the asset-integrity reports. Full local/CI/Lighthouse output and screenshots remain in ignored review artifact directories.

Practice verification restored the original dates, real Turnstile verification and notification topic. Its final 12 claims include the nine preserved originals, two QA claims and one additional practice activity. No practice reset or production claim was used.

## Release issues resolved

Two asset-check attempts observed cached SPA HTML at JavaScript URLs on the canonical domain. Their immutable deployment URLs served the correct bytes; fresh canonical query URLs also returned the correct scripts. The cache-purge request was denied by the current token. Both failed attempts restored the previous Pages and Worker versions. A fresh content-hashed build plus a fresh-response canonical readiness gate preceded the final exact-URL integrity check. No integrity assertion was weakened.

Another attempt passed all 210 actual Worker scoring samples and all four Chromium smoke cases, then rolled back on a WebKit console error. An independent reproduction showed no errors before screenshot capture and a CSP error only after Playwright injected its screenshot synchronization style. The production WebKit smoke now stays screenshot-free, with the same interactions, zero-error assertions and unchanged strict CSP. WebKit visual captures passed against the isolated security-test server. Evidence is in attempt1/, attempt2/, attempt3/ and webkit-screenshot-diagnostic.json.

## Decisions, limits and owner checks

Full decisions: [DECISIONS.md](DECISIONS.md). Equal pageviews keep equal scores, including ties crossing the pool cutoff. Missing data uses the nameable-pool median; entirely unmeasured catalogs retain the old 50-point fallback. The old scale actually ended at 100, so it was rescaled to satisfy the explicit 110-point requirement.

No paid services, new secrets or notification messages were created. Zero ntfy alerts were sent. Existing credentials remain in ignored local files; no credential values are in this report. R12's optional 7:05 PM practice load test is skipped because it occurs after this task's hard stop.

Device profiles and user agents are emulations. Physical Safari/iOS versions, native Samsung/Edge behavior and native in-app sharing still need owner-device confirmation. The changed UI has no known blocker. The three weakest existing views remain the long mobile Office page, dense completed-day page and certificates at extreme text zoom.

On your phone: (1) check the closed page still says Monday 9 PM ET; (2) open reminders and change theme; (3) read the FAQ's 10–110 range; (4) after opening, compare familiar and rarer valid answers and their curve markers; (5) open your certificate and exercise share/download fallback.

Screenshots: review/final/round19e/, review/round19e/ui/, review/devices/, and production-*.png. Visual review: [VISUAL_REVIEW.md](VISUAL_REVIEW.md).

## Device pass table

Each profile covers the full gameplay flow, scored payoff and FAQ/accessibility checks. Firefox's six desktop/theme profiles passed separately in CI.

| Profile | Result |
|---|---|
| iPhone-SE-light | 4 passed |
| iPhone-15-Pro-light | 4 passed |
| iPhone-15-Pro-Max-light | 4 passed |
| Pixel-7-light | 4 passed |
| Galaxy-S9+-light | 4 passed |
| iPad-Mini-light | 4 passed |
| iPad-Pro-11-landscape-light | 4 passed |
| chromium-1280-light | 4 passed |
| chromium-1440-light | 4 passed |
| chromium-2560-light | 4 passed |
| webkit-1280-light | 4 passed |
| webkit-1440-light | 4 passed |
| webkit-2560-light | 4 passed |
| 320-small-light | 4 passed |
| landscape-phone-light | 4 passed |
| iPhone-SE-dark | 4 passed |
| iPhone-15-Pro-dark | 4 passed |
| iPhone-15-Pro-Max-dark | 4 passed |
| Pixel-7-dark | 4 passed |
| Galaxy-S9+-dark | 4 passed |
| iPad-Mini-dark | 4 passed |
| iPad-Pro-11-landscape-dark | 4 passed |
| chromium-1280-dark | 4 passed |
| chromium-1440-dark | 4 passed |
| chromium-2560-dark | 4 passed |
| webkit-1280-dark | 4 passed |
| webkit-1440-dark | 4 passed |
| webkit-2560-dark | 4 passed |
| 320-small-dark | 4 passed |
| landscape-phone-dark | 4 passed |
| Instagram-iPhone-15-Pro | 4 passed |
| Instagram-Pixel-7 | 4 passed |
| TikTok-iPhone-15-Pro | 4 passed |
| TikTok-Pixel-7 | 4 passed |
| X-iPhone-15-Pro | 4 passed |
| X-Pixel-7 | 4 passed |
| Samsung-Internet-360 | 4 passed |
| Edge-1440 | 4 passed |
| chromium-390-light | 4 passed |
| chromium-390-dark | 4 passed |
| webkit-390-light | 4 passed |
| webkit-390-dark | 4 passed |

## Appendix — 30 before/after answers per catalog


Percentile 0 is most familiar; 100% is rarest. Views are retained mean daily Wikipedia pageviews. No readings or target scores were invented. Missing readings retain no percentile and use the category reference-pool median. Before uses the exact R19C scale (10–100); after uses the requested 10–110 scale.

## actors

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| RJ Mitte | 156545.61 | 0.00% | 0.00% | 10 | 10 |
| Charlie Heaton | 12128.71 | 0.08% | 3.83% | 10 | 10 |
| Richard Riehle | 9085.10 | 0.17% | 7.67% | 10 | 10 |
| Billie Lourd | 7553.61 | 0.25% | 11.54% | 10 | 10 |
| Sean Connery | 6681.90 | 0.34% | 15.37% | 10 | 15 |
| Riz Ahmed | 5983.23 | 0.42% | 19.21% | 10 | 20 |
| John Ritter | 5405.32 | 0.50% | 23.07% | 10 | 25 |
| Bani J | 4932.52 | 0.59% | 26.91% | 10 | 30 |
| Kane Parsons | 4586.81 | 0.67% | 30.74% | 10 | 35 |
| Kirk Herbstreit | 4333.68 | 0.76% | 34.61% | 10 | 35 |
| Jim Morrison | 4079.29 | 0.84% | 38.45% | 10 | 40 |
| Matt LeBlanc | 3830.58 | 0.92% | 42.28% | 10 | 45 |
| Jamie Foxx | 3611.74 | 1.01% | 46.15% | 10 | 50 |
| Joe Rogan | 3426.77 | 1.09% | 49.98% | 10 | 55 |
| Demi Lovato | 3254.00 | 1.17% | 53.82% | 10 | 60 |
| Roy Orbison | 3091.81 | 1.26% | 57.69% | 10 | 65 |
| Dichen Lachman | 2940.39 | 1.34% | 61.52% | 10 | 65 |
| Emily Deschanel | 2802.58 | 1.43% | 65.36% | 10 | 70 |
| Chris Isaak | 2678.97 | 1.51% | 69.24% | 10 | 75 |
| Sam Richardson | 2582.00 | 1.59% | 73.06% | 10 | 80 |
| Sidney Poitier | 2481.23 | 1.68% | 76.89% | 10 | 85 |
| Bel Powley | 2392.74 | 1.76% | 80.76% | 10 | 90 |
| Jason Derulo | 2297.32 | 1.85% | 84.59% | 10 | 95 |
| Isaac Hayes | 2219.13 | 1.93% | 88.43% | 10 | 95 |
| Roy Scheider | 2137.94 | 2.01% | 92.30% | 10 | 100 |
| Ted Cassidy | 2062.26 | 2.10% | 96.13% | 10 | 105 |
| Terrence Howard | 1992.10 | 2.18% | 100.00% | 10 | 110 |
| Soulja Boy | 1991.10 | 2.18% | 100.00% | 10 | 110 |
| Yadana Bo | 0.03 | 99.97% | 100.00% | 100 | 110 |
| Abdou Chaibane | unknown | unmeasured | unmeasured | 50 | 55 |

## airports

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Area 51 | 3917.55 | 0.00% | 0.00% | 10 | 10 |
| Birmingham Airport | 389.42 | 0.90% | 3.83% | 10 | 10 |
| Sacramento International Airport | 219.90 | 1.80% | 7.67% | 10 | 10 |
| Kota Kinabalu International Airport | 158.71 | 2.71% | 11.54% | 10 | 10 |
| Chengdu Shuangliu International Airport | 126.77 | 3.61% | 15.37% | 10 | 15 |
| Tivat Airport | 103.74 | 4.51% | 19.21% | 10 | 20 |
| Surat Airport | 88.81 | 5.42% | 23.07% | 10 | 25 |
| Whitehorse Airport | 73.81 | 6.32% | 26.89% | 10 | 30 |
| Gregorio Luperón International Airport | 61.84 | 7.23% | 30.74% | 10 | 35 |
| Akureyri Airport | 53.39 | 8.14% | 34.63% | 10 | 35 |
| Çukurova International Airport | 46.26 | 9.04% | 38.45% | 10 | 40 |
| Henry E. Rohlsen Airport | 39.65 | 9.94% | 42.28% | 10 | 45 |
| Waterford Airport | 34.71 | 10.84% | 46.13% | 10 | 50 |
| Warangal Airport | 30.71 | 11.74% | 49.97% | 10 | 55 |
| Ivalo Airport | 27.87 | 12.64% | 53.80% | 15 | 60 |
| Hagerstown Regional Airport | 24.65 | 13.56% | 57.70% | 15 | 65 |
| El Arish International Airport | 22.26 | 14.47% | 61.55% | 15 | 65 |
| Molokai Airport | 19.94 | 15.36% | 65.37% | 15 | 70 |
| Inca Manco Cápac International Airport | 18.10 | 16.27% | 69.22% | 15 | 75 |
| Allegheny County Airport | 16.61 | 17.18% | 73.11% | 15 | 80 |
| Polonia Airport | 15.39 | 18.05% | 76.81% | 20 | 85 |
| MOD West Freugh | 14.03 | 18.97% | 80.73% | 20 | 90 |
| East Hampton Airport | 12.94 | 19.88% | 84.58% | 20 | 95 |
| Gaziantep Oğuzeli Airport | 11.90 | 20.80% | 88.51% | 20 | 95 |
| Victoria Inner Harbour Airport | 11.16 | 21.67% | 92.20% | 20 | 100 |
| Stillwater Airport | 10.39 | 22.57% | 96.05% | 25 | 105 |
| Sukhothai Airport | 9.58 | 23.47% | 100.00% | 25 | 110 |
| Tiksi Airport | 9.58 | 23.47% | 100.00% | 25 | 110 |
| Winona-Montgomery County Airport | 0.03 | 99.99% | 100.00% | 100 | 110 |
| ??? 'Greenhouse town' Airport | unknown | unmeasured | unmeasured | 50 | 55 |

## albums

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| XXXXX | 19229.45 | 0.00% | 0.00% | 10 | 10 |
| The Boys of Dungeon Lane | 862.48 | 0.08% | 3.83% | 10 | 10 |
| Obscured by Clouds | 645.97 | 0.16% | 7.67% | 10 | 10 |
| Are You Experienced | 538.65 | 0.25% | 11.54% | 10 | 10 |
| A Farewell to Kings | 472.52 | 0.33% | 15.37% | 10 | 15 |
| Thank Me Later | 423.97 | 0.41% | 19.21% | 10 | 20 |
| Thank U, Next | 385.19 | 0.49% | 23.07% | 10 | 25 |
| Come This Madness | 353.19 | 0.57% | 26.91% | 10 | 30 |
| Goblin | 329.65 | 0.65% | 30.74% | 10 | 35 |
| All the Right Reasons | 309.90 | 0.74% | 34.61% | 10 | 35 |
| Three Dollar Bill, Y'all | 292.32 | 0.82% | 38.45% | 10 | 40 |
| Holy Wood | 276.19 | 0.90% | 42.28% | 10 | 45 |
| Buckingham Nicks | 262.13 | 0.98% | 46.15% | 10 | 50 |
| Animal Magnetism | 248.90 | 1.06% | 49.98% | 10 | 55 |
| Forever Changes | 235.65 | 1.15% | 53.82% | 10 | 60 |
| Juju | 223.77 | 1.23% | 57.69% | 10 | 65 |
| Tha Carter II | 212.26 | 1.31% | 61.50% | 10 | 65 |
| Ace Frehley | 203.61 | 1.39% | 65.36% | 10 | 70 |
| Point of Know Return | 195.55 | 1.47% | 69.22% | 10 | 75 |
| Loaded | 189.13 | 1.56% | 73.06% | 10 | 80 |
| Kaleidoscope | 182.23 | 1.64% | 76.89% | 10 | 85 |
| Summer Days | 175.90 | 1.72% | 80.76% | 10 | 90 |
| Does This Look Infected? | 170.26 | 1.80% | 84.58% | 10 | 95 |
| Lionheart | 165.23 | 1.88% | 88.43% | 10 | 95 |
| Razorblade Romance | 159.84 | 1.96% | 92.30% | 10 | 100 |
| Hushed and Grim | 155.52 | 2.05% | 96.13% | 10 | 105 |
| The Seventh One | 151.06 | 2.13% | 99.98% | 10 | 110 |
| Floral Shoppe | 151.00 | 2.13% | 100.00% | 10 | 110 |
| Phantom | 0.03 | 99.28% | 100.00% | 100 | 110 |
| ¿Quién? | unknown | unmeasured | unmeasured | 50 | 55 |

## animals

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Cat | 13735.83 | 0.00% | 0.00% | 10 | 10 |
| Dog | 7077.59 | 0.00% | 0.07% | 10 | 10 |
| Axolotl | 4020.83 | 0.01% | 0.13% | 10 | 10 |
| Lion | 3048.93 | 0.03% | 0.62% | 10 | 10 |
| Deer | 1788.17 | 0.14% | 2.97% | 10 | 10 |
| Quokka | 1591.07 | 0.18% | 3.80% | 10 | 10 |
| Okapi | 1266.28 | 0.28% | 6.07% | 10 | 10 |
| Manul | 1252.24 | 0.29% | 6.24% | 10 | 10 |
| Camel | 1225.83 | 0.30% | 6.50% | 10 | 10 |
| Bull shark | 779.69 | 0.58% | 12.47% | 10 | 15 |
| Chameleon | 757.00 | 0.59% | 12.64% | 10 | 15 |
| Great Egret | 542.00 | 0.87% | 18.76% | 10 | 20 |
| Bovine | 411.93 | 1.16% | 24.97% | 10 | 25 |
| Partridge | 315.72 | 1.45% | 31.24% | 10 | 35 |
| Steller Sea Lion | 246.79 | 1.74% | 37.48% | 10 | 40 |
| Blobfish | 213.66 | 1.94% | 41.61% | 10 | 45 |
| Tamaraw | 198.97 | 2.04% | 43.76% | 10 | 50 |
| American White Ibis | 167.34 | 2.33% | 49.98% | 10 | 55 |
| African Fish Eagle | 143.14 | 2.62% | 56.22% | 10 | 60 |
| Indian Jungle Crow | 123.21 | 2.91% | 62.45% | 10 | 70 |
| Sarcastic fringehead | 110.00 | 3.15% | 67.77% | 10 | 75 |
| Western meadowlark | 107.86 | 3.20% | 68.72% | 10 | 75 |
| Western Rat Snake | 96.60 | 3.49% | 75.01% | 10 | 80 |
| Bone-eating marine worms | 86.17 | 3.78% | 81.23% | 10 | 90 |
| Cuscus | 77.24 | 4.07% | 87.50% | 10 | 95 |
| Crested Hawk-Eagle | 70.14 | 4.36% | 93.71% | 10 | 105 |
| Buff tailed bumblebee | 63.83 | 4.66% | 100.00% | 10 | 110 |
| Eurasian Oystercatcher | 63.83 | 4.66% | 100.00% | 10 | 110 |
| Witte's Worm Lizard | 0.00 | 99.94% | 100.00% | 100 | 110 |
| 'Alpine' Sheridan'S Hairstreak | unknown | unmeasured | unmeasured | 50 | 55 |

## architects

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Leonardo da Vinci | 5618.35 | 0.00% | 0.00% | 10 | 10 |
| Keye Luke | 296.81 | 0.65% | 3.83% | 10 | 10 |
| William Wesley Peters | 132.00 | 1.30% | 7.67% | 10 | 10 |
| Sergio Galeotti | 84.81 | 1.95% | 11.52% | 10 | 10 |
| Louisa Rix | 63.10 | 2.61% | 15.37% | 10 | 15 |
| Howard Dwight Smith | 46.65 | 3.25% | 19.19% | 10 | 20 |
| Naum Gabo | 37.74 | 3.91% | 23.07% | 10 | 25 |
| Michael E. Reynolds | 31.81 | 4.56% | 26.93% | 10 | 30 |
| Enamul Karim Nirjhar | 26.10 | 5.21% | 30.74% | 10 | 35 |
| Andrew Wallace | 22.00 | 5.87% | 34.64% | 10 | 35 |
| Dankmar Adler | 19.26 | 6.52% | 38.48% | 10 | 40 |
| Greg Lynn | 17.00 | 7.17% | 42.30% | 10 | 45 |
| Michael Bryce | 15.26 | 7.83% | 46.17% | 10 | 50 |
| Siamak Hariri | 13.90 | 8.47% | 49.95% | 10 | 55 |
| C. Howard Crane | 12.71 | 9.13% | 53.87% | 10 | 60 |
| Tom Kundig | 11.58 | 9.77% | 57.64% | 10 | 65 |
| Edmund Happold | 10.68 | 10.44% | 61.59% | 10 | 65 |
| Dorte Mandrup | 9.77 | 11.09% | 65.42% | 10 | 70 |
| Wilhelm Kreis | 9.00 | 11.71% | 69.11% | 10 | 75 |
| Richard Kauffmann | 8.39 | 12.38% | 73.01% | 10 | 80 |
| Miodrag Živković | 7.90 | 13.01% | 76.73% | 15 | 85 |
| Wirt C. Rowland | 7.45 | 13.67% | 80.66% | 15 | 90 |
| Harvey Wiley Corbett | 7.00 | 14.35% | 84.64% | 15 | 95 |
| Vincenzo Campi | 6.61 | 14.96% | 88.25% | 15 | 95 |
| Frederick Clarke Withers | 6.23 | 15.67% | 92.45% | 15 | 100 |
| Miles Warren | 5.90 | 16.30% | 96.17% | 15 | 105 |
| Diego Suarez | 5.58 | 16.98% | 100.00% | 15 | 110 |
| Eduardo Arroyo | 5.58 | 16.98% | 100.00% | 15 | 110 |
| Thomas Frazer | 0.03 | 99.95% | 100.00% | 100 | 110 |
| Alexander Wiseman | unknown | unmeasured | unmeasured | 50 | 55 |

## arthropods

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Palm Thief | 3611.35 | 0.00% | 0.00% | 10 | 10 |
| Gnat | 402.23 | 0.78% | 3.83% | 10 | 10 |
| Giant Golden Orb Weaver | 159.26 | 1.57% | 7.67% | 10 | 10 |
| Glasswing butterfly | 94.06 | 2.36% | 11.55% | 10 | 10 |
| Mormon cricket | 60.61 | 3.14% | 15.37% | 10 | 15 |
| Rottenwood termite | 42.65 | 3.92% | 19.21% | 10 | 20 |
| Soft tick | 31.97 | 4.71% | 23.07% | 10 | 25 |
| Stalk-eyed fly | 24.29 | 5.49% | 26.89% | 10 | 30 |
| Harlequin cockroach | 19.58 | 6.28% | 30.74% | 10 | 35 |
| Graceful twig ant | 16.16 | 7.06% | 34.61% | 10 | 35 |
| Dimorphic Jumper | 14.00 | 7.85% | 38.46% | 10 | 40 |
| Drummer | 12.19 | 8.64% | 42.33% | 10 | 45 |
| Hairstreak | 10.71 | 9.42% | 46.15% | 10 | 50 |
| Sleepy Orange | 9.42 | 10.21% | 50.02% | 10 | 55 |
| Brimstone Moth | 8.39 | 11.00% | 53.90% | 10 | 60 |
| Cowpea aphid | 7.55 | 11.78% | 57.74% | 10 | 65 |
| Black Jezebel | 6.77 | 12.57% | 61.57% | 15 | 65 |
| Micromalthid beetles | 6.10 | 13.35% | 65.39% | 15 | 70 |
| Fairy Moths | 5.55 | 14.13% | 69.24% | 15 | 75 |
| Bear Spiders | 5.03 | 14.93% | 73.14% | 15 | 80 |
| Primitive bristletail | 4.65 | 15.67% | 76.76% | 15 | 85 |
| Silk-Button Spangle Gall | 4.29 | 16.46% | 80.63% | 15 | 90 |
| Granulate ambrosia beetle | 3.97 | 17.27% | 84.59% | 15 | 95 |
| Ciliated False Squilla | 3.68 | 18.07% | 88.53% | 20 | 95 |
| Arizona Walkingstick | 3.45 | 18.88% | 92.51% | 20 | 100 |
| White-Blotched Heterocampa | 3.26 | 19.59% | 95.97% | 20 | 105 |
| Sooty-Winged Chalcoela Moth | 3.03 | 20.35% | 100.00% | 20 | 110 |
| Subtropical Lady | 3.03 | 20.35% | 100.00% | 20 | 110 |
| Yellowstone Snowfly | 0.03 | 99.58% | 100.00% | 100 | 110 |
| 'Alpine' Sheridan'S Hairstreak | unknown | unmeasured | unmeasured | 50 | 55 |

## asteroids

Pool: 3000. Missing-data fallback: 45 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Ceres | 1482.23 | 0.00% | 0.00% | 10 | 10 |
| Hungaria | 10.06 | 0.54% | 3.83% | 10 | 10 |
| Piazzia | 4.19 | 1.08% | 7.64% | 10 | 10 |
| Rhea | 2.74 | 1.63% | 11.47% | 10 | 10 |
| Shapleya | 2.06 | 2.17% | 15.27% | 10 | 15 |
| Giordano | 1.71 | 2.74% | 19.31% | 10 | 20 |
| Pawlowia | 1.52 | 3.26% | 22.97% | 10 | 25 |
| Josephina | 1.35 | 3.81% | 26.84% | 10 | 30 |
| Sidonia | 1.26 | 4.31% | 30.36% | 10 | 35 |
| Ostro | 1.16 | 4.87% | 34.34% | 10 | 35 |
| Beowulf | 1.06 | 5.55% | 39.11% | 10 | 40 |
| Vundtia | 1.03 | 5.85% | 41.23% | 10 | 45 |
| Levy | 0.97 | 6.54% | 46.15% | 10 | 50 |
| Chimay | 0.90 | 7.18% | 50.67% | 10 | 55 |
| Tomaiyowit | 0.87 | 7.51% | 52.95% | 10 | 60 |
| Edburga | 0.81 | 8.22% | 57.97% | 10 | 65 |
| Rumpelstilz | 0.77 | 8.62% | 60.80% | 10 | 65 |
| Steel | 0.74 | 9.08% | 64.00% | 10 | 70 |
| Alsufi | 0.68 | 10.01% | 70.59% | 10 | 75 |
| Cosette | 0.65 | 10.50% | 74.06% | 10 | 80 |
| Ehrenfreund | 0.61 | 11.05% | 77.94% | 10 | 85 |
| Celiacruz | 0.58 | 11.61% | 81.84% | 10 | 90 |
| Daitor | 0.55 | 12.12% | 85.48% | 10 | 95 |
| Eurydamas | 0.52 | 12.62% | 89.03% | 15 | 100 |
| Hopper | 0.48 | 13.13% | 92.56% | 15 | 100 |
| Lujiaxi | 0.45 | 13.62% | 96.02% | 15 | 105 |
| Imhilde | 0.42 | 14.23% | 100.00% | 15 | 110 |
| Impala | 0.42 | 14.23% | 100.00% | 15 | 110 |
| Zywiecmed | 0.03 | 85.41% | 100.00% | 85 | 110 |
| 'Oumuamua | unknown | unmeasured | unmeasured | 45 | 55 |

## bands

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Katseye | 14489.48 | 0.00% | 0.00% | 10 | 10 |
| Tears for Fears | 2276.29 | 0.23% | 3.83% | 10 | 10 |
| Black Flag | 1418.26 | 0.46% | 7.67% | 10 | 10 |
| Five Finger Death Punch | 1085.81 | 0.70% | 11.54% | 10 | 10 |
| James | 898.65 | 0.93% | 15.37% | 10 | 15 |
| The Pogues | 764.68 | 1.16% | 19.21% | 10 | 20 |
| Children of Bodom | 658.35 | 1.39% | 23.07% | 10 | 25 |
| Clutch | 563.32 | 1.62% | 26.91% | 10 | 30 |
| Black Label Society | 507.52 | 1.86% | 30.74% | 10 | 35 |
| Run the Jewels | 447.06 | 2.09% | 34.61% | 10 | 35 |
| O.A.R. | 401.87 | 2.32% | 38.45% | 10 | 40 |
| Japan | 366.55 | 2.55% | 42.28% | 10 | 45 |
| Carter Family | 330.87 | 2.79% | 46.15% | 10 | 50 |
| Tomora | 304.00 | 3.02% | 49.98% | 10 | 55 |
| Xscape | 280.16 | 3.25% | 53.82% | 10 | 60 |
| Uncle Acid & the Deadbeats | 260.45 | 3.48% | 57.69% | 10 | 65 |
| M2M | 240.58 | 3.71% | 61.52% | 10 | 65 |
| Infectious Grooves | 226.26 | 3.95% | 65.36% | 10 | 70 |
| Fu Manchu | 213.48 | 4.18% | 69.22% | 10 | 75 |
| Marcy Playground | 202.13 | 4.41% | 73.04% | 10 | 80 |
| Dope | 188.77 | 4.64% | 76.89% | 10 | 85 |
| Whitehouse | 179.35 | 4.88% | 80.76% | 10 | 90 |
| Hinge and Bracket | 170.35 | 5.11% | 84.58% | 10 | 95 |
| Frou Frou | 160.68 | 5.34% | 88.45% | 10 | 95 |
| Anti-Nowhere League | 152.61 | 5.57% | 92.30% | 10 | 100 |
| Dilated Peoples | 145.13 | 5.80% | 96.13% | 10 | 105 |
| Rossington Collins Band | 137.97 | 6.04% | 100.00% | 10 | 110 |
| The Hold Steady | 137.90 | 6.04% | 100.00% | 10 | 110 |
| Y Ffyrc | 0.03 | 99.92% | 100.00% | 100 | 110 |
| Aeon Gods | unknown | unmeasured | unmeasured | 50 | 55 |

## birds

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Dodo | 2105.17 | 0.00% | 0.00% | 10 | 10 |
| Harpy | 545.41 | 0.90% | 3.83% | 10 | 10 |
| Long-tailed Tit | 311.62 | 1.80% | 7.67% | 10 | 10 |
| Black guillemot | 195.21 | 2.70% | 11.54% | 10 | 10 |
| Pied Currawong | 145.47 | 3.60% | 15.37% | 10 | 15 |
| Brown-headed Cowbird | 113.69 | 4.50% | 19.21% | 10 | 20 |
| Gambel's Quail | 91.28 | 5.41% | 23.07% | 10 | 25 |
| Sacred Kingfisher | 74.76 | 6.31% | 26.91% | 10 | 30 |
| Augur Buzzard | 63.52 | 7.21% | 30.74% | 10 | 35 |
| Brown Quail | 54.41 | 8.11% | 34.61% | 10 | 35 |
| Nankeen Kestrel | 47.17 | 9.01% | 38.45% | 10 | 40 |
| Okarito Kiwi | 41.90 | 9.91% | 42.28% | 10 | 45 |
| Eurasian Pygmy Owl | 36.97 | 10.82% | 46.17% | 10 | 50 |
| Shamas | 32.93 | 11.72% | 49.98% | 10 | 55 |
| Coconut Lorikeet | 29.14 | 12.62% | 53.82% | 15 | 60 |
| Black-rumped Magpie | 26.24 | 13.53% | 57.72% | 15 | 65 |
| Wompoo Fruit Dove | 23.86 | 14.42% | 61.52% | 15 | 65 |
| American Cliff Swallow | 22.03 | 15.31% | 65.32% | 15 | 70 |
| Indian White-eye | 20.38 | 16.23% | 69.24% | 15 | 75 |
| Island Scrub Jay | 19.00 | 17.13% | 73.07% | 15 | 80 |
| Hudsonian Godwit | 17.62 | 18.03% | 76.93% | 20 | 85 |
| Mexican Duck | 16.38 | 18.95% | 80.83% | 20 | 90 |
| Paramo Horned Owl | 15.18 | 19.83% | 84.59% | 20 | 95 |
| Cryptic Treehunter | 14.00 | 20.73% | 88.45% | 20 | 95 |
| Red-tailed Hawk (calurus/alascensis) | 12.97 | 21.63% | 92.28% | 20 | 100 |
| Barred Buttonquail | 12.21 | 22.55% | 96.20% | 25 | 105 |
| Orange-chinned Parakeet | 11.38 | 23.45% | 100.00% | 25 | 110 |
| Philippine Dwarf Kingfisher | 11.38 | 23.45% | 100.00% | 25 | 110 |
| Jackson's Pipit | 0.20 | 100.00% | 100.00% | 100 | 110 |
| "magna" Bluethroat | unknown | unmeasured | unmeasured | 50 | 55 |

## castles

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Frankenstein | 4313.52 | 0.00% | 0.00% | 10 | 10 |
| Lakshmi Vilas Palace, Vadodara | 353.48 | 0.59% | 3.83% | 10 | 10 |
| Hindenburg Line | 214.10 | 1.18% | 7.67% | 10 | 10 |
| Leeds Castle | 151.16 | 1.77% | 11.54% | 10 | 10 |
| Hohensalzburg Fortress | 114.61 | 2.36% | 15.39% | 10 | 15 |
| Cadbury Castle, Somerset | 92.87 | 2.95% | 19.22% | 10 | 20 |
| Mukden Palace | 78.06 | 3.54% | 23.06% | 10 | 25 |
| Beaufort Castle, Lebanon | 65.71 | 4.13% | 26.91% | 10 | 30 |
| Lal Mahal | 57.29 | 4.72% | 30.74% | 10 | 35 |
| Fort Independence | 50.10 | 5.31% | 34.63% | 10 | 35 |
| Prabalgad | 45.58 | 5.89% | 38.41% | 10 | 40 |
| Mamucium | 41.48 | 6.49% | 42.30% | 10 | 45 |
| Palace of Cortés, Cuernavaca | 37.61 | 7.08% | 46.17% | 10 | 50 |
| Yusupov Palace | 34.45 | 7.67% | 49.97% | 10 | 55 |
| Baddesley Clinton | 31.90 | 8.26% | 53.85% | 10 | 60 |
| Fort Nelson, Hampshire | 29.26 | 8.86% | 57.74% | 10 | 65 |
| Fénis Castle | 26.97 | 9.45% | 61.57% | 10 | 65 |
| Elmley Castle | 25.16 | 10.03% | 65.39% | 10 | 70 |
| Sandal Castle | 23.58 | 10.62% | 69.19% | 10 | 75 |
| Fort Bowyer | 22.23 | 11.21% | 73.04% | 10 | 80 |
| Palais Schaumburg | 20.97 | 11.79% | 76.86% | 10 | 85 |
| Shahr-e-Gholghola | 19.71 | 12.38% | 80.71% | 10 | 90 |
| Kyoto Ōmiya Palace | 18.58 | 12.97% | 84.54% | 15 | 95 |
| Toshhovli Palace | 17.61 | 13.56% | 88.38% | 15 | 95 |
| Castello Sforzesco | 16.55 | 14.18% | 92.41% | 15 | 100 |
| Ichijōdani Asakura Family Historic Ruins | 15.68 | 14.75% | 96.17% | 15 | 105 |
| Château de Condé | 14.94 | 15.35% | 100.00% | 15 | 110 |
| Doe Castle | 14.94 | 15.35% | 100.00% | 15 | 110 |
| Wolverley Castle Hill | 0.03 | 99.91% | 100.00% | 100 | 110 |
| ‘Emārat-e ‘Ālī Qāpū | unknown | unmeasured | unmeasured | 50 | 55 |

## cities

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| New York | 11137.90 | 0.00% | 0.00% | 10 | 10 |
| Columbus | 1852.90 | 0.11% | 3.83% | 10 | 10 |
| Lucento | 1318.74 | 0.22% | 7.65% | 10 | 10 |
| Sapporo | 952.26 | 0.33% | 11.54% | 10 | 10 |
| Abuja | 756.94 | 0.44% | 15.37% | 10 | 15 |
| Donetsk | 641.52 | 0.55% | 19.21% | 10 | 20 |
| Firebaugh | 565.61 | 0.66% | 23.07% | 10 | 25 |
| St. George | 493.87 | 0.77% | 26.91% | 10 | 30 |
| Yaoundé | 444.58 | 0.88% | 30.74% | 10 | 35 |
| Santa Ana | 406.35 | 0.99% | 34.61% | 10 | 35 |
| Goth Faridabad | 375.81 | 1.10% | 38.43% | 10 | 40 |
| Fuzhou | 347.61 | 1.21% | 42.28% | 10 | 45 |
| Port Louis | 324.23 | 1.32% | 46.15% | 10 | 50 |
| Mantua | 303.97 | 1.43% | 49.98% | 10 | 55 |
| Haarlem | 285.23 | 1.53% | 53.80% | 10 | 60 |
| Voronezh | 272.32 | 1.64% | 57.67% | 10 | 65 |
| Manchester-by-the-Sea | 255.13 | 1.75% | 61.52% | 10 | 65 |
| Fullerton | 240.74 | 1.86% | 65.36% | 10 | 70 |
| Noumea | 228.32 | 1.97% | 69.22% | 10 | 75 |
| Newburgh | 216.90 | 2.08% | 73.06% | 10 | 80 |
| Umeå | 208.26 | 2.19% | 76.88% | 10 | 85 |
| Srikalahasti | 200.39 | 2.30% | 80.76% | 10 | 90 |
| Tuljāpur | 193.19 | 2.41% | 84.58% | 10 | 95 |
| Plattsburgh | 185.94 | 2.52% | 88.45% | 10 | 95 |
| Alto | 178.55 | 2.63% | 92.30% | 10 | 100 |
| Dire Dawa | 171.74 | 2.74% | 96.13% | 10 | 105 |
| Horsham | 165.00 | 2.85% | 100.00% | 10 | 110 |
| Jizan | 164.94 | 2.85% | 100.00% | 10 | 110 |
| Zudilovo | 0.03 | 99.89% | 100.00% | 100 | 110 |
| 'A'ala | unknown | unmeasured | unmeasured | 50 | 55 |

## composers

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Florence Pugh | 38637.29 | 0.00% | 0.00% | 10 | 10 |
| Chester Bennington | 6263.65 | 0.16% | 3.83% | 10 | 10 |
| Teyana Taylor | 4417.87 | 0.33% | 7.67% | 10 | 10 |
| John Mayer | 3292.77 | 0.49% | 11.54% | 10 | 10 |
| Victoria Beckham | 2756.74 | 0.65% | 15.37% | 10 | 15 |
| Amy Holland | 2331.35 | 0.82% | 19.21% | 10 | 20 |
| Louis Armstrong | 2034.55 | 0.98% | 23.07% | 10 | 25 |
| Édith Piaf | 1785.71 | 1.15% | 26.91% | 10 | 30 |
| Mark Lanegan | 1604.03 | 1.31% | 30.74% | 10 | 35 |
| Jack Johnson | 1444.42 | 1.47% | 34.61% | 10 | 35 |
| Rita Coolidge | 1288.68 | 1.64% | 38.45% | 10 | 40 |
| Claude Debussy | 1190.58 | 1.80% | 42.28% | 10 | 45 |
| Giorgio Moroder | 1087.61 | 1.97% | 46.15% | 10 | 50 |
| Pat Boone | 1000.26 | 2.13% | 49.98% | 10 | 55 |
| Zach Top | 927.58 | 2.29% | 53.82% | 10 | 60 |
| Kate Pierson | 866.19 | 2.46% | 57.69% | 10 | 65 |
| Cherie Currie | 805.68 | 2.62% | 61.52% | 10 | 65 |
| Ian Brown | 751.45 | 2.78% | 65.36% | 10 | 70 |
| Julia Donaldson | 698.90 | 2.95% | 69.22% | 10 | 75 |
| Shifty Shellshock | 661.03 | 3.11% | 73.06% | 10 | 80 |
| Shakin' Stevens | 624.84 | 3.27% | 76.89% | 10 | 85 |
| Kurt Vile | 592.39 | 3.44% | 80.76% | 10 | 90 |
| Craig David | 559.71 | 3.60% | 84.59% | 10 | 95 |
| Kurupt | 530.77 | 3.77% | 88.41% | 10 | 95 |
| Luke Steele | 502.26 | 3.93% | 92.30% | 10 | 100 |
| Robert Miles | 477.29 | 4.09% | 96.13% | 10 | 105 |
| C. Tangana | 452.06 | 4.26% | 100.00% | 10 | 110 |
| Graham Gouldman | 451.77 | 4.26% | 100.00% | 10 | 110 |
| Pete Gowdy | 0.03 | 99.99% | 100.00% | 100 | 110 |
| Adam | unknown | unmeasured | unmeasured | 50 | 55 |

## countries

Pool: 249. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| United States | 30595.35 | 0.00% | 0.00% | 10 | 10 |
| France | 10775.55 | 3.23% | 3.23% | 10 | 10 |
| Taiwan | 7795.48 | 6.85% | 6.85% | 10 | 10 |
| Azerbaijan | 7470.74 | 10.08% | 10.08% | 10 | 10 |
| Pakistan | 6696.06 | 13.71% | 13.71% | 15 | 15 |
| South Korea | 6140.48 | 16.94% | 16.94% | 15 | 20 |
| Afghanistan | 5642.00 | 20.56% | 20.56% | 20 | 20 |
| Oman | 5181.61 | 23.79% | 23.79% | 25 | 25 |
| Romania | 4880.71 | 27.42% | 27.42% | 25 | 30 |
| North Macedonia | 4586.32 | 30.65% | 30.65% | 30 | 35 |
| Syria | 4320.45 | 34.27% | 34.27% | 35 | 35 |
| Maldives | 4084.61 | 37.90% | 37.90% | 40 | 40 |
| Cuba | 3905.74 | 41.13% | 41.13% | 40 | 45 |
| Madagascar | 3726.29 | 44.76% | 44.76% | 45 | 50 |
| Moldova | 3502.71 | 47.98% | 47.98% | 50 | 50 |
| Fiji | 3436.87 | 51.61% | 51.61% | 50 | 55 |
| Namibia | 3170.94 | 54.84% | 54.84% | 55 | 60 |
| Jamaica | 3059.19 | 58.47% | 58.47% | 60 | 65 |
| Djibouti | 2847.13 | 61.69% | 61.69% | 60 | 65 |
| Mauritania | 2748.81 | 65.32% | 65.32% | 65 | 70 |
| Ecuador | 2600.65 | 68.95% | 68.95% | 70 | 75 |
| Nicaragua | 2410.42 | 72.18% | 72.18% | 70 | 80 |
| Tuvalu | 2194.90 | 75.81% | 75.81% | 75 | 85 |
| American Samoa | 1979.23 | 79.03% | 79.03% | 80 | 85 |
| Comoros | 1766.00 | 82.66% | 82.66% | 85 | 90 |
| French Polynesia | 1611.55 | 85.89% | 85.89% | 85 | 95 |
| Antigua and Barbuda | 1334.26 | 89.52% | 89.52% | 90 | 100 |
| Norfolk Island | 1013.84 | 92.74% | 92.74% | 95 | 100 |
| Wallis and Futuna | 675.65 | 96.37% | 96.37% | 95 | 105 |
| Cyprus | 194.55 | 100.00% | 100.00% | 100 | 110 |

## films

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Jailer 2 | 142021.68 | 0.00% | 0.00% | 10 | 10 |
| Premada Oorali | 6953.35 | 0.07% | 3.83% | 10 | 10 |
| Get Out | 4335.61 | 0.14% | 7.67% | 10 | 10 |
| Toy Story 3 | 3396.35 | 0.22% | 11.54% | 10 | 10 |
| Possession | 2914.32 | 0.29% | 15.37% | 10 | 15 |
| The Last Samurai | 2582.23 | 0.36% | 19.21% | 10 | 20 |
| Saltburn | 2326.03 | 0.44% | 23.07% | 10 | 25 |
| Paper Tiger | 2126.16 | 0.51% | 26.91% | 10 | 30 |
| Die Another Day | 1970.35 | 0.58% | 30.74% | 10 | 35 |
| Now You See Me 2 | 1835.19 | 0.65% | 34.59% | 10 | 35 |
| Point Break | 1744.42 | 0.73% | 38.45% | 10 | 40 |
| Kim Kardashian, Superstar | 1659.10 | 0.80% | 42.28% | 10 | 45 |
| Furiosa: A Mad Max Saga | 1566.35 | 0.87% | 46.15% | 10 | 50 |
| The Royal Tenenbaums | 1492.90 | 0.94% | 49.98% | 10 | 55 |
| The Thursday Murder Club | 1415.84 | 1.02% | 53.82% | 10 | 60 |
| Straw | 1343.10 | 1.09% | 57.70% | 10 | 65 |
| American Hustle | 1276.68 | 1.16% | 61.52% | 10 | 65 |
| The Vow | 1229.26 | 1.23% | 65.36% | 10 | 70 |
| Supermax | 1169.10 | 1.31% | 69.22% | 10 | 75 |
| Killer Klowns from Outer Space | 1116.35 | 1.38% | 73.04% | 10 | 80 |
| The Name of the Rose | 1073.16 | 1.45% | 76.89% | 10 | 85 |
| Dunki | 1030.97 | 1.53% | 80.76% | 10 | 90 |
| Girl in the Picture | 993.71 | 1.60% | 84.59% | 10 | 95 |
| Camp Rock 3 | 956.45 | 1.67% | 88.43% | 10 | 95 |
| Cronos | 920.19 | 1.74% | 92.31% | 10 | 100 |
| The Monuments Men | 888.90 | 1.82% | 96.12% | 10 | 105 |
| Never After Dark | 858.42 | 1.89% | 100.00% | 10 | 110 |
| Rocky Aur Rani Kii Prem Kahaani | 858.13 | 1.89% | 100.00% | 10 | 110 |
| Youth Unstoppable | 0.03 | 99.93% | 100.00% | 100 | 110 |
| 01:00 A.M. | unknown | unmeasured | unmeasured | 50 | 55 |

## foods

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Persimmon | 4098.55 | 0.00% | 0.00% | 10 | 10 |
| Tofu | 1044.13 | 3.05% | 3.90% | 10 | 10 |
| Areca nuts | 818.32 | 6.01% | 7.69% | 10 | 10 |
| Chinese dumplings | 680.39 | 9.00% | 11.52% | 10 | 10 |
| Spotted dick | 582.84 | 12.01% | 15.37% | 10 | 15 |
| Gelato | 501.87 | 15.01% | 19.21% | 15 | 20 |
| Miso soup | 434.06 | 18.03% | 23.07% | 20 | 25 |
| Flour | 378.00 | 21.05% | 26.94% | 20 | 30 |
| Tortilla | 324.65 | 24.02% | 30.74% | 25 | 35 |
| Mulligatawny | 288.61 | 27.05% | 34.61% | 25 | 35 |
| Insalata caprese | 253.10 | 30.04% | 38.45% | 30 | 40 |
| Radler | 218.65 | 33.04% | 42.28% | 35 | 45 |
| Sopressa | 188.77 | 36.05% | 46.13% | 35 | 50 |
| Shish kebab | 170.13 | 39.06% | 49.98% | 40 | 55 |
| Sunflower oil | 150.87 | 42.05% | 53.82% | 40 | 60 |
| Cider vinegar | 134.77 | 45.08% | 57.69% | 45 | 65 |
| Chiffon cake | 114.74 | 48.07% | 61.52% | 50 | 65 |
| Convenience food | 97.03 | 51.07% | 65.36% | 50 | 70 |
| Rujak | 83.68 | 54.14% | 69.29% | 55 | 75 |
| Murgh musallam | 71.06 | 57.07% | 73.04% | 55 | 80 |
| Mare's milk | 60.23 | 60.08% | 76.89% | 60 | 85 |
| Pannenkoek | 52.58 | 63.11% | 80.76% | 65 | 90 |
| Ham sandwich | 44.84 | 66.12% | 84.61% | 65 | 95 |
| Ashcake | 37.61 | 69.10% | 88.43% | 70 | 95 |
| Harzer | 31.42 | 72.15% | 92.33% | 70 | 100 |
| Khanom krok | 26.29 | 75.12% | 96.13% | 75 | 105 |
| Carrot juice | 22.19 | 78.14% | 100.00% | 80 | 110 |
| Ossenworst | 22.13 | 78.18% | 100.00% | 80 | 110 |
| Na tinombur | 0.06 | 100.00% | 100.00% | 100 | 110 |
| 'Nzuddi | unknown | unmeasured | unmeasured | 50 | 55 |

## footballers

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Harry Kane | 34690.42 | 0.00% | 0.00% | 10 | 10 |
| Alexander Isak | 2630.45 | 0.06% | 3.83% | 10 | 10 |
| Lev Yashin | 1755.90 | 0.11% | 7.67% | 10 | 10 |
| Daniel Sturridge | 1308.32 | 0.17% | 11.54% | 10 | 10 |
| Thiago Silva | 1080.58 | 0.22% | 15.37% | 10 | 15 |
| Lee Kang-in | 912.48 | 0.28% | 19.21% | 10 | 20 |
| Alex Karras | 800.23 | 0.33% | 23.07% | 10 | 25 |
| Keith Andrews | 705.13 | 0.39% | 26.91% | 10 | 30 |
| Raúl González | 627.29 | 0.44% | 30.74% | 10 | 35 |
| Gianluca Vialli | 561.58 | 0.50% | 34.61% | 10 | 35 |
| Solly March | 500.42 | 0.55% | 38.45% | 10 | 40 |
| Vedat Muriqi | 452.71 | 0.61% | 42.28% | 10 | 45 |
| Matt O'Riley | 416.90 | 0.66% | 46.15% | 10 | 50 |
| Wilson Isidor | 385.48 | 0.72% | 49.97% | 10 | 55 |
| Fer López | 361.16 | 0.78% | 53.82% | 10 | 60 |
| Nathan Tjoe-A-On | 334.58 | 0.83% | 57.69% | 10 | 65 |
| Lutsharel Geertruida | 313.29 | 0.89% | 61.52% | 10 | 65 |
| Jeremy Monga | 294.39 | 0.94% | 65.36% | 10 | 70 |
| Derek Acorah | 274.29 | 1.00% | 69.22% | 10 | 75 |
| Shin Tae-yong | 259.39 | 1.05% | 73.06% | 10 | 80 |
| Alexandros Kyziridis | 244.35 | 1.11% | 76.91% | 10 | 85 |
| Noah Sadiki | 231.55 | 1.16% | 80.74% | 10 | 90 |
| Viv Anderson | 220.42 | 1.22% | 84.56% | 10 | 95 |
| Moussa Sissoko | 210.61 | 1.27% | 88.43% | 10 | 95 |
| Kristian Shevchenko | 200.19 | 1.33% | 92.30% | 10 | 100 |
| Roman Bürki | 192.00 | 1.38% | 96.12% | 10 | 105 |
| Matías Almeyda | 182.39 | 1.44% | 100.00% | 10 | 110 |
| Jordan Larsson | 182.35 | 1.44% | 100.00% | 10 | 110 |
| Ziad Al-Muwallad | 0.03 | 99.90% | 100.00% | 100 | 110 |
| A Pulchert | unknown | unmeasured | unmeasured | 50 | 55 |

## fruits-vegetables

Pool: 1177. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Quince | 2643.90 | 0.00% | 0.00% | 10 | 10 |
| Lentil | 951.94 | 3.57% | 3.57% | 10 | 10 |
| Watermelon | 710.42 | 7.14% | 7.14% | 10 | 10 |
| Green pea | 570.29 | 10.67% | 10.67% | 10 | 10 |
| Butterhead lettuce | 436.03 | 14.29% | 14.29% | 15 | 15 |
| Spaghetti squash | 334.06 | 17.86% | 17.86% | 20 | 20 |
| Boysenberry | 262.61 | 21.43% | 21.43% | 20 | 25 |
| Honeyberry | 184.55 | 25.00% | 25.00% | 25 | 25 |
| Doub palm fruit | 148.00 | 28.57% | 28.57% | 30 | 30 |
| Sweet orange | 118.71 | 32.14% | 32.14% | 30 | 35 |
| Red mulberry | 93.94 | 35.71% | 35.71% | 35 | 40 |
| Rampion | 78.84 | 39.33% | 39.33% | 40 | 45 |
| Caigua / Achocha | 59.06 | 42.86% | 42.86% | 45 | 45 |
| Miner's lettuce | 47.52 | 46.47% | 46.47% | 45 | 50 |
| West Indian gherkin | 35.94 | 50.00% | 50.00% | 50 | 55 |
| Plumleaf crab apple | 29.23 | 53.57% | 53.57% | 55 | 60 |
| Brazil cherry | 23.03 | 57.14% | 57.14% | 55 | 60 |
| Solomon's plume | 18.45 | 60.71% | 60.71% | 60 | 65 |
| Lipote | 15.48 | 64.29% | 64.29% | 65 | 70 |
| Antipolo | 12.13 | 67.90% | 67.90% | 70 | 75 |
| Golden samphire | 9.55 | 71.43% | 71.43% | 70 | 80 |
| Binung | 7.29 | 75.00% | 75.00% | 75 | 80 |
| Kanpei | 6.10 | 78.61% | 78.61% | 80 | 85 |
| White apple | 4.61 | 82.10% | 82.10% | 80 | 90 |
| Button mangosteen | 3.77 | 85.76% | 85.76% | 85 | 95 |
| Texas almond | 2.87 | 89.24% | 89.24% | 90 | 100 |
| Coarse dodder-laurel fruit | 2.06 | 92.81% | 92.81% | 95 | 100 |
| Wild cherimoya | 1.42 | 96.34% | 96.34% | 95 | 105 |
| Duguetia confinis | 0.23 | 100.00% | 100.00% | 100 | 110 |
| (Red) laver | unknown | unmeasured | unmeasured | 50 | 55 |

## islands

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| United Kingdom | 15787.74 | 0.00% | 0.00% | 10 | 10 |
| Hawaiian Islands | 1052.48 | 0.79% | 3.83% | 10 | 10 |
| Johnston Atoll | 471.61 | 1.58% | 7.69% | 10 | 10 |
| Spitsbergen | 273.26 | 2.37% | 11.54% | 10 | 10 |
| Jarvis Island | 204.61 | 3.15% | 15.37% | 10 | 15 |
| Savage Islands | 147.74 | 3.94% | 19.21% | 10 | 20 |
| Queen Island | 122.77 | 4.73% | 23.07% | 10 | 25 |
| Ponui Island | 98.16 | 5.52% | 26.91% | 10 | 30 |
| Great Nicobar Island | 83.35 | 6.31% | 30.76% | 10 | 35 |
| Tres Marias Islands | 69.23 | 7.09% | 34.56% | 10 | 35 |
| Amorgos | 56.35 | 7.88% | 38.45% | 10 | 40 |
| Cheung Chau | 49.29 | 8.67% | 42.28% | 10 | 45 |
| Santo Antão, Cape Verde | 42.39 | 9.46% | 46.15% | 10 | 50 |
| Pine Islands | 36.71 | 10.24% | 49.97% | 10 | 55 |
| Verrill Island | 35.84 | 10.77% | 52.52% | 10 | 55 |
| Admiralty Island | 32.84 | 11.83% | 57.69% | 10 | 65 |
| Babuyan Islands | 29.97 | 12.61% | 61.52% | 15 | 65 |
| Moekawa / South West Island | 27.32 | 13.39% | 65.34% | 15 | 70 |
| Gaiola Island | 25.13 | 14.20% | 69.29% | 15 | 75 |
| Out Stack | 23.13 | 14.98% | 73.06% | 15 | 80 |
| Apo | 21.42 | 15.76% | 76.86% | 15 | 85 |
| La Désirade | 19.52 | 16.55% | 80.73% | 15 | 90 |
| Pentecost Island | 18.03 | 17.35% | 84.64% | 15 | 95 |
| Kizhi Island | 16.87 | 18.13% | 88.43% | 20 | 95 |
| Quita Sueño Bank | 15.55 | 18.92% | 92.30% | 20 | 100 |
| Louisa Reef | 14.13 | 19.71% | 96.13% | 20 | 105 |
| Tokashiki Island | 13.00 | 20.50% | 100.00% | 20 | 110 |
| Vormsi | 13.00 | 20.50% | 100.00% | 20 | 110 |
| Îlet des Chardons | 0.03 | 99.81% | 100.00% | 100 | 110 |
| ,Isla La Papaya | unknown | unmeasured | unmeasured | 50 | 55 |

## lakes

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Lake Baikal | 3479.45 | 0.00% | 0.02% | 10 | 10 |
| Venetian Lagoon | 169.29 | 0.75% | 3.83% | 10 | 10 |
| Lake Mungo | 84.87 | 1.50% | 7.67% | 10 | 10 |
| Pavana Lake | 53.39 | 2.26% | 11.54% | 10 | 10 |
| Lake Pukaki | 39.84 | 3.01% | 15.37% | 10 | 15 |
| Norris Lake | 30.52 | 3.76% | 19.21% | 10 | 20 |
| Albert Park and Lake | 25.03 | 4.52% | 23.09% | 10 | 25 |
| Lake Ronkonkoma | 20.68 | 5.27% | 26.91% | 10 | 30 |
| Gogebic Lake | 17.87 | 6.02% | 30.71% | 10 | 35 |
| Lake Calumet | 15.45 | 6.78% | 34.59% | 10 | 35 |
| Lake Chamo | 13.58 | 7.53% | 38.41% | 10 | 40 |
| Tasman Lake | 12.06 | 8.28% | 42.28% | 10 | 45 |
| Lake Mezzano | 11.03 | 9.04% | 46.13% | 10 | 50 |
| Hauz-i-Shamsi | 10.10 | 9.80% | 50.03% | 10 | 55 |
| Dark Lake | 9.58 | 10.83% | 55.27% | 10 | 60 |
| Tobeatic Lake | 9.58 | 10.83% | 55.27% | 10 | 60 |
| Kremenchuk Reservoir | 8.97 | 12.06% | 61.55% | 10 | 65 |
| Cheney Reservoir | 8.23 | 12.82% | 65.41% | 15 | 70 |
| Lej da San Murezzan | 7.65 | 13.53% | 69.07% | 15 | 75 |
| Mananchira | 7.06 | 14.31% | 73.06% | 15 | 80 |
| Lago di Saoseo | 6.55 | 15.08% | 76.96% | 15 | 85 |
| Wax Lake | 6.16 | 15.80% | 80.64% | 15 | 90 |
| DeGray Lake | 5.71 | 16.59% | 84.66% | 15 | 95 |
| McPhee Reservoir | 5.42 | 17.31% | 88.36% | 15 | 95 |
| Bois d'Arc Lake | 5.10 | 18.13% | 92.55% | 20 | 100 |
| Lake Osceola | 4.87 | 18.84% | 96.15% | 20 | 105 |
| Lough Inagh | 4.61 | 19.55% | 100.00% | 20 | 110 |
| Opeongo Lake | 4.61 | 19.55% | 100.00% | 20 | 110 |
| Laguna Sajama | 0.03 | 99.66% | 100.00% | 100 | 110 |
| .11 Reservoir | unknown | unmeasured | unmeasured | 50 | 55 |

## mountains

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Mount Everest | 7120.77 | 0.00% | 0.02% | 10 | 10 |
| Mount of Olives | 388.55 | 0.37% | 3.85% | 10 | 10 |
| Meru Peak | 186.10 | 0.73% | 7.67% | 10 | 10 |
| Southern Alps | 136.39 | 1.11% | 11.54% | 10 | 10 |
| Taihang Mountains | 102.74 | 1.47% | 15.37% | 10 | 15 |
| Seongsan Ilchulbong | 80.84 | 1.84% | 19.21% | 10 | 20 |
| Forest of Bowland | 67.39 | 2.21% | 23.07% | 10 | 25 |
| Broad Hill | 58.03 | 2.58% | 26.93% | 10 | 30 |
| Mount Wilson | 49.74 | 2.95% | 30.74% | 10 | 35 |
| Qilian Mountains | 42.29 | 3.32% | 34.68% | 10 | 35 |
| Dandenong Ranges | 38.29 | 3.69% | 38.46% | 10 | 40 |
| You Yangs | 34.10 | 4.05% | 42.28% | 10 | 45 |
| Monte Pissis | 30.81 | 4.42% | 46.17% | 10 | 50 |
| Taylor Mountain | 28.23 | 4.79% | 49.95% | 10 | 55 |
| Garo Hills | 25.68 | 5.16% | 53.85% | 10 | 60 |
| Mount Craig | 23.84 | 5.53% | 57.69% | 10 | 65 |
| Rano Kau | 22.13 | 5.89% | 61.49% | 10 | 65 |
| Mount Hibok-Hibok | 20.61 | 6.26% | 65.36% | 10 | 70 |
| Coma Pedrosa | 19.10 | 6.64% | 69.26% | 10 | 75 |
| Creux du Van | 17.74 | 7.01% | 73.16% | 10 | 80 |
| Terqa | 17.00 | 7.36% | 76.79% | 10 | 85 |
| Elysium Mons | 15.87 | 7.74% | 80.79% | 10 | 90 |
| Killington Peak | 14.97 | 8.11% | 84.61% | 10 | 95 |
| Schauinsland | 14.00 | 8.46% | 88.33% | 10 | 95 |
| Naftali Mountains | 12.97 | 8.85% | 92.31% | 10 | 100 |
| Gatineau Hills | 12.39 | 9.22% | 96.18% | 10 | 105 |
| Mount Constitution | 11.77 | 9.59% | 100.00% | 10 | 110 |
| Mount Livermore | 11.77 | 9.59% | 100.00% | 10 | 110 |
| Wiens Peak | 0.03 | 99.05% | 100.00% | 100 | 110 |
| ‘A‘ahuwela | unknown | unmeasured | unmeasured | 50 | 55 |

## museums

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Colosseum | 3159.71 | 0.00% | 0.00% | 10 | 10 |
| Atlas Science Center | 326.10 | 0.56% | 3.83% | 10 | 10 |
| Mercer Island Historical Society | 179.87 | 1.12% | 7.67% | 10 | 10 |
| Old State House | 126.42 | 1.68% | 11.54% | 10 | 10 |
| Museum of Death | 96.06 | 2.24% | 15.39% | 10 | 15 |
| Tsitsernakaberd | 77.23 | 2.80% | 19.19% | 10 | 20 |
| Franklin Institute | 66.13 | 3.36% | 23.07% | 10 | 25 |
| Glyptothek | 56.00 | 3.92% | 26.93% | 10 | 30 |
| Aga Khan Museum | 49.90 | 4.48% | 30.78% | 10 | 35 |
| Musée de l'air et de l'espace | 43.87 | 5.04% | 34.61% | 10 | 35 |
| Imperial Treasury, Vienna | 39.32 | 5.60% | 38.46% | 10 | 40 |
| Musée de l'Homme | 35.87 | 6.16% | 42.25% | 10 | 45 |
| Buckinghamshire Railway Centre | 32.97 | 6.73% | 46.17% | 10 | 50 |
| Milwaukee Public Museum | 30.26 | 7.29% | 50.02% | 10 | 55 |
| Weston Park | 28.32 | 7.84% | 53.78% | 10 | 60 |
| Inhotim | 26.16 | 8.41% | 57.69% | 10 | 65 |
| Castello del Valentino | 24.13 | 8.97% | 61.54% | 10 | 65 |
| Planes of Fame Air Museum | 22.45 | 9.52% | 65.32% | 10 | 70 |
| Cancún Underwater Museum | 21.13 | 10.09% | 69.27% | 10 | 75 |
| Historical Museum of French-Chinese Friendship | 19.68 | 10.65% | 73.06% | 10 | 80 |
| Modern Art Museum of Fort Worth | 18.58 | 11.20% | 76.86% | 10 | 85 |
| Mexican Professional Baseball Hall of Fame | 17.42 | 11.77% | 80.76% | 10 | 90 |
| Caldicot Castle | 16.48 | 12.33% | 84.59% | 10 | 95 |
| CaixaForum Madrid | 15.61 | 12.89% | 88.46% | 15 | 95 |
| Newark Air Museum | 14.84 | 13.45% | 92.31% | 15 | 100 |
| Villa Pisani, Stra | 14.23 | 14.00% | 96.05% | 15 | 105 |
| Seawolf Park | 13.58 | 14.56% | 100.00% | 15 | 110 |
| Tun Datu Mustapha Memorial | 13.58 | 14.56% | 100.00% | 15 | 110 |
| Vilassar de Mar Municipal Museum | 0.03 | 99.98% | 100.00% | 100 | 110 |
| Artillery Fort Hůrka | unknown | unmeasured | unmeasured | 50 | 55 |

## novels

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| East of Eden | 79717.52 | 0.00% | 0.00% | 10 | 10 |
| The Camp of the Saints | 1757.77 | 0.34% | 3.83% | 10 | 10 |
| Mrs Dalloway | 1075.61 | 0.68% | 7.67% | 10 | 10 |
| Madame Bovary | 799.90 | 1.02% | 11.54% | 10 | 10 |
| Starship Troopers | 656.61 | 1.36% | 15.37% | 10 | 15 |
| Star Wars: A New Dawn | 546.00 | 1.69% | 19.21% | 10 | 20 |
| John Dies at the End | 466.16 | 2.03% | 23.07% | 10 | 25 |
| Chitty-Chitty-Bang-Bang | 389.13 | 2.37% | 26.91% | 10 | 30 |
| The House of the Seven Gables | 351.26 | 2.71% | 30.74% | 10 | 35 |
| The Troop | 306.61 | 3.05% | 34.61% | 10 | 35 |
| The Hallmarked Man | 272.97 | 3.39% | 38.45% | 10 | 40 |
| Investiture of the Gods | 243.39 | 3.73% | 42.28% | 10 | 45 |
| Allegiant | 223.84 | 4.07% | 46.15% | 10 | 50 |
| The Girl Who Loved Tom Gordon | 206.55 | 4.41% | 49.98% | 10 | 55 |
| A Conventional Boy | 192.68 | 4.75% | 53.90% | 10 | 60 |
| Gregor the Overlander | 179.87 | 5.09% | 57.69% | 10 | 65 |
| Junie B. Jones | 167.65 | 5.42% | 61.52% | 10 | 65 |
| A Dog of Flanders | 156.00 | 5.76% | 65.36% | 10 | 70 |
| Melmoth the Wanderer | 146.29 | 6.10% | 69.21% | 10 | 75 |
| Demons' Crest | 137.77 | 6.44% | 73.04% | 10 | 80 |
| Babylon's Ashes | 131.45 | 6.78% | 76.89% | 10 | 85 |
| The Acts of King Arthur and His Noble Knights | 128.16 | 7.12% | 80.74% | 10 | 90 |
| The Dark Is Rising | 120.84 | 7.46% | 84.59% | 10 | 95 |
| Black Bullet | 115.97 | 7.80% | 88.45% | 10 | 95 |
| The Southern Book Club's Guide to Slaying Vampires | 110.52 | 8.14% | 92.28% | 10 | 100 |
| Freedom | 104.13 | 8.48% | 96.13% | 10 | 105 |
| The Moviegoer | 99.74 | 8.81% | 99.98% | 10 | 110 |
| Miracle | 99.45 | 8.82% | 100.00% | 10 | 110 |
| Wading Home | 0.03 | 99.98% | 100.00% | 100 | 110 |
| A Cold Heart | unknown | unmeasured | unmeasured | 50 | 55 |

## painters

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Adolf Hitler | 16360.87 | 0.00% | 0.00% | 10 | 10 |
| Rebecca Miller | 1218.45 | 0.22% | 3.83% | 10 | 10 |
| Jan van Eyck | 656.42 | 0.43% | 7.67% | 10 | 10 |
| Carroll Dunham | 421.87 | 0.65% | 11.54% | 10 | 10 |
| George Maharis | 286.87 | 0.87% | 15.37% | 10 | 15 |
| Johnny Eck | 213.65 | 1.09% | 19.21% | 10 | 20 |
| Laurel Holloman | 167.84 | 1.31% | 23.07% | 10 | 25 |
| Théophile Gautier | 139.10 | 1.52% | 26.89% | 10 | 30 |
| Dash Snow | 116.90 | 1.74% | 30.74% | 10 | 35 |
| Georg Baselitz | 100.19 | 1.96% | 34.59% | 10 | 35 |
| Carl Nebel | 86.26 | 2.18% | 38.48% | 10 | 40 |
| Duane Hanson | 76.39 | 2.40% | 42.28% | 10 | 45 |
| Mikalojus Konstantinas Čiurlionis | 67.55 | 2.62% | 46.15% | 10 | 50 |
| Al Feldstein | 60.84 | 2.83% | 50.00% | 10 | 55 |
| Marc Quinn | 55.13 | 3.05% | 53.82% | 10 | 60 |
| Hwang Jini | 50.26 | 3.27% | 57.69% | 10 | 65 |
| Władysław Strzemiński | 46.10 | 3.49% | 61.49% | 10 | 65 |
| Edward Mitchell Bannister | 42.23 | 3.71% | 65.36% | 10 | 70 |
| Max Klinger | 39.03 | 3.92% | 69.22% | 10 | 75 |
| Arsenie Boca | 36.39 | 4.14% | 73.06% | 10 | 80 |
| Ambrogio Lorenzetti | 33.90 | 4.36% | 76.91% | 10 | 85 |
| Florine Stettheimer | 31.52 | 4.58% | 80.76% | 10 | 90 |
| Valentine Penrose | 29.77 | 4.79% | 84.56% | 10 | 95 |
| Elaine Sturtevant | 27.97 | 5.01% | 88.45% | 10 | 95 |
| Eastman Johnson | 26.48 | 5.24% | 92.33% | 10 | 100 |
| Fausto Zonaro | 25.10 | 5.45% | 96.13% | 10 | 105 |
| Abdur Rahman Chughtai | 23.81 | 5.68% | 100.00% | 10 | 110 |
| Christi Belcourt | 23.81 | 5.68% | 100.00% | 10 | 110 |
| Walther-Hans Böttcher | 0.03 | 99.96% | 100.00% | 100 | 110 |
| Alice Maude Angell | unknown | unmeasured | unmeasured | 50 | 55 |

## paintings

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Mona Lisa | 5643.55 | 0.00% | 0.00% | 10 | 10 |
| Nude Descending a Staircase, No. 2 | 250.13 | 1.14% | 3.83% | 10 | 10 |
| The Incredulity of Saint Thomas | 135.97 | 2.27% | 7.67% | 10 | 10 |
| Bird on Money | 98.23 | 3.42% | 11.54% | 10 | 10 |
| The Cyclops | 75.16 | 4.56% | 15.37% | 10 | 15 |
| Das Bunte Leben | 60.94 | 5.70% | 19.21% | 10 | 20 |
| Beata Beatrix | 49.35 | 6.84% | 23.07% | 10 | 25 |
| Work | 41.84 | 7.98% | 26.89% | 10 | 30 |
| Moses breaking the Tablets of the Law | 36.23 | 9.12% | 30.76% | 10 | 35 |
| Triptych, 1976 | 32.23 | 10.26% | 34.59% | 10 | 35 |
| The Architect's Dream | 29.03 | 11.39% | 38.41% | 10 | 40 |
| Woman with a Water Jug | 25.97 | 12.52% | 42.23% | 15 | 45 |
| Leiv Eirikson Discovering America | 23.35 | 13.69% | 46.17% | 15 | 50 |
| Portrait of Ann | 21.26 | 14.83% | 50.02% | 15 | 55 |
| Norham Castle, Sunrise | 19.26 | 15.96% | 53.80% | 15 | 60 |
| Portrait of Comtesse d'Haussonville | 17.61 | 17.11% | 57.69% | 15 | 65 |
| The Stolen Kiss | 16.48 | 18.23% | 61.47% | 20 | 65 |
| Looking Down Yosemite Valley, California | 14.87 | 19.40% | 65.42% | 20 | 70 |
| Naked Woman Sleeping by the Water | 13.81 | 20.55% | 69.31% | 20 | 75 |
| Portrait of Oliver Cromwell | 12.94 | 21.68% | 73.09% | 20 | 80 |
| Cupid and Psyche | 12.10 | 22.84% | 77.01% | 25 | 85 |
| Congress Voting Independence | 11.48 | 24.01% | 80.96% | 25 | 90 |
| Saint George | 10.84 | 25.09% | 84.59% | 25 | 95 |
| The Fall of Icarus | 10.19 | 26.20% | 88.33% | 25 | 95 |
| The Departure of the Israelites | 9.55 | 27.38% | 92.31% | 25 | 100 |
| Portrait of Horatio Nelson | 8.97 | 28.52% | 96.17% | 30 | 105 |
| The Gilded Cage | 8.58 | 29.65% | 100.00% | 30 | 110 |
| The Plum Blossoms | 8.58 | 29.65% | 100.00% | 30 | 110 |
| Madonna and Child Enthroned with Two Virgin Martyrs | 0.06 | 100.00% | 100.00% | 100 | 110 |
| -R-R-R-R-Ring!! | unknown | unmeasured | unmeasured | 50 | 55 |

## plants

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Quince | 2681.59 | 0.00% | 0.00% | 10 | 10 |
| Martinique sweetleaf | 722.86 | 0.48% | 3.78% | 10 | 10 |
| Peony | 530.07 | 0.98% | 7.67% | 10 | 10 |
| Chives | 383.30 | 1.48% | 11.55% | 10 | 10 |
| Water crowfoot | 284.00 | 1.96% | 15.32% | 10 | 15 |
| Liquidambar | 229.14 | 2.46% | 19.22% | 10 | 20 |
| Pink | 179.00 | 2.96% | 23.12% | 10 | 25 |
| English walnut | 150.21 | 3.44% | 26.91% | 10 | 30 |
| European aspen | 125.24 | 3.93% | 30.74% | 10 | 35 |
| Littleleaf linden | 107.77 | 4.42% | 34.61% | 10 | 35 |
| Elephant grass | 93.70 | 4.91% | 38.45% | 10 | 40 |
| Dock | 81.38 | 5.40% | 42.28% | 10 | 45 |
| Baby sage | 72.07 | 5.90% | 46.17% | 10 | 50 |
| African bowstring hemp | 63.97 | 6.39% | 49.98% | 10 | 55 |
| Fritillary | 57.60 | 6.88% | 53.85% | 10 | 60 |
| Wallflower | 52.28 | 7.38% | 57.70% | 10 | 65 |
| Bog bilberry | 47.67 | 7.87% | 61.54% | 10 | 65 |
| Labrador tea | 43.20 | 8.35% | 65.34% | 10 | 70 |
| Paperbark maple | 39.53 | 8.84% | 69.19% | 10 | 75 |
| Fig buttercup | 36.41 | 9.34% | 73.04% | 10 | 80 |
| Princess-flower | 33.20 | 9.83% | 76.89% | 10 | 85 |
| Chinese hackberry | 31.03 | 10.33% | 80.83% | 10 | 90 |
| Siberian peashrub | 29.10 | 10.81% | 84.58% | 10 | 95 |
| Soapwort | 27.13 | 11.30% | 88.45% | 10 | 95 |
| Cotton grass | 25.38 | 11.79% | 92.28% | 10 | 100 |
| Tall buttercup | 23.93 | 12.27% | 95.98% | 10 | 105 |
| Fishpole bamboo | 22.33 | 12.77% | 99.92% | 15 | 110 |
| Nanking cherry | 22.31 | 12.79% | 100.00% | 15 | 110 |
| Woodborder dewberry | 0.00 | 99.95% | 100.00% | 100 | 110 |
| 'ahakea | unknown | unmeasured | unmeasured | 50 | 55 |

## poets

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Anne Carson | 20261.68 | 0.00% | 0.00% | 10 | 10 |
| Michael Crichton | 2085.26 | 0.28% | 3.83% | 10 | 10 |
| Hermann Hesse | 1085.87 | 0.56% | 7.67% | 10 | 10 |
| Euripides | 711.52 | 0.85% | 11.54% | 10 | 10 |
| Akiane | 516.32 | 1.13% | 15.37% | 10 | 15 |
| Paul Auster | 394.10 | 1.41% | 19.21% | 10 | 20 |
| John Harington | 311.03 | 1.70% | 23.07% | 10 | 25 |
| Abd al-Muttalib | 253.55 | 1.98% | 26.91% | 10 | 30 |
| Kae Tempest | 207.61 | 2.26% | 30.74% | 10 | 35 |
| Ram Nath Shastri | 175.58 | 2.55% | 34.61% | 10 | 35 |
| Akka Mahadevi | 151.10 | 2.83% | 38.45% | 10 | 40 |
| Violeta Parra | 131.61 | 3.11% | 42.28% | 10 | 45 |
| Eve Kosofsky Sedgwick | 118.29 | 3.39% | 46.15% | 10 | 50 |
| Sankardev | 106.71 | 3.68% | 49.98% | 10 | 55 |
| Annemarie Jacir | 93.52 | 3.96% | 53.83% | 10 | 60 |
| Vinod Kumar Shukla | 84.97 | 4.24% | 57.69% | 10 | 65 |
| Jimmy Santiago Baca | 76.71 | 4.52% | 61.52% | 10 | 65 |
| Robert Greene | 69.65 | 4.80% | 65.32% | 10 | 70 |
| Laura Riding | 63.77 | 5.09% | 69.22% | 10 | 75 |
| Theodore Beza | 58.32 | 5.37% | 73.06% | 10 | 80 |
| Anna Louise Strong | 53.03 | 5.66% | 76.93% | 10 | 85 |
| Ban Zhao | 48.97 | 5.94% | 80.76% | 10 | 90 |
| Jigar Moradabadi | 45.87 | 6.22% | 84.59% | 10 | 95 |
| Joy Goswami | 43.16 | 6.50% | 88.43% | 10 | 95 |
| Aśvaghoṣa | 41.03 | 6.79% | 92.33% | 10 | 100 |
| Ata-Malik Juvayni | 38.68 | 7.07% | 96.17% | 10 | 105 |
| Quaiser Khalid | 36.68 | 7.35% | 100.00% | 10 | 110 |
| James Wong Jim | 36.65 | 7.36% | 100.00% | 10 | 110 |
| William Whittingham Lyman Jr. | 0.03 | 99.98% | 100.00% | 100 | 110 |
| Abd al-Rafe Heravi | unknown | unmeasured | unmeasured | 50 | 55 |

## rivers

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Danube | 2368.52 | 0.00% | 0.02% | 10 | 10 |
| Kaviri | 229.55 | 0.34% | 3.80% | 10 | 10 |
| River Tay | 106.81 | 0.68% | 7.67% | 10 | 10 |
| South Platte River | 65.55 | 1.03% | 11.54% | 10 | 10 |
| Periyar River | 49.74 | 1.37% | 15.36% | 10 | 15 |
| Eastern Branch | 39.23 | 1.71% | 19.17% | 10 | 20 |
| Tideway | 31.87 | 2.06% | 23.06% | 10 | 25 |
| River Orwell | 26.90 | 2.40% | 26.91% | 10 | 30 |
| Nyabarongo | 22.81 | 2.74% | 30.73% | 10 | 35 |
| Diyala River | 19.87 | 3.09% | 34.63% | 10 | 35 |
| Adelaide River | 17.87 | 3.43% | 38.45% | 10 | 40 |
| Chickahominy River | 16.39 | 3.77% | 42.28% | 10 | 45 |
| Aniene | 14.74 | 4.12% | 46.20% | 10 | 50 |
| Gypsey Race | 13.55 | 4.46% | 50.00% | 10 | 55 |
| Düssel | 12.48 | 4.80% | 53.82% | 10 | 60 |
| Someș | 11.52 | 5.14% | 57.60% | 10 | 65 |
| Black Cart Water | 10.58 | 5.49% | 61.49% | 10 | 65 |
| Dalälven | 9.87 | 5.84% | 65.41% | 10 | 70 |
| Agusan River | 9.35 | 6.19% | 69.34% | 10 | 75 |
| Minnehaha Creek | 8.71 | 6.52% | 73.02% | 10 | 80 |
| Westpeene | 8.26 | 6.85% | 76.73% | 10 | 85 |
| Speed River | 7.84 | 7.20% | 80.68% | 10 | 90 |
| Nahr al-Kabir | 7.42 | 7.55% | 84.54% | 10 | 95 |
| Osage Creek | 7.00 | 7.90% | 88.46% | 10 | 95 |
| Kymijoki | 6.61 | 8.25% | 92.38% | 10 | 100 |
| Wekiva River | 6.29 | 8.58% | 96.10% | 10 | 105 |
| Nawailevu Creek | 6.13 | 8.93% | 100.00% | 10 | 110 |
| Nawailevu River | 6.13 | 8.93% | 100.00% | 10 | 110 |
| Rivière Ronald | 0.03 | 97.85% | 100.00% | 100 | 110 |
| ?uzqan Ja?e | unknown | unmeasured | unmeasured | 50 | 55 |

## ships

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| MKD VYOM | 17554.00 | 0.00% | 0.00% | 10 | 10 |
| H. L. Hunley | 414.58 | 0.35% | 3.83% | 10 | 10 |
| USS Massachusetts | 244.77 | 0.69% | 7.67% | 10 | 10 |
| Turtle | 174.90 | 1.04% | 11.54% | 10 | 10 |
| MV Princess of the Stars | 135.94 | 1.39% | 15.37% | 10 | 15 |
| INS Mangrol | 111.32 | 1.73% | 19.21% | 10 | 20 |
| MS Jan Heweliusz | 95.58 | 2.08% | 23.07% | 10 | 25 |
| SMS Blücher | 83.52 | 2.42% | 26.89% | 10 | 30 |
| USS Winston S. Churchill | 75.90 | 2.77% | 30.74% | 10 | 35 |
| Antikythera wreck | 67.52 | 3.12% | 34.61% | 10 | 35 |
| SS City of New York | 60.13 | 3.47% | 38.46% | 10 | 40 |
| CCGS Imnaryuaq | 54.00 | 3.81% | 42.31% | 10 | 45 |
| Russian submarine Generalissimus Suvorov | 49.65 | 4.16% | 46.12% | 10 | 50 |
| USS Herring | 45.71 | 4.51% | 49.98% | 10 | 55 |
| SS Amerika | 42.06 | 4.85% | 53.80% | 10 | 60 |
| INS Tamal | 39.16 | 5.20% | 57.69% | 10 | 65 |
| USS Rushmore | 36.74 | 5.54% | 61.50% | 10 | 65 |
| MV Queen of the Oceans | 34.32 | 5.89% | 65.34% | 10 | 70 |
| MS Amadea | 32.10 | 6.24% | 69.24% | 10 | 75 |
| USS Shoup | 30.03 | 6.58% | 73.02% | 10 | 80 |
| BRP Jose Rizal | 28.39 | 6.93% | 76.91% | 10 | 85 |
| Gunilda | 26.97 | 7.28% | 80.78% | 10 | 90 |
| HMS Rose | 25.42 | 7.63% | 84.61% | 10 | 95 |
| Italian cruiser Alberico da Barbiano | 24.39 | 7.98% | 88.48% | 10 | 95 |
| Benchijigua Express | 23.26 | 8.32% | 92.35% | 10 | 100 |
| CCGS Terry Fox | 22.19 | 8.67% | 96.18% | 10 | 105 |
| General Grant | 21.16 | 9.02% | 100.00% | 10 | 110 |
| German destroyer Z1 Leberecht Maass | 21.16 | 9.02% | 100.00% | 10 | 110 |
| USS Wego | 0.03 | 99.98% | 100.00% | 100 | 110 |
| American Heritage | unknown | unmeasured | unmeasured | 50 | 55 |

## songs

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| X X X | 11037.13 | 0.00% | 0.00% | 10 | 10 |
| Dragostea din tei | 794.71 | 0.13% | 3.83% | 10 | 10 |
| Day-O | 593.39 | 0.27% | 7.65% | 10 | 10 |
| A Thousand Miles | 487.32 | 0.40% | 11.54% | 10 | 10 |
| Norwegian Wood | 426.29 | 0.54% | 15.37% | 10 | 15 |
| Jekyll & Hyde | 383.68 | 0.67% | 19.21% | 10 | 20 |
| Sexxx Dreams | 343.19 | 0.81% | 23.07% | 10 | 25 |
| Man I Need | 311.68 | 0.94% | 26.91% | 10 | 30 |
| Tannhäuser | 288.61 | 1.08% | 30.71% | 10 | 35 |
| Everywhere | 269.45 | 1.21% | 34.63% | 10 | 35 |
| Warriors | 253.74 | 1.35% | 38.45% | 10 | 40 |
| As It Was | 239.23 | 1.48% | 42.28% | 10 | 45 |
| Poison | 227.10 | 1.62% | 46.15% | 10 | 50 |
| Get It On | 216.35 | 1.75% | 50.00% | 10 | 55 |
| Land of Hope and Glory | 206.13 | 1.89% | 53.82% | 10 | 60 |
| You to Me Are Everything | 196.13 | 2.02% | 57.69% | 10 | 65 |
| Kiss | 187.32 | 2.15% | 61.52% | 10 | 65 |
| Two Princes | 178.97 | 2.29% | 65.36% | 10 | 70 |
| Day 'n' Nite | 171.29 | 2.42% | 69.22% | 10 | 75 |
| Freestyler | 164.71 | 2.56% | 73.06% | 10 | 80 |
| Man! I Feel Like a Woman! | 159.19 | 2.69% | 76.88% | 10 | 85 |
| Say Something | 153.81 | 2.83% | 80.76% | 10 | 90 |
| Centerfold | 148.48 | 2.96% | 84.59% | 10 | 95 |
| Plush | 143.65 | 3.10% | 88.43% | 10 | 95 |
| I Can Dream About You | 138.23 | 3.23% | 92.30% | 10 | 100 |
| Wonderful Christmastime | 134.06 | 3.37% | 96.08% | 10 | 105 |
| The Inner Light | 129.68 | 3.50% | 100.00% | 10 | 110 |
| What's My Name? | 129.68 | 3.50% | 100.00% | 10 | 110 |
| Znak Pokoju | 0.03 | 99.61% | 100.00% | 100 | 110 |
| (Not The) Greatest Rapper | unknown | unmeasured | unmeasured | 50 | 55 |

## stations

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Hydroelectric Station | 3213.13 | 0.00% | 0.00% | 10 | 10 |
| Mission Harbour station | 124.55 | 0.19% | 3.83% | 10 | 10 |
| Pune Junction railway station | 83.13 | 0.38% | 7.67% | 10 | 10 |
| Tongtianhe railway station | 68.58 | 0.54% | 11.00% | 10 | 10 |
| Frankfurt (Main) Hauptbahnhof | 55.13 | 0.76% | 15.39% | 10 | 15 |
| Rani Kamalapati railway station | 45.71 | 0.94% | 19.19% | 10 | 20 |
| Amiens Street Station | 38.32 | 1.13% | 23.06% | 10 | 25 |
| Woollahra railway station | 33.94 | 1.32% | 26.88% | 10 | 30 |
| Stockwell tube station | 29.32 | 1.51% | 30.74% | 10 | 35 |
| Rotterdam Centraal railway station | 27.45 | 1.70% | 34.58% | 10 | 35 |
| Endako station | 25.26 | 1.89% | 38.43% | 10 | 40 |
| Hong Kong station | 23.39 | 2.08% | 42.30% | 10 | 45 |
| Outram Park MRT Station | 22.10 | 2.27% | 46.13% | 10 | 50 |
| Madavara metro station | 20.90 | 2.46% | 49.97% | 10 | 55 |
| Gomti Nagar railway station | 19.65 | 2.65% | 53.85% | 10 | 60 |
| Wigan North Western Railway Station | 18.65 | 2.84% | 57.67% | 10 | 65 |
| Barlaston railway station | 17.74 | 3.03% | 61.55% | 10 | 65 |
| Khlong Nueng station | 17.13 | 3.21% | 65.31% | 10 | 70 |
| Córdoba railway station | 16.52 | 3.41% | 69.34% | 10 | 75 |
| Earlestown railway station | 15.77 | 3.60% | 73.12% | 10 | 80 |
| Stratford-upon-Avon railway station | 15.23 | 3.78% | 76.89% | 10 | 85 |
| Joliet Gateway Center | 14.61 | 3.97% | 80.78% | 10 | 90 |
| Gothenburg Central Station | 14.10 | 4.16% | 84.63% | 10 | 95 |
| Richmond Hill station | 13.65 | 4.35% | 88.36% | 10 | 95 |
| Brickland MRT station | 13.13 | 4.55% | 92.41% | 10 | 100 |
| Bordeaux-Saint-Jean station | 12.68 | 4.73% | 96.25% | 10 | 105 |
| Kosciuszko Street station | 12.26 | 4.93% | 100.00% | 10 | 110 |
| Morpeth railway station | 12.26 | 4.93% | 100.00% | 10 | 110 |
| Schrezheim | 0.03 | 99.82% | 100.00% | 100 | 110 |
| ‘Abal | unknown | unmeasured | unmeasured | 50 | 55 |

## television

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| East of Eden | 77462.16 | 0.00% | 0.00% | 10 | 10 |
| Haunted Hotel | 5175.52 | 0.20% | 3.83% | 10 | 10 |
| A Knight of the Seven Kingdoms | 3232.45 | 0.40% | 7.67% | 10 | 10 |
| M*A*S*H | 2431.35 | 0.60% | 11.54% | 10 | 10 |
| The Night Manager | 1935.81 | 0.80% | 15.37% | 10 | 15 |
| The Sandman | 1613.77 | 1.00% | 19.21% | 10 | 20 |
| The Strain | 1401.68 | 1.20% | 23.07% | 10 | 25 |
| Bait | 1220.87 | 1.40% | 26.91% | 10 | 30 |
| Leanne | 1100.26 | 1.60% | 30.74% | 10 | 35 |
| The Biggest Loser | 990.26 | 1.80% | 34.61% | 10 | 35 |
| Jane the Virgin | 898.45 | 2.00% | 38.45% | 10 | 40 |
| X-Men: The Animated Series | 829.26 | 2.20% | 42.28% | 10 | 45 |
| Kingdom | 762.94 | 2.40% | 46.15% | 10 | 50 |
| Game of Thrones season 1 | 708.68 | 2.60% | 49.98% | 10 | 55 |
| The Little Drummer Girl | 658.81 | 2.80% | 53.80% | 10 | 60 |
| The Real Ghostbusters | 612.94 | 3.01% | 57.69% | 10 | 65 |
| Dad's Army | 573.61 | 3.21% | 61.52% | 10 | 65 |
| Super Why! | 538.84 | 3.40% | 65.34% | 10 | 70 |
| The Bachelor | 507.90 | 3.61% | 69.22% | 10 | 75 |
| Darling in the Franxx | 480.35 | 3.81% | 73.06% | 10 | 80 |
| Kim's Convenience | 455.32 | 4.01% | 76.89% | 10 | 85 |
| I Am Not Okay with This | 435.35 | 4.21% | 80.76% | 10 | 90 |
| Lists of Dancing with the Stars (American TV series) episodes | 417.23 | 4.41% | 84.59% | 10 | 95 |
| Gotham Knights | 400.06 | 4.61% | 88.43% | 10 | 95 |
| Yellowjackets season 2 | 381.94 | 4.81% | 92.30% | 10 | 100 |
| WWE SmackDown | 363.81 | 5.01% | 96.13% | 10 | 105 |
| Mildred Pierce | 350.35 | 5.21% | 100.00% | 10 | 110 |
| The Challenge: Spies, Lies & Allies | 350.13 | 5.21% | 100.00% | 10 | 110 |
| Zvezde Granda 2010-2011 | 0.03 | 99.88% | 100.00% | 100 | 110 |
| ¿En qué lío me metí? | unknown | unmeasured | unmeasured | 50 | 55 |

## universities

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Cornell University | 6284.68 | 0.00% | 0.00% | 10 | 10 |
| Northeastern University | 553.10 | 0.47% | 3.83% | 10 | 10 |
| Kew Gardens | 350.03 | 0.94% | 7.67% | 10 | 10 |
| University of Arkansas | 261.77 | 1.42% | 11.54% | 10 | 10 |
| Bates College | 213.23 | 1.89% | 15.37% | 10 | 15 |
| Centennial College | 177.19 | 2.36% | 19.21% | 10 | 20 |
| Thomas Jefferson University | 151.61 | 2.83% | 23.07% | 10 | 25 |
| Sungkyunkwan University | 129.16 | 3.30% | 26.91% | 10 | 30 |
| University of South Africa | 114.58 | 3.77% | 30.74% | 10 | 35 |
| University of Louisiana at Monroe | 101.94 | 4.25% | 34.61% | 10 | 35 |
| New York University Stern School of Business | 90.03 | 4.72% | 38.45% | 10 | 40 |
| Royal College of Music | 81.97 | 5.19% | 42.28% | 10 | 45 |
| Brigham Young University–Hawaii | 75.00 | 5.66% | 46.17% | 10 | 50 |
| Imam Mohammad Ibn Saud Islamic University | 69.52 | 6.13% | 49.97% | 10 | 55 |
| University of La Verne | 64.81 | 6.60% | 53.82% | 10 | 60 |
| Pontifical Catholic University of Chile | 60.29 | 7.08% | 57.67% | 10 | 65 |
| Wolfson College, Cambridge | 56.42 | 7.55% | 61.50% | 10 | 65 |
| Rashtriya Raksha University | 52.77 | 8.02% | 65.36% | 10 | 70 |
| King Edward Medical University | 49.71 | 8.50% | 69.24% | 10 | 75 |
| Allama Iqbal Open University | 46.45 | 8.97% | 73.11% | 10 | 80 |
| Medgar Evers College | 43.90 | 9.43% | 76.88% | 10 | 85 |
| King University | 41.45 | 9.91% | 80.76% | 10 | 90 |
| Paris School of Economics | 39.00 | 10.38% | 84.59% | 10 | 95 |
| St. Joseph's University, Bangalore | 36.84 | 10.85% | 88.43% | 10 | 95 |
| University of Rajshahi | 35.13 | 11.32% | 92.28% | 10 | 100 |
| University of Texas Health Science Center at Houston | 33.42 | 11.80% | 96.13% | 10 | 105 |
| University of Nebraska system | 31.97 | 12.26% | 99.90% | 10 | 110 |
| Cornell Johnson Graduate School of Management | 31.94 | 12.28% | 100.00% | 10 | 110 |
| Yokohama City University College of Nursing | 0.03 | 99.71% | 100.00% | 100 | 110 |
| Accademia dei Fisiocritici | unknown | unmeasured | unmeasured | 50 | 55 |

## video-games

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Call of Duty: Modern Warfare 4 | 28351.45 | 0.00% | 0.00% | 10 | 10 |
| Halo Online | 1720.71 | 0.37% | 3.87% | 10 | 10 |
| Pokémon Home | 1158.16 | 0.73% | 7.65% | 10 | 10 |
| Crash Bandicoot | 910.10 | 1.10% | 11.54% | 10 | 10 |
| Call of Duty: Advanced Warfare | 783.97 | 1.47% | 15.37% | 10 | 15 |
| Grand Theft Auto: Liberty City Stories | 670.45 | 1.84% | 19.21% | 10 | 20 |
| Lichess | 589.19 | 2.21% | 23.07% | 10 | 25 |
| Madden Season 2 | 543.42 | 2.57% | 26.89% | 10 | 30 |
| V8 Challenge | 489.35 | 2.94% | 30.74% | 10 | 35 |
| Gears of War: Reloaded | 458.45 | 3.31% | 34.59% | 10 | 35 |
| Metroid Prime Remastered | 430.71 | 3.67% | 38.43% | 10 | 40 |
| Christmas Lemmings | 393.45 | 4.04% | 42.26% | 10 | 45 |
| Evil Night | 362.71 | 4.42% | 46.22% | 10 | 50 |
| Forza Horizon 2 | 337.90 | 4.78% | 49.98% | 10 | 55 |
| The Forest | 319.32 | 5.15% | 53.82% | 10 | 60 |
| Nonogram | 299.10 | 5.52% | 57.70% | 10 | 65 |
| Lobotomy Corporation | 283.00 | 5.88% | 61.52% | 10 | 65 |
| Shantae | 265.00 | 6.25% | 65.36% | 10 | 70 |
| Total War: Warhammer 40,000 | 248.77 | 6.62% | 69.22% | 10 | 75 |
| Riven | 234.26 | 6.99% | 73.06% | 10 | 80 |
| Luigi's Mansion 2 HD | 222.23 | 7.35% | 76.88% | 10 | 85 |
| SpongeBob's Truth or Square | 211.74 | 7.72% | 80.69% | 10 | 90 |
| 428: Shibuya Scramble | 200.52 | 8.09% | 84.61% | 10 | 95 |
| Prototype 2 | 191.23 | 8.46% | 88.43% | 10 | 95 |
| The Incident at Galley House | 183.52 | 8.82% | 92.30% | 10 | 100 |
| AI: The Somnium Files | 176.87 | 9.19% | 96.13% | 10 | 105 |
| Fire Emblem Gaiden | 169.13 | 9.56% | 100.00% | 10 | 110 |
| The Last Story | 169.13 | 9.56% | 100.00% | 10 | 110 |
| Winter Wonderland | 0.13 | 100.00% | 100.00% | 100 | 110 |
| _dive | unknown | unmeasured | unmeasured | 50 | 55 |

## foods (retained scheduled catalog f0dbabbca22064f9)

Pool: 3000. Missing-data fallback: 50 → 55 points.

| Answer | Daily views | Before percentile | After percentile | Before pts | After pts |
|---|---:|---:|---:|---:|---:|
| Persimmon | 4098.55 | 0.00% | 0.00% | 10 | 10 |
| Tofu | 1044.13 | 3.05% | 3.90% | 10 | 10 |
| Areca nuts | 818.32 | 6.01% | 7.69% | 10 | 10 |
| Chinese dumplings | 680.39 | 9.00% | 11.52% | 10 | 10 |
| Spotted dick | 582.84 | 12.01% | 15.37% | 10 | 15 |
| Gelato | 501.87 | 15.01% | 19.21% | 15 | 20 |
| Miso soup | 434.06 | 18.03% | 23.07% | 20 | 25 |
| Flour | 378.00 | 21.05% | 26.94% | 20 | 30 |
| Tortilla | 324.65 | 24.02% | 30.74% | 25 | 35 |
| Mulligatawny | 288.61 | 27.05% | 34.61% | 25 | 35 |
| Insalata caprese | 253.10 | 30.04% | 38.45% | 30 | 40 |
| Radler | 218.65 | 33.04% | 42.28% | 35 | 45 |
| Sopressa | 188.77 | 36.05% | 46.13% | 35 | 50 |
| Shish kebab | 170.13 | 39.06% | 49.98% | 40 | 55 |
| Sunflower oil | 150.87 | 42.05% | 53.82% | 40 | 60 |
| Cider vinegar | 134.77 | 45.08% | 57.69% | 45 | 65 |
| Chiffon cake | 114.74 | 48.07% | 61.52% | 50 | 65 |
| Convenience food | 97.03 | 51.07% | 65.36% | 50 | 70 |
| Rujak | 83.68 | 54.14% | 69.29% | 55 | 75 |
| Murgh musallam | 71.06 | 57.07% | 73.04% | 55 | 80 |
| Mare's milk | 60.23 | 60.08% | 76.89% | 60 | 85 |
| Pannenkoek | 52.58 | 63.11% | 80.76% | 65 | 90 |
| Ham sandwich | 44.84 | 66.12% | 84.61% | 65 | 95 |
| Ashcake | 37.61 | 69.10% | 88.43% | 70 | 95 |
| Harzer | 31.42 | 72.15% | 92.33% | 70 | 100 |
| Khanom krok | 26.29 | 75.12% | 96.13% | 75 | 105 |
| Carrot juice | 22.19 | 78.14% | 100.00% | 80 | 110 |
| Ossenworst | 22.13 | 78.18% | 100.00% | 80 | 110 |
| Na tinombur | 0.06 | 100.00% | 100.00% | 100 | 110 |
| 'Nzuddi | unknown | unmeasured | unmeasured | 50 | 55 |
