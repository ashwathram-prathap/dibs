# FIXES-R5.md: HTTPS and security hardening (run AFTER Round 4 is tagged `r4-done`)

> OVERNIGHT.md rules apply: `R5:` commits, push regularly, tag `r5-done`, and add a "Round 5 security" section to MORNING_REPORT.md that includes a pass/fail table.
> If a step needs a Cloudflare dashboard setting that wrangler can't change, don't work around it. Write the exact click path under "Owner steps" in the report.

## 0. Connect the custom domain first (it was skipped in Round 3, and Round 4 didn't include it)

`DOMAIN.txt` contains `dibs.here`. The owner bought it at Porkbun.
- Add `dibs.here` (and `www.dibs.here`) to the Cloudflare account and to the Pages project as custom domains.
- If the zone isn't on Cloudflare yet, create the zone and put the two Cloudflare nameservers it assigns under "Owner steps", with the exact Porkbun click path (Domain Management, then NS, then replace with the Cloudflare nameservers). Then continue with every other step that doesn't need DNS to be live.
- Set `PUBLIC_ORIGIN=https://dibs.here`, add `dibs.here` to the Turnstile hostnames, and redeploy.
- Once DNS is active, verify that certificates, OG images and share text all use dibs.here. If DNS isn't active by the end of the run, write the exact verification commands for the owner.

## 0b. Private practice copy for the owner to play-test before launch

- Deploy a separate **staging** environment: its own D1 database (`dibs-db-staging`), its own Worker and a Pages preview branch URL. The Worker and preview URL are marked noindex.
- It has a **PRACTICE** category (Animals, a copy) that's always open, with a large `PRACTICE — NOT THE PUBLIC RECORD` banner. Staging data never touches production.
- Add an admin-only staging reset command so the owner can clear practice claims and replay.
- Put the staging URL at the top of the report, so the owner can test the full flow on a real phone today.

## 1. HTTPS everywhere

- **`https://dibs.here` and `https://www.dibs.here`** both serve over valid TLS. `www` redirects (301) to the apex.
- **Every `http://` request redirects (301) to `https://`,** on the apex, on `www` and on `dibs-7hz.pages.dev`. In the zone, turn on "Always Use HTTPS" and set SSL mode to "Full (strict)".
- **`dibs-7hz.pages.dev` and the workers.dev URL redirect (301) to `https://dibs.here`,** with the path kept, so there's one canonical address. Canonical link tags and OG URLs all point to dibs.here.
- **HSTS:** send `Strict-Transport-Security: max-age=31536000; includeSubDomains` from the app headers. Don't add `preload` yet; note it as an owner decision for later.
- **No mixed content:** every asset, font, API call and OG image URL is https and same-origin.

## 2. Security headers (Pages `_headers` plus Worker responses)

- **A strict `Content-Security-Policy`:**
  - `default-src 'self'`
  - Allow `challenges.cloudflare.com` only where Turnstile needs it (`script-src`, `frame-src`), plus the Cloudflare Web Analytics beacon if it's enabled.
  - No `unsafe-eval`. Avoid `unsafe-inline`; use hashes or nonces if anything inline is unavoidable.
  - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: deny camera, microphone, geolocation, payment and USB.
- `Cross-Origin-Opener-Policy: same-origin`
- Each header must be checked so it doesn't break: Turnstile, share/download, fonts, OG images and the live updates (WebSocket `connect-src` to its own origin over `wss:` only).

## 3. Cookies and sessions

- The identity cookie is `Secure; HttpOnly; SameSite=Lax`, scoped to `dibs.here` with `Path=/`, and HMAC-signed. Rotate it on suspicion.
- Never put identity or admin tokens in URLs or local storage.

## 4. API hardening

- **CORS:** allow only `https://dibs.here` (and localhost in dev only). Reject other origins on state-changing routes, and check the `Origin` header on POST requests.
- **Turnstile:** the production widget's hostnames are `dibs.here` only. Verify the `hostname` returned by siteverify on the server and reject a mismatch.
- **Validate every input:** length limits, an allow-list of characters, and parameterized D1 queries only. Grep the code to confirm there's no string-built SQL.
- **Rate limits** on claims and strikes (already present). Also add limits to admin routes and share-event logging.
- **Admin:**
  - The token goes in the `Authorization` header only, compared in constant time.
  - Admin routes return `404` (not `401`) without the right token.
  - Lock out for 15 minutes after 10 failed attempts per IP hash.
- **Errors:** no stack traces or internal messages in responses. Return generic clerk-voice errors.

## 5. Secrets and dependencies

- **Scan the full git history for secrets** (gitleaks or an equivalent). If anything ever leaked, rotate that secret with `wrangler secret put`, report it, and never rewrite history without owner approval.
- **Dependencies:** `npm audit` with zero high or critical issues. Pin versions and keep the lockfile committed.
- **No third-party scripts** besides Turnstile and Cloudflare Web Analytics.

## 6. Verify and report

- **curl checks:**
  - `http` returns 301 to `https`
  - `pages.dev` returns 301 to `dibs.here`
  - all headers are present on `/`, on a certificate page and on `/api/today`
- **Run the full Playwright suite** with the new CSP and confirm no CSP violations appear in the console.
- **Write the pass/fail table** to the report. Under "Owner steps", list any dashboard clicks the owner has to make: Always Use HTTPS, SSL Full (strict), and Web Analytics.

## Do not

- Don't post anything.
- Don't make the repo public.
- Don't change plans or billing.
- Never weaken a check just to make a test pass.
