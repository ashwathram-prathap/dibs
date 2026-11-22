# Dibs

A daily game of first claims. React/TypeScript/Vite on Cloudflare Pages; a Worker, D1, SQLite Durable Object caches and Turnstile. The repository is private. The preview is unlisted/noindex, not access-controlled.

Round 3 gives each player three dibs and five strikes. Taken answers cost a strike; invalid entries do not. Completed files rank by dibs, strikes and completion time. The day summary is the main PNG/share artifact; certificates remain available.

The owner approved all 30 catalogs. Five are remotely verified and scheduled for November 24–28, 2026; the other 25 are queued for budgeted daily upload/verification/approval. Production stays closed until November 24 at 9 PM Toronto. November 24 is Tuesday; the explicit date overrides the conflicting Monday label in FIXES-R3.md.

Review [the Round 3 gallery](review/index.html), [device results](review/round3/devices.md), [free-tier measurements](review/round3/free-tier.md), and [upload progress](review/round3/upload-progress.json). Remote migrations are applied. No plan or billing changes were made; no DOMAIN.txt was supplied.

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

A labelled development proof uses `VITE_DEMO=true npm run dev`. Vite removes fixtures from production. `scripts/local-register.ts` opens a real category only in local D1 for integration tests; never use its SQL remotely. The production preview remains closed until the scheduled first drop.

## Verification

```sh
npm run check
npm test
npx playwright install chromium webkit firefox
npm run test:e2e
npx tsx scripts/review-round3.ts
npm run build
npx tsx scripts/verify-production.ts
npm run preview -- --port 5175
# Separate terminal; preview proxies the running local Worker:
npx tsx scripts/lighthouse.ts http://127.0.0.1:5175
```

The browser matrix covers 320–2560px, phone landscape, tablets, both themes, keyboard selection, taken/claim/certificate/ledger, two PNG sizes and share fallbacks. Firefox passes the same checks in Ubuntu CI but fails before app launch on this Mac; physical browser/native keyboard/share behavior is not claimed as tested. Raw capture folders and downloaded browsers are removed after final verification; compact evidence and `review/final/` remain.

`npm test` uses local workerd/D1 for race safety, rate/IP limits, private sessions, cache hits, cursor polling, quota messages, upload idempotency and moderation invalidation. `scripts/local-round3.ts` tests real local D1: three dibs, one strike, exact event order, five-strike closure, reload persistence and closed-file rejection.

## Runtime and budget

`shared/config.ts` owns `PUBLIC_ORIGIN`. Certificates, canvas exports, OG images and shared links all use it. Browser fonts are subset WOFF2; `npm run build` regenerates Pages-served autocomplete catalogs from `categories/`.

`/api/bootstrap` combines today's state, private identity and the latest 50 filings. `/api/live` carries cursor polls every 15 seconds, backing off to 60 seconds after two minutes and pausing hidden tabs. Socket failures fall back to 120-second HTTP refreshes. `/api/today` and `/api/ledger` also use shared 10-second Workers Cache API entries; a global coordinator performs indexed incremental D1 reads. Earlier ledger entries load in pages of 50; search is explicitly within the loaded filings.

Pending identities, rerolls, attempt limits and content-free share counters live in DO SQLite. Only successful claim submission creates D1 player records. Existing signed identities have a cached restore path. D1 enforces worldwide answer uniqueness, atomic per-user limits (three dibs or five strikes), and daily IP account limits. Raw IPs and user-entered public names are never stored. Privacy cleanup is indexed and removes old salted hashes.

OG images are rendered once and stored for 30 days in eight bounded image caches. Later or capacity-limited previews use the common wordmark. HTML certificates and client exports remain available. Moderation invalidates images and public caches. Inactive private caches expire after 30 days, and certificate response caches after one day; D1 records persist. D1 quota errors show a clerk notice and suppress retries until reset.

The stated five-minute workload with one taken guess per player on average fits at 10,000 daily visitors. The maximum workload where all 10,000 players use five strikes exceeds free limits; this capacity limitation is documented. This is not unlimited browsing or indefinite database retention. See the budget for limits, assumptions, measurements, cache storage bounds and the 500 MB per-D1-database ceiling.

## Categories and administration

```sh
npm run categories -- animals
npx tsx scripts/validate-categories.ts
npx tsx scripts/upload-drafts.ts --dry-run categories/animals.json
# Defaults to local D1; ADMIN_TOKEN comes from the environment or the local .dev.vars.
npx tsx scripts/upload-drafts.ts categories/animals.json
```

All 30 source catalogs keep draft transport metadata; owner approval is applied separately to each verified remote catalog. `review/categories.md` contains their review checklists. The builder records Wikipedia/Wikidata sources and measured pageviews, normalizes/deduplicates aliases and excludes unmeasured/offensive/ambiguous entries. Round 3 supplies owner approval for all 30.

The uploader runs sequential bounded batches, reserves at most 45,000 writes per UTC day, skips identical content and stops without retrying errors. Keep its ignored `.upload-state.json` journal. Remote mode is explicitly `--remote`, locked until the requested quota reset, and refuses uploads while a category is open. It never approves a category. Do not combine bulk uploads with traffic on a live day.

`ADMIN_TOKEN` belongs in the environment, never a URL/argument/commit. `scripts/admin.ts` supports explicit owner review/approval, hide-user, void-claim and stats. Approval requires a future reviewed date and 2,000–2,200 measured entries. Hiding anonymizes the holder and blocks filings; voiding preserves the occupied answer/serial and daily claim limit. `/stats` reads daily actual figures, share taps and exact D1/D7 retention.

## Deploy

Apply future D1 migrations before deploying dependent code:

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

## Resumable Round 3 rollout

`npx tsx scripts/round3-categories.ts` resumes the approved variety order in `scripts/category-plan.json`. The private `Approved category rollout` workflow runs daily at 00:20 UTC using `DIBS_ADMIN_TOKEN`; the initial workflow run passed. Each new catalog is verified by answer/alias/obscurity digest and normalized-key digest before the admin approve call. A server-side daily 45,000-write reservation prevents journal loss from bypassing the upload budget. Busy traffic days defer uploads. Dates are pushed forward and logged if needed.

Keep `.upload-state.json`. Each workflow run publishes the journal and progress report in the `category-upload-state` artifact. Download the latest artifact with `gh run download <run-id> -n category-upload-state -D .tmp/latest-upload` to inspect future progress. A full 30-category rollout needs multiple UTC days by design; the current snapshot is not a claim that pending uploads are complete.
