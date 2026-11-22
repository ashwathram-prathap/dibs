# Round 5 acceptance

## Round 5 security

**Implementation and verification complete; production cutover BLOCKED on owner domain/SSL configuration.** The existing Round 4 site/API still serve at https://dibs-7hz.pages.dev and https://dibs-api.dibs-registry.workers.dev. Both dibs.here and www.dibs.here fail TLS handshakes; Pages lists only its default hostname. No dashboard/API workaround, billing change, public repo change, or social posting was made.

Staged Pages: https://r5-security.dibs-7hz.pages.dev (deployment 755bf273) returns a verified 301 to dibs.here with the original path/query and all security headers. Inactive Worker version: **5db708fd-5ed8-4db0-be21-2130b0c32e01**. Production Worker remains d3719e5f-3056-4bde-8968-9ede6dbec90e. Staging avoids redirecting the working preview into a broken TLS host.

| Acceptance check | Result | Evidence / limit |
| --- | --- | --- |
| Apex + www valid TLS; zone Always Use HTTPS + Full (strict) | FAIL — owner blocked | Live TLS fails; HTTP apex returns 307 to HTTP and www redirects to HTTP. Zone settings cannot be verified/configured with Wrangler. |
| Canonical 301s preserving paths/queries; metadata/OG URLs | PASS code/stage; BLOCKED production | Middleware/Worker tests and staged curl; all generated URLs use dibs.here. |
| HSTS and all six security headers on pages/API/errors | PASS code/stage; BLOCKED apex | Strict CSP, nosniff, referrer, permissions, COOP, HSTS. Static _headers and dynamic responses match. |
| CSP compatibility / mixed content | PASS | 462 distinct browser checks, zero app CSP violations; exact production-policy filing/fonts/PNG + real Turnstile passed in Chromium and WebKit. Assets/API/OG same-origin; only permitted external scripts. |
| Cookies / token handling | PASS | Signed host-only cookie, Secure + HttpOnly + SameSite=Lax + Path=/; tampering rejected. No admin/identity tokens in URLs/storage. No secret leak found, so no rotation needed. |
| Origin/CORS + Turnstile hostname/action | PASS | Missing/foreign origins rejected on writes and live sockets, including admin; canonical Origin only (loopback dev exception). Real siteverify mismatch/valid-result server tests. |
| Widget production hostnames | BLOCKED until cutover | Current widget still allows Pages + localhost so the active release keeps working. Change to dibs.here only in release commands below. |
| Input validation / parameterized D1 / generic errors | PASS | Bounded bodies, IDs, Unicode text, aliases, query values, socket messages, provenance; all 30 catalogs pass. SQL audit found only static query fragments; retention offsets now bound too. |
| Admin concealment, constant-time check, lockout; event limits | PASS | Crypto verification; 404 without valid token; 10 failures lock IP hash 15 min; 60 authenticated admin/min; 30 share/arrival events/min per IP hash; concurrent tests pass. Existing claim/strike limits pass. |
| Full-history secrets + pinned dependency audit | PASS | Gitleaks plus exact scan of three local secret values: no leaked credentials. Five generic hits were catalog SHA-256 keyDigest fields. Zero npm vulnerabilities; exact versions + lockfile. |
| Build, Worker/Pages compilation, server/unit tests | PASS | Type/build checks; 45/45 tests, including real D1, Durable Objects, WebSockets, moderation and previews. Production bundle contains no fixtures. |
| Browser/device suite / final visual review | PASS | 396 local Chromium/WebKit + 66 Firefox Linux = 462/462; light/dark and all configured widths/devices. review/round5/devices.md and review/final/. |
| Lighthouse mobile Slow 4G | PASS | 95 performance / 100 accessibility on compiled local fixture build. Live custom-domain run waits for TLS. |
| Live canonical acceptance | FAIL — owner blocked | 1/11 current live checks pass. Real certificate/summary production checks also wait for genuine records; no fake claims created. |

**Decisions I made:** R5's explicit domain request supersedes the old no-custom-domain instruction. Kept working production active until TLS is ready. The cookie is host-only (narrower than Domain=dibs.here). WebKit's screenshot engine injects an inert body {} style: only the isolated test server grants that exact SHA-256 hash; production remains style-src 'self'. Separate screenshot-free tests use the exact production policy. Analytics remains disabled; its permitted domains are ready if enabled. HSTS has no preload: submitting to preload is a later owner decision. Rate-limit storage adds writes; previous free-tier capacity estimates should not be treated as unchanged.

### Owner steps

1. **Attach domains:** Cloudflare dashboard → account → Workers & Pages → dibs → Custom domains → Set up a domain → dibs.here → Continue; repeat for www.dibs.here. If needed first add dibs.here as a Cloudflare zone and use its assigned nameservers at the registrar. Wait for both custom domains/certificates to be Active. [Cloudflare domain guide](https://developers.cloudflare.com/pages/configuration/custom-domains/).
2. **SSL:** dashboard → dibs.here zone → SSL/TLS → Overview → choose Full (strict); then SSL/TLS → Edge Certificates → Always Use HTTPS → On. These dashboard settings were deliberately left to you per FIXES-R5.md. [HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/), [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
3. **Analytics (optional):** dashboard → Workers & Pages → dibs → Metrics → Web Analytics → Enable, then redeploy. Do not also add the manual VITE_CF_ANALYTICS_TOKEN beacon or events may be duplicated. Leaving analytics disabled is valid. [Pages analytics guide](https://developers.cloudflare.com/pages/how-to/web-analytics/).
4. **Coordinated cutover, after TLS works:** run the commands below from this folder. Update the category workflow's temporary DIBS_API override to https://dibs.here/api at the same time. The Turnstile update may print widget data, so its output stays in an ignored local file. No secret changes are required.

```sh
set -e
mkdir -p .tmp
npx tsx scripts/verify-domain-ready.ts
npx wrangler turnstile widget update 0x4AAAAAAGLNsW8c9WxZVAxQ --domain dibs.here --json > .tmp/cutover-turnstile-secret.json
npx wrangler versions deploy 5db708fd-5ed8-4db0-be21-2130b0c32e01@100 -c worker/wrangler.jsonc --yes
npm run deploy:web
DIBS_WORKER_URL=https://dibs-api.dibs-registry.workers.dev npx tsx scripts/verify-round5-live.ts
```

Run commands sequentially and stop if the preflight fails. Once a genuine certificate exists, check its HTML/PNG, share/download and live wss updates on your phone. Keep HSTS preload off unless you explicitly choose it later. Secrets created/rotated this round: **none**; the existing ADMIN_TOKEN above remains unchanged. Screenshots/recording: review/final/; compact sheets: review/round5/contact-sheet-390.png and contact-sheet-1440.png. Visual checklist passed; the least expressive screens remain mobile Office notice (long), blank Office figures, and empty Archive.
