# Dibs

Dibs is a daily race to claim answers before anyone else. Each file has three dibs and five strikes. Taken and house-held answers cost a strike; unregistered answers and typos do not. The app uses React, TypeScript and Vite on Cloudflare Pages, with a Worker, D1, SQLite Durable Objects and Turnstile. This repository is private.

Production: https://dibs.here. Practice: https://practice.dibs-7hz.pages.dev (unlisted and noindex, not password protected). Practice uses separate credentials, D1 and Durable Objects. Never create test players, reset files or run fixture SQL in production.

The existing November 23–27 schedule is preserved. Existing approval does **not** certify the new R8 coverage gates. See [catalog status and house words](review/coverage/catalog-report.md) and [the launch runbook](LAUNCH.md) before opening a day. No later dates are added automatically; the old capped builder and rollout scheduler are retired.

## Development and checks

```sh
npm ci
# Create ignored .dev.vars with local secrets and LOCAL_TEST=true.
cp .dev.vars worker/.dev.vars
npx wrangler d1 migrations apply dibs-db --local -c worker/wrangler.jsonc
npm run worker:dev
# In a second terminal:
npm run dev
```

`VITE_DEMO=true npm run dev` enables labelled development fixtures; production builds exclude them. Local test setup must never be run against remote D1.

```sh
npm run check
npm test
npm run test:emoji
npm run catalog:coverage
npx playwright install chromium webkit firefox
npm run test:e2e
npx playwright test -c playwright.r7.config.ts
npm run build
```

The browser matrix covers both themes, 320–2560px, phone landscape, tablets, keyboard play, results, certificate exports and share fallbacks. Firefox is also tested in Ubuntu CI because this Mac's installed Firefox fails before opening the app. Browser emulation does not certify physical keyboards, native share sheets or an in-app browser's Turnstile interaction. Review evidence lives in `review/round8/` and `review/coverage/`; bulk screenshots and private downloads stay ignored.

## Complete catalogs

The R8 pipeline merges full reference extracts: WordNet, GBIF English vernacular names, IOC, USDA PLANTS, GeoNames cities1000 and allCountries plus English alternate names, the Mammal Diversity Database, OurAirports, NASA/JPL named minor planets, ISO 3166, Open Food Facts, supplementary culinary lists, and uncapped Wikidata classifications. See [source attribution](public/data/licenses.txt). Reference downloads and pageview caches are private build inputs under `.category-cache/r8/`; source checksums are recorded in `review/round8/source-checksums.json`.

```sh
# After downloading the documented complete reference inputs:
python3 scripts/extract-gbif-r8.py
python3 scripts/extract-geonames-en-r8.py
npx tsx scripts/extract-r8-curated.ts
python3 scripts/extract-r8-geography.py
npx tsx scripts/extract-r8-asteroids.ts
npx tsx scripts/extract-r8-wikidata-chunks.ts
python3 scripts/extract-r8.py
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/build-r8.ts --write-measurement-queue
npx tsx scripts/prepare-r8-title-inventory.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/build-r8.ts
npm run catalog:coverage
npm run build
```

For complete monthly rankings, download Wikimedia's full human-pageview dump and run `python3 scripts/extract-r8-bulk-pageviews.py`, then use `build-r8.ts --bulk`. The extractor sums every access method, including views without a page ID, and records the complete input checksum and row counts. Selection scans the entire extracted index; it never caps candidate membership. Verify sample totals against the monthly REST API with `scripts/verify-r8-bulk-pageviews.ts`. The bulk mode uses October 1–31, 2026 consistently; article existence, redirects and category scope are checked separately. Run only one ranking-cache writer at a time. `--measure-only --bulk` fills metadata, while `--offline --bulk` materializes the measured snapshot. Do not switch back to daily mode without remeasuring metadata-only cache entries.

Wikidata extraction first retrieves the entire classification ID set, then uses resumable bounded joins to obtain English article links. Article titles supply common names; English and multilingual labels and aliases supply accepted variants. A mandatory English-only label would wrongly omit entries that use Wikidata's default multilingual label, so it is never an eligibility condition. English Wikipedia article availability is the stated quality filter; batch size never caps membership. Cities, biological and food references retain their full eligible reference set. For the other GeoNames categories, every candidate is considered; only measured articles with matching geographic descriptions pass the stated quality filter. Missing pageview data is recorded as unknown, never fabricated zero views. Geography feature codes and exclusions are recorded in the extraction audit.

The builder considers every source row, merges common names and aliases, and measures English Wikipedia readership without a query-order cap. Unknown measurements remain unknown. Source completeness, completed ranking, at least 150 independently authored obvious examples (98%, Animals 100%), and 50 independent mid-popularity checks gate new approval. Legacy catalogs remain unverified until they pass. The old capped builder and uploader are retired, and their scheduled GitHub workflow is disabled; the live game calendar is unchanged. Countries uses all 249 ISO countries and territories; artificial entries are not added to reach 300.

`build-catalog-assets.ts` writes immutable, versioned public indexes with no golden flags. The Worker checks a bundled common-name index first, then lazily loads one category's sorted full index per isolate and binary-searches it. D1 stores claims, strikes, house rows and golden commitments, not one row per reference answer. Legacy answer rows remain for rollback. Counts use the manifest's actual total. Client spelling assistance runs only **after submission**, in a bounded Web Worker; there is no answer autocomplete.

House words are the ten highest measured mean daily pageview answers, with deterministic name tie breaks. Golden answers use unbiased draws without replacement excluding the house. A cryptographic commitment is stored before play; its payload is revealed only when the day closes. Public indexes contain all accepted names but never disclose golden selection. Changing a future category through `/api/admin/static-catalog` preserves its date and status and draws new commitments; opened categories cannot be replaced.

## Identity, privacy and operation

A hashed recovery key restores the same signed identity in another browser. Key entry is rate limited. Claim requests carry an idempotency UUID so a network retry cannot duplicate a claim or strike. Missing-answer submissions are anonymous, rate limited, retained for 90 days, and visible in admin stats. The Office notice explains storage, retention, 13+ eligibility and the `privacy@dibs.here` contact placeholder.

The shared registry coordinator serializes claims; D1 constraints enforce answer uniqueness and atomic daily limits. Public polling uses bounded caches and incremental cursors. Permanent Day Certificate and individual certificate links support PNG, copy, download and long-press fallbacks. Moderation redacts public previews without erasing identity records. Free-tier limits still apply; the earlier workload estimates are in `review/round4/free-tier.md`.

`SHOW_CREATOR_CREDIT` in `shared/creator.ts` defaults to false. Public pages and artifacts use the Dibs brand alone.

## Deployment and recovery

Deploy to practice and verify before production. Apply the additive migration before code that depends on it. Keep secrets in ignored files or Wrangler's secret store, never in command arguments, URLs or commits.

```sh
npx wrangler d1 migrations apply dibs-db --remote -c worker/wrangler.jsonc
npm run deploy:api
npm run deploy:web
```

Both production deploy commands enforce the November 23, 6 PM ET–November 24, midnight ET freeze. Direct Wrangler commands must obey it too. Root `wrangler.jsonc` defines Pages service bindings; `worker/wrangler*.jsonc` separates production and practice. Remote `LOCAL_TEST` must remain disabled.

`npm run backup` exports production D1 privately to `.backups/`, retaining 30 days. The project-local launchd task runs at 5:30 AM while this Mac is awake and its login session exists. The runbook documents reloading it after reboot, local restore rehearsal, seven-day Free-plan D1 Time Travel, pausing a day, voiding an abusive claim, rollback and Search Console DNS verification. `MORNING_REPORT.md` is a private operational handoff and must never be committed.
