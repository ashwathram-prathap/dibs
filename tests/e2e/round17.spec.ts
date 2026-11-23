import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
test('R17 real curves, marker positions, readable labels and sealed certificate', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [mode, p] of [
    ['holder', '0'],
    ['holder', '.5'],
    ['holder', '.99'],
    ['sealed', '.94'],
    ['closed', '.94'],
  ]) {
    await page.goto(`/certificate/fixture-1?r17=${mode}&p=${p}`);
    await expect(page.locator('.certificate')).toBeVisible();
    if (mode === 'sealed') {
      await expect(page.locator('.cert-answer')).toHaveText('SEALED');
      await expect(page.locator('.rarity-curve')).toHaveCount(0);
      await expect(page.locator('.certificate')).not.toContainText('UNRATED');
    } else {
      const curve = page.locator('.rarity-curve');
      await expect(curve).toBeVisible();
      const x = await curve.locator('circle').getAttribute('cx');
      expect(Number(x)).toBeCloseTo(Number(p) * 400);
      const geometry = await curve.evaluate((el) => {
        const label = el.querySelector('.rarity-marker-label')!;
        const axis = el.querySelector('.rarity-axis')!;
        const b = label.getBoundingClientRect(),
          a = axis.getBoundingClientRect(),
          c = el.getBoundingClientRect();
        return {
          size: parseFloat(getComputedStyle(label).fontSize),
          noOverlap: b.bottom <= a.top,
          contained: b.left >= c.left - 1 && b.right <= c.right + 1,
        };
      });
      expect(geometry).toEqual({ size: 14, noOverlap: true, contained: true });
      await expect(page.locator('.certificate')).not.toContainText('UNRATED');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    mkdirSync('review/round17/certificate', { recursive: true });
    await page.screenshot({
      path: `review/round17/certificate/${info.project.name}-${mode}-${p}.png`,
      fullPage: true,
    });
  }
});
for (const scenario of ['file', 'url', 'reject', 'abort'])
  test('R17 native share ' + scenario, async ({ page }) => {
    await page.addInitScript((scenario) => {
      (window as any).shareCalls = [];
      (window as any).copied = '';
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: () => scenario !== 'url',
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: any) => {
          (window as any).shareCalls.push({
            keys: Object.keys(data),
            type: data.files?.[0]?.type,
            size: data.files?.[0]?.size,
          });
          if (scenario === 'abort') throw new DOMException('Cancelled', 'AbortError');
          if (scenario === 'reject') throw new DOMException('Rejected', 'NotAllowedError');
        },
      });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (s: string) => {
            (window as any).copied = s;
          },
        },
      });
    }, scenario);
    await page.goto('/certificate/fixture-1?r17=holder');
    await expect(page.getByRole('button', { name: 'SHARE', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'SHARE', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).shareCalls.length))
      .toBe(scenario === 'reject' ? 2 : 1);
    const calls = await page.evaluate(() => (window as any).shareCalls);
    if (scenario !== 'url') {
      expect(calls[0].keys).toEqual(['files']);
      expect(calls[0].type).toBe('image/jpeg');
      expect(calls[0].size).toBeLessThan(350000);
    }
    if (scenario === 'url') expect(calls[0].keys).toEqual(['url', 'text']);
    if (scenario === 'reject') {
      await expect(page.locator('.share-hint').first()).toHaveText(
        "Couldn't share. Link copied instead.",
      );
      expect(await page.evaluate(() => (window as any).copied)).toContain('/certificate/fixture-1');
    }
    if (scenario === 'abort') await expect(page.locator('.share-hint').first()).toHaveText('');
  });
