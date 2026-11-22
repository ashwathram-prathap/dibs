import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
const practice = process.argv.includes('--practice');
const origin = practice ? 'https://practice.dibs-7hz.pages.dev' : 'https://dibs.here';
const report: any[] = [];
const check = (name: string, passed: boolean, detail?: any) =>
  report.push({ name, passed, detail });
for (const path of ['/', '/about', '/archive']) {
  const response = await fetch(origin + path);
  const html = await response.text();
  check(
    path + ' successful HTML',
    response.ok && response.headers.get('content-type')?.includes('text/html') === true,
  );
  check(
    path + ' index policy',
    practice
      ? /noindex/.test(response.headers.get('x-robots-tag') || '')
      : !/noindex/.test(response.headers.get('x-robots-tag') || ''),
  );
  check(path + ' canonical', html.includes('rel="canonical" href="' + origin + path + '"'));
  check(
    path + ' social tags',
    /property="og:title"/.test(html) &&
      /name="twitter:card"/.test(html) &&
      /property="og:image"/.test(html),
  );
  check(path + ' English/theme', html.includes('lang="en"') && html.includes('name="theme-color"'));
  check(
    path + ' no creator credit',
    !/ashwathram\.ca|github\.com\/ashwathram|Built by Ashwathram|Made by Ashwathram/.test(html),
  );
  if (path === '/')
    check(
      'crawlable home rules/FAQ',
      /<h1>Dibs<\/h1>/.test(html) && html.includes('How to play') && html.includes('Is it free?'),
    );
  if (path === '/about')
    check(
      'crawlable privacy',
      html.includes('Missing-answer submissions') && html.includes('privacy@dibs.here'),
    );
  if (!practice)
    check(
      path + ' structured data',
      html.includes('application/ld+json') &&
        html.includes('VideoGame') &&
        html.includes('WebSite'),
    );
  if (path === '/')
    check(
      'exact homepage title',
      html.includes('<title>Dibs | the daily race to claim answers before anyone else</title>'),
    );
}
const robots = await (await fetch(origin + '/robots.txt')).text();
check(
  'robots policy',
  practice
    ? robots.includes('Disallow: /\n')
    : robots.includes('Allow: /\n') &&
        robots.includes('Disallow: /api/') &&
        robots.includes('Sitemap: ' + origin + '/sitemap.xml'),
);
const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
check(
  'sitemap',
  sitemap.includes('<urlset') &&
    (practice ? !sitemap.includes('<url>') : sitemap.includes('<loc>' + origin + '/about</loc>')),
);
const today: any = await (await fetch(origin + '/api/today')).json();
check('environment', today.practice === practice);
if (!practice)
  check(
    'unchanged launch',
    today.nextDrop === '2026-11-24T02:00:00.000Z' && !today.category && today.claimed === 0,
  );
else check('Animals practice noun', today.category?.name === 'Animals');
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin);
      await page.locator('main').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (practice) await page.locator('#answer').waitFor();
      else await page.locator('.closed-board').waitFor();
      const a = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      check(
        engine.name() + ' ' + theme + ' axe',
        !a.violations.length,
        a.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      );
      check(
        engine.name() + ' ' + theme + ' no overflow',
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
      check(engine.name() + ' ' + theme + ' no app errors', !errors.length, errors);
      await page.screenshot({
        path: `review/round8/ui/live-${practice ? 'practice' : 'production'}-${engine.name()}-${theme}.png`,
        fullPage: true,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(
  `review/round8/${practice ? 'practice' : 'production'}-live-checks.json`,
  JSON.stringify(report, null, 2),
);
console.log(report.filter((r) => !r.passed));
if (report.some((r) => !r.passed)) process.exitCode = 1;
