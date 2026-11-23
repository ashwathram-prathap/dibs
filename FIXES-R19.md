# FIXES-R19: follow the system theme (tiny; ship to production)

> Owner request (Mon Nov 23, 4:00 AM ET). Run after R18. Ship like FIXES-R12 section 5. **No production deploy after Mon Nov 23 3:00 PM ET**: if you aren't done by then, ship nothing and report. All existing tests must pass. OVERNIGHT.md rules apply. At most one ntfy alert. Tag `r19-done`.

Today `public/theme.js` follows `prefers-color-scheme` only until the player taps the theme toggle; after that the choice is stored forever, and the page never reacts to system changes.
- Three theme choices: **System (default)**, **Paper copy** and **Carbon copy**. Store only an explicit choice; System stores nothing (or `system`).
- With System: follow `prefers-color-scheme` **live** (a `matchMedia` change listener, no reload), including in the installed home-screen app. Update `meta[name=theme-color]` for both themes so the phone's status bar matches.
- The header toggle keeps its quick Paper/Carbon flip (it sets an explicit choice). Settings gets a 3-option control "Theme: System · Paper · Carbon copy" so players can return to System.
- No flash on load: the inline head theme script from R16 handles all three states before first paint.
- Share and certificate exports use the **resolved** theme.
- Also follow the other system settings that apply: `prefers-reduced-motion` (already done; verify), `prefers-contrast: more` (stronger borders and text), text size (all sizes in `rem`, so iOS/Android text-size settings and browser zoom scale the layout; verify at 130% and 200%), and `forced-colors` (Windows high contrast: controls and stamps stay visible).
- Tests: emulate light and dark system preferences with each stored choice, a live system flip while on the page, and the installed (standalone) mode. Screenshots in `review/round19/`.

## Player names: remove the hex suffix (regression from R17)
Handles now render as "Tan Dove #6a325f64". R17 appends `' #' + user.id.slice(0, 8)` (see `worker/day-registry.ts` around lines 319-327 and the `/me/reroll` path near line 736). The owner never asked for this and it looks like a database ID. Before R17 handles were like "Teal Otter #41".
- Display handles as **"Tan Dove"** with no suffix by default.
- If two players visible on the same screen (leaderboard, ledger, certificate) share the exact same name, disambiguate with a **short number of 2 to 3 digits** ("Tan Dove #41"), stable per player (derived from the id, not random each render). Never show hex or a long id.
- **Existing stored handles** that already contain " #<8 hex>": strip the suffix at read/display time and in the stored data, preserving everything else. Founder (THE REGISTRAR) and Withdrawn player are unaffected.
- Make the handle generator draw from a big enough pool (adjective × animal, 10,000+ combinations) that clashes are rare.
- Tests: no handle anywhere in the UI, API, certificates, share images or OG images matches `/#[0-9a-f]{5,}/`; the clash case shows "#NN"; rerolls still work.

## Streak: a little more presence (restrained)
Today it's plain text, "Streak 0", next to the handle. Make it feel earned without turning it into a game-show badge:
- A compact **streak chip** in the header: a small registry-style mark (a tiny ink tally or stamp glyph in the brand icon style, no emoji, no flame) plus the number in Archivo ("3"), with the word "day streak" in Instrument Sans on wider screens and just the number on phones. At 0, show it muted (or hide it until the first claim).
- **Moment:** when a claim extends the streak (the first claim of the day), the number ticks up once with a short ink-press animation (about 300 ms; with reduced motion, an instant change) and the post-claim payoff gets one line: "Streak 4. Back tomorrow at 9 PM to keep it." No confetti.
- **Milestones only at 3, 7, 30 and 100:** the chip gets a thin vermilion ring that day, and the certificate shows "4-day streak" in the Plex form-label style. Nothing more.
- On the certificate, done screen and share text, keep "streak N" as it is.
- **Every device:** fits the header at 320px next to the handle and theme toggle without wrapping or truncating the handle (on very narrow widths, abbreviate the handle before the streak); 44px or larger tap target if interactive; AA contrast in both themes; correct at 200% zoom and with large text; works in the installed app.
- Tests: 0, 1, the milestone and the reset states; the tick only happens on the first claim of the day; no layout shift (CLS 0) when it changes; screenshots at 320, 390 and 1440 in both themes in `review/round19/streak/`.

## Post-claim payoff: fix the rarity curve and the desktop layout (owner screenshot, dark, desktop)
1. **The curve is a flat plateau** (a block with rounded corners). Replace it with a **clean, idealised bell curve** (the owner's choice, like an IQ-curve graphic): a smooth standard normal shape, the same every time.
   - **Keep it honest:** place the marker at `x = inverseNormalCDF(percentile)`, so the area under the curve left of the marker equals the player's real percentile. A 94th-percentile answer sits out in the right tail, a familiar one sits far left. Clamp to ±2.6σ so the marker never falls off the ends.
   - **Look (our brand, not a copy of any other game):** a 1.75px ink stroke with round caps; a soft fill under the whole curve at about 10% opacity; the area **right of the marker** (rarer than you) filled at about 25% opacity in the stamp colour (vermilion, or gold for a golden); a vertical marker line in vermilion with a small dot where it meets the curve; "You" under the marker in Instrument Sans; "Familiar" and "Obscure" at the two ends in the Plex form-label style; a thin baseline; no grid. Generous padding so the peak never touches the box. The draw-in animation is as before (about 600 ms, instant with reduced motion).
   - Size: about 520x150 in the desktop right column, full width and about 96px tall on phones.
   - Test: the marker x matches `inverseNormalCDF(p)` for p = 0.05, 0.5 and 0.94, and the labels never overlap at the edges.
2. **"rarer than 0% of animals"** reads as an insult and is confusing. Wording by percentile: at 0 to 10%, "**One of the most familiar animals**" (no number); 11 to 89%, "**Rarer than N% of animals**"; 90 to 99%, "**Rarer than N% of animals · deep cut**"; the top 1%, "**Rarer than 99% of animals**". Use the same wording on the curve label, the certificate and the share text. Drop the duplicate small "you · rarer than 0%" label above the curve: put a short "You" next to the marker only.
3. **Grammar:** "1 claims left" becomes "1 claim left" (pluralise every counter: claims, strikes, points, days).
4. **Time zone label:** "Closes Tue 11:00 AM GMT+9 your time" should name the zone the way the picker does ("Closes Tue 11:00 AM, Japan time" or "Toronto time"), never "GMT+9". It must match the zone selected in Settings.
5. **Desktop whitespace:** on 1024px and wider, the payoff card uses **two columns**: left is the stamp, the result lines, the counters and the actions; right is a larger version of the rarity curve (about 480 to 560px wide) with today's mini leaderboard snapshot (your rank and the top 3, answers hidden) under it. Content is vertically aligned, and there are no huge empty areas. Phones stay single-column and compact (R17 rules).
6. **Spacing:** the DIBS stamp currently crowds "Yours. Camel has your name on it for good." Leave 16px or more under the stamp. The "Next claim" button has a heavy double white outline at rest, so show the focus ring only on `:focus-visible`. Align "View certificate" vertically with the button.
7. Screenshots at 390, 768, 1440 and 1920, both themes, for a familiar, a mid and a deep-cut claim, in `review/round19/payoff/`.

## Phone payoff screen polish (owner screenshot, Android Chrome, 360x800-ish, dark)
Same bugs as above, plus phone-specific ones. Target: it looks deliberate and calm on a phone, with nothing that reads as a template.
- **One frame only.** The payoff currently sits in a darker inner card inside an outer bordered card (box in a box). Use one surface and one border.
- **Hierarchy, top to bottom:** the stamp (DIBS + answer), 16px gap, "Yours. Deer has your name on it for good." (one weight), then a single compact line "**+10 points** · One of the most familiar animals", the bell curve (full width, about 96px), then the counters as two small inline chips "1 claim left" and "3 strikes left", then the actions.
- **Actions:** "Next claim" full width as the primary button. Under it, one line of quiet text links: "View certificate · Remind me". Remind me opens its menu as a bottom sheet. No big outlined Remind me box on phones.
- **Close-time line:** "Closes 9:00 PM Toronto time" in the muted body style, not bold, and only once. Drop "your time" when the zone is shown.
- **Bottom tab bar:** give the page bottom padding equal to the bar height plus the safe-area inset so nothing hides behind it. Remove the duplicate "How it works" disclosure from the play screen on phones, since it's already a tab.
- The "The full board and golden tickets reveal when the day closes." line goes muted and smaller, and doesn't wrap awkwardly.
- Check on Android Chrome (360x800, 412x915) and iOS Safari (375x667, 390x844, 430x932), both themes, with system font scaling at 1.0 and 1.3. Screenshots in `review/round19/payoff-phone/`. **The owner will judge this screen first, so compare it against the R7 screenshots for craft, and iterate until it's clearly better than the current one.**

## Slow claim: pre-warm the bot check (owner: "it takes so long when I click")
`src/turnstile.ts` loads the Turnstile script and renders the widget **only when the player presses CALL DIBS** (App.tsx around line 1079), so every first claim waits for the script download plus the challenge (several seconds on phones).
- **Pre-warm:** once the live screen is shown and the browser is idle (`requestIdleCallback`, falling back to a 1.5 s timeout), or on the first focus/keypress in the answer box (whichever comes first), load the script and render the widget with `execution: 'execute'` and `appearance: 'interaction-only'`, then call `turnstile.execute()` straight away so a token is ready before the player submits. Keep the token in memory. Tokens expire after about 300 s, so re-execute shortly before expiry (and on `expired-callback`) while the tab is visible. At claim time, use the ready token instantly. Only if none is ready, wait for the in-flight one (show "Checking you're human..." inline, not a blank wait).
- **Server:** after one successful Turnstile verification, issue a short-lived signed session proof (HMAC with the existing cookie secret, at least 30 minutes, tied to the player) so later claims and strikes in the session don't need a new token. If R15/R17 already do this, verify it and make sure the client actually uses it.
- Keep the CSP correct for `challenges.cloudflare.com`. In-app browsers: keep the existing fallback.
- **Measure** the time from tap to stamp for the first claim and later claims on throttled 4G (Chromium and WebKit, with test keys), before and after. Target: the first claim's stamp within about 1.5 s of the tap when the player has been on the page for 3 s or more; later claims under about 1 s. Report the numbers.
- In the report, tell the owner if the Turnstile widget mode in the Cloudflare dashboard (Managed, Non-interactive or Invisible) affects speed, with the exact dashboard path, but don't change it.

## Bell curve: keep it as a supporting detail (the certificate and Share stay the hero)
- Per claim, it's small and quick (as above).
- **Hierarchy on the done screen (fixed):** 1) the Day Certificate (the hero), 2) the **Share** button (primary) and Copy result (secondary) right under it, 3) then the curve as a supporting detail below. The curve never pushes the certificate or Share below the fold on phones.
- **On the done screen only (not inside the Day Certificate or its image):** one bell curve with **all three claims marked** (three vermilion ticks, gold for a golden, each labelled with the answer since the player knows their own), plus the day's total points and rank above it. It's a supporting detail on the certificate, not the headline. On the share image before close, show the three ticks **without answer labels** (no spoilers).
- On phones, it spans the full width (about 120px tall), with labels that never collide (stagger them or use 1, 2, 3 keyed to a legend when ticks are close).

## Done screen on phones: Share and Copy must be visible without scrolling (owner, final say)
- On phones, when the day is done, **Share** (primary, full width) and **Copy result** (secondary) are visible **without scrolling** on a 360x800 / 390x844 screen: directly under a compact certificate preview (scaled to fit, tappable to open it full size), or as a **sticky action bar** pinned above the bottom tab bar (safe-area aware, never covering content, since the page gets matching bottom padding). Pick whichever looks cleaner and record why. On desktop they sit right under the certificate.
- **Day Certificate (the main card with the day's results): no bell curves** (overrides the earlier instruction). It lists the claims and strikes cleanly, with points, rank and streak.
- **Individual claim certificates (`/c/<id>`):** these get the single bell curve for that claim (holder view; sealed public view shows no position before close).
- **The done screen (the website) DOES show one bell curve with all three claims marked**, placed **below** the certificate preview and the Share/Copy buttons. It's not part of the Day Certificate/scorecard itself or its share image.
- Test: at 360x800, 390x844 and 430x932, both themes and font scale 1.3, the Share button's bounding box is fully inside the viewport on load of the done screen.

## How-it-works example: stamps wrap onto their own line
The inline YOURS/TAKEN stamps sit at the end of each sentence, so when the sentence fills the line, the stamp drops to a new line by itself (the owner's screenshot shows TAKEN orphaned; "(5 max)" also orphans).
- Lay each example line out as a **two-column grid**: a fixed-width stamp column on the **left** (YOURS, TAKEN, same width, vertically centred), then the sentence on the right. The stamp never wraps away from its sentence at any width from 320 to 2560.
- Tighten the copy so it fits: "You type **Okapi**. Nobody has it yet, so **it's yours**." and "You type **Lion**. Someone already has it, so **you get a strike**."
- Rules line: "You get 3 claims. A guess someone already took costs a strike. 5 strikes and you're out."
- Add `text-wrap: pretty` (with a `balance` fallback for headings) site-wide to avoid one-word last lines.
- Screenshots at 320, 360, 390 and 1440, both themes.

## Final done-screen curve = YOUR SCORE vs TODAY'S PLAYERS (owner clarification, overrides earlier "three claims marked")
- The one bell curve on the done screen (below the certificate and Share/Copy) compares the player's **day total points** with **everyone who has finished today**. It doesn't plot the three answers. Label: "**Better than 63% of today's players**" plus "(41 finished so far)".
- The same idealised bell shape and honest marker as the per-claim curve: marker x = `inverseNormalCDF(percentile among finished players)`, with ties counted as half. The percentile comes from the server (DO memory, from real finished files only, no fabricated players). It updates live over the socket as more people finish, with a gentle marker glide.
- **Too few players:** with fewer than 10 finished players today, don't draw the curve. Show "Your rank: #3 of 7 so far. The curve appears once 10 players finish." No fake distribution.
- Founder, withdrawn and hidden users follow the existing leaderboard rules. Practice test players never count on production.
- After close it freezes as the final result, and the archive shows each day's final curve with the player's own position if they played.
- **Per-claim curves** (in the payoff after each claim and on individual claim certificates) stay as answer rarity within the category.
- Tests: the percentile with ties, the fewer-than-10 state, the live update, no-peek (no answers exposed), and the done-screen layout on phones (Share still visible without scrolling).

## No orphaned last words on every device (owner requirement)
`text-wrap: pretty` isn't supported in every browser the game targets (older iOS Safari, Firefox, some in-app webviews), so don't rely on it alone:
- Add a small `noOrphan()` helper that joins the last two words of a string with a non-breaking space (`\u00A0`) when the last word is shorter than about 10 characters. Apply it to every user-facing sentence and heading rendered by React (rules, example lines, payoff lines, FAQ, notices, buttons with 3 or more words, certificate text), and to canvas text in `src/share.ts` (the export wrapper must treat the NBSP as unbreakable).
- Keep `text-wrap: pretty` (and `balance` on headings) as a progressive enhancement on top.
- Never join if that alone would overflow the container at 320px (fall back to a normal space for very long final pairs).
- Test: a Playwright check that, for every visible text block on the main screens (closed, live, payoff, done, how it works, settings, certificate), the last line contains more than one word, at 320, 360, 390, 430, 768, 1024 and 1440, in Chromium, WebKit and Firefox, both themes and font scale 1.3. Report any unavoidable exceptions (for example a single long word).

## Feedback hardening (small)
Already in place: 500-character cap, 4 KB body cap, verification (Turnstile or a verified session), 3 per hour per player (DO memory), parameterised SQL, admin-only viewing, 90-day deletion. Add:
- A **global cap of 300 feedback notes a day** (protects the D1 write budget). After that: "Feedback is full for today. Try again tomorrow." Keep the per-player limit, and also store it durably enough that a DO restart doesn't reset it within the hour.
- A per-IP-hash backstop of 20 a day (not the residence-blocking kind: generous on purpose).
- Strip control and zero-width characters, collapse runs of whitespace, and reject notes that are only links or contain more than 2 URLs.
- The admin view renders feedback strictly as text (no `innerHTML`, no Markdown or link rendering; show URLs as plain text) and labels it "Player-submitted, untrusted". Add a test that an HTML/script payload displays inertly.
- Never send feedback to ntfy, email, or any AI/automation pipeline automatically.

## Settings → Backup code STILL scrolls sideways (owner retest after R18, Mon 5:33 AM)
R18's fix didn't solve it for the owner. Find the actual cause instead of patching symptoms: open Settings, expand Backup code and Delete my data, and find which element is wider than the panel (`document.querySelectorAll('*')` where `scrollWidth > clientWidth` or `getBoundingClientRect().right > panel.right`). Likely suspects: the backup code itself (a long unbroken string, so give it `overflow-wrap: anywhere` / `word-break: break-all`, a monospace block at 100% width with a Copy button below, not beside it), an input with a fixed or `min-width`/`size` width, a `<details>` with grid or flex `min-width: auto` children (set `min-width: 0` on flex/grid children), fixed-width buttons, or the panel itself positioned with a fixed width larger than the viewport.
- The panel width is `min(100vw - 32px, 420px)` on desktop and a full-width bottom sheet on phones; `overflow-x: hidden` is **not** an acceptable fix on its own, because the content must actually fit.
- Test: with every disclosure open, at 320, 360, 375, 390, 430, 768 and 1440, in Chromium, WebKit and Firefox, both themes, font scale 1.3 and 200% zoom, assert that the panel and every descendant have `scrollWidth <= clientWidth` and that the document has no horizontal scroll. Include a real-length backup code (the longest format the app generates). Screenshots in `review/round19/settings/`.
- **The owner reproduced it on a MacBook Air (Chrome/Safari, about 1440x900 or 1470x956) and a Samsung flagship (Android Chrome, about 360x780 to 412x915 CSS px).** Test those first: Chromium desktop 1470x956 and 1440x900, WebKit desktop 1470x956, and Chromium Android emulation (Galaxy S2x/S2x Ultra profiles, 360x780, 384x854, 412x915) with Samsung Internet's user agent too. The bug must be reproduced in a test **before** the fix and pass after.
