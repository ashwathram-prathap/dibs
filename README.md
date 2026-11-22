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
npx tsx scripts/enrich-r8-wikidata-aliases.ts
python3 scripts/extract-r8-airports.py
python3 scripts/extract-r8.py
npx tsx scripts/enrich-r8-wikipedia-aliases.ts --slug=airports
npx tsx scripts/enrich-r8-wikipedia-aliases.ts --slug=arthropods
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/build-r8.ts --write-measurement-queue
npx tsx scripts/prepare-r8-title-inventory.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/build-r8.ts
npm run catalog:coverage
npm run build
```

For complete monthly rankings, download Wikimedia's full human-pageview dump and run `python3 scripts/extract-r8-bulk-pageviews.py`, then use `build-r8.ts --bulk`. The extractor sums every access method, including views without a page ID, and records the complete input checksum and row counts. Selection scans the entire extracted index; it never caps candidate membership. Verify sample totals against the monthly REST API with `scripts/verify-r8-bulk-pageviews.ts`. The bulk mode uses October 1–31, 2026 consistently; article existence, redirects and category scope are checked separately. Run only one ranking-cache writer at a time. `--measure-only --bulk` fills metadata, while `--offline --bulk` materializes the measured snapshot. Do not switch back to daily mode without remeasuring metadata-only cache entries.

Wikipedia redirect continuation preserves the original article description and page properties. Airport names and aliases require an airport description before an external article can replace the reference name; unrelated links remain unrated. Food readership likewise requires a food description. The emoji check inspects canonical catalog names as well as UI source; original symbol-bearing titles remain accepted aliases while displayed names use source-backed plain text.

Wikidata extraction first retrieves the entire classification ID set, then uses resumable bounded joins to obtain English article links. Article titles supply common names; English and multilingual labels and aliases supply accepted variants. A mandatory English-only label would wrongly omit entries that use Wikidata's default multilingual label, so it is never an eligibility condition. English Wikipedia article availability is the stated quality filter; batch size never caps membership. Cities, biological and food references retain their full eligible reference set. Every cleaned GeoNames geography entry remains accepted, including names without Wikipedia articles. Matching descriptions qualify readership, never membership; missing or unrelated articles leave obscurity unknown. Complete Wikidata classifications complement gaps in geographic feature coding. Missing pageview data is recorded as unknown, never fabricated zero views. Geography feature codes and exclusions are recorded in the extraction audit.

Songs and novels also use Wikidata's form-of-creative-work property (`P7937`), and novels include genre (`P136`): their instance type can be an audio recording or literary work. These broad classes apply the English-article quality filter during candidate extraction, with uncapped subclass groups and independent counts. Two independent classifications run concurrently, with atomic progress snapshots and resumable source caches. `enrich-r8-occupation-ranks.ts` additionally retrieves non-deprecated normal occupation statements hidden by another preferred occupation, counting every complete class group independently.

Video games & series includes paired versions and compilations. It also accepts English/Latin-script source names without a dedicated English article, retaining unknown readership instead of borrowing an unrelated article's traffic. TV shows includes independently named anthology seasons; ordinary numbered season articles are excluded. Leading English articles may be omitted from work titles, with existing canonical names retaining priority over aliases.

The builder considers every source row, merges common names and aliases, and measures English Wikipedia readership without a query-order cap. Unknown measurements remain unknown. Source completeness, completed ranking, at least 150 independently authored obvious examples (98%, Animals 100%), and 50 independent mid-popularity checks gate new approval. Legacy catalogs remain unverified until they pass. The old capped builder and uploader are retired, and their scheduled GitHub workflow is disabled; the live game calendar is unchanged. Countries uses all 249 ISO countries and territories; artificial entries are not added to reach 300.

`build-catalog-assets.ts` writes immutable, versioned public indexes with no golden flags. The Worker parses only the active category’s bundled common-name index, then lazily caches its complete exact index. Smaller catalogs use sorted keys; larger ones use sorted 96-bit SHA-256 keys and compact rows in immutable 8 MiB chunks, with build-time collision checks. The largest allowed binary index is 80 MiB; assets stay below Pages’ 25 MiB per-file limit. No complete buffer is copied while loading chunks. Rows use 256- or 1,024-entry files, declared in the manifest. Large source answer arrays use checksum-verified `.answers.json.gz` companions; scripts read them through `readCategory`. D1 stores claims, strikes, house rows and golden commitments, not one row per reference answer. Legacy answer rows remain for rollback. Counts use the manifest's actual total. Client spelling assistance runs only **after submission**, in a bounded Web Worker; there is no answer autocomplete.

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
