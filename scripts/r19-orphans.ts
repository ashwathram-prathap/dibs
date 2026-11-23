import { chromium, webkit, firefox } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const results: any[] = [];
mkdirSync('review/round19/text', { recursive: true });
for (const [name, engine] of Object.entries(
  process.env.R19_FIREFOX ? { firefox } : { chromium, webkit },
)) {
  const browser = await engine.launch();
  for (const width of [320, 360, 390, 430, 768, 1024, 1440])
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width < 768 ? 844 : 1000 },
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      for (const screen of ['closed', 'live', 'payoff', 'done', 'how', 'settings', 'certificate']) {
        const url =
          screen === 'how'
            ? '/how-it-works?r19&r6'
            : screen === 'certificate'
              ? '/certificate/fixture-1?r19&r17=holder'
              : screen === 'closed' || screen === 'settings'
                ? '/?r19&r7-closed'
                : '/?r19&r6';
        await page.goto('http://127.0.0.1:5199' + url);
        await page.locator('.loading').waitFor({ state: 'hidden' });
        if (screen === 'payoff' || screen === 'done') {
          for (const a of screen === 'done' ? ['Okapi', 'Quokka', 'Wombat'] : ['Okapi']) {
            await page.locator('#answer').fill(a);
            await page.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
            if (screen === 'done' && a !== 'Wombat')
              await page.getByRole('button', { name: 'Next claim', exact: true }).click();
          }
          await page.locator(screen === 'done' ? '.day-certificate' : '.win-stamp').waitFor();
        }
        if (screen === 'settings') {
          await page.locator('.header-settings > summary').click();
          await page.locator('#file-settings > summary').click();
        }
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '20.8px';
          window.dispatchEvent(new Event('resize'));
        });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(100);
        const audit = await page.evaluate(() => {
          const failures: any[] = [];
          let checked = 0;
          for (const el of document.querySelectorAll<HTMLElement>(
            '.player-handle,p,h1,h2,h3,h4,button,a,summary,label,li,th,td,small',
          )) {
            if (
              !el.getClientRects().length ||
              el.closest('svg,pre,code,select') ||
              el.querySelector('.player-handle,p,h1,h2,h3,h4,li,button')
            )
              continue;
            const hiddenDetails = el.closest('details:not([open])');
            if (
              el.closest('.sr-only,.skip') ||
              (hiddenDetails && !hiddenDetails.querySelector(':scope > summary')?.contains(el))
            )
              continue;
            if ((el.textContent?.trim().split(/\s+/).length || 0) < 2) continue;
            const words: { word: string; rect: DOMRect }[] = [];
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const n = walker.currentNode as Text;
              for (const match of n.data.matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(n, match.index!);
                range.setEnd(n, match.index! + match[0].length);
                for (const rect of range.getClientRects())
                  if (rect.width && rect.height) words.push({ word: match[0], rect });
              }
            }
            if (words.length < 2) continue;
            checked++;
            const top = Math.max(...words.map((w) => w.rect.top));
            const last = words.filter((w) => w.rect.bottom > top + 1);
            if (last.length === 1 && words.some((w) => w.rect.bottom <= top + 1))
              failures.push({
                tag: el.tagName,
                cls: el.className,
                text: el.textContent?.trim().replace(/\s+/g, ' '),
                last: last[0].word,
                width: el.clientWidth,
              });
          }
          return { checked, failures, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        results.push({ browser: name, width, theme, screen, ...audit });
        writeFileSync(
          'review/round19/text/' + (process.env.R19_FIREFOX ? 'firefox' : 'local') + '.json',
          JSON.stringify(results, null, 2),
        );
      }
      await context.close();
    }
  await browser.close();
}
console.log(
  JSON.stringify({
    cases: results.length,
    blocks: results.reduce((n, r) => n + r.checked, 0),
    orphans: results.reduce((n, r) => n + r.failures.length, 0),
    overflow: results.filter((r) => r.overflow).length,
  }),
);
