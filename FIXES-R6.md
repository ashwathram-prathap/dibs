# FIXES-R6.md: domain, practice copy, Monday launch, house words and golden tickets (run AFTER Round 5 is tagged `r5-done`)

> OVERNIGHT.md rules apply: `R6:` commits, push regularly, tag `r6-done`, and add a "Round 6" section to MORNING_REPORT.md.

## A. Connect the custom domain (skip anything Round 5 already finished)

`DOMAIN.txt` contains `dibs.here`. The owner bought it at Porkbun.
- Add `dibs.here` (and `www.dibs.here`) to the Cloudflare account and to the Pages project as custom domains.
- If the zone isn't on Cloudflare yet, create the zone and put the two Cloudflare nameservers it assigns under "Owner steps", with the exact Porkbun click path (Domain Management, then NS, then replace with the Cloudflare nameservers). Then continue with every other step that doesn't need DNS to be live.
- Set `PUBLIC_ORIGIN=https://dibs.here`, add `dibs.here` to the Turnstile hostnames, and redeploy.
- Once DNS is active, verify that certificates, OG images and share text all use dibs.here. If DNS isn't active by the end of the run, write the exact verification commands for the owner.

## B. Private practice copy for the owner to play-test before launch

- Deploy a separate **staging** environment: its own D1 database (`dibs-db-staging`), its own Worker and a Pages preview branch URL. The Worker and preview URL are marked noindex.
- It has a **PRACTICE** category (Animals, a copy) that's always open, with a large `PRACTICE — NOT THE PUBLIC RECORD` banner. Staging data never touches production.
- Add an admin-only staging reset command so the owner can clear practice claims and replay.
- Put the staging URL at the top of the report, so the owner can test the full flow on a real phone today.

## C. Move the launch to Monday Nov 23, 2026

- The first drop is **Monday Nov 23, 2026 at 9:00 PM America/Toronto**: Animals. Shift the whole approved schedule one day earlier (Plants Nov 24, Birds Nov 25, and so on), keeping the order.
- Respect the upload budget. If a shifted date would come before a category's verified upload, push only that category back and log it.
- Update the closed-office countdown and the rollout workflow to match.

## 1. House words (held by the Registry)

- Each day, the **10 most obvious answers** in the category (the highest Wikipedia pageviews, e.g. DOG, CAT, LION) are pre-held by **"The Registry"**.
- **They're clearly labelled, never disguised as players.**
  - Holder name: `THE REGISTRY`, with a distinct house stamp style (registry blue, not vermilion).
  - They never count as player claims, players or ledger entries in any player count.
- **Guessing one costs a strike,** like any taken answer, with the clerk line: "DOG is held by the Registry. Obvious picks are reserved."
- **They stay hidden** until someone guesses one, or until the day closes. Then the full reserved list is revealed on that day's archive page.
- The "How it works" copy adds: "The 10 most obvious answers are held by the house."
- Counts shown to players exclude house words. "2,390 still up for grabs" is calculated honestly, with house words removed from the pool.

## 2. Golden tickets

- Each day, the server secretly picks **3 random answers** as golden tickets, using a server-side seed. Never send the list to the client, and never expose it through any API, page source or cache before the day closes.
  - Picks are random but valid (not house words).
  - Store a hash commitment of the list at drop time and publish the list at close, so anyone can verify it wasn't changed mid-day. Show "Verified" on the archive.
- **When a player claims one:**
  - a special **gold** stamp animation (gold ink, a short shimmer, still in the registry style)
  - a gold certificate variant
  - a ★ in their share line, e.g. `dibs #12 ■★■□ 3/3 · 1 strike · filed 9:04 PM`
  - an announcement on the ledger: "Golden ticket found: 1 of 3"
- **Gold palette:** one muted metallic gold, `#B8902F`, plus a darker `#7A5C14` for text. Use it only for golden tickets, and keep it within the existing palette discipline. No gradients except one subtle sheen in the stamp animation.
- **The Day summary** shows "Golden tickets found: X / 3".

## 3. Tests

- Golden-ticket answers are never present in any client payload, HTML, cache key or API response before the claim or close. Write a test that greps responses.
- House words cost a strike and never appear in player counts.
- Commitment hash verification passes at close.
- Visual: screenshots of the gold stamp, the gold certificate, a house-word strike message and the archive's reserved list, in light and dark mode at 390px and 1440px.

## 4. Drop time

Make the drop time a single config value, `DROP_TIME_LOCAL` with timezone `America/Toronto`, that's easy to change. Keep 9:00 PM unless the owner says otherwise in `DROP_TIME.txt`.

## Do not

- Never fabricate players. "The Registry" is the only non-player holder, and it's always labelled as the house.
- Don't post anything, and don't change plans or billing.
