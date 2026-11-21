// Local-only administrative handoff. The generated file is ignored and mode 0600.
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
const env = readFileSync('.dev.vars', 'utf8');
const token = env.match(/^ADMIN_TOKEN=(.+)$/m)?.[1];
if (!token) throw new Error('ADMIN_TOKEN is missing from the local secret file');
const categories = JSON.parse(readFileSync('review/category-validation.json', 'utf8'));
if (!categories.passed || categories.registers !== 30)
  throw new Error('Catalog validation must pass before the final handoff');
const lighthouse = JSON.parse(readFileSync('review/lighthouse/mobile.json', 'utf8'));
const performance = Math.round(lighthouse.categories.performance.score * 100);
const accessibility = Math.round(lighthouse.categories.accessibility.score * 100);
const content = `# Dibs — morning report

## 1. Live URLs

- Pages: https://dibs-7hz.pages.dev
- API: https://dibs-api.dibs-registry.workers.dev/api/today
- Private repository: https://github.com/ashwathram-prathap/dibs

The preview is unlisted/noindex, **not access-controlled**. No announcement, social post, paid upgrade or custom domain was made. Production has zero users and zero claims after removing only our exact QA accounts.

## 2. What's done

- **M1:** All screens, paper/carbon themes, self-hosted fonts, grain, ink rules, visible stamp impact and receipt reveal under 1.4 seconds. Final gallery: [review/index.html](review/index.html).
- **M2:** Worker, D1, Turnstile, signed first-party identity, rerolls, school selection, moderation, atomic serials and abuse limits. **17 tests pass**, including 50 simultaneous claims → one 201 and 49 409s, double claims and shared-IP quota. Real local browser→D1 integration passes.
- **M3:** Polling/searchable ledger, archive, schools, streaks, measured obscurity, two PNG sizes and share/manual-save/text fallbacks. **30 browser configurations pass**, four motion proofs and four fallback scenarios pass; 20 live page checks have no axe AA violations or overflow.
- **M4:** **30 draft categories / ${categories.entries.toLocaleString()} measured entries**, each ≥2,000; admin tools, D1 statistics/retention, per-claim OG, deployment and private GitHub pushes. Final mobile Slow 4G Lighthouse: **${performance} performance / ${accessibility} accessibility**. Dependency audit: zero vulnerabilities. Remaining external blockers below.

## 3. Blocked / your next actions

1. **Owner category review:** review [review/categories.md](review/categories.md). Animals, Plants and Birds alone have proposed dates, November 21–23 at 9 PM Toronto, all drafts. Use README's admin approve command only after review; choose future dates if these have passed. Until then, the closed office is intentional.
2. **Cloudflare Web Analytics:** Wrangler OAuth lacks RUM permission (list and create both 403); dashboard browser access was unavailable. Enable free Web Analytics in Cloudflare, save its public beacon token as \`VITE_CF_ANALYTICS_TOKEN\` in ignored \`.env.local\`, run \`npm run deploy:web\`. D1 stats already work.
3. **Firefox:** all six cases are blocked before page load by macOS profile/sandbox/framebuffer errors. Bundled, project-local/headed, older/manual releases and reduced sandbox attempts failed. Rerun on a host where Firefox launches, or Linux. No system settings were changed.
4. **Physical devices:** iOS Safari 16 specifically, Android/Samsung Internet, native Edge, social-app webviews, real keyboards/share sheets and iMessage previews remain unverified. Positive production Turnstile verification also needs the first real claim after category approval. Emulation is not a physical-device pass.

## 4. Decisions I made

Small categories (countries, elements, sports, fonts) were replaced by larger registers. Source scopes, scientific names and disambiguating titles are explicit in the review docket. Obscurity uses measured mean daily pageview bands, never player percentiles. D1 daily stats use UTC; claims/streaks/drop times use Toronto. Handle and school lock after the first claim. Voids preserve occupied slots and serials. Pages proxies the Worker for first-party Safari cookies. OG uses bundled font outlines/resvg; PNG exports use canvas.

## 5. Secrets created

\`COOKIE_SECRET\`, \`TURNSTILE_SECRET\`, \`ADMIN_TOKEN\` are stored as Worker secrets. Local secret files and this report are ignored; this file is mode 0600.

ADMIN_TOKEN:

\`\`\`text
${token}
\`\`\`

Do not commit this report or put the token in a URL. README documents admin commands and local setup.

## 6. Screenshots and visual judgement

Open [review/index.html](review/index.html). Final 390/1440 light/dark PNGs are in \`review/final/\`; the recording is \`review/final/claim-moment.webm\`. Per-device step captures remain local in \`review/devices/\`; motion, fallback and real local integration proofs have their own folders. Full evidence and caveats: [review/ACCEPTANCE.md](review/ACCEPTANCE.md).

Weakest three: empty Schools (two long ruled tables), empty Archive (little content before launch), admin Stats (utilitarian). They remain deliberate and usable.

## 7. First five phone checks

1. Open the preview in Safari and Chrome; switch themes, rotate, check the notch, navigation and 320px layout. Closed office is expected before approval.
2. After approving a future register and its drop, focus ENTRY: confirm the keyboard leaves both field and CALL DIBS accessible; select an autocomplete answer.
3. Complete real Turnstile and one claim; check the visible stamp/receipt, then reload to confirm your identity and claim persist. Verify a taken answer from a second browser/account.
4. Save feed and story PNGs; inspect sharpness. Test native sharing, Copy text and manual long-press save inside a social-app browser.
5. Open a certificate link in iMessage/Discord, inspect its preview and try reduced-motion/private-cookie settings. Return after the next reviewed drop to verify the attendance streak.

## 8. Device/browser results

Both themes in every automated row. These are Playwright emulations, not physical devices.

| Profile / engine | Result |
| --- | --- |
| iPhone SE, 15 Pro, 15 Pro Max / WebKit | 6 PASS |
| Pixel 7, Galaxy S9+ / Chromium | 4 PASS |
| iPad Mini, iPad Pro landscape / WebKit | 4 PASS |
| Desktop Chrome engine 1280/1440/2560 | 6 PASS |
| Desktop Safari engine 1280/1440/2560 | 6 PASS |
| 320px phone + 844px phone landscape | 4 PASS |
| Desktop Firefox 1280/1440/2560 | 6 BLOCKED at launch |
| Physical iOS/Android, Samsung Internet, Edge, social webviews | NOT RUN — needs devices |

Known device gap: actual keyboard occlusion, file-share gesture restrictions, download/long-press behavior and native preview caching cannot be certified by emulation. Fallbacks are implemented and engine-tested.
`;
writeFileSync('MORNING_REPORT.md', content, { mode: 0o600 });
chmodSync('MORNING_REPORT.md', 0o600);
console.log('Wrote ignored MORNING_REPORT.md (0600); token not printed.');
