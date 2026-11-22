import { chromium, webkit, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const results = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    for (const [app, suffix] of [
      ['Instagram', 'Instagram 360.0.0.0'],
      ['LinkedIn', 'LinkedInApp/4.1.0'],
      ['iMessage', 'Mobile/15E148'],
    ])
      for (const colorScheme of ['light', 'dark'] as const) {
        const device = devices[engine === webkit ? 'iPhone 15 Pro' : 'Pixel 7'];
        const c = await b.newContext({
          ...device,
          colorScheme,
          userAgent: device.userAgent + ' ' + suffix,
        });
        const p = await c.newPage();
        const errors: string[] = [];
        p.on('pageerror', (e) => errors.push(e.message));
        await p.goto('http://127.0.0.1:5176/?r6');
        await p.locator('#answer').waitFor();
        const button = (await p.locator('.input-row .primary').boundingBox())!;
        assert.ok(button.y + button.height <= device.viewport.height);
        await p.locator('#answer').fill('Okapi');
        await p.locator('#answer').press('Enter');
        await p.locator('.win-stamp').waitFor();
        assert.deepEqual(errors, []);
        results.push({ engine: engine.name(), app, colorScheme, passed: true });
        await c.close();
      }
  } finally {
    await b.close();
    writeFileSync('review/round14/webviews.json', JSON.stringify(results, null, 2));
  }
}
console.log(results.length + ' emulated in-app flows passed');
