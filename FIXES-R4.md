# FIXES-R4.md: round 4, sharing everywhere (run AFTER Round 3 is finished and tagged)

> OVERNIGHT.md rules apply: unattended run, `R4:` commits, push regularly, tag `r4-done`, and add a "Round 4" section to MORNING_REPORT.md.

## Goal

After finishing a day, a player can post their result to any platform in 2 taps, and it looks great everywhere.

## 1. The share sheet (on the Day summary and on each certificate)

- **Primary button: `SHARE`.**
  - On mobile, call the Web Share API with the **story PNG (1080×1920) as a file**, plus the share text and URL. That opens the phone's native sheet, which already lists Instagram, TikTok, WhatsApp, Snapchat, Messages and so on.
  - If file sharing isn't supported, share the text and URL only, then offer the image download.
- **Platform buttons below it** (styled as small ink-outlined form boxes, not brand-coloured icons; brand names in text only, no logos):
  - **X:** opens `https://twitter.com/intent/tweet?text=<share text>&url=<url>`
  - **WhatsApp:** opens `https://wa.me/?text=<share text + url>`
  - **Facebook:** opens `https://www.facebook.com/sharer/sharer.php?u=<url>`
  - **Instagram / TikTok story:** neither supports web posting. Save the 1080×1920 PNG (using the share sheet with a file if available, otherwise download), then show a one-line clerk tip: "Saved. Open Instagram or TikTok, add it to your story, and add a link sticker."
  - **Copy link:** copies the URL and shows "Copied."
- Every button works in the Instagram, TikTok and X in-app browsers. Test with the in-app-browser user agents, and fall back to download plus long-press when downloads are blocked.

## 2. Two image formats, designed for each place

- **Story (1080×1920):** the day summary and dibs, safe from the top 160px and bottom 260px, where the story UI and link stickers go.
- **Feed (1080×1350):** the same content, laid out for X, Instagram feed and Facebook.
- Both must read clearly as small thumbnails, use the public domain, and never contain localhost.

## 3. Link previews (what appears when someone pastes the link)

- **Every certificate and day-summary URL gets its own Open Graph and Twitter card image** (1200×630, `summary_large_image`), generated once and cached, following the Round 2 OG budget.
- Title and description are spoiler-free on the day itself. For example, a summary shows "3/3 · 1 strike" rather than the answers until the category closes.
- Check the previews with real fetch tests against WhatsApp, X, Facebook, iMessage and Discord user agents. Verify the image loads in under 2 seconds and is under 300 KB.

## 4. Tracking (no personal data)

- Log one anonymous event per share-button tap, recording the platform name only, and show the counts per platform on the admin `/stats` page.
- **Add an optional `?s=<platform>` to shared URLs.** On first visit, count arrivals by platform, so we learn which platform actually brings players.

## Checks

- Playwright: every button appears and triggers the right intent URL or fallback on iPhone, Android and desktop profiles.
- Save screenshots of the share sheet and both PNG formats to `review/final/`.

## Do not

- Never post anything anywhere. The owner shares manually.
- No third-party share widgets or tracking scripts.
- Never fabricate share counts.
