# FIXES-R12: clarity pass, then ship to production (short round)

> **Owner decision (Sun Nov 22, 2:11 PM ET):** ship this round to **production** (dibs.here) and practice as soon as the tests below pass. The owner accepts the two blocked R11 infrastructure gates (ntfy quota, deployed load test). **Do not edit `review/round11/release-gates.json` or mark any gate passed.** Deploy with the direct commands in section 5. Keep production's first drop at **Mon Nov 23, 9:00 PM ET** (`LAUNCH_DATE`, `DROP_TIME`). Do not open production early. OVERNIGHT.md rules apply. Hard stop: no production deploy after Mon Nov 23, 5 PM ET.

Context: the owner's father opened dibs.here on a laptop and **could not tell what the game is or what to do**, and did not understand "file key". The real test for this round: **a parent in their 50s who has never played Wordle understands the game in 10 seconds, on the closed screen and on the live screen.**

## 1. Clerk notes must not state fake facts
`shared/moments.ts` notes like "Someone always takes the axolotl first." and "Nobody ever claims Mississauga." describe player behaviour that hasn't happened. That's fabricated, and it also nudges guesses. Rewrite every note so none claims anything about players, popularity or what gets taken, and none names a likely answer in its category. Keep them dry and short. Add a test that fails if a note contains "always", "nobody", "everyone", "someone", "first" or names an answer from its own category's catalog.

## 2. Say what the game is, plainly, above the fold
On **every** state (closed, live, done) the first thing under the wordmark is a plain 2-line explanation in normal sentence case, at least 18px on desktop:
- "One category a day. Name something in it that nobody else has claimed. If you're first, it's yours, and your name goes on it for good."
- "You get 3 claims. Each guess someone already took costs a strike (5 max)."
Under it is a short worked example in full sentences, labelled "Example", with no arrows, no fake player names and no shorthand:
> **Example:** Today's category is **Animals**.
> You type **Okapi**. Nobody has claimed it yet, so **it's yours**.
> You type **Lion**. Someone already claimed it, so you get **a strike**.
Show it as three short lines, the outcomes in the stamp style (vermilion "YOURS", grey "TAKEN"). The owner must be able to read it in one glance. Don't use arrows or a compressed format.

Brand words (Registrar, Office, filed, ledger) can stay in headings and flavour text, but **every button, instruction, error and label uses plain words**: "Claim it" or the existing CALL DIBS plus a plain subline, "Taken", "Reserved (too obvious, nobody can claim it)", "Your claims", "Today's results".

## 3. The closed screen (what Dad saw)
Before the first drop, and between drops, the closed screen must:
- lead with the 2-line explanation (section 2) and the example
- say when it opens in plain words with the countdown: "The first category opens **Monday at 9:00 PM** your time (in Toronto time it's 9:00 PM ET)." Show the correct weekday from the single schedule source.
- have one clear action: "Remind me" (the menu from R11)
- not lead with archive, office, privacy or certificate jargon.

## 4. Rename "file key" everywhere the user sees it
Rename it to **"backup code"**, with a one-line explanation wherever it appears: "Use this code to get your claims back on another device or browser." Update App.tsx (settings disclosure "Backup code & settings", the restore label, the "Your backup code" panel, the privacy and FAQ text, delete-my-file text), `shared/seo.ts`, the Office/privacy page and all tests. Internal names and the admin CLI can stay. Old keys keep working.

Run a jargon audit of all user-facing copy and list any term a first-time visitor wouldn't know, with what you changed it to, in the report.

## 4b. Accuracy: every claim on the site must be true
- **Rules copy comes from the code.** Number of claims, strikes, golden tickets per day (10 in launch week, then the normal number), drop time and the close time are read from `shared/config.ts` and never typed into copy. Add a test that fails if any page, FAQ, OG/meta text, share text or reminder says a different number or time.
- Explain once, plainly: what happens after 3 claims or 5 strikes (you're done for the day, here's your certificate), when today's category closes, what a golden ticket is (one line), and what "Reserved" means.
- Share text, OG/meta descriptions and the reminder text use the same 2-line explanation. No "registry" jargon in the first sentence of any of them.
- Remove anything that's not true or not built: stale practice-rehearsal times (practice was moved to Sun 2:30 PM), numbers or stats that aren't live, and mentions of features that don't exist.
- Spot-check dibs.here in the Instagram and LinkedIn in-app browsers (emulated): the page loads, Turnstile shows, and it's playable.

## 4c. Brevity
Cut every block of copy to the fewest words that stay clear. Targets: the explanation is 2 sentences; any FAQ answer is at most 2 sentences; buttons are 1 to 3 words; errors are 1 sentence saying what happened and what to do. Delete anything repeated. Put a before/after word count per screen in the report.

## 5. Verify, then ship
1. Unit/API tests, the Chromium/WebKit browser matrix, the Lighthouse mobile run, and the "first visit" closed→live test on practice. All must pass.
2. Screenshots in `review/round12/`: the closed screen and the live screen at 390px and 1440px, light and dark, before/after.
3. Deploy practice with the usual staging commands.
4. Deploy production with:
   `npx tsx scripts/check-deploy-freeze.ts --production && npx tsx scripts/configure-drop.ts && npx tsx scripts/build-house-words.ts && npx wrangler deploy -c worker/wrangler.jsonc && npm run build && npx wrangler pages deploy dist --project-name dibs`
   Record the rollback point (previous Pages deployment and Worker version) first.
5. Production smoke test (read-only, closed state): dibs.here loads on desktop and phone widths, shows the new explanation, says Monday 9:00 PM ET, the Remind me menu works, dark mode works, and there are no console errors. **If it fails, roll back immediately.**
6. **Load test, practice only, after 7:05 PM ET** (when the D1 daily writes reset): refresh account-wide D1 usage first. Only if the estimate fits with a wide margin, run the committed 200-player guarded test with test Turnstile keys, then restore real keys. Do not run it if it would leave less than 30% of the daily writes for production. Report the p50, p95 and errors, and whether one winner held. If you can't wait until then, skip this step and say so.
7. **ntfy:** send at most one alert this round (the final one). The daily quota ran out in R11.
8. Commit, push, tag `r12-done`, and write a short report at the top of MORNING_REPORT.md: what shipped, the rollback IDs, the jargon table and anything the owner must do.
