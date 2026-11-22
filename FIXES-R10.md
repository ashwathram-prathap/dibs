# FIXES-R10.md: visual quality pass plus bug fixes (owner review, Sun Nov 22)

> OVERNIGHT.md rules apply: `R10:` commits, push regularly, tag `r10-done`, and add a "Round 10" section to MORNING_REPORT.md. Practice first, then production. **Everything must be live and verified by Mon Nov 23, 5 PM ET.** After that the freeze applies.

The owner's verdict on Round 9's look: **"frankly terrible now compared to before. Soul does not replace good looks; it needs both."** This round is about visual quality. Don't add features.

## 1. The seal is badly drawn. Fix it or pull it.

**Problems:**
- The pointing hand looks crude: lumpy fingers, random hatch marks.
- The top arc "REGISTRY OF DIBS" isn't centred, and the bottom arc isn't symmetric with it.
- "EST. 2026" collides with the inner ring, and the double rule under the hand floats.
- On the page it's tiny (about 160px), grey, low-contrast and off to the side of the countdown, so nobody can tell what it is.

**Rebuild it to a professional standard:**
- Make the geometry exact. Use concentric rings with the same centre. Put arc text on SVG `textPath` with `startOffset="50%"` and `text-anchor="middle"`, so both arcs are perfectly centred and mirror each other (the top reads clockwise; the bottom reads left-to-right along the lower arc). Separate the two arcs with dots or stars placed at exactly 9 and 3 o'clock.
- Use even letter-spacing, and one weight and size for both arcs.
- **The emblem:** replace the hand-drawn hand with a clean, well-proportioned manicule (☞) traced from a public-domain type ornament, with its source recorded. Or use a bold `d.` monogram in the wordmark font. Pick whichever renders more cleanly at 48px and at 400px.
- Ink at full contrast (ink on paper, paper on ink in dark mode), never grey.
- **Where it appears:** certificates and day certificates (at least 180px on the 1080px exports, bottom right, like a real stamp, at a slight angle), OG images, and the favicon/app icon (in a simplified version).
- **Remove it from the closed-office and Today heroes,** where it's tiny and pointless. If it's shown on the page at all, it must be at least 140px on mobile and 200px on desktop, and placed deliberately.
- **QA it:** render the seal alone at 32px, 64px, 200px and 600px. Save `review/round10/seal-sizes.png`. It must look crisp, symmetric and professional at every size.

## 2. Desktop layout: too much empty space, and it lost its presence

**Problems:**
- At 1440px and 2560px the content is a narrow column with huge empty sides.
- Blocks have different widths: the "Have a file key" box is much wider than the content above it.
- It lost the big, confident type that made Round 7 look good.

**Fix:**
- **One container width for every block.** Use a 12-column grid with a max content width of about 1200 to 1280px, centred. Everything (hero, rules, file-key box, ledger, footer, nav) aligns to the same edges.
- **Closed office on desktop is a two-column hero:**
  - On the left, the NEXT DROP countdown (very large) with "Animals drops Mon 9:00 PM", "Same moment for everyone", the 3 rules and the reminder button.
  - On the right, the **category engraving plate, big** (about 420 to 520px), on the category's paper tint, in a framed "plate" with a caption ("Plate I. Animals").
  - It must fill the space intentionally.
- **Today (open) on desktop:** the play card stays focused and readable, but the category name returns as a **huge display headline across the full container width**, like Round 7's ANIMALS, with the engraving plate beside or behind the card. No large dead zones.
- **Mobile:** keep the countdown hero. The engraving goes above or below it, at full width. Respect the no-scroll play rule.
- Move the **main nav (Today / Archive / Office notice) to the header** on desktop. It's currently buried at the bottom.
- Fix "Animals drops Mon 9:00 PM ET." so "ET" isn't shrunken below the baseline. Use consistent sizing.

## 3. Engraving plates must look good

The plates must look like real, high-quality engravings: fine line weight, readable at size, consistent style across categories. Don't use a tiny icon-sized butterfly for Animals. Use a proper plate (e.g. a multi-animal natural-history composition, or a single striking animal) that reads beautifully at 400px or more. If a plate isn't good enough, use none, rather than a weak one.

## 4. Bugs

1. **The Day Certificate reminder** says "Remind me at 7:18 PM ET". It must always be the drop time (9:00 PM in the viewer's timezone, with the alert 5 minutes before). Audit every reminder button and `.ics` file.
2. **"Poutine" is missing from Foods.** Add it. Then run an additional Canada-specific coverage list for Foods, Cities and other relevant categories (e.g. poutine, butter tart, Nanaimo bar, BeaverTails, ketchup chips, tourtière, peameal bacon, Kitchener, Mississauga, Brampton, Markham, Guelph), and fix any gaps.

## 5. Visual QA gate (mandatory)

- For every changed screen, produce **before (Round 7 final) vs after** comparisons at 390px, 1440px and 2560px, in both themes. Save them to `review/round10/before-after/`.
- Score each screen 1 to 10 for visual quality using this rubric: alignment and consistent widths; type scale and hierarchy; intentional use of space; craft of every graphic; brand recognisability. **An "after" scoring lower than its "before" on any screen must be fixed before shipping.**
- Run the anti-AI checklist again.
- Fix every misalignment you find. Check every block's left and right edges against the container width at 1440px.
- Add a 30-second screen recording of the closed office and a full play at 1440px.

## Do not

- Don't add features.
- Don't change game rules, schedule or data (except adding the missing answers).
- Don't post anything.
