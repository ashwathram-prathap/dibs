# FIXES-R13: hero, type size, theme toggle and sound (ship to production)

> Owner decision (Sun Nov 22, 2:34 PM ET): the sounds feel random and annoying. Fix only what's in this file, test, and ship to practice and then production with the same direct commands, rollback point and smoke test as FIXES-R12 section 5. Don't change anything else. Keep the Mon 9:00 PM ET first drop. No production deploy after Mon Nov 23, 5 PM ET. At most one ntfy alert.

## Layout and type fixes from the owner's R12 review (do these first)
1. **Bring back the PAPER COPY / CARBON COPY theme toggle** exactly as it was at `f150b49` (visible label `CARBON COPY` in light mode and `PAPER COPY` in dark). Keep the plain aria-labels ("Switch to dark mode" and "Switch to light mode"). This brand word is allowed: it's a toggle label, not an instruction.
2. **A real hero comes first on every screen and width.** Order: wordmark/header, then the **hero**, then the 2-line explanation and example, then the rest.
   - Closed: the hero is the countdown, set huge like the R7 category type ("Opens in 1d 06:12:40", plus "Monday 9:00 PM" under it), with Remind me.
   - Live: the hero is today's category name at the R7 size, then the input and Claim. The explanation sits under the input and collapses after the first guess (as in R11 section 3).
   - Done: the hero is the result ("3 of 3 claimed" or the stamp), then the certificate.
   - On phones, the rules must **never** appear above the hero. The hero plus the input must be visible without scrolling on a 390x844 screen.
3. **Type is too small again.** Restore the R7 scale (`r7-done` CSS) for the hero and category, body copy at least 18px on phones and 19 to 20px on desktop, and buttons and input at least 18px. Compare against `review/final/r7-*.png` at 390 and 1440. R13 must be equal or bigger everywhere. Put side-by-side screenshots in `review/round13/`.
5. **The hero must work on every device.** Test it at 320x568 (iPhone SE 1st gen), 375x667, 390x844, 430x932, 360x800 (Android), 412x915, iPad 768x1024 and 1024x1366 in portrait and landscape, phone landscape (844x390), and 1280, 1440, 1920 and 2560 desktop. On each, in both themes and Chromium plus WebKit:
   - nothing overflows or clips sideways. Long category names (the longest in the catalog, e.g. "Novels & novellas", "Fruits & vegetables") and the countdown wrap or scale with `clamp()` and never break mid-word
   - the hero and input are visible without scrolling on every phone portrait size. In phone landscape, the input is reachable with one short scroll
   - the on-screen keyboard doesn't cover the input or the Claim button (iOS Safari and Android Chrome visual viewport, plus `interactive-widget`/`dvh` handling)
   - the safe-area insets (notch, home bar) are respected
   - 200% browser zoom and large system text (iOS Dynamic Type, Android font scale 1.3) still work
   - the countdown doesn't jitter in width as digits change (tabular numbers)
   - in-app browsers (Instagram, LinkedIn, iMessage preview open), emulated
   Save a contact sheet of every size and theme to `review/round13/hero-matrix.png`. Any failure blocks the deploy.
4b. Keep R12's plain copy, backup-code wording and accuracy tests. Change layout and size only, not the words.

## The system
The current sounds are bare oscillator blips (`src/sound.ts`: triangle and sine tones), so they sound like a computer, not the game. Replace them with **one family: paper and a rubber stamp.** Every sound must sound like it comes from the same desk.

| Moment | Sound | Length | Loudness |
|---|---|---|---|
| Claim wins | Firm rubber-stamp thunk: a short low body (about 90 to 120 Hz) plus a filtered noise "paper slap" transient | ≤ 150 ms | Reference (loudest) |
| Gold ticket win | The same stamp thunk, then one soft bell-like ping about 120 ms later (single note, gentle decay) | ≤ 500 ms | Stamp at reference, ping about 40% |
| Taken or Reserved (strike) | A softer, duller version of the stamp (lower, muffled, no slap) | ≤ 120 ms | About 50% |
| Invalid, typo or no-strike replies | **No sound** | | |
| Typing, buttons, page load, theme, nav, out of claims, 5th strike, certificate | **No sound** | | |

Rules:
- That's 3 sounds in total. Each plays only as the direct result of the player pressing Claim.
- Synthesise them in Web Audio (filtered noise plus envelope) or ship tiny local files (each under 15 KB, self-hosted, CSP-safe). No harsh pure tones, nothing above about 2 kHz except the gold ping, and no clicks at the start or end (use a 5 ms or longer attack and release).
- Same output level across Safari, Chrome and Firefox. Never louder than a quiet notification on a phone at mid volume.
- Keep the existing on/off control and the remembered choice. Default stays on. Reduced motion doesn't mute sound.
- Never play overlapping copies. A double tap plays once.

## Verify
Add unit tests for the mapping above (which events play which sound, and that everything else is silent). Render each sound to a WAV in `review/round13/` with a short waveform PNG, and confirm the peak levels and lengths match the table. Run the Chromium/WebKit matrix. Then ship, smoke-test production, commit, push, tag `r13-done`, and put a short note at the top of MORNING_REPORT.md.

## Optional background music (owner request)
Add one small "waiting room" muzak loop: a calm, lo-fi, office/elevator feel that fits the registry. **Off by default.**
- **License: CC0 or public domain only** (for example OpenGameArt or Freesound, filtered to CC0). Not Pixabay, YouTube Audio Library or anything CC-BY or NC. Record the source URL, author and licence in `public/audio/CREDITS.md` and in the report. If no CC0 track fits the feel, compose a short original loop in code (Web Audio, a soft electric-piano chord progression) rather than using anything uncertain.
- Seamless loop of 30 to 60 s, Opus/MP3 under 400 KB, self-hosted, lazy-loaded only when the player turns music on. It never loads otherwise, so performance doesn't change.
- A "Music" toggle next to the sound toggle, with the choice remembered. It starts only from that tap. It pauses when the tab is hidden and resumes on return, at low volume (about 25% of the stamp's level). It ducks under the stamp sounds and fades in and out over about 1 s. Reduced motion doesn't affect it.
- It must match the stamp family's mood. If it clashes, cut it and say so in the report rather than shipping something cheesy.
