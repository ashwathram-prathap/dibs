# Dibs

A daily game of first claims. React/TypeScript/Vite on Cloudflare Pages; a Worker, D1, SQLite Durable Object caches and Turnstile. The repository is private. The preview is unlisted/noindex, not access-controlled.

Round 3 gives each player three dibs and five strikes. Taken answers cost a strike; invalid entries do not. Completed files rank by dibs, strikes and completion time. The day summary is the main PNG/share artifact; certificates remain available.

The owner approved all 30 catalogs. Animals opens Monday November 23, 2026 at 9:00 PM America/Toronto; Plants, Birds, Cities and Actors follow November 24–27. Those five are remotely verified. The other 25 remain queued for budgeted upload, verification and approval; only a late category moves, preserving the other planned dates.

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

`shared/config.ts` owns `PUBLIC_ORIGIN`. Certificates, canvas exports, OG images and shared links all use it. Browser fonts are subset WOFF2; `npm run build` removes public autocomplete catalogs to protect unclaimed golden answers.

`/api/bootstrap` combines today's state, private identity and the latest 50 filings. `/api/live` carries cursor polls every 15 seconds, backing off to 60 seconds after two minutes and pausing hidden tabs. Socket failures fall back to 120-second HTTP refreshes. `/api/today` and `/api/ledger` also use shared 10-second Workers Cache API entries; a global coordinator performs indexed incremental D1 reads. Earlier ledger entries load in pages of 50; search is explicitly within the loaded filings.

Pending identities, rerolls, attempt limits and content-free share counters live in DO SQLite. Only successful claim submission creates D1 player records. Existing signed identities have a cached restore path. D1 enforces worldwide answer uniqueness, atomic per-user limits (three dibs or five strikes), and daily IP account limits. Raw IPs and user-entered public names are never stored. Privacy cleanup is indexed and removes old salted hashes.

OG images are rendered once and stored for 30 days in eight bounded image caches. Later or capacity-limited previews use the common wordmark. HTML certificates and client exports remain available. Moderation invalidates images and public caches. Inactive private caches expire after 30 days, and certificate response caches after one day; D1 records persist. D1 quota errors show a clerk notice and suppress retries until reset.

Round 4 adds anonymous arrival counters and permanent summary references. Its conservative 10,000-visitor workload exceeds the free Durable Object request/write allowance; smaller launch traffic fits. The maximum workload where every player uses five strikes costs more still. See `review/round4/free-tier.md` for the updated capacity envelope. This is not unlimited browsing or indefinite database retention. See the budget for limits, assumptions, measurements, cache storage bounds and the 500 MB per-D1-database ceiling.

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

## Round 4 sharing

Day summaries have permanent `/summary/:id` links, including zero-dibs closed files. The primary SHARE action uses a prepared 1080×1920 PNG with text and the canonical URL; text-only native sheets, download, copy and long-press fallbacks are available. Separate 1080×1350 feed exports and X, WhatsApp, Facebook and Instagram/TikTok controls use no third-party widgets.

Certificate and summary HTML includes matching Open Graph and Twitter metadata. Preview text and images remain spoiler-free permanently so a cached card cannot reveal today's answers; manually exported PNGs contain the player's answers. Existing 30-day/eight-shard image limits still apply. Anonymous per-platform tap and arrival totals appear in `/stats`; events contain only an allowlisted platform. First arrival is remembered by a boolean local-storage flag, with a per-page fallback if storage is blocked. “Native” means the system sheet, whose selected destination is not exposed to the website.

Evidence is in `review/round4/` and screenshots/PNGs in `review/final/`. Reproduce exports with `npx tsx scripts/review-round4.ts` against the fixture dev server. `npx tsx scripts/verify-round4-live.ts` checks live cards without posting, claiming, or incrementing analytics.

## Round 5 security and domain cutover

The release uses `https://dibs.here` as its only canonical origin. Pages middleware and the Worker redirect alternate hosts with status 301 and preserve paths/queries. Static files, Functions, API responses and errors share HSTS, strict CSP (no inline/eval), COOP and the other security headers. The identity cookie is HMAC-signed, Secure, HttpOnly, SameSite=Lax and host-only. Admin bearer tokens are cryptographically compared; invalid credentials return 404, ten failed attempts lock an IP hash for 15 minutes, and authenticated access is limited to 60 requests/minute. Share/arrival logging allows 30 requests/minute per IP hash. Rate state is private, expires after inactivity and is cleaned by the Durable Object alarm.

All state-changing clients, including CLI admin tools, must send `Origin: https://dibs.here`; localhost is accepted only with LOCAL_TEST on a loopback request. Tokens belong only in the Authorization header. Turnstile verification checks both the canonical hostname and `claim` action. Persisted user input is bounded and D1 data values are bound parameters; reusable SQL fragments contain only static source text.

**Round 6 supersedes the old cutover handoff.** Production Worker/Pages now run the canonical release, both custom domains are attached, and the zone is active. Apex and www point to `dibs-7hz.pages.dev`; Full (strict) SSL and Always Use HTTPS are configured. TLS issuance completed and both hosts were verified live. The category workflow now uses `https://dibs.here/api`. Run `npx tsx scripts/verify-round6-live.ts` to check current TLS/canonical status; see the ignored morning report for live results.

`npm run test:e2e` builds an isolated fixture bundle in `.tmp/e2e-dist`; normal builds still remove all fixtures. Tests enforce CSP violations as failures. The test server authorizes only the exact inert `body {}` stylesheet that Playwright WebKit injects for screenshots, using a SHA-256 hash. Production CSP has no such exception. `scripts/verify-security-browser.ts` separately checks the exact production policy without screenshots, including real Turnstile with Cloudflare's official dummy key. Evidence is in `review/round5/`; Firefox runs on Linux CI because this Mac cannot launch the installed Firefox.


## Round 6: practice, house words and golden tickets

Practice: https://practice.dibs-7hz.pages.dev. This unlisted, noindex preview is not password protected. It binds only to `dibs-api-staging`, `dibs-db-staging` and independent Durable Objects. It uses independent cookie/admin credentials, a permanently open PRACTICE copy of Animals, and conspicuous practice labels on pages and exported certificates. The existing Turnstile widget allows the practice hostname as well as production. No remote test bypass is enabled.

Reset practice from this folder (then refresh the phone). These commands read the separate staging credential; production rejects the reset route:

```sh
set -a
source .dev.vars.staging
set +a
DIBS_API=https://practice.dibs-7hz.pages.dev/api npx tsx scripts/admin.ts practice-reset
```

`DROP_TIME_LOCAL` and `DROP_TIME_ZONE` live in `shared/config.ts`. Builds read optional `DROP_TIME.txt` (`21:00` or `9:00 PM`) through `scripts/configure-drop.ts`; the default is 21:00 America/Toronto. This drives scheduling, rollover, countdown and share copy. The hourly cron runs at the configured minute so DST requires no manual UTC change. Deploy both environments after changing it; published category timestamps remain explicit D1 records and need an audited future-only reschedule.

`scripts/build-house-words.ts` ranks every catalog by measured mean daily Wikipedia pageviews, with display-name tie breaks. The resulting ten names live only in the Worker bundle. `house_words` contains no player identity or claim. Guesses consume ordinary atomic strikes, reveal that one house entry and use the registry-blue stamp. Pool counts subtract house words; they never inflate player, claim or ledger counts.

At a drop, `daily_specials` stores a random 256-bit server seed, three unbiased draws without replacement from non-house answers, the list's SHA-256 commitment and its filing time in one D1 batch. Competing cold starts use INSERT OR IGNORE and re-read the winning commitment. No public endpoint returns the seed or unclaimed golden IDs. The archive reveals the exact canonical UTF-8 payload after the next drop; it never invents a proof for a missed drop. Archive details load one selected day at a time to stay within Free Worker query limits. Independently verify a closed register with:

```sh
npx tsx scripts/verify-golden.ts animals
```

All public autocomplete catalogs were removed because they contained unclaimed golden answers. The input still accepts the full verified answer set and aliases. Golden claims carry a star through events, reload, summary share text and the ledger; certificate and PNG stamps use the gold palette, with reduced-motion and static SVG fallbacks.

Validation and screenshots: `review/round6/`, `review/final/r6-*`. Use `npm test`, `npm run test:e2e`, and `npx tsx scripts/verify-round6-live.ts`. Live phone verification still requires a human to complete Turnstile when it requests interaction. Never bypass the widget or create test players in production.
