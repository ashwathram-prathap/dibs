# OVERNIGHT.md: unattended run rules (these override SPEC.md)

I'm asleep. Nobody can answer questions or approve anything until morning. Work through the whole of SPEC.md without stopping.

## Product name

The product is called **Dibs**. Use "Dibs" in all user-facing copy, titles, meta tags, share text and the Pages project name (`dibs`, or the closest free name). SPEC.md is already updated.

## How to run

1. **Do M1 through M4 back to back.** Wherever SPEC.md says "stop and show me", don't stop. Save the screenshots and recordings to `review/` and keep going.
2. **When something is ambiguous,** choose the most reasonable option, note it in `MORNING_REPORT.md` under "Decisions I made", and continue.
3. **Push to GitHub regularly, not just at the end.**
   - **First thing:** create the private repo, make an initial commit with SPEC.md, OVERNIGHT.md, `.gitignore` and the README skeleton, and push it.
   - **Then commit and push after every meaningful step:** each screen, each API route, each test suite, each fix. Never let more than 30 minutes of work go unpushed.
   - **Commit messages** are clear and prefixed with the milestone, for example `M1: certificate layout` or `M2: claim API + concurrency test`.
   - **Before every push,** run `git status` and check that no secrets are staged. `.dev.vars`, `.env*`, `MORNING_REPORT.md` and `wrangler` secret values must be in `.gitignore`.
   - **Tag each finished milestone,** for example `git tag m1-done && git push --tags`.
   - **If a push fails,** fix it (rebase or retry). Never force-push, and never rewrite pushed history.
4. **Don't stop early.** If a step fails, debug it. If you're truly blocked after 3 different attempts, write it up in the report and move on to the next task.
5. **You're done only when** every acceptance check in SPEC.md passes or is documented as blocked.

## Accounts and infrastructure (already logged in on this Mac: `gh` and `wrangler`)

- **GitHub:** create a **private** repo named `dibs` with `gh repo create dibs --private --source=. --push`. Never make it public.
- **Cloudflare database:** create the D1 database with `wrangler d1 create dibs-db` and run the migrations locally and remotely.
- **Turnstile:** create the widget with `wrangler turnstile widget create`. Allowed hostnames are the pages.dev domain and `localhost`.
  - Store the secret with `wrangler secret put TURNSTILE_SECRET`.
  - Never commit it.
- **Other secrets:** generate `COOKIE_SECRET` and `ADMIN_TOKEN` with `openssl rand -hex 32` and store them with `wrangler secret put`.
  - Write the `ADMIN_TOKEN` value to `MORNING_REPORT.md` so I can use the admin tools.
  - Make sure `MORNING_REPORT.md` is in `.gitignore`.
- **Hosting:** deploy the front end to Cloudflare Pages and the API to Workers.
  - Use the default `*.pages.dev` and `*.workers.dev` URLs only. No custom domain tonight.
- **Never add a payment method,** upgrade a plan or enable anything paid. Stay on free tiers only.

## Hard limits

- **Only touch files inside this project folder.** Don't read, change or delete anything elsewhere on this Mac. The exceptions are global tool installs (npm and npx packages, Playwright browsers).
- **Don't post, announce or share anything.** No social media, no emails, no Product Hunt or Hacker News, and no public links anywhere. The deploy is a private preview only I know about.
- **Never show fabricated player data in production.** Mock data stays in dev fixtures only.
- **Categories:**
  - Build all 30 into `categories/`.
  - Schedule only 3 for the first 3 days, all marked `status: "draft"` for my review.
  - Put a review checklist for each one in `review/categories.md`.

## Visual quality bar

- Visuals matter more than features.
- Run the Playwright screenshot plus anti-AI-checklist loop from SPEC.md after every UI change. Fix every hit before moving on.
- At the end, do one final full design pass across every screen in light and dark mode, at 390px and 1440px wide.
- Save the final screenshots to `review/final/`.

## Cross-device compatibility (required, same priority as visuals)

The game must work and look right on every common device and browser.

### Browsers

- iOS Safari 16+ (iPhone and iPad)
- Android Chrome
- Samsung Internet
- Desktop Chrome, Safari, Firefox and Edge
- In-app browsers: Instagram, TikTok, X, Discord and iMessage link previews. Most visitors will arrive this way.

### Screen sizes

- Layout works at every width from **320px** (iPhone SE) to **2560px**, in portrait and landscape.
- On ultra-wide screens, content gets a max width with intentional margins. Never stretch it.

### Mobile details

- Use `100dvh`, not `100vh`, so iOS Safari's address bar doesn't break the layout.
- Respect safe-area insets for the notch and home bar: `env(safe-area-inset-*)` plus `viewport-fit=cover`.
- Inputs are at least 16px so iOS doesn't zoom in on focus.
- Turn off autocorrect and autocapitalize on the claim field, and set `enterkeyhint="go"`.
- The on-screen keyboard must never cover the input or the CALL DIBS button. Test this on iOS and Android.
- Tap targets are at least 44×44px. There are no hover-only interactions; everything works by touch.
- No horizontal scrolling anywhere.

### Graceful fallbacks

- **Sharing:** if the Web Share API or file sharing isn't supported, especially in in-app browsers, fall back to a PNG download plus "Copy text". If even downloads are blocked, open the image so it can be long-pressed and saved, and show a one-line hint.
- **Cookies:** if cookies or storage are blocked (private mode, some in-app browsers), show a clear clerk-voice message instead of a broken state.
- **Ink-bleed filter:** if the SVG filter is too slow on low-end Android, detect it and use a static stamp image instead.
- **Old browsers:** if JavaScript is old or fails, show a plain "please open in a newer browser" notice.

### Accessibility

- Keyboard-only play works.
- Visible focus states, styled in the ink look.
- Screen-reader labels on all controls.
- Colour contrast passes WCAG AA in both light and dark modes.
- `prefers-reduced-motion` is respected.

### Testing

**Never run browser or test matrices in GitHub Actions. Run them locally.**

- Run the Playwright suite on **WebKit, Chromium and Firefox**.
- Use these device profiles: iPhone SE, iPhone 15 Pro, iPhone 15 Pro Max, Pixel 7, Galaxy S9+ (small Android), iPad Mini, iPad Pro landscape, and desktop at 1280, 1440 and 2560px.
- For each profile, play the full flow end to end: load, claim, taken, success, certificate, share fallback, ledger. Screenshot every step.
- Save the results to `review/devices/` and include a pass/fail table in the morning report.
- Run Lighthouse mobile on a throttled "Slow 4G" profile: performance 90+ and accessibility 95+.

## When finished, write `MORNING_REPORT.md` (keep it short)

1. **Live URLs:** the Pages site and the Worker API.
2. **What's done,** milestone by milestone, with test results.
3. **What's broken or blocked,** and exactly what I need to do about each item.
4. **Decisions I made** while I was asleep.
5. **Secrets created** (names only, plus the `ADMIN_TOKEN` value).
6. **Where the screenshots are,** and the 3 screens you think are weakest visually.
7. **The 5 things I should check first** on my phone.
8. **Device and browser pass/fail table,** plus any known device issues.
