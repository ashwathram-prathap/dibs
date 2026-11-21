# Dibs

A daily registry of first-come, first-served claims. React + TypeScript + Vite on Cloudflare Pages; a single Worker with D1 and Turnstile. All fonts are self-hosted. The repository is private.

**Current deployment caveat (November 21):** D1 reported its free-tier daily read limit. The home and static pages work, but archive/schools/admin queries return a clerk message until the reset at **7 PM Toronto, November 21 (midnight UTC)**. See `review/d1-quota.json` and `review/final-api-health.json`. No paid upgrade was made.

The preview deliberately opens with a closed office. The three proposed launch registers are **drafts**, and there are no production claims. Reviewing a category is a separate, explicit operation. Nothing in deployment approves one. Published register dates cannot be moved; create a new draft ID for a later edition.

## Run locally

```sh
npm ci
# Create .dev.vars with COOKIE_SECRET, ADMIN_TOKEN and TURNSTILE_SECRET.
cp .dev.vars worker/.dev.vars
# LOCAL_TEST=true permits test tokens only on localhost / 127.0.0.1.
npx wrangler d1 migrations apply dibs-db --local -c worker/wrangler.jsonc
npm run worker:dev
# In another terminal:
npm run dev
```

For a design proof with clearly labelled, isolated fixtures:

```sh
VITE_DEMO=true npm run dev
```

`VITE_DEMO` is only consulted under `import.meta.env.DEV`. Production builds eliminate the fixture import. Local fixture counts and people are not public records. To exercise real data locally, `scripts/local-register.ts` imports the Animals draft and opens it **only in the local emulator**. It reads the project-local `.dev.vars` for the local admin token. Keep both secret files ignored. The root file and `worker/.dev.vars` must contain the same local values for that script.

## Check and test

```sh
npm run check
npm test
npx playwright install chromium webkit firefox
npm run test:e2e
npx tsx scripts/screenshots.ts review/final
npx tsx scripts/lighthouse.ts
```

The Worker suite runs the actual Worker and SQLite through Miniflare: 50-way contention, double claiming, atomic shared-IP quota, rolling user limits, signatures, time zones, drafts, rerolls, and access controls. The browser suite covers the full flow, both PNG dimensions, accessibility, small screens, tablets, desktop, and both themes. Test fixtures never run against production. `scripts/integration.ts` exercises the real local Worker, database and signed cookie, with only the Turnstile client stubbed. It expects Axolotl to be unclaimed in the local emulator.

Open `review/index.html` for the local visual gallery. Screenshot files, video, Lighthouse reports, and device results are in `review/`. The latest Lighthouse run records its exact QA identity IDs in an ignored file; `npx tsx scripts/cleanup-audit-accounts.ts` removes only those accounts, and preserves any account with a claim. After `scripts/live-review.ts`, use the same cleanup command with the `live` argument. Large per-device PNG captures stay local to keep the private repository small. The final design proofs are committed. The local `MORNING_REPORT.md` includes deployment details and the admin token and must never be committed.

## Category pipeline

```sh
npm run categories                  # all sources
npm run categories -- animals       # one catalogued source
```

`scripts/category-sources.json` is the input catalog. Each entry accepts a Wikidata class/occupation/taxon ID, or `wikiCategoryRoots` containing English Wikipedia category-list names. The builder follows source pagination and PageViewInfo continuation, records article URLs and measured pageview windows, normalizes and deduplicates names, filters sensitive names and disambiguation pages, excludes redirects whose normalized source title differs from the measured article title, and caches requests in the ignored `.category-cache/` directory. An interrupted run is resumable. The automated filter supplements the owner's review; it does not claim to replace it.

Obscurity is based on the average daily pageviews over at least 20 observed days in the last 30: **1 ≥ 1,000; 2 ≥ 200; 3 ≥ 50; 4 ≥ 10; 5 < 10**. Missing measurements are excluded. These are readership bands, not player percentiles. Every answer includes its source and measurements. Scientific and disambiguated titles are retained. Aliases are exact and must be unique within a category.

The final catalog validates **30 registers / 65,846 measured answers**, each at least 2,000. Run `npx tsx scripts/validate-categories.ts` to recheck it.

All files are written as drafts. Only Animals, Plants and Birds have proposed launch dates, at 9 PM Toronto time. The other registers are unscheduled and remain in `categories/` until uploaded for review; only the first three are currently in D1. The review docket is `review/categories.md`. A category below 2,000 scored entries cannot be approved. Source data comes from Wikidata (CC0) and English Wikipedia; each record links to its originating article. Font licenses are in `public/fonts/`.

## Admin procedures

Set `ADMIN_TOKEN` in your shell using the local morning report. Do not put the token in a URL or command argument. `DIBS_API` can override the API base for local use.

```sh
npx tsx scripts/admin.ts upload categories/animals.json
# To correct a draft already uploaded (refuses approved or claimed registers):
npx tsx scripts/admin.ts replace-draft categories/animals.json
# Only after personally reviewing the register; choose a future date:
npx tsx scripts/admin.ts approve animals YYYY-MM-DD
npx tsx scripts/admin.ts hide-user USER_ID
npx tsx scripts/admin.ts void-claim CLAIM_ID
npx tsx scripts/admin.ts stats
```

The `/stats` page accepts the token in a password field and keeps it only in memory. The daily table uses UTC. D1/D7 retention uses exact Toronto registry dates and mature first-claim cohorts; numerator and denominator are shown. School season counts cover all published registers since opening.

Moderation is soft: hiding a user anonymizes their public holder information and blocks new filings. Voiding a claim removes it from public counts and certificates. It does **not** reopen the answer or grant a second daily claim. Serial numbers are never reused. Open counts exclude those reserved slots, and the daily header reports voided filings separately. Identity and school freeze after the first claim so old ledgers cannot be rewritten by changing the holder's name or school. Anonymous accounts are created when a reviewed register is open; pre-launch closed-office visits do not need an identity or database writes. A nullable provider subject is reserved for a future optional sign-in flow.

## Deploy on free Cloudflare services

```sh
npx wrangler d1 migrations apply dibs-db --remote -c worker/wrangler.jsonc
npm run deploy:api
npm run deploy:web
```

Migration `0002_foreign_key_indexes.sql` adds the child-key indexes required for efficient bulk draft replacement. Its two indexes were applied remotely using `d1 execute --file`; normal migration bookkeeping remains blocked by the daily quota. After the reset, rerun the idempotent migration command above. The Worker also ensures the indexes before replacement and during scheduled cleanup at 00:05 and 05:17 UTC. The quota response is HTTP 503 with `Retry-After`; the next midnight UTC is shown in Toronto time. [Cloudflare free-tier limits](https://developers.cloudflare.com/d1/platform/limits/) explain the reset. Three unclaimed anonymous accounts remain from interrupted QA requests; row inspection is currently blocked, so no broad cleanup was performed.

Root `wrangler.jsonc` configures Pages and its `API` service binding. `worker/wrangler.jsonc` configures the Worker, D1 and cleanup cron. The Pages gateway preserves first-party, signed, httpOnly, SameSite=Lax cookies on Safari. The production cookie is Secure. Secrets are provisioned with `wrangler secret put NAME -c worker/wrangler.jsonc` and are never bundled. Never set `LOCAL_TEST` on a remote Worker.

Turnstile checks every claim token with Siteverify, checks its hostname and `claim` action, and never trusts client ownership status. Autocomplete only returns canonical names. Both ownership constraints and serial assignment run atomically in SQLite; database triggers also enforce the IP quota. The raw IP is never written to the database. Its daily HMAC salt is derived from `COOKIE_SECRET`; hashes are scrubbed from old claims and quotas after two days. Attempt timestamps expire through the daily cleanup cron.

Certificate PNGs are rendered with canvas at 1080×1350 and 1080×1920. Unsupported sharing falls back to download, a manual image link, and Copy text. Per-claim OG PNGs use bundled font outlines and resvg; short certificate URLs resolve to the canonical certificate. Draft or voided claims cannot produce public certificates. Extended Latin and Vietnamese subsets are bundled; a separately named OFL supplement supplies three missing orthographic glyphs. `scripts/verify-fonts.ts` checks every original and uppercase catalog name. Accented export proofs are in `review/accents/`.

Cloudflare Web Analytics needs an account token with Web Analytics/RUM permission or dashboard setup. After obtaining the public beacon token, set `VITE_CF_ANALYTICS_TOKEN` in an ignored `.env.local` and rebuild. No beacon is injected without a valid token. The default Wrangler OAuth grant on this machine cannot provision that service.

The preview is **unlisted, not access-controlled**: `noindex` headers and metadata discourage indexing, but someone who knows its default Cloudflare URL can open it. No paid services, custom domains, public GitHub repository, or announcements are part of this delivery.
