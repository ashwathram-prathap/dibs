# R19E implementation decisions

- Reproduced the owner's four examples using the frozen R19C algorithm. All score 10 and say “One of the most familiar animals.”
- `scripts/category-plan.json` retains the same schedule list and adds explicit `rarityPoolSizes` for all 33 catalogs, default 3,000. Measured readings alone can be ranked; if fewer readings exist, use them all. Countries therefore uses all measured entries in its 249-entry catalog.
- Equal readings retain middle ranks. Ties crossing the pool cutoff all receive percentile 1, preventing different scores for equal pageviews.
- Unknown readings remain null, with R19C's unmeasured wording. Their fallback is the median of the category's nameable reference pool (55 on the new scale), rather than awarding 110 because the vast obscure tail dominates the full catalog. A catalog with no readings still falls back to 50.
- The old formula actually ended at 100. R19E explicitly asks for 110, so the interval above percentile 0.1 is rescaled to end at 110, still rounded to five-point increments. Golden bonuses and strikes are unchanged; saved points are never recalculated.
- Score paths add `r19e-pool-v1` beneath the existing catalog version; curve paths include catalog and scoring versions too. Builders refuse to change bytes at an existing immutable URL. Old v1/v2 binaries and curves are reproduced by frozen legacy math and retained. Catalog rebuilds no longer remove old catalog directories.
- The R19 visual bell is analytic, not fetched from the empirical rarity JSON. It continues to place its marker directly from the saved claim percentile. The versioned empirical curves are rebuilt from the exact quantized binary readings.
- Sanity targets are observations, not editorial overrides: Axolotl, Okapi and Quokka remain very popular in the retained measurements and score 10. Chameleon scores 15, Blobfish 45, and Sarcastic fringehead 75. See SAMPLES.md for 30 before/after rows in each category.
- An authenticated GET-only scoring diagnostic exercises the actual Worker asset fetch and scorer without creating a player/claim or reading golden selections. It is used to verify both deployment origins.
- R12's 7:05 PM deployed load test is after R19E's 4:30 PM hard stop and will not run. No notification is necessary; zero ntfy alerts planned.
