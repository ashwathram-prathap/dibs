import { test, expect } from './security-fixture';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
test('Builder credit stays grouped, accessible and confined to footer and information pages', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of [
    '/?r7-closed&r19',
    '/?r19',
    '/how-it-works?r19',
    '/about?r19',
    '/archive?r19',
    '/leaderboard?r19',
  ]) {
    await page.goto(path);
    await expect(page.locator('.loading')).toBeHidden();
    const footer = page.locator('footer');
    await expect(footer.locator('.creator-credit')).toHaveText('Made byAshwathram PrathapX');
    for (const scope of [
      footer,
      ...(path.startsWith('/about') || path.startsWith('/how-it-works')
        ? [page.locator('.builder-note')]
        : []),
    ]) {
      const name = scope.getByRole('link', {
        name: 'Ashwathram Prathap',
        exact: true,
        includeHidden: true,
      });
      await expect(name).toHaveAttribute('href', 'https://ashwathram.ca');
      const x = scope.getByRole('link', {
        name: 'Ashwathram Prathap on X',
        exact: true,
        includeHidden: true,
      });
      await expect(x).toHaveAttribute('href', 'https://x.com/ashwaprathap');
      for (const link of [name, x]) {
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    }
    if (path.startsWith('/about') || path.startsWith('/how-it-works')) {
      await expect(page.locator('.builder-note')).toContainText(
        'Dibs is built by Ashwathram Prathap, a student at the University of Waterloo.',
      );
    } else await expect(page.locator('main')).not.toContainText('Ashwathram');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (await footer.isVisible()) {
      const nameBox = await footer
        .getByRole('link', { name: 'Ashwathram Prathap', exact: true, includeHidden: true })
        .boundingBox();
      const xBox = await footer
        .getByRole('link', { name: 'Ashwathram Prathap on X', includeHidden: true })
        .boundingBox();
      expect(Math.abs(nameBox!.y - xBox!.y)).toBeLessThan(3);
    }
    const violations = await new AxeBuilder({ page })
      .include('footer')
      .include('.builder-note')
      .analyze();
    expect(violations.violations).toEqual([]);
    const dir = `${process.env.R19G_SHOTS || 'review/round19g/ui'}/${info.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: `${dir}/${path.split('?')[0].replaceAll('/', '') || (path.includes('closed') ? 'closed' : 'play')}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  expect(errors).toEqual([]);
});

test('R19H: explanation, How it works and the share line say 3 claims a night', async ({
  page,
}) => {
  await page.goto('/how-it-works?r19');
  await expect(page.locator('.loading')).toBeHidden();
  // How it works begins with the nightly allowance.
  await expect(page.locator('.how-page .game-intro > :first-child')).toHaveText(
    'You get 3 claims every night.',
  );
  await expect(page.locator('.how-page .game-explanation')).toContainText('3 claims a night.');
  // Strike, typo safety and the next-day close stay explained.
  await expect(page.locator('.how-page')).toContainText(
    'Taken or reserved answers cost a strike. Typos and answers not on the list never do.',
  );
  await expect(page.locator('.how-page')).toContainText('closes at 9:00 PM ET the next day');
  await page.goto('/?r7-closed&r19');
  await expect(page.locator('.closed-office .game-explanation')).toContainText(
    "3 claims a night. 5 strikes and you're out.",
  );
  await page.goto('/?r19&r6');
  await page.locator('#answer').waitFor();
  const rules = page.locator('.play-rules');
  if (await rules.isVisible()) {
    await rules.evaluate((d: HTMLDetailsElement) => (d.open = true));
    await expect(rules.locator('.game-intro > :first-child')).toHaveText(
      'You get 3 claims every night.',
    );
  }
});
