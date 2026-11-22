# FIXES-R14: points, a live leaderboard, streaks and an instant payoff (ship to production)

> **Owner decision (Sun Nov 22, 3:23 PM ET):** a friend playtested and said that after a claim nothing happens, there's no reason to compete, and it's bland. Build the four parts below. Run this **after R13 has finished**. Test on practice, then ship to production with the FIXES-R12 section 5 commands, rollback point and smoke test. Production still opens **Mon Nov 23, 9:00 PM ET**. Hard stop: **if it isn't fully passing by Mon Nov 23, 3:00 PM ET, don't deploy it to production.** Leave production on R13 and report. OVERNIGHT.md rules apply. **No fabricated players, scores or entries anywhere.** At most one ntfy alert.

Keep R12's plain copy rules and R13's hero, type sizes and sounds. Every new string is short and plain.

## 1. Points: instant and real
- **Score each claim on the server at claim time** from how obscure the answer is **within today's category**, using the popularity data we already have (Wikipedia pageviews or the house-word ranking). Use the percentile rank within the category's catalog:
  - the most popular 10% score **10**
  - then it scales smoothly up to **100** for the most obscure
  - round to 5
  - answers with no popularity data get the category's median score (not 0, not max)
- **Golden ticket:** +100 bonus. **Each strike:** −10. The day's total is never below 0.
- Store the points on the claim row so they never change after the fact. Recompute nothing client-side, and never trust client input for points.
- Document the formula in one plain line on the FAQ: "Rarer answers score more. Golden tickets +100. Strikes −10."

## 2. The payoff right after a claim (the friend's first question)
Directly under the stamp, in the hero area:
- **"Yours. Okapi has your name on it for good."**
- **"+60 points · rarer than 94% of animals"** (the real percentile)
- **"2 claims left · 4 strikes left"**
- One line: "The full board and golden tickets reveal when the day closes." Show the close time in local time, with the Remind me menu.
For a strike: "Taken. −10 points. 4 strikes left." For Reserved: "Reserved (too obvious). −10 points."
When done (3 claims or 5 strikes): the hero shows the total, "**140 points · #3 of 27 today**", then the certificate.

## 3. A live leaderboard with answers hidden
- A "Today's leaderboard" section, also reachable from the header: rank, handle, points, number of claims, and a gold marker if they found a golden ticket. **Never show anyone's answers before the day closes** (keep the no-peek rule; add tests on the API, HTML and socket).
- Show the top 25 plus the player's own row if they're outside it. Ties are broken by who reached that score first.
- Real players only. Empty state: "No scores yet. Be first." Founder and Withdrawn filer rules from earlier rounds still apply. Hidden or voided users are excluded.
- After close, the board stays as the final result, and the answers appear in the ledger as before.
- Cache leaderboard reads for 15 to 30 s (or push via the existing Durable Object socket with backoff) so a 9 PM rush stays well inside the free tier. Estimate the D1 reads and writes at 10k players a day in the report.

## 4. Streaks
- A streak counts consecutive drops on which the player made at least one claim. Show "Streak 3" (no emoji) in the header next to the player's handle, and on the certificate.
- Missing a day resets it to 0. It uses the drop's date in America/Toronto, so timezones can't game it.

## 5. Certificate, share and archive
- The Day Certificate and share text include the points, rank and streak: "Dibs, Animals: 140 pts, #3 of 27, streak 3." Spoiler-free (no answers) until the day closes, as before.
- The archive shows each past day's final leaderboard top 10.

## 6. Verify, then ship
1. Unit/API tests: scoring (percentile edges, missing data, golden, strikes, the 0 floor), ties, no-peek, streak across DST and midnight, the deleted-user leaderboard, the founder and the cache.
2. The Chromium/WebKit matrix plus the R13 hero device matrix still pass with the new panels (390x844: the post-claim payoff is visible without scrolling).
3. Screenshots in `review/round14/` of: the post-claim payoff, a strike, the done hero, the leaderboard (empty and populated with practice test players created by the test, labelled as practice), the certificate and the share card.
4. **Load test, practice only, after 7:05 PM ET** (the D1 daily reset): refresh account-wide D1 usage first. Only if the estimate leaves at least 30% of the daily writes, run 200 virtual players in 60 s with leaderboard polling. Report the p50, p95 and errors, and whether one winner held. This is needed before the 10k-member post on Wednesday. If there isn't headroom, say so.
5. Deploy practice, then production (subject to the 3:00 PM Monday stop rule), with the smoke test and rollback. Commit, push, tag `r14-done`, and put a short report at the top of MORNING_REPORT.md.
