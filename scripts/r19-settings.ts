import { chromium, webkit, firefox } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const phase = process.argv[2] || 'before';
const results: any[] = [];
mkdirSync('review/round19/settings', { recursive: true });
for (const [name, engine] of Object.entries(
  process.env.R19_FIREFOX ? { firefox } : { chromium, webkit },
)) {
  const browser = await engine.launch({ env: { ...process.env, TMPDIR: process.cwd() + '/.tmp' } });
  for (const [width, height] of phase === 'before'
    ? [
        [1470, 956],
        [1440, 900],
        [360, 780],
        [384, 854],
        [412, 915],
      ]
    : [
        [1470, 956],
        [1440, 900],
        [320, 800],
        [360, 780],
        [375, 667],
        [384, 854],
        [390, 844],
        [412, 915],
        [430, 932],
        [768, 1024],
      ])
    for (const scale of phase === 'before' ? [1, 1.3, 2] : [1.3, 2])
      for (const theme of ['light', 'dark'] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme: theme,
          reducedMotion: 'reduce',
          ...(width < 500 && name === 'chromium'
            ? {
                userAgent:
                  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
              }
            : {}),
        });
        const page = await context.newPage();
        if (phase === 'before') {
          // Serve the untouched R18 CSS under its own matching CSP hash.
          const { createHash } = await import('node:crypto');
          await page.route('**/*', async (route) => {
            if (route.request().resourceType() !== 'document') return route.continue();
            const response = await route.fetch();
            const css = readFileSync('.tmp/r19-original.css', 'utf8');
            const html = (await response.text()).replace(/<style>[\s\S]*?<\/style>/g, (block) =>
              block.length > 1000 ? '<style>' + css + '</style>' : block,
            );
            const headers = { ...response.headers() };
            headers['content-security-policy'] = headers['content-security-policy'].replace(
              "style-src 'self'",
              "style-src 'self' 'sha256-" + createHash('sha256').update(css).digest('base64') + "'",
            );
            await route.fulfill({ response, body: html, headers });
          });
        }
        await page.goto('http://127.0.0.1:5199/?r7-closed');
        await page.locator('.header-settings > summary').click();
        await page.locator('#file-settings > summary').click();
        await page.locator('.your-backup-code output').waitFor();
        await page.getByRole('button', { name: 'Delete my data', exact: true }).click();
        await page.locator('#restore-key').fill('DIBS-ABCDE-12345-FABCD-67890');
        await page.locator('#delete-key').fill('DIBS-ABCDE-12345-FABCD-67890');
        await page.evaluate((scale) => {
          document.documentElement.style.fontSize = 16 * scale + 'px';
        }, scale);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const violations = await page.locator('.header-controls').evaluate((panel) => {
          const right = panel.getBoundingClientRect().right;
          return [panel, ...panel.querySelectorAll('*')]
            .filter(
              (el) =>
                el.getBoundingClientRect().width > 0 &&
                (el.scrollWidth > el.clientWidth + 1 ||
                  el.getBoundingClientRect().right > right + 1),
            )
            .map((el) => ({
              tag: el.tagName,
              cls: el.className,
              id: el.id,
              scroll: el.scrollWidth,
              client: el.clientWidth,
              right: el.getBoundingClientRect().right,
              panelRight: right,
            }));
        });
        results.push({
          name,
          width,
          height,
          scale,
          theme,
          violations,
          documentOverflow: await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        });
        if (phase === 'before' ? violations.length > 0 : scale === 1.3)
          await page.screenshot({
            path: `review/round19/settings/${phase}-${name}-${width}-${scale}-${theme}.png`,
          });
        writeFileSync(
          `review/round19/settings/${process.env.R19_FIREFOX ? 'firefox-' : ''}${phase}.json`,
          JSON.stringify(results, null, 2),
        );
        await context.close();
      }
  await browser.close();
}
writeFileSync(
  `review/round19/settings/${process.env.R19_FIREFOX ? 'firefox-' : ''}${phase}.json`,
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify({
    phase,
    cases: results.length,
    failed: results.filter((r) => r.violations.length || r.documentOverflow).length,
    first: results.find((r) => r.violations.length),
  }),
);
if (phase === 'after' && results.some((r) => r.violations.length || r.documentOverflow))
  process.exitCode = 1;
