import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const dir = 'review/round8/ui';
mkdirSync(dir, { recursive: true });
const pagesOnly = process.argv.includes('--pages-only');
const results: any[] = pagesOnly
  ? JSON.parse(readFileSync('review/round8/ui-results.json', 'utf8')).filter(
      (r: any) => !['about', 'archive', 'stats'].includes(r.state),
    )
  : [];
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  for (const theme of ['light', 'dark'] as const)
    for (const size of [
      { width: 390, zoom: 1 },
      { width: 390, zoom: 2 },
      { width: 1440, zoom: 1 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: 844 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:5174/?r6=1&r8=1');
      await page.locator('#answer').waitFor();
      if (size.zoom === 2)
        await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
      const shot = async (state: string) => {
        await page.evaluate(() => document.fonts.ready);
        if (
          engine === chromium &&
          size.width === 390 &&
          size.zoom === 1 &&
          ['house', 'taken', 'invalid', 'gold', 'success'].includes(state)
        ) {
          const cdp = await context.newCDPSession(page);
          for (const type of ['protanopia', 'deuteranopia', 'tritanopia']) {
            await cdp.send('Emulation.setEmulatedVisionDeficiency', { type });
            await page
              .locator('.result-panel')
              .screenshot({ path: `${dir}/${theme}-${type}-${state}.png` });
          }
          await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
          await cdp.detach();
        }
        await page.screenshot({
          path: `${dir}/${engine.name()}-${theme}-${size.width}-${size.zoom}x-${state}.png`,
          fullPage: true,
        });
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const glyphs = await page.evaluate(() => {
          const bad = /[\u2190-\u27bf\u{1f000}-\u{1ffff}]|\p{Extended_Pictographic}/u;
          const hits: string[] = [];
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (w.nextNode())
            if (
              w.currentNode.parentElement?.closest('script,style') === null &&
              bad.test(w.currentNode.textContent || '')
            )
              hits.push(w.currentNode.textContent || '');
          for (const el of document.querySelectorAll('*'))
            for (const pseudo of ['::before', '::after'])
              if (bad.test(getComputedStyle(el, pseudo).content))
                hits.push(getComputedStyle(el, pseudo).content);
          return hits;
        });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        const snapshot = await page.locator('main').ariaSnapshot();
        writeFileSync(
          `${dir}/${engine.name()}-${theme}-${size.width}-${size.zoom}x-${state}.aria.txt`,
          snapshot,
        );
        results.push({
          engine: engine.name(),
          theme,
          ...size,
          state,
          overflow,
          glyphs,
          axe: axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        });
        writeFileSync('review/round8/ui-results.json', JSON.stringify(results, null, 2));
      };
      if (!pagesOnly) {
        await shot('ready');
        await page.locator('#answer').fill('offline proof');
        await page.locator('#answer').press('Enter');
        await page.getByText('OFFLINE PROOF: The clerk didn’t get that. Try again.').waitFor();
        await shot('network-failure');
        for (const [answer, state] of [
          ['Dog', 'house'],
          ['Pangolin', 'taken'],
          ['unknown animal', 'invalid'],
          ['Axolot', 'typo'],
        ]) {
          await page.locator('#answer').fill(answer);
          await page.locator('#answer').press('Enter');
          await page.waitForTimeout(500);
          await shot(state);
          if (state === 'invalid') {
            await page.getByRole('button', { name: 'Submit to the clerk' }).click();
            await page.getByText('Submitted to the clerk. No strike charged.').waitFor();
            await shot('clerk-submission');
          }
        }
        await page.getByRole('button', { name: 'Did you mean AXOLOTL?' }).click();
        await page.locator('.gold-stamp').waitFor();
        await shot('gold');
        await page.getByRole('button', { name: 'Copy continuation link' }).click();
        await shot('file-key');
        await page.getByRole('button', { name: 'I saved my key' }).click();
        await page.getByRole('button', { name: 'Next dibs', exact: true }).click();
        await page.locator('#answer').fill('Okapi');
        await page.locator('#answer').press('Enter');
        await page.waitForTimeout(500);
        await shot('success');
        await page.getByRole('button', { name: 'Next dibs', exact: true }).click();
        await page.locator('#answer').fill('Quokka');
        await page.locator('#answer').press('Enter');
        await page.getByRole('button', { name: 'See my file', exact: true }).click();
        await shot('closed');
        if (engine === chromium && size.width === 390 && size.zoom === 1) {
          const cdp = await page.context().newCDPSession(page);
          for (const type of ['protanopia', 'deuteranopia', 'tritanopia']) {
            await cdp.send('Emulation.setEmulatedVisionDeficiency', { type });
            await page
              .locator('.day-certificate')
              .screenshot({ path: `${dir}/${theme}-${type}-certificate.png`, timeout: 60000 });
          }
          await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' });
        }
      }
      for (const path of ['/about', '/archive?r6=1', '/stats']) {
        await page.goto('http://127.0.0.1:5174' + path);
        await page.locator('main h1').waitFor();
        if (path === '/about')
          await page.getByRole('heading', { name: 'Sources and attribution' }).waitFor();
        if (path.startsWith('/archive'))
          await page.getByRole('table', { name: 'Claims in Animals' }).waitFor();
        if (path === '/stats')
          await page.getByRole('button', { name: 'Read the record' }).waitFor();
        if (size.zoom === 2)
          await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
        await shot(path.split('?')[0].slice(1));
      }
      await context.close();
    }
  await browser.close();
}
writeFileSync('review/round8/ui-results.json', JSON.stringify(results, null, 2));
console.log(results.filter((r) => r.overflow || r.glyphs.length || r.axe.length));
if (results.some((r) => r.overflow || r.glyphs.length || r.axe.length)) process.exitCode = 1;
