# FIXES-R8.md: no emoji glyphs and SEO (run AFTER Round 7 is tagged `r7-done`)

> OVERNIGHT.md rules apply: `R8:` commits, push regularly, tag `r8-done`, and add a "Round 8" section to MORNING_REPORT.md. Deploy to practice first, verify, then production. Don't touch player data.

## 0. TOP PRIORITY, before Monday's 9 PM drop: rebuild the answer catalogs (they're broken)

### What the owner's audit of `categories/*.json` found

Every category was capped at 2,200 entries, apparently taken in SPARQL result order rather than by how well-known the answers are. The results are unplayable:

- **Animals:** mammals only. 112 of 148 obvious animals are missing (horse, cow, pig, shark, owl, snake, frog, chameleon, penguin, bee, spider…).
- **Birds:** 44 of 45 obvious birds are missing (eagle, owl, parrot, penguin, robin…). The list opens with "Chestnut-bellied guan, Spot-winged wood quail…".
- **Plants:** 35 of 36 are missing (rose, sunflower, oak, cactus…). It's mostly Latin binomials ("Abelmoschus ficulneus").
- **Cities:** 25 of 42 are missing, **including Paris, Tokyo, New York, Berlin, Rome and Toronto's neighbours**. It's full of small Albanian towns.

Assume every other category is broken the same way until proven otherwise.

### 0.1 Rules for every catalog

1. **Popularity first.** Pull the full candidate set from the source with no arbitrary cap, rank it by English Wikipedia pageviews, then cut by popularity and quality, never by query order. All the well-known answers must be in.
2. **Common names are the answers.** Use the English common names players actually type. Include scientific names only as aliases where they're well known. Include general nouns too (eagle, owl, rose, oak, shark), not just species.
3. **Sensible size.** The minimum drops from 2,000 to **300 entries** (for naturally small sets like countries); otherwise, be as complete as possible, since a beta with about 30 players makes about 100 claims a day. A smaller, high-quality list beats a huge obscure one. Countries, fruits, sports and so on become allowed again.
4. **Aliases and plurals:** wolf/wolves, mouse/mice, octopus/octopi, NYC/New York City, St./Saint, accents stripped.
5. **Scope honesty:** the display name and rule line must match the scope exactly.

### 0.1b Use complete reference lists, not just Wikipedia (owner direction)

**Goal:** anything a reasonable player types for the category is accepted. Missing a real answer kills the game. Build each register from the most complete open dataset for that domain, merged with Wikipedia/Wikidata for popularity ranking, house words and obscurity.

**Suggested sources** (verify each licence and add attribution on the Office notice):
- **Cities:** GeoNames `cities1000` (every city with population 1,000 or more, with alternate names and ASCII names). Use the country/admin data to settle duplicates like "Paris, Texas": one answer per name, matched by name only.
- **Countries:** the ISO 3166 list plus common alternate names (USA, UK, Holland, Ivory Coast…).
- **Animals:** the GBIF backbone vernacular (English) names, plus WordNet `noun.animal` hyponyms (general nouns like shark, owl and beetle), plus Wikidata common names.
- **Birds:** the IOC World Bird List English names (all species), plus general bird nouns (eagle, owl, hawk, gull…).
- **Plants:** USDA PLANTS and GBIF English common names, plus WordNet `noun.plant` general nouns (rose, oak, cactus, fern).
- **Foods, and fruits & vegetables:** WordNet `noun.food`, plus the Open Food Facts category taxonomy (English).
- **Others:** the best complete public list for each one. If none exists, the category can't be scheduled yet.

**Cleaning:**
- Remove junk, offensive terms and anything ambiguous.
- Dedupe by normalized name, and keep aliases and plurals.
- Accept multi-word answers.

**Architecture for very large registers** (cities alone could be around 150k names), to stay inside the D1 free-tier write limits:
- **Don't store every answer as a D1 row.** Ship each category's answer index as a compressed static asset: a sorted, normalized-key → id file, or a sharded JSON, served from Pages (free, unlimited).
- The Worker loads it lazily and caches it per isolate, or looks up a shard by key prefix.
- D1 stores only claims, strikes, house words and golden commitments.
- Answer lists and golden tickets must still never leak golden status. The index carries no golden flags.
- Lookups must stay under 50ms p95, and the free Worker CPU limits must hold. Measure and report it.
- The ledger and counts say "X of N still open" using the real N.

**Coverage targets:** the obvious-list test still applies (98% or more, Animals 100%). Also spot-check 50 random mid-popularity answers per category from an independent source.

### 0.2 Coverage test (it gates scheduling)

- For each category, write **150 obvious answers** independently from the builder's sources.
- A category may only be scheduled if at least 98% are present. **Day 1, Animals, needs 100%.**
- Store the obvious lists and results in `review/coverage/`.

### 0.3 Week 1 schedule (Nov 23 to 29): 7 categories that pass

Use Animals (rebuilt, all animal kinds) on Mon Nov 23, then six other broad, fun, instantly-understood categories that pass the coverage test, for example Foods, Countries, Birds (rebuilt), Fruits & Vegetables, Cities (rebuilt) and Sports. Unschedule every category that doesn't pass. Days after Nov 29 stay empty until categories pass. Log the final week-1 list.

### 0.4 Upload and verify

- Upload in schedule order within the free-tier write budget. **Animals must be verified live by Mon Nov 23, 6 PM ET.**
- Recompute house words and re-draw golden tickets (with new commitments) for every rebuilt category before its drop.
- Load the rebuilt Animals into practice, reset practice, and replay the obvious-answers list against the practice API as an end-to-end check (staging only).

### 0.5 Report

Give a table of every category with its entries, scope, coverage score, house words, status (scheduled or unscheduled) and date.

## 0b. Launch-readiness fixes (must ship before Monday's drop)

1. **Identity across browsers.** Friends will open links in Instagram, TikTok or iMessage in-app browsers and later in Safari, and each has its own cookie. Right now that means a lost file and streak, and a second free set of 3 dibs.
   - Add a **"Your file key"**: a short recovery code, shown once after the first claim (e.g. `OTTER-41-K7Q2`), plus a "Continue in another browser" link that carries the code.
   - Entering the key on another browser restores the same identity.
   - Limit one identity per key. Store keys hashed. Rate-limit key entry.
   - Explain it in one plain line: "Switching apps? Use your file key to keep your dibs and streak."
2. **No autocomplete that gives answers away.** With complete lists, autocomplete would let people scroll for answers instead of thinking of them. **Remove answer autocomplete.** Instead, on submit, for a near-miss typo (edit distance 1 to 2 from a valid answer), show "Did you mean CHAMELEON?" with a one-tap confirm. A near-miss costs no strike.
3. **"Not on the register? Tell the clerk."**
   - When an answer isn't found, offer a one-tap "Submit to the clerk", with no strike and no free text beyond the answer itself.
   - Log the normalized answer, category and count, anonymously, rate-limited.
   - The admin stats show the top missing submissions per day, so the owner can add real answers to the list next day.
4. **Privacy page.**
   - Add a plain-language Privacy section on the Office notice: what's stored (a random ID cookie, claims, a hashed IP with a daily rotating salt, anonymous share/arrival counts, missing-answer submissions), why, how long it's kept, and that nothing is sold or used for ads. Include a contact email placeholder `privacy@dibs.here` for the owner to set up.
   - Add a short line that the game is for players 13 and up.
5. **Backups.**
   - Make a nightly export of the production D1 claims, strikes and identities to a private, gitignored location, plus a documented restore command.
   - Confirm whether D1 Time Travel is available on the free plan, and document how to use it.
6. **Launch freeze and runbook.**
   - After all R8 work is verified, write `LAUNCH.md` covering: a pre-drop checklist (6 PM Monday), how to pause a day, how to void an abusive claim, how to roll back the last deploy, and who to check (the admin stats).
   - **No production deploys between Mon Nov 23, 6 PM ET and Tue Nov 24, 12 AM ET.**
7. **Offline and slow network.** If a claim request fails or times out, show "The clerk didn't get that. Try again." No strike is charged unless the server confirms one. Make retries idempotent with a client request ID, so a retried claim can't double-count.

8. **Remove the owner credit for now.**
   - Remove "Built by Ashwathram Prathap", the link to ashwathram.ca and any personal GitHub link from every page, the certificates, the OG images, the JSON-LD and the README's public-facing text.
   - The game stays anonymous-brand: the Dibs wordmark only.
   - Keep a single config flag, `SHOW_CREATOR_CREDIT` (default `false`), with ready-to-enable markup for a later credit line: "Made by Ashwathram" linking to `https://www.ashwathram.ca` and his X profile (`X_URL=https://x.com/ashwarathap`). The owner will turn it on later.

## 1. No emoji rendering anywhere in the UI (iOS shows some symbols as emoji)

- On a friend's iPhone, symbols like the ↗ arrow on "Read the office notice" rendered as colour emoji. That's unacceptable.
- **Audit every Unicode symbol** used in UI markup, CSS `content:` and copy: ↗ ← → ↑ ↓ ✓ ✗ ★ ■ □ ● ○ ✦ · and any other non-ASCII glyph that isn't a letter or punctuation.
- **Replace each one with an inline SVG** in the ink style, with `aria-hidden` and a text label where needed. Use `currentColor` so it follows light and dark mode.
  - Exception: plain punctuation such as `·`, `—` or curly quotes, if it renders as text everywhere.
- **Share text pasted into other apps** may keep ■ □ ★, since that's a deliberate Wordle-style string. The on-page preview of that string must render them as SVG or styled spans, never as emoji.
- **Test it:** add a check that fails if any UI text node or `content:` contains a character from emoji-capable ranges (Misc Symbols, Dingbats, Arrows U+2190–21FF, Geometric Shapes, U+2600–27BF, U+1F000+) outside the allow-listed share-text string. Re-screenshot on WebKit iPhone profiles and visually check the icons.

## 2. SEO (production dibs.here only; practice stays noindex)

- **Unique title and meta description per page:**
  - Home: "Dibs | the daily race to claim answers before anyone else"
  - Each archive day: "Dibs #3: Animals (Nov 23, 2026) | Who claimed what"
  - Certificates: noindex, since they're personal and there are many of them; keep them shareable via OG.
  - Never use other games' trademarks in titles or meta.
- **Tags:** canonical URLs on every page; Open Graph and Twitter tags (already present, verify them); `lang="en"`; a sensible `theme-color`.
- **`robots.txt`:** allow production and point to the sitemap; disallow `/api/`, admin and stats. Practice keeps `noindex` and its own disallow-all `robots.txt`.
- **`sitemap.xml`:** home, Office notice/About and every closed archive day. Generate it automatically as days close, with `lastmod`.
- **JSON-LD:** `WebSite` and `VideoGame` structured data (name, description, url, genre "word game", free to play), plus `BreadcrumbList` on archive pages.
- **Content:**
  - Real crawlable HTML for the home rules and the Office notice: an `h1` with "Dibs", a short "How to play" section and a short FAQ ("When does the category drop?", "What's a golden ticket?", "Is it free?").
  - Archive day pages render their content server-side or prerendered, not only client-side.
- **Performance:** keep Lighthouse SEO at 100 on production, and performance and accessibility at 95 or above.
- **Owner step:** in the report, write the exact steps to verify dibs.here in Google Search Console with a DNS TXT record (Cloudflare dashboard → DNS) and submit the sitemap. Codex can't log into Google.

## 2b. Polish from the owner's review of the practice copy and the Day Certificate

1. **The practice category is broken.** The headline reads "PRACTICE", and the copy says "Call dibs on up to 3 practice." and "2,188 practice still unclaimed".
   - The category must show as **ANIMALS** (the real category name and noun), with the PRACTICE banner only at the top.
   - Every sentence uses the category's proper plural noun.
   - Add a test that renders the copy for all 30 categories and checks the grammar of the plural noun.
2. **Handles are too long:** "Coral Kestrel #526098". Keep the numbers at 1 to 3 digits (e.g. `#41`), and make them unique per name pair. Add a suffix only when it's needed.
3. **Duplicate golden line:** "Golden tickets: X of N found today" appears twice on the page. Show it once, near the ledger heading.
4. **The "Golden-ticket commitment" disclosure is clutter** on the main page. Move it to the archive/day page and the Office notice. Keep it verifiable there.
5. **Ledger highlight rows** (red fill) make the holder and time text hard to read. Use a vermilion left rule or a light tint with ink text instead of a full red fill. Contrast must pass AA.
6. **Day Certificate spacing:**
   - Each filing row has a large empty gap, with the DEEP CUT label far below the stamp.
   - Tighten the rows into a compact, even rhythm: the answer, stamp and DEEP CUT sit on one line or are tightly stacked, and the "Taken by…" line sits directly under the struck answer.
   - The certificate should fill the story frame with balanced margins, not huge empty bands above and below it.
   - Re-export both the story and feed formats and check them as thumbnails.
7. **A house word showed AXOLOTL as held by the Registry.** House words must be the 10 highest-pageview answers only. Verify the selection for every category and log the list per category in a review file. AXOLOTL being a house word suggests the selection is wrong, or that practice data was mixed in.

## 2c. Feedback messages must be impossible to miss, and accessible

Owner feedback: "CAT is held by the Registry" appeared as a thin, small, low-contrast strip. That's too tiny and not obvious, and the game must work for everyone, including people with low vision and screen-reader users.

**Every guess result gets a prominent result panel:** taken, house-held, invalid, success, gold, file closed.
- It appears **directly under the input**, at least 20px text on mobile, bold.
- **It's never colour-only:** each result has a drawn SVG icon plus a clear word label: `TAKEN`, `HOUSE WORD`, `NOT ON THE REGISTER`, `DIBS`, `GOLD`.
  - Taken and house panels use a thick 3px ink border and a tinted fill. They read like a stamped rejection slip, in keeping with the registry style.
- **The message is plain and big.** For example "CAT is taken. The Registry holds the obvious ones. **Strike 2 of 5.**", with the strike count always stated in words.
- **The strike boxes visibly fill with a short stamp animation** when a strike lands (respect reduced motion). The strike count also appears in text next to the boxes ("2 of 5 strikes used").
- **The panel stays until the next guess.** Never auto-dismiss it.

**Screen readers:**
- Results are announced through an `aria-live="assertive"` region for strikes and wins, and polite for everything else.
- Each announcement includes the outcome, the answer and the remaining dibs and strikes.
- Focus returns to the input after each result, so keyboard and screen-reader users can keep playing.

**Contrast:**
- All text meets **WCAG 2.2 AA** in both themes (at least 4.5:1 body, 3:1 large text and UI). Aim for AAA (7:1) on result panels.
- Registry blue on paper, and in dark mode, must pass. Adjust the shade if it doesn't.
- Check every vermilion, gold and blue text use.

**Zoom and text size:**
- The layout works at 200% browser zoom and with iOS Dynamic Type / large text, with no clipping or horizontal scroll.
- Use relative units for type.

**Touch:**
- All interactive targets are at least 44×44px.
- The keyboard never hides the result panel. Scroll it into view if needed.

**Optional haptics:** use `navigator.vibrate` short patterns for strike and win where supported. They're purely additive and never the only signal.

**Audit:**
- Run axe on every screen and state, with zero violations.
- Do a manual keyboard-only playthrough.
- Run a VoiceOver/TalkBack-style announcement test via Playwright accessibility snapshots.
- Do a colour-blind simulation check (protanopia, deuteranopia, tritanopia) on the result states and the certificates.
- Save screenshots of every result panel in both themes at 390px and at 200% zoom.

## 3. Checks

Run the full Playwright suite, the emoji-glyph check and Lighthouse SEO (production 100). Save screenshots of every icon on WebKit iPhone profiles.

## Do not

Don't post anything, don't change the schedule, and don't touch player data.
