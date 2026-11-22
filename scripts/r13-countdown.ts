import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const rows = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    for (const width of [320, 375, 390, 430, 768, 1024, 1440, 2560]) {
      const p = await b.newPage({ viewport: { width, height: 844 } });
      await p.goto('http://127.0.0.1:5176/?r7-closed');
      await p.locator('.closed-office .clock').waitFor();
      await p.evaluate(() => document.fonts.ready);
      const result = await p.locator('.closed-office .clock').evaluate((e) => {
        const fontSize = parseFloat(getComputedStyle(e).fontSize);
        const widths = ['00:00:00', '11:11:11', '88:88:88', '23:59:59'].map((text) => {
          e.innerHTML = '<span class="clock-part">' + text + '</span>';
          return e.firstElementChild!.getBoundingClientRect().width;
        });
        e.innerHTML = '<span class="clock-part">1d</span> <span class="clock-part">06:12:40</span>';
        return {
          fontSize,
          widths,
          overflow: document.documentElement.scrollWidth > innerWidth,
          partsFit: [...e.children].every((x) => x.getBoundingClientRect().right <= innerWidth),
        };
      });
      assert.ok(result.widths.every((w) => Math.abs(w - result.widths[0]) < 0.1));
      assert.ok(result.fontSize >= Math.min(164, Math.max(52, width * 0.185)) - 1);
      assert.ok(!result.overflow && result.partsFit);
      rows.push({ engine: engine.name(), width, ...result, passed: true });
      await p.close();
    }
  } finally {
    await b.close();
  }
}
writeFileSync('review/round13/countdown-widths.json', JSON.stringify(rows, null, 2));
console.log('Countdown: 16 R7-scale, tabular-width and multi-day wrapping checks passed.');
