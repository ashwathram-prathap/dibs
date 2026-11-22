# Dibs launch runbook

**Freeze:** no production deploys from Monday November 23, 2026 at 6 PM ET through Tuesday November 24 at midnight ET (23:00Z–05:00Z). Both npm production deploy commands enforce this window. Direct Wrangler commands must obey it too.

## Monday, 6 PM ET

- Read `review/coverage/catalog-report.md` and the Round 8 report. Animals must accept every obvious fixture; no incomplete reference or ranking job counts as passed. Check 50 independent mid-popularity examples and record misses.
- Confirm https://dibs.here/api/today shows the expected next drop (9 PM ET), with no stray practice banner or mock claims. Check the live catalog version, actual answer count, ten measured house words and newly drawn commitment in the authenticated register report.
- Open production in Safari and an in-app browser. Do the actual claiming checks on **practice only**, including recovery in another browser, one typo, one house strike, and one failed-network retry. Never reset production.
- Check the latest `.backups/last-success.txt`; make a fresh private export with `npm run backup`. The backup folder is gitignored and mode 700; SQL files are mode 600. Confirm the Mac is awake/logged in for the 5:30 AM local nightly task (`launchctl print gui/$(id -u)/here.dibs.backup`). A service loaded from this project runs while the login session exists; after a reboot reload `launchctl bootstrap gui/$(id -u) ops/dibs-backup.plist`.
- Check `/stats` using the existing admin token, especially claims, active claimers, missing-answer counts and errors. Do not paste the token into a URL. Verify keyboard focus, large result text and light/dark contrast.
- Capture the Worker deployment ID and Pages production deployment in Cloudflare. Freeze releases until midnight. If a gate is red, pause the affected day; do not silently declare it ready.

## Pause a day

Use the authenticated `POST /api/admin/pause` with `{ "id": "animals" }` (replace with the exact register ID). It changes the category to draft, closes new filings and invalidates live caches. Claims and identities remain stored. Read `/api/today` again after the ten-second public cache expires. Reopening requires the explicit coverage-gated approve procedure and a future date; never delete player rows. No pause was executed during R8 because the owner said to preserve the schedule.

## Void an abusive claim

Read `/stats` and the ledger, identify the exact claim UUID, then run `ADMIN_TOKEN=… npx tsx scripts/admin.ts void-claim <uuid>` with the token supplied privately through the environment, not command history. Prefer loading the value from `.dev.vars` in a private local script. This marks the claim void and redacts public previews; it never erases the player identity. It intentionally does not release the answer for another player that day.

## Roll back a release

Before changing production, read `review/round8/production-deployments-before.txt`. Run `npx wrangler deployments list -c worker/wrangler.jsonc`, then `npx wrangler rollback <known-good-version-id> -c worker/wrangler.jsonc`. In Cloudflare Pages → dibs → Deployments, select the previous successful production deployment and choose **Rollback to this deployment**. Roll back both the Worker and Pages to a compatible pair. Additive columns from R8 may stay in place; do not roll back player data to roll back code. During the freeze, pause a day if necessary and investigate without deploying.

## Private backups and restore

`npm run backup` exports the entire production D1 schema and rows, including claims, strikes, users, hashed recovery keys, category references and commitments. It retains 30 days. `.backups/` must never be committed or uploaded publicly.

For a recovery rehearsal, restore into a separate empty local database first:

```sh
npx wrangler d1 execute dibs-db --local -c worker/wrangler.jsonc --file .backups/production-<UTC timestamp>.sql
```

An SQL export is intended for an empty database, not a live database with tables already present. Verify counts and foreign keys before switching traffic. Never drop production tables to make an import work.

Cloudflare D1 **Time Travel is always enabled on the Free plan for seven days**, at no extra cost. Read the current or historical bookmark:

```sh
npx wrangler d1 time-travel info dibs-db -c worker/wrangler.jsonc
npx wrangler d1 time-travel info dibs-db -c worker/wrangler.jsonc --timestamp '2026-11-23T17:59:00-05:00'
```

For an owner-authorized disaster restore, pause traffic first and run:

```sh
npx wrangler d1 time-travel restore dibs-db -c worker/wrangler.jsonc --bookmark '<verified bookmark>'
```

This overwrites the database to that point, cancels in-flight queries and can lose later claims. Record the undo bookmark printed by Wrangler. No production restore was run during R8. Documentation: https://developers.cloudflare.com/d1/reference/time-travel/

## Search Console (owner)

1. Sign into Google Search Console with the Google account that should own the property.
2. Add property → **Domain** → enter `dibs.here` (no scheme or path).
3. Copy Google's exact `google-site-verification=…` TXT value.
4. Cloudflare dashboard → select `dibs.here` → DNS → Records → Add record → type TXT, name `@`, content the full Google value, TTL Auto → Save.
5. Return to Search Console and click Verify. If propagation has not finished, retry later; keep the TXT record permanently.
6. In that property → Sitemaps → submit `https://dibs.here/sitemap.xml`.
7. Inspect `https://dibs.here/` and `/about`, then request indexing. Closed-day archive URLs are added to the sitemap automatically. Do not submit the practice site or certificate URLs.
