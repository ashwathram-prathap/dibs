# Codex handoff: Dibs

Paste everything below the line into Codex. Run it under the separate macOS user you set up for Codex projects.

---

## What you're building

**Dibs** is a daily browser game. (Internally, a successful dibs is a "claim".)

- **One category per day.** At 9:00 PM America/Toronto, a new category drops (for example "Animals", "Foods" or "Cities").
- **Every valid answer can be owned by one person in the world.** First come, first served.
- **One successful claim per person per day.** If your answer is taken, you see who took it and when, and you try another.
- **Your claim becomes a certificate,** a share card that says something like: *"I called dibs on AXOLOTL. Dibs No. 31 of 8,400 animals."*
- **Everything shown is real.** Player counts, claims and leaderboards are never faked, seeded with bots or padded. When numbers are small, show them small.

**Visuals are the product.** It must not look AI-generated or templated. If a choice is between polish and a feature, choose polish. The full art direction is below, and it is a hard requirement, not a suggestion.

## Stack

- **Front end:** Vite + React + TypeScript, deployed to Cloudflare Pages.
- **Back end:** one Cloudflare Worker (the API) with a D1 database (SQLite). Add Cloudflare Turnstile to the claim action.
- **Styling:** plain CSS with custom properties, or CSS Modules. If you use Tailwind, replace the whole default theme. No default Tailwind palette, radii or shadows anywhere.
- **Motion:** Framer Motion.
- **Share cards:** render to PNG client-side (html-to-image or canvas). Stretch goal: per-claim Open Graph images from the Worker using satori or workers-og.
- **Fonts:** self-host all of them.
  - Display: **Archivo**, using the variable width axis. Expanded and Black for stamps and headlines, Condensed for dense labels.
  - Text: **Instrument Sans**.
  - Numbers and serials: **IBM Plex Mono**, with tabular figures.
  - Do not use Inter, Space Grotesk, Poppins or system-ui as a visible face.

## Art direction: a county land-registry office, printed on paper

The concept is that you're filing a claim at an old registry office. Think deeds, ledgers, rubber stamps, ticket stubs, carbon copies and municipal forms. It should feel tactile, printed, slightly imperfect and very confident.

### Palette (hard rules)

| Name | Hex | Role |
| --- | --- | --- |
| Paper | `#F1ECE2` | Main background |
| Paper-dark | `#E4DDCF` | Panels and ledger stripes |
| Ink | `#1A1A17` | Text and rules |
| Ink-60 | `#5C5A53` | Secondary text |
| Vermilion | `#E1462B` | Stamps, the live claim and the single call to action |
| Registry blue | `#22408F` | Links and "taken" metadata only, sparingly |

- **Dark mode is "carbon copy":** background `#16150F` with paper-coloured text. Vermilion stays the same.
- No other colours.
- No gradients of any kind.

### Texture and imperfection

- **Subtle paper grain:** a single tiled noise PNG at about 4% opacity. No CSS noise filters on scroll containers, for performance.
- **Stamp misregistration:** stamped text gets an SVG `feTurbulence` + `feDisplacementMap` ink-bleed filter and a random rotation between -4° and 3°, seeded by claim number so it's stable.
- **Hairline rules everywhere:** 1px ink rules, perforation lines (dashed) and registration marks in the corners of the certificate.

### Typography

- **Headline scale:** the category name is huge (Archivo Expanded Black, about 18vw on mobile, all caps, tight tracking). Labels are tiny (11 to 12px uppercase mono with wide tracking).
- **Hierarchy comes from contrast in size and width, not colour.**
- **Serial numbers everywhere,** in mono: `DIBS No. 0031`, `REG. 2026-11-21`, `FORM C-1`.

### Layout

- **Strict 4-column mobile grid** (12 columns on desktop), with visible structure: rules, column labels, form-field boxes.
- **Asymmetric, left-aligned compositions.** Don't centre everything.
- **Square corners.** Radius 0, or 2px max on inputs.
- **No drop shadows.** Depth comes from offset ink borders (a 2px ink outline plus a 4px offset solid block), like printed forms.

### Voice

- **Copy reads like a dry, slightly funny registry clerk.** For example: "Your dibs has been entered into the public record." "AXOLOTL is already registered to Teal Otter #41 (9:04 PM). Please call dibs on something else." "Office reopens in 03:12:44."
- **No exclamation marks, no emoji, no hype words.** Never write "amazing", "unlock", "level up", "seamless" or "AI-powered".

### Anti-AI checklist (check every screen against it; any hit is a bug)

1. No purple, blue or teal gradients. No mesh or blob backgrounds. No glassmorphism, blur or glow.
2. No hero section with three feature cards underneath.
3. No rounded cards with soft shadows. No pill buttons.
4. No emoji or sparkle icons. No Lucide or Heroicons used decoratively. Draw any icon yourself as simple SVG in the ink style, or leave it out.
5. No centred-everything layouts. No generic "Get started" or "Learn more" buttons.
6. No Inter or system fonts visible.
7. No placeholder or lorem text, and no stock illustrations.
8. Every screen has at least one deliberate detail: a serial number, a stamp, a rule, a form-field label.

### Self-review loop

After every UI change:
- Run Playwright screenshots at 390×844 and 1440×900, in both light and dark mode.
- Compare them against this section and the checklist, and fix anything off.
- Include the screenshots in your milestone report.

## Screens

### 1. Today (home)

- **Top strip:** `REGISTRY OF CLAIMS · FORM C-1 · REG. <date>` and a live countdown to the next drop.
- **Category headline:** the huge category name (e.g. `ANIMALS`) with a small mono line beneath it: `8,400 registrable · 31 claimed · 8,369 open`. Real numbers only.
- **The claim form:** styled like a paper form field labelled `ENTRY:`, with a vermilion `CALL DIBS` button using the offset-ink style.
  - Autocomplete appears after 3 characters, from the canonical list only. It never shows claimed or unclaimed status.
  - On submit, run Turnstile, then call the API.
- **Taken:** show an inline clerk line with the owner's handle and time, then let them retry. Unlimited retries until one claim succeeds.
- **Success, the signature moment (polish this the most):**
  1. A rubber stamp slams down with a scale from 1.4 to 1, a 6px screen shake on mobile and the ink-bleed filter.
  2. A big `DIBS` stamp lands, with the answer and the dibs number.
  3. The certificate then slides up from the bottom like a receipt being printed, with a line-by-line reveal.
  4. Total time is under 1.4 seconds.
  5. Respect `prefers-reduced-motion`.
- **Live ledger below:** a dense, striped registry table with columns `No. | ENTRY | HOLDER | SCHOOL | TIME`.
  - Poll every 5 seconds. New rows ink in at the top with a brief vermilion highlight that fades to ink.
  - Searchable.
  - With only 3 rows it must still look intentional, like a real ledger page with empty ruled lines. It must never look broken.

### 2. Certificate (your claim)

- **A deed or certificate layout:** registration corner marks, a perforated edge and the serial `CERTIFICATE OF DIBS No. 0031`.
- **Content:** the answer in huge Archivo, the category, the date, `HELD BY Teal Otter #41 · University of Waterloo`, and the claim's obscurity rating (see Scoring).
- **A small URL** in the footer.
- **Export as PNG** at 1080×1350 (X and Instagram feed) and 1080×1920 (Stories and TikTok), using the Web Share API with a download fallback.
- **A "Copy text" button** that copies: `I called dibs on AXOLOTL. Dibs No. 31 of 8,400 animals. <url>`
- The certificate must look great as a small thumbnail in a feed.

### 3. Registry archive

- Past days' full ledgers ("who owned what on Nov 21").
- Each day is a page of a bound ledger.

### 4. Schools board

- Today's claims counted by school, as a typeset results table. No chart-library look.
- The cumulative season table sits below it.

### 5. About (the "Office notice" page)

- How it works, in five lines.
- Privacy: what's stored, and that nothing is sold.
- "Built by Ashwathram Prathap", linked to https://www.ashwathram.ca, plus a GitHub link.

## Identity (no free-text names)

- **First visit:**
  - Generate a handle like `Teal Otter #41` from curated word lists (colours plus animals; write about 60 of each, all brand-safe).
  - The user can re-roll up to 3 times, then it locks.
  - The user picks a school from a fixed list: University of Waterloo, Wilfrid Laurier, University of Toronto, McMaster, Western, Queen's, TMU, York, Other, None.
- **Store it** as an anonymous account: a random user ID in a signed, httpOnly cookie (HMAC with a Worker secret).
- **No email and no passwords for v1.** Keep a hook for optional Google sign-in later.
- **Users never type a public name.** That rules out slurs on share cards by design.

## Data model (D1)

- `categories(id, date, name, slug, total_registrable, drop_at)`
- `answers(id, category_id, canonical, display, aliases_json, obscurity)`
- `users(id, handle, school, created_at, rerolls_used)`
- `claims(id, category_id, answer_id, user_id, claim_no, created_at)`
  - Add `UNIQUE(category_id, answer_id)` and `UNIQUE(category_id, user_id)`.
  - Assign `claim_no` atomically in the same transaction.
- `rate_limits(ip_hash, day, count)`
  - The IP is hashed with a daily rotating salt. Never store raw IPs.

## API (Worker)

- `GET /api/today` returns the category, counts and drop time.
- `GET /api/ledger?category=<id>&since=<claim_no>` returns ledger rows.
- `POST /api/claim {answer, turnstileToken}` returns one of:
  - `201 {claim}` when the claim succeeds
  - `409 {takenBy, at}` when the answer is already taken
  - `422` when the answer isn't valid
  - `429` when rate-limited
  - `403` when the user has already claimed today
- `GET /api/me` and `POST /api/me/reroll` handle the user's handle.
- `GET /api/schools?category=<id>` returns the schools board.
- **Admin** (bearer secret): hide a user, void a claim, and upload category JSON.
- **Answer matching:** normalize (lowercase, strip accents, punctuation and whitespace, simple plural folding), then match exactly against canonical names and aliases. No fuzzy matching in v1.

## Abuse protection

- **Turnstile** is required on every claim POST.
- **Limits:** at most 3 claim attempts per minute per user, and at most 5 accounts that successfully claim per IP hash per day.
- **Tests:**
  - A concurrency test: 50 simultaneous claims of the same answer must produce exactly one 201 and 49 409s.
  - A test that one user can't claim twice in a day.

## Scoring and depth (honest, labelled)

- **Obscurity:** each answer gets a precomputed score from 1 to 5, based on the Wikipedia pageviews of its article, computed offline when the category is built.
  - Show it on the certificate as `OBSCURITY ●●●●○ (Wikipedia pageviews)`.
  - Deep cuts (4 and 5) get a `DEEP CUT` stamp variant.
  - This makes late, clever claims feel good instead of feeling like scraps.
- **Streaks:** consecutive days with a claim, shown as a row of small stamp marks.
- **No crowd percentiles.** Nothing like "you beat X% of players" unless it's computed from real data, and not in v1.

## Category pipeline

- **`scripts/build-category.ts`:**
  - Takes a Wikidata or Wikipedia list source.
  - Outputs `categories/<slug>.json` with canonical names, aliases and obscurity.
  - Drops anything offensive or ambiguous, and dedupes.
- **Only use categories with at least 2,000 valid answers,** so they never sell out.
- **Build 30 to start:** animals, foods, cities, countries plus capitals, films, bands, chemical elements plus minerals, plants, sports, fonts, and so on. Skip anything that would be small.
- **Every category is reviewed by me** before it's scheduled. Generate a review checklist for each one.

## Analytics

- Cloudflare Web Analytics (cookieless).
- An admin `/stats` page reading from D1: daily active claimers, new users, claims per day, D1/D7 retention and share-button taps (log a share event with no content).

## Milestones (stop after each and show screenshots)

1. **M1, visual prototype first:** all screens, the stamp animation and the certificate, running on local mock data.
   - Mock data lives only in a dev fixture file and must never ship to production.
   - Deliver Playwright screenshots in light and dark mode, plus a screen recording of the claim moment.
   - **I approve the look before any back-end work.**
2. **M2:** Worker, D1 schema, claim API, Turnstile, identity, the concurrency test, and 3 real categories.
3. **M3:** live ledger, archive, schools board, streaks, obscurity, PNG export and the share flow.
4. **M4:** category pipeline with 30 categories, admin tools, analytics, OG images, deployed on a custom domain, and a Lighthouse score of 90+ on mobile.

## Acceptance checks

- Every screen passes the anti-AI checklist at both screenshot sizes.
- A brand-new install with zero claims looks intentional, not empty or broken.
- No fabricated numbers anywhere in production. Grep for fixture imports in the production bundle.
- Exported PNGs are crisp on iPhone Safari and Android Chrome.
- The concurrency and double-claim tests pass.
- No raw IPs or free-text names are stored.
