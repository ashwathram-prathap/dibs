# FIXES-R18: settings, feedback form and footer layout (small; ship to production)

> Owner playtest (Mon Nov 23, 2:49 AM ET). Run **after R17 finishes**. Change only what's in this file. Ship like FIXES-R12 section 5 (practice, then production, with the rollback point and smoke test). Production opens Mon 9:00 PM ET. **No production deploy after Mon Nov 23 3:00 PM ET**: if you aren't done by then, ship nothing and report. All existing tests must pass. OVERNIGHT.md rules apply. At most one ntfy alert. Commit, push, tag `r18-done`, and put a short note at the top of MORNING_REPORT.md.

## Settings, feedback form and footer layout (owner playtest, phone and desktop)
1. **The backup code opens sideways:** opening "Backup code" inside Settings lays its content out as a second column, so the panel needs **horizontal scrolling** (it overflows on desktop and iPhone). The explanation line "Use this code to get your claims back on another device or browser." also appears **twice**. Fix:
   - Settings is one vertical column. Every row (Sound, Music, Time zone, Backup code) is full width with equal gaps. Disclosures expand **downwards** only, never sideways. Zero horizontal overflow at any width (add a test asserting `scrollWidth <= clientWidth` on the panel with every disclosure open).
   - On phones (under 768px), Settings opens as a full-width bottom sheet, scrollable vertically, with a clear Close control and safe-area padding.
   - Show the backup-code explanation once. Order: the explanation, **your code** (shown, with a Copy button), then "Restore on this device" (input + Restore claims), then a divider and "Delete my data".
   - Remove the double border/outline around the Backup code row so it matches the Sound and Music rows.
2. **The "Send feedback" form looks bad on iPhone:** spacing, alignment and field sizes. Rebuild it as a clean single column: label above each field, 16px-or-larger inputs (prevents the iOS zoom), consistent 16 to 24px gaps, a full-width Send button on phones, a clear success and error state, and safe-area padding. It's a sheet on phones and a centred panel (max 560px) on desktop.
3. **Footer wraps awkwardly:** on phones, "Office, Privacy, Sources" sit on one line and "Send feedback" drops to a fourth line on its own. Fix: the wordmark and tagline on one row, then **all four links in one consistent group** (a single row if it fits, otherwise an even 2x2 grid on phones). "Send feedback" is styled exactly like the other links. No orphaned item at any width from 320 to 2560.
4. Screenshots of Settings with every disclosure open, the feedback form and the footer at 320, 375, 390, 430, 768 and 1440, in both themes, in `review/round18/`.

## Feedback form on desktop
Right now "Send feedback" expands **inline inside the footer** on desktop: the form hangs off the right of the footer, the label and field gaps are cramped ("Topic" touching its select), the textarea and button widths don't match, and the "Send feedback" link gets a heavy outline box. Fix: it opens as a centred panel/dialog (max 560px, focus-trapped, Esc to close, a close button), with the same single-column layout as on phones: labels 8px above fields, 20 to 24px between groups, the select and textarea full width, the Send button full width or right-aligned consistently, and the helper text "500 characters max" under the field in a smaller muted style (not in the label). No outline box on the footer link except a normal focus ring.

## Carbon copy (dark mode) reads as "AI-made" to a playtester
Remove the generic "AI template" tells in dark mode (and check light mode for the same):
- corner crosshair "+" marks and thin double-line frames on the certificate and cards
- too many tiny ALL-CAPS letter-spaced labels ("FORM D-1", "PRACTICE — NOT THE PUBLIC RECORD", "CERTIFICATE OF DIBS")
- dashed rules
- flat pure near-black with cream text and no texture
Make carbon copy feel like **real carbon paper**: keep the warm near-black (`#16150F`/`#1F1E18`), add the same subtle paper grain used in light mode (at low opacity), and make ink slightly warm and softly imperfect (the existing ink filter) rather than crisp vector white. Fewer and larger all-caps labels: follow the Plex form-label rule in the brand section (form labels yes, sparingly and readable; everything else in sentence case). One frame line, not two. Keep the vermilion and gold. Before/after screenshots of the play screen, done screen and certificate in both themes. The result must still pass AA contrast.

## Copy and share buttons
Keep them prominent, because sharing is how the game spreads, but show them only **after** the player has a result (done screen and certificate), never during play. One primary button (**Share**) and one secondary button (**Copy result**, outlined, lighter). They never compete with CALL DIBS on the play screen.

## Countdown: restore the Round 7 clock exactly
The owner says the current countdown (a heavy serif-like face with a soft, grainy ink edge) is less sharp and satisfying than the original. The original is **`review/final/r7-chromium-1440-light-closed.png`** (and the `-390-`/dark variants): wide, heavy expanded grotesque digits (Archivo at its widest and heaviest, as in R7's CSS at `r7-done`), **crisp solid edges with no ink displacement or blur filter**, large, left-aligned with "Next drop" above and "Next drop: 9:00 PM ET" below.
- Restore that font, width, weight and crisp rendering from `r7-done`. Keep R16's digit-gap fix (every pair, such as 44, 11 and 00, has a clearly visible gap) and tabular, non-jittering digits.
- Keep the newer hint under it ("9:00 PM ET · change in Settings").
- Side-by-side comparison with the R7 screenshot at 390 and 1440, both themes, in `review/round18/clock/`. It must match R7's look apart from the gap fix.

## Remind me menu: consistent rows
Apple's caveat sits inside its link text, while Outlook's sits on a separate line below, so the menu looks uneven. Make every option the same shape: a menu row (a button-style row with a hover/focus state, not an underlined text link) with the **name** on the first line and an optional muted **helper line** under it:
- Google Calendar · "Opens in a new tab"
- Apple Calendar · "Downloads a file. Open it to add"
- Outlook · "Adds one event. Set it to repeat daily"
Equal row heights and gaps, keyboard accessible, both themes, and phone tap targets of 48px or more.

## Brand identity: one type system, written down
The owner wants a consistent visual identity with **few fonts**. Audit every font family in the CSS, the canvas exports (`src/share.ts`), the OG/certificate images and the SVGs, then consolidate to **three families with strict roles** (the owner decided the register/form feel is core to the brand):
- **Display: Archivo** (wide, heavy, as in R7) for the wordmark, the hero category, the countdown clock, the stamp and big headings.
- **Text: Instrument Sans** for body copy, buttons, inputs, menus, instructions, errors and the game counters ("Claims 0 of 3").
- **Form: IBM Plex Mono**, *only* for registry/form details: form numbers ("Form D-1"), field labels on the certificate and in the ledger ("Held by", "Filed under", "Next drop"), dates and times on certificates, ledger entry numbers, edition numbers, and backup codes. Rules: at least 14px on desktop and 13px on phones, used sparingly (a few per screen), and never for instructions, buttons or anything the player must read to play. Small caps or uppercase only for short form labels of 1 to 3 words, with letter-spacing of 0.06em or less.
- Remove every other face (`ArchivoClock` merges into Archivo, `Instrument, monospace` fallbacks get fixed, and any serif goes), including in the canvas exports. Drop unused font files.
Also write **`BRAND.md`** in the repo, one page: the three fonts with their roles, weights and sizes (a type scale) (a type scale), the colours (paper, carbon, ink, vermilion `#E1462B`, gold) with their exact hex values in both themes, line/border rules (one frame weight), corner radius rules (3px on controls only), the stamp rules, the icon style, the voice (plain words, brand flavour only in headings) and "don'ts" (no emoji in the UI, no crosshair marks, no dashed rules, no tiny all-caps labels outside the Plex form-label rule, no default-blue links). Then make the whole app and the exports follow it, and add a test that fails if any CSS or canvas code references a font family outside the three, or uses Plex outside its allowed roles.

## SEO extras (the owner added Google Search Console and Bing Webmaster Tools)
Already in place: robots.txt with the sitemap, `/sitemap.xml`, canonical, title/description, OG and Twitter tags. Add:
- **Home structured data:** JSON-LD `WebSite` (name "Dibs", url) plus `VideoGame` (or `WebApplication` with `applicationCategory: GameApplication`): name, description (the plain 2-line explanation), url, `genre` "Word game", `gamePlatform` "Web browser", `offers` price 0, publisher/author "Ashwathram Prathap". Validate it against schema.org rules in a test. No fake ratings or reviews.
- **IndexNow (Bing, Yandex):** add a key file at `/<key>.txt` (generate a key and commit it, since it isn't a secret), and after each production deploy and each daily archive page, ping `https://api.indexnow.org/indexnow` with the new and changed URLs (home, `/archive`, the new archive day). Failures never block a deploy.
- Make sure each archive day page has a unique title and description and is in the sitemap with `lastmod`.
- The sitemap and robots.txt respond 200 on production with the correct content type. Check `https://dibs.here/sitemap.xml` and `https://dibs.here/robots.txt` in the smoke test.
- **Google Search Console says "Couldn't fetch" for `https://dibs.here/sitemap.xml`.** Diagnose and fix. The sitemap and robots handlers call `api('/archive')` and throw on any non-OK response, so if the internal API call fails the sitemap errors. Make `/sitemap.xml` and `/robots.txt` **never fail**: on an API error, still return a valid sitemap with `/` and `/about`, with status 200 and `application/xml; charset=utf-8`. Fetch both on production with Googlebot's and Bingbot's user agents (`curl -A`) and confirm 200, valid XML, no redirect loop, no Turnstile or challenge page, and correct `lastmod` dates (W3C format). Check that no Cloudflare security setting (Bot Fight Mode, WAF, challenge) blocks verified bots. If one would, report the exact dashboard toggle for the owner and don't change it yourself. Put the curl outputs in the report.
