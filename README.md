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

Additional domain passes are reproducible with `enrich-r8-occupation-ranks.ts`, `enrich-r8-described-novels.ts`, the museum-infobox extractor, and `enrich-r8-painting-titles.ts`. `extract-r8-geography.py --extra` adds omitted lake, river and island feature subtypes while preserving existing enriched primaries. `extract-r8-castle-titles.py` followed by `enrich-r8-castle-titles.ts` checks the full English title inventory for castle-style buildings outside geographic classifications. Run Wikipedia alias enrichment on every completed primary; `--wikidata-supplement` targets geographic complements and `--geonames-extra` targets supplemental feature extracts. `--incremental` preserves completed aliases. Per-reference locks prevent concurrent writers. Never run catalog generation while browser tests or asset builders are reading those files.

For complete monthly rankings, download Wikimedia's full human-pageview dump and run `python3 scripts/extract-r8-bulk-pageviews.py`, then use `build-r8.ts --bulk`. The extractor sums every access method, including views without a page ID, and records the complete input checksum and row counts. Selection scans the entire extracted index; it never caps candidate membership. Verify sample totals against the monthly REST API with `scripts/verify-r8-bulk-pageviews.ts`. The bulk mode uses October 1–31, 2026 consistently; article existence, redirects and category scope are checked separately. Run only one ranking-cache writer at a time. `--measure-only --bulk` fills metadata, while `--offline --bulk` materializes the measured snapshot. Do not switch back to daily mode without remeasuring metadata-only cache entries.

Wikipedia redirect continuation preserves the original article description and page properties. Airport names and aliases require an airport description before an external article can replace the reference name; unrelated links remain unrated. Food readership likewise requires a food description. The emoji check inspects canonical catalog names as well as UI source; original symbol-bearing titles remain accepted aliases while displayed names use source-backed plain text.

Wikidata extraction first retrieves the entire classification ID set, then uses resumable bounded joins to obtain English article links. Article titles supply common names; English and multilingual labels and aliases supply accepted variants. A mandatory English-only label would wrongly omit entries that use Wikidata's default multilingual label, so it is never an eligibility condition. English Wikipedia article availability is the default quality filter; the explicitly broader geography, painting and video-game references retain named works without an article. Batch size never caps membership. Cities, biological and food references retain their full eligible reference set. Every cleaned GeoNames geography entry remains accepted, including names without Wikipedia articles. Matching descriptions qualify readership, never membership; missing or unrelated articles leave obscurity unknown. Complete Wikidata classifications complement gaps in geographic feature coding. Missing pageview data is recorded as unknown, never fabricated zero views. Geography feature codes and exclusions are recorded in the extraction audit.

Songs and novels also use Wikidata's form-of-creative-work property (`P7937`), and novels include genre (`P136`): their instance type can be an audio recording or literary work. These broad classes apply the English-article quality filter during candidate extraction, with uncapped subclass groups and independent counts. Two independent classifications run concurrently, with atomic progress snapshots and resumable source caches. `enrich-r8-occupation-ranks.ts` additionally retrieves non-deprecated normal occupation statements hidden by another preferred occupation, counting every complete class group independently.

`enrich-r8-described-novels.ts` also traverses the complete book/literary-work classes for explicit novel or novella descriptions, excluding collections, series and people. `enrich-r8-museum-reference.ts` merges every main-namespace article using Wikipedia's museum infobox, exhausting continuation. Run these supplements before the final alias and ranking passes. `enrich-r8-wikipedia-aliases.ts --slug=museums --incremental` enriches newly added records while retaining previously verified redirects. Source traversal and additions are recorded under `review/round8/`; coverage samples are never used to select source membership.

Paintings & series includes individually named works, groups and series, including English/default source names without an English article. Non-deprecated painting classifications are checked even when another type has preferred rank. English aliases and original/native titles are fetched in separate bounded queries, with every requested ID accounted for. After redirect enrichment, run `repair-r8-painting-redirects.ts` before ranking: unrelated or unverified articles cannot provide aliases or popularity, while the verified artwork names remain accepted. `--batch-size=1000` on the Wikidata alias importer resumes smaller batches after source throttling without reducing membership.

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

Both production deploy commands enforce the November 23, 5 PM ET–November 24, midnight ET freeze. Direct Wrangler commands must obey it too. Root `wrangler.jsonc` defines Pages service bindings; `worker/wrangler*.jsonc` separates production and practice. Remote `LOCAL_TEST` must remain disabled.

`npm run backup` exports production D1 privately to `.backups/`, retaining 30 days. The project-local launchd task runs at 5:30 AM while this Mac is awake and its login session exists. The runbook documents reloading it after reboot, local restore rehearsal, seven-day Free-plan D1 Time Travel, pausing a day, voiding an abusive claim, rollback and Search Console DNS verification. `MORNING_REPORT.md` is a private operational handoff and must never be committed.

## Topic calendar (Round 9)

Open `/admin/schedule` on your phone and enter the existing admin token. It stays in memory, never in a URL or local storage. Select a day, search the topic library, request a new topic, choose **Pick for me**, or move/swap days. Library changes close 24 hours before the drop; new requests require 72 hours. Live and past days cannot be changed. Empty or failed days get an automatic coverage-passed topic at 48 hours, with the reason recorded in the clerk’s log. Existing Round 8 dates remain unchanged.

Each file in `recipes/` names complete sources, scope, alias rules, ranking, an immutable source snapshot, and obvious/independent answer fixtures. The nightly job reproduces these audited snapshots; it does not silently refresh source membership or invent popularity data. Coverage requires at least 150 obvious answers at 98% (Animals: 100%), 50 independent matches, complete sources and completed ranking. Twenty-three current recipes pass. Unready recipes cannot be newly scheduled.

New requests are matched against audited source scopes and recipe aliases. A matching complete recipe must still pass the coverage gate. Unmapped topics stay **needs recipe**, with the reason visible; they fall back at 48 hours. A topic such as Car brands needs its own complete source and independently written answer fixtures before it can qualify. No free-text request is treated as an already verified dataset.

To add a recipe by hand, create a definition matching `recipes/countries.json` with its complete category snapshot and fixtures, then run one command:

```sh
npx tsx scripts/recipe-add.ts path/to/new-recipe.json
```

Commit the recipe, category snapshot (including any gzip companion), and fixtures. The helper rejects a recipe that fails coverage or source/ranking checks. The nightly build generates its immutable answer indexes; scheduling never depends on a laptop. Source refreshes must explicitly re-pin the recipe after review.

### Enable unattended Cloudflare uploads

1. Cloudflare dashboard → profile icon → **My Profile → API Tokens → Create Token → Create Custom Token**.
2. Name it `dibs-calendar`. Add account permissions **Cloudflare Pages / Edit**, **Workers Scripts / Edit**, and **D1 / Edit**. Under Account Resources choose **Include → Specific account → the Dibs account**. Do not grant all accounts or zone/DNS permissions. Create the token and copy it privately.
3. Private GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**. Name: `CLOUDFLARE_API_TOKEN`; value: the token. `DIBS_ADMIN_TOKEN` already exists. Account ID is non-secret and configured in the workflow.
4. Repository → **Actions → Daily topic calendar rollout → Run workflow → main**. Leave **Build and verify without changing production** unchecked. After it succeeds, `/admin/schedule` shows its timestamp and result.

Daily runs start at 07:17 UTC, with a manual trigger available. The Worker also checks deadlines and builds one already-uploaded requested day each minute, keeping ready days independent of GitHub timing. The rollout uploads Pages assets, publishes coverage-gated D1 metadata, seals house/golden commitments, records status and prunes. It does not deploy Worker code. Production rollout guards enforce the November launch freeze.

The workflow retains only referenced current/upcoming or recently closed full indexes. Full indexes can be removed seven days after close; shared versions remain while any upcoming day needs them. Sparse claimed answers, house words, golden reveals, counts, claims and certificates stay in D1. Clearing an unplayed future day deletes its unused metadata; removing a schedule never deletes a played record. Old inactive Pages deployments are pruned after seven days while preserving the active production deployment and five recent deployments per environment. Build files live only on ephemeral runners; coverage artifacts expire after three days. Account platform limits can constrain deletion; active aliased deployments are never force-deleted.

Expected monthly automation budget: roughly 10 minutes × 31 Linux runs = 310 Actions minutes, plus manual tests (GitHub Free includes 2,000 private-repo minutes). Coverage artifacts are under 1 MB each with three-day retention (500 MB included storage). One Pages upload per day is about 31 of 500 monthly builds; asset checks enforce 20,000 files and 25 MiB per file. Calendar minute checks add about 43,200 cron executions and 86,400 internal monitoring/calendar requests per month, well below the 100,000-request **daily** Workers allowance before player traffic. D1 metadata/coverage writes are small; only sparse played answers enter D1. Admin Live measures API usage and the calendar reports actual D1 and static-asset storage, with 70% warnings. These are projections, not traffic guarantees.

Limits: [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/), [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [GitHub included usage](https://docs.github.com/en/billing/reference/product-usage-included).
