import './test-traffic';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
mkdirSync('review/round11/share-cards', { recursive: true });
const b = await chromium.launch(),
  cards: any[] = [];
try {
  for (const phase of ['before', 'after'])
    for (const state of ['clean', 'five-strikes', 'gold']) {
      const p = await b.newPage();
      await p.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }));
      await p.goto('http://127.0.0.1:' + (phase === 'before' ? 5174 : 5173) + '/?r6');
      await p.locator('#answer').waitFor();
      const answers =
        state === 'five-strikes'
          ? ['Dog', 'Dog', 'Dog', 'Dog', 'Dog']
          : ['Axolotl', 'Okapi', 'Quokka'];
      for (const [i, answer] of answers.entries()) {
        await p.locator('#answer').fill(answer);
        await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
        await p.waitForTimeout(200);
        if (answer !== 'Dog') {
          if (phase === 'before')
            await p.getByRole('button', { name: i === 2 ? 'See my file' : 'Next dibs' }).click();
          else if (i < 2) await p.getByRole('button', { name: 'Next dibs' }).click();
        }
      }
      if (
        state === 'five-strikes' &&
        phase === 'before' &&
        (await p.getByRole('button', { name: 'See my file' }).count())
      )
        await p.getByRole('button', { name: 'See my file' }).click();
      await p.locator('.day-certificate').waitFor();
      if (state === 'gold') await p.locator('.summary-answers a').first().click();
      await p.getByRole('button', { name: 'SHARE', exact: true }).waitFor();
      if (await p.getByText('More ways to share', { exact: true }).count())
        await p.getByText('More ways to share', { exact: true }).click();
      for (const format of ['Feed', 'Story']) {
        const download = p.waitForEvent('download');
        await p.getByRole('button', { name: format + ' PNG', exact: true }).click();
        const path = `review/round11/share-cards/${state}-${format.toLowerCase()}-${phase}.png`;
        await (await download).saveAs(path);
        cards.push({ phase, state, format, path });
      }
      await p.close();
    }
  const p = await b.newPage({ viewport: { width: 480, height: 900 } });
  let html =
    '<style>body{font:14px monospace;margin:20px;background:#ddd}main{display:grid;grid-template-columns:200px 200px;gap:20px}img{width:200px}figure{margin:0}figcaption{margin:8px 0}</style><h1>R7 vs R11 · 200px</h1><main><b>Round 7</b><b>Round 11</b>';
  for (const state of ['clean', 'five-strikes', 'gold'])
    for (const format of ['Feed', 'Story'])
      for (const phase of ['before', 'after']) {
        const c = cards.find((c) => c.state === state && c.format === format && c.phase === phase);
        html += `<figure><img src="data:image/png;base64,${readFileSync(c.path).toString('base64')}"><figcaption>${state} · ${format}</figcaption></figure>`;
      }
  for (const name of ['certificate', 'summary'])
    for (const phase of ['before', 'after']) {
      const bytes =
        phase === 'before'
          ? execFileSync('git', ['show', `r7-done:review/final/r7-${name}-og.png`])
          : readFileSync(`review/final/r7-${name}-og.png`);
      html += `<figure><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${name} OG</figcaption></figure>`;
    }
  await p.setContent(html + '</main>');
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p.screenshot({ path: 'review/round11/vs-r7/share-grid-200px.png', fullPage: true });
} finally {
  await b.close();
}
