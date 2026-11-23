import { readCategory } from '../../scripts/category-file';
import { test, expect } from './security-fixture';
import { readFileSync } from 'node:fs';
import { normalize } from '../../worker/domain';
import { fullDistance } from '../../shared/catalog';
test('checks a long-tail submitted typo in a browser worker without revealing suggestions while typing', async ({
  page,
}) => {
  const manifest = JSON.parse(readFileSync('public/catalog/animals/manifest.json', 'utf8'));
  await page.goto('/?r6=1&spellingVersion=' + manifest.version);
  await page.locator('#answer').fill('chamel');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  const c = readCategory('categories/animals.json');
  const row = c.answers.find(
    (a: any, i: number) =>
      i > 10000 && a.display.length > 24 && a.display.length < 31 && a.aliases.length === 1,
  );
  await page.locator('#answer').fill(row.display.slice(0, -1) + 'x');
  await page.locator('#answer').press('Enter');
  const button = page.getByRole('button', { name: /^Did you mean/ });
  await expect(button).toBeVisible({ timeout: 15000 });
  const result = (await button.textContent())!
    .replace(/\s/g, ' ')
    .replace(/^Did you mean /, '')
    .replace(/\?$/, '');
  expect(result).not.toBeNull();
  expect(c.answers.some((a: any) => a.display.toUpperCase() === result)).toBe(true);
  // A returned spelling must be within two edits of an accepted spelling of the same entry.
  const proposed = c.answers.find((a: any) => a.display.toUpperCase() === result);
  expect(
    Math.min(
      ...[proposed.display, ...proposed.aliases].map((s) =>
        fullDistance(normalize(row.display.slice(0, -1) + 'x'), normalize(s)),
      ),
    ),
  ).toBeLessThanOrEqual(2);
});
