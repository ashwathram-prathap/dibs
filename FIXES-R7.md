# FIXES-R7.md: local drop times and a big countdown

> OVERNIGHT.md rules apply: `R7:` commits, push regularly, tag `r7-done`, and add a "Round 7" section to MORNING_REPORT.md.
> Deploy to **practice first**, verify, then production. Don't touch player data, and don't change the drop schedule itself.

## 1. Show drop times in the player's own timezone

- **Detect the timezone** with `Intl.DateTimeFormat().resolvedOptions().timeZone`. This needs no permission, and nothing is stored or sent to the server.
- **Show the next drop in local time:**
  - Show "Next drop: 9:00 PM" in the player's own zone, with a small zone label (e.g. "6:00 PM PT", "2:00 AM GMT", "9:00 PM ET").
  - If the local date differs from Toronto's, show the day too (e.g. "Tue 2:00 AM GMT").
- **Fallback:** if detection fails or returns nothing usable, show Toronto time labelled "9:00 PM ET".
- **The schedule itself stays fixed** at 9:00 PM America/Toronto. Only the display changes.
- **Apply this everywhere** a time appears: closed office, rules line, day summary, share text and OG cards.
  - In share text and OG cards, the player's zone is unknown to the reader, so always say "9 PM ET".
- **Ledger and "filed at" times** use the viewer's local time, with the zone label shown on hover/tap.

## 2. A big countdown at the top

- **Closed office and "file complete" states:** one huge countdown to the next drop, in the display face with tabular mono digits, e.g. `23:41:07`.
  - Label: "NEXT DROP", with the local time beneath it.
  - It's the dominant element on the screen, in the registry style: ink on paper, with no glow, gradients or emoji.
  - The digits tick every second without layout shift, using `font-variant-numeric: tabular-nums`.
- **During an open round** (the player still has dibs left): a slim strip at the top, "Round closes in 05:12:44", that doesn't push the claim box below the fold at 390×844.
- **At zero:** the page swaps to the new category automatically, with a short stamp transition and no reload needed. If the server isn't ready yet, show "Opening…" and retry with backoff. Never show a negative timer.
- **Accessibility:** use `aria-live="polite"`, announcing at most once a minute, plus a static text version for screen readers. Respect `prefers-reduced-motion`.
- **Performance:** one shared `requestAnimationFrame` or 1-second interval. Pause it in hidden tabs and resync from server time on visibility change. Correct for client clock skew using the server's `Date` header or the `/api/today` server time.

## 4. Certificates stay until dismissed

- After a successful dibs, the stamp and certificate **never auto-dismiss**. They stay until the player taps "Next dibs" (or "See my file" after the last one).
- Remove every timer-based hide or transition. The stamp animation can still finish in 1.4 seconds, but the result stays on screen.

## 5. The day file shows the misses too

The Day summary, and its PNG and share card, show **every guess in order**:
- Each **win** shows the answer, a mini stamp, and DEEP CUT or GOLD where it applies.
- Each **miss** shows the answer guessed, struck through, plus who had it: "FOX: taken by Rust Finch #12 at 9:01 PM", or "DOG: held by the Registry".
- Invalid entries cost no strike and aren't listed.
- The header reads "3/3 dibs · 2 strikes · filed 9:06 PM".
- **Spoilers:** misses reveal answers, so the downloadable PNG and the on-page summary show them, but the spoiler-free share text and OG card keep the `■□` row only until the category closes. After close, the archive and summary links show everything.
- Make the misses fun in clerk voice, e.g. "Rejected filings" as the section title.

## 6. More golden tickets during the beta

- Make the daily golden count a config value, `GOLDEN_PER_DAY`. Set it to **10** for the first 7 drops (Nov 23 to 29), then 3. Commitment hashing and close-time reveal still apply.
- Show "Golden tickets: X of 10 found today" on the ledger.

## 7. Day Certificate: the one postable card with everything

- When a player's file closes (3 dibs or 5 strikes), show a **Day Certificate**. It's a full certificate in the registry style, the same quality as the single-dibs certificate, and it's the main thing to share.
- **It contains:** category and date; "dibs #N"; every guess in order (wins stamped, misses struck through with who held them); gold and DEEP CUT marks; "3/3 dibs · 2 strikes · filed 9:06 PM"; the handle; the streak; and dibs.here.
- **It's the default image for SHARE,** in story (1080×1920) and feed (1080×1350) formats. Individual dibs certificates stay available, but they're secondary.
- **The PNG shows the answers.** They're already owned or held, so showing them gives other players no advantage. Only the pasted share text and OG previews stay spoiler-free until close.
- It must look great as a story thumbnail. Get it reviewed against the anti-AI checklist, with screenshots of a 3/3 clean file, a file with 2 strikes and a gold, and a 5-strike closed file.
- Owner decision: the game stays at **one category per day** (3 dibs, 5 strikes). Don't change the structure.

## 3. Tests

- Playwright with forced timezones: America/Toronto, America/Vancouver, Europe/London, Asia/Kolkata, Australia/Sydney, and an invalid/empty timezone (falls back to ET). Each shows the correct local time and day.
- Use fake timers to check the countdown, including the rollover at zero.
- A test with client clock skew of ±10 minutes still shows the correct countdown.
- Tests: the certificate persists until tapped; the summary lists wins and misses in order; the share text stays spoiler-free before close.
- Screenshots: closed office, mid-round strip and file-complete countdown, in light and dark mode at 390px and 1440px.

## Do not

- Don't change the drop time or the category schedule.
- No location permission prompts, and nothing that stores or sends the timezone.
- Don't post anything.
