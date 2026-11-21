# Dibs

A daily game of first claims. React/TypeScript/Vite on Cloudflare Pages; a Worker, D1, SQLite Durable Object caches and Turnstile. The repository is private. The preview is unlisted/noindex, not access-controlled.

Round 2 puts the category, plain rule and claim input in the first phone viewport, removes school affiliations, and gives quiet ledgers/archives deliberate layouts. All categories remain **drafts**. No deployment approves or schedules a category.

Review [acceptance](review/ACCEPTANCE.md), [the gallery](review/index.html), [device results](review/round2/devices.md), and [the measured free-tier budget](review/round2/free-tier.md). Remote D1 migrations and verification are deferred until **November 21, 2026, 7 PM Toronto**. No plan, billing or custom-domain changes were made.

## Local development

```sh
npm ci
# .dev.vars contains local COOKIE_SECRET, ADMIN_TOKEN, TURNSTILE_SECRET and LOCAL_TEST=true.
# Keep root and worker copies local and ignored.
cp .dev.vars worker/.dev.vars
npx wrangler d1 migrations apply dibs-db --local -c worker/wrangler.jsonc
npm run worker:dev
# Separate terminal:
npm run dev
```

A labelled development proof uses `VITE_DEMO=true npm run dev`. Vite removes fixtures from production. `scripts/local-register.ts` opens a real category only in local D1 for integration tests; never use its SQL remotely. The production preview remains closed pending owner review.

## Verification

```sh
npm run check
npm test
npx playwright install chromium webkit firefox
npm run test:e2e
npx tsx scripts/screenshots.ts review/final
npm run build
npx tsx scripts/verify-production.ts
npm run preview -- --port 5175
# Separate terminal; preview proxies the running local Worker:
npx tsx scripts/lighthouse.ts http://127.0.0.1:5175
```

The browser matrix covers 320–2560px, phone landscape, tablets, both themes, keyboard selection, taken/claim/certificate/ledger, two PNG sizes and share fallbacks. Firefox currently fails before app launch on this Mac; physical browser/native keyboard/share behavior is not claimed as tested. Raw capture folders and downloaded browsers are removed after final verification; compact evidence and `review/final/` remain.

`npm test` uses local workerd/D1 for race safety, rate/IP limits, private sessions, cache hits, cursor polling, quota messages, upload idempotency and moderation invalidation. `scripts/local-round2.ts` tests the real local UI/API flow; it expects an existing local Axolotl claim and selects an available real entry for its new claim.

## Runtime and budget

`shared/config.ts` owns `PUBLIC_ORIGIN`. Certificates, canvas exports, OG images and shared links all use it. Browser fonts are subset WOFF2; `npm run build` regenerates Pages-served autocomplete catalogs from `categories/`.

`/api/bootstrap` combines today's state, private identity and the latest 50 filings. `/api/live` carries cursor polls every 15 seconds, backing off to 60 seconds after two minutes and pausing hidden tabs. Socket failures fall back to 120-second HTTP refreshes. `/api/today` and `/api/ledger` also use shared 10-second Workers Cache API entries; a global coordinator performs indexed incremental D1 reads. Earlier ledger entries load in pages of 50; search is explicitly within the loaded filings.

Pending identities, rerolls, attempt limits and content-free share counters live in DO SQLite. Only successful claim submission creates D1 player records. Existing signed identities have a cached restore path. D1 still enforces atomic answer/user uniqueness and daily IP limits. Raw IPs and user-entered public names are never stored. Privacy cleanup is indexed and removes old salted hashes.

OG images are rendered once and stored for 30 days in eight bounded image caches. Later or capacity-limited previews use the common wordmark. HTML certificates and client exports remain available. Moderation invalidates images and public caches. Inactive private caches expire after 30 days, and certificate response caches after one day; D1 records persist. D1 quota errors show a clerk notice and suppress retries until reset.

The documented five-minute workload fits at 10,000 daily visitors using the existing 2,046–2,200-answer categories. This is not unlimited browsing or indefinite database retention. See the budget for limits, assumptions, measurements, cache storage bounds and the 500 MB per-D1-database ceiling.

## Categories and administration

```sh
npm run categories -- animals
npx tsx scripts/validate-categories.ts
npx tsx scripts/upload-drafts.ts --dry-run categories/animals.json
# Defaults to local D1; ADMIN_TOKEN comes from the environment or the local .dev.vars.
npx tsx scripts/upload-drafts.ts categories/animals.json
```

All 30 source catalogs remain drafts; `review/categories.md` contains their review checklists. The builder records Wikipedia/Wikidata sources and measured pageviews, normalizes/deduplicates aliases and excludes unmeasured/offensive/ambiguous entries. Owner review is still required.

The uploader runs sequential bounded batches, reserves at most 45,000 writes per UTC day, skips identical content and stops without retrying errors. Keep its ignored `.upload-state.json` journal. Remote mode is explicitly `--remote`, locked until the requested quota reset, and refuses uploads while a category is open. It never approves a category. Do not combine bulk uploads with traffic on a live day.

`ADMIN_TOKEN` belongs in the environment, never a URL/argument/commit. `scripts/admin.ts` supports explicit owner review/approval, hide-user, void-claim and stats. Approval requires a future reviewed date and 2,000–2,200 measured entries. Hiding anonymizes the holder and blocks filings; voiding preserves the occupied answer/serial and daily claim limit. `/stats` reads daily actual figures, share taps and exact D1/D7 retention.

## Deploy

After the specified quota reset, apply pending D1 migrations:

```sh
npx wrangler d1 migrations apply dibs-db --remote -c worker/wrangler.jsonc
```

Code deployment itself does not query D1 or approve drafts:

```sh
npm run deploy:api
npm run deploy:web
```

Root `wrangler.jsonc` defines Pages and the first-party API service binding. The Worker config defines D1, SQLite DO classes and cleanup crons. Keep `LOCAL_TEST` off remote Workers. Secrets use `wrangler secret put NAME -c worker/wrangler.jsonc`. The ignored `MORNING_REPORT.md` contains the owner's operational handoff and must never be committed.

Free cookieless Cloudflare Web Analytics still needs a public beacon token configured as `VITE_CF_ANALYTICS_TOKEN` in an ignored `.env.local`. No beacon ships without it; no account permissions were changed in Round 2. Font licenses and supplement attribution remain in `public/fonts/`.
