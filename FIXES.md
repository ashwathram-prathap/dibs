# FIXES.md: round 2 (owner review, Nov 21)

> **Running overnight, unattended:** I'm asleep, so don't stop to ask questions. Make reasonable calls and log them in the report.
> **The remote D1 free quota is exhausted until Nov 21, 7 PM Toronto.**
> - Do all development and testing against local D1 (`wrangler dev --local`).
> - Deploying Pages and the Worker code is fine.
> - Do NOT run remote D1 migrations or remote D1 queries before the reset, and don't retry them in a loop.
> - Write any pending remote steps as exact commands under "Run after 7 PM" in the report.

Work through these in order. Commit and push after each item, with messages prefixed `R2:`. Re-run the Playwright screenshot loop and the anti-AI checklist after every UI change. Add a short "Round 2" section to MORNING_REPORT.md at the end.

## 1. Make the game instantly obvious (top priority)

A first-time visitor on a phone must understand the game and be able to play within 5 seconds, **without scrolling**. Right now they can't.

**Above the fold at 390×844, show only:**
- the wordmark
- **Today's category:** ANIMALS (huge)
- **One plain-English rule line:** "Name an animal nobody has claimed yet. First to call it owns it today."
- **The input,** focused-ready, with a placeholder example such as "try: axolotl", and the CALL DIBS button
- **A tiny live strip:** "2,399 still up for grabs · last claim 2 min ago". Real numbers only.

**Add a 3-step "How it works" strip** just below the input, with one short line each, styled as form boxes:
1. Type a [category item].
2. If nobody has it, it's yours.
3. Share your certificate.

**Move below the fold, or after the first claim:**
- the handle and re-roll box
- the registry jargon (FORM C-1, REG. date, "Application for temporary ownership")

Keep the registry style, but make the words plain. Jargon is decoration, never instructions.

**The "taken" message must explain in one line:** "Someone already called dibs on X (Rust Finch #12). Try another."

**When no category is open** (the closed office), say plainly: "The next category drops tonight at 9 PM ET. Come back to call dibs." Also show the countdown and an example of how the game works.

**Test it:** write a Playwright test that loads a fresh page at 390×844 and asserts that the category, rule line, input and CALL DIBS button are all in the first viewport.

## 2. Remove schools completely

- Delete the school picker, the Schools page and nav item, the ledger school column, school data on certificates and OG images, and all related API and DB usage.
- Add a migration that drops or ignores the column.
- Leave no "rep your school" prompt anywhere.

## 2b. Never look dead (honestly, with no fake players)

Never fabricate players, claims, handles or counts. Instead, design the low-traffic states so they look intentional and inviting:

- **Ledger with fewer than 10 claims:** don't show a big empty table. Show a compact "First filings" card listing the real claims so far, with each slot shown as an open, numbered line ("No. 0004 — open").
  - Headline the pool instead: "2,399 animals still unclaimed. Be early."
  - Being early is the selling point.
- **Archive:** list only days that had at least one claim. Before any day has closed, show one handsome sample page clearly titled "SPECIMEN — how a filed day looks", with an obvious SPECIMEN watermark across it.
  - Specimens are allowed only when they're unmistakably labelled as examples, never mixed into real records.
- **Counts:** never show "0 players". Show the open pool and the countdown instead.

## 3. Stamp text readability

The `DEEP CUT · REGISTERED` text inside the stamp is unreadable. Make it at least 9px at 390px wide and at least 18px in the 1080 PNG exports, or drop it and use a separate, legible DEEP CUT mark.

## 4. One logo everywhere

Use the lowercase `dibs.` wordmark with the vermilion block in the header, footer, certificate, OG image and favicon. Remove `DIBS/`.

## 5. No localhost on certificates

- Every certificate, PNG export, OG image and share text uses a single config value `PUBLIC_ORIGIN`. For now that's `dibs-7hz.pages.dev`.
- Add a test that fails if any export or OG image contains `127.0.0.1`, `localhost` or `5173`.

## 6. Run cheaply: stay on free tiers at 10,000 daily players

- **No player traffic should hit D1 directly for reads.**
  - Serve `/api/today` and `/api/ledger` from the Workers Cache API with a shared cache key. Each region then hits D1 at most once every 10 seconds, no matter how many players are watching.
  - Claims are the only per-player D1 writes.
- **Poll the ledger every 15 seconds,** then 60 seconds after 2 minutes. Stop when the tab is hidden, and refresh immediately after the player's own claim.
- **Serve static assets from Pages only,** with long cache headers (free and unlimited). Fonts are subset WOFF2. The total first-load payload is under 300 KB, excluding the noise PNG.
- **Generate OG images once per claim and cache them.** Never re-render on every request.
- **Report the Workers requests and D1 rows per day** at 100, 1,000 and 10,000 players against Cloudflare's current free limits, citing the docs. If any number crosses a limit, redesign until it doesn't.

## 6b. Free-tier safety (before any real traffic)

- **Measure the D1 rows read and written per action:** page load, one ledger poll, one claim, one certificate view. Put them in a table.
- **Project daily usage at 100, 1,000 and 10,000 players,** each keeping the page open for 5 minutes, against Cloudflare's current D1 free limits. Cite the docs page.
- **Make polling cheap:**
  - Poll only for new rows (indexed `claim_no > since`).
  - Back off to every 15 seconds after 2 minutes, and pause when the tab is hidden.
  - Serve `/api/today` counts from a cache refreshed at most every 10 seconds.
- **If D1 is over quota,** show a clerk-voice "Registry closed for the day" page, never a raw 503.
- **Explain why the quota was hit tonight,** and make the category upload script batched so that doesn't happen again.

## 7. Cleanup (last step, after everything passes and is pushed)

Delete the large downloaded and generated files that aren't needed to run or rebuild the project. First list everything with its size, then delete:
- `.category-cache/`
- `test-results/`
- `review/devices/`, plus any other large raw capture folders. Keep `review/final/`, `review/index.html`, `review/categories.md` and `ACCEPTANCE.md`.
- `dist/`
- `node_modules/` (it's restored with `npm install`)
- Playwright's downloaded browsers: `npx playwright uninstall --all`, or delete `~/Library/Caches/ms-playwright`

Report the disk space freed. Only delete inside this project folder, apart from the Playwright browser cache.

## Do not

- Don't approve or schedule any category. They stay drafts for my review.
- No custom domain, plan or billing changes, and no posting anywhere.
- Never commit secrets or MORNING_REPORT.md.
