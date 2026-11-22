# FIXES-R3.md: round 3 (owner decisions, Nov 21)

> **Unattended run.** OVERNIGHT.md rules still apply: don't stop to ask, log decisions, push regularly with `R3:` commit messages, and tag `r3-done` at the end. Add a "Round 3" section to MORNING_REPORT.md.
> This run starts after the D1 reset (Nov 21, 7 PM Toronto), so remote D1 is allowed again. Stay within the free-tier budgets in `review/round2/free-tier.md`.

## 0. Finish the Round 2 remote steps first

Run the "Run after 7 PM" steps from MORNING_REPORT.md: `npm ci`, remote migrations, then verify `/api/bootstrap` and `/api/archive`. If D1 still reports a quota problem, stop all remote work, write it up, and do the local-only items.

## 1. New mechanic: 3 dibs, 5 strikes (top priority)

### Rules

- Each player can land up to **3 dibs** per category (per day).
- Each answer still has exactly one owner worldwide.
- **A guess that's already taken costs 1 strike.** After 5 strikes, the player's file is closed for the day, even if they have fewer than 3 dibs.
- **An invalid entry** (not on the register) costs **no** strike. Show the clerk line "Not on today's register. Check the spelling."
- **No rarity score.** That's Krillion's mechanic and we deliberately avoid it. A player's result is **dibs landed (0 to 3) and strikes used (0 to 5)**, for example "3/3 with 1 strike".
- **Ranking for the top-files board:** most dibs, then fewest strikes, then earliest time the file was completed. Speed at the drop is Dibs' identity.
- **Obscurity stays as a fun label only,** on certificates and the DEEP CUT stamp. It's never part of the score or ranking.

### Backend

- Replace `UNIQUE(category_id, user_id)` with an atomic per-user count check of 3 or fewer, in the same transaction as the claim insert.
- Keep `UNIQUE(category_id, answer_id)`.
- Add atomic strike counting, either in a `strikes` table or an attempts log. Write a strike row **only** on a taken guess.
- **Tests:**
  - Parallel requests can never give a user more than 3 dibs or more than 5 strikes.
  - A user with a closed file gets `403`.
  - 50 simultaneous claims of the same answer still produce exactly one winner.
  - Strike and dibs counts survive a reload.
- **Update the free-tier measurements and projections** for the extra writes, and confirm they're still inside free limits at 10,000 daily players.

### UI

- The claim box shows progress plainly: `DIBS 1 / 3` and a row of 5 strike boxes, drawn in the ink style (filled = strike).
- **Each successful dibs** gets the full stamp moment. Keep it under 1.4 seconds, and make the 2nd and 3rd stamps slightly faster.
- **After the 3rd dibs or the 5th strike,** show a **Day summary card**: the 3 answers, dibs X/3, the strike row, the time the file was completed, and a "Next drop" countdown.
- **The summary card is the main share artifact.** It exports as PNG (1080×1350 and 1080×1920). Individual dibs certificates stay available.
- **Share text is spoiler-free** (no answers), Wordle-style, using plain characters: `dibs #12 ■□■■ 3/3 · 1 strike · filed 9:04 PM · <public url>`. Here `■` is a dibs and `□` is a strike, in the order they happened.
- **"How it works"** becomes three lines: "Call dibs on up to 3 [animals]." / "Taken guesses cost a strike. 5 strikes and you're out." / "Fastest clean file wins the day."
- **Add a small "Today's cleanest files" board** below the ledger: the top 10 by the ranking above, with real data only. When there are fewer than 3 players, show "Results post as players file." instead of an empty table.

## 2. Polish

1. On mobile, remove the large blank gap under the claim box. Content should flow straight on.
2. Change "last claim 0 min ago" to "just now" when it's under 1 minute.
3. On the highlighted ledger row, the time text is unreadable red on red. Use ink colour on the highlight.
4. On the certificate, close the empty band between the date and HELD BY, and rebalance the spacing.
5. Cut D1 writes per visit: don't create a user row until the first claim attempt. A visit that only browses writes nothing.

## 3. Categories: all 30 are approved by the owner

- **Upload the remaining 27 categories** in batches that respect the upload write budget. Spread them over as many days as needed, and record the progress in `.upload-state.json`.
- **Schedule one category per day at 9:00 PM America/Toronto, starting Monday Nov 24, 2026:**
  - Nov 24 Animals, Nov 25 Plants, Nov 26 Birds.
  - Then the other 27, ordered for variety (alternate living things, places, people and objects). Never schedule two similar categories back to back.
- **Mark all 30 approved** using the admin approve flow.
- A category may only be scheduled once its upload is fully verified. If a scheduled date would come before its upload finishes, push it back and log that.
- **Until Mon Nov 24 at 9 PM,** the site shows the closed office with a countdown to that drop.

## 4. Custom domain (only if the owner has bought one)

If a file `DOMAIN.txt` exists in the project root containing a domain:
- add it to Cloudflare Pages as a custom domain
- set `PUBLIC_ORIGIN` to it
- add it to the Turnstile widget's hostnames
- redeploy, and verify that certificates and OG images show the new domain

If the domain's DNS isn't on Cloudflare yet, write the exact Porkbun nameserver steps in the report instead.

If `DOMAIN.txt` doesn't exist, skip this section.

## 5. Re-run every check

Run the full Playwright suite, the anti-AI checklist screenshots, and Lighthouse. Show the new mechanic in `review/final/`: mid-game, 5-strike closed file, and day summary. Record one new claim-moment video with 3 dibs and a strike.

## 6. Cleanup at the end

Same as Round 2: remove rebuildable caches, test output, `node_modules`, `dist/` and the Playwright browsers. Report the space freed.

## Do not

- Never fabricate players, scores, claims or counts.
- Don't post or announce anything, don't make the repo public, and don't change plans or billing.
- Never commit secrets or MORNING_REPORT.md.
