# R14 — implementation and verification in progress

R13 remains the production release until the R14 release checks and practice rehearsal pass. The production deadline is November 23, 2026 at 3 PM America/Toronto. Launch remains November 23 at 9 PM ET.

Implemented server-stored claim points, a live answer-free leaderboard, immediate claim/strike payoff, Toronto drop streaks, certificate scores and spoiler-free sharing. The archive requests each closed day's final top ten. Hidden users and files with a voided claim are excluded; deletion retains an unrelated “Withdrawn player” row per day. Founder display names do not change scores.

Scoring uses category-specific pageviews per measured day. Percentile is ascending obscurity, from 0 to 1, with equal readings sharing their midrank. Base points are `round_to_5(10 + 100 × max(0, percentile − 0.1))`. Missing readings use the median measured score (50 if there are no measurements), with no invented percentile. Golden claims save an additional 100. The file total is `max(0, sum(saved claim points) − 10 × strikes)`. Ties use the earliest event at which the current total was reached, then a stable private ID only if timestamps match. Existing pre-R14 claims have no stored percentile and receive the median fallback through the additive migration; previous golden wins retain their bonus.

A streak survives the current drop while it is still open; after missing that drop it resets. Dates come from the Toronto drop calendar, independent of the viewer's timezone. Equal-day claims count only once.

Leaderboard rows are stored in 256 small Durable Object shards. Reads cache the sorted standings for 25 seconds. Normal refreshes ride the existing hibernating socket with its backoff; HTTP is only an initial/archive/fallback read. Successful claims and strikes return updated standings immediately. D1 is consulted to seed or recover the cache, not to rescan the day on every poll. Summary image caches refresh in 25 seconds so live ranks do not remain frozen for a day.

Local API and browser evidence is in this directory. Full-size PNGs stay local under `review/round14/`; final verification summaries and release metadata will be committed. No production players or test records were created.

Remote rehearsal is waiting for the permitted 7:05 PM ET window: Cloudflare reported 98,686 account-wide writes before the reset. The guarded load test will refresh the UTC-day account usage before sending anything and will reserve at least 30% of the daily quota. The earlier R11 release-gates file is unchanged.
