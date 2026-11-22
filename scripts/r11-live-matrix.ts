import { chromium, webkit, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { api, origin } from './r11-practice';
const evidence: any[] = [];
mkdirSync('review/round11/practice', { recursive: true });
const reset = async () => {
  assert.ok((await api('/admin/practice-reset', {}, undefined, true)).response.ok);
};
const golden = () => {
  const r = spawnSync(
    './node_modules/.bin/wrangler',
    [
      'd1',
      'execute',
      'dibs-db-staging',
      '--remote',
      '-c',
      'worker/wrangler.staging.jsonc',
      '--json',
      '--command',
      "SELECT a.display FROM daily_specials d,json_each(d.golden_json) j JOIN answers a ON a.id=j.value WHERE d.category_id='practice' LIMIT 1",
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (r.status !== 0) throw Error('Practice golden read failed');
  return JSON.parse(r.stdout)[0].results[0].display;
};
for (const [name, type] of [
  ['chromium', chromium],
  ['webkit', webkit],
] as const) {
  const b = await type.launch();
  try {
    for (const width of [390, 1440])
      for (const theme of ['light', 'dark'] as const) {
        const row: any = { browser: name, width, theme, checks: [] };
        evidence.push(row);
        try {
          await reset();
          const c = await b.newContext({
              viewport: { width, height: width === 390 ? 844 : 900 },
              colorScheme: theme,
              timezoneId: 'America/Vancouver',
            }),
            p = await c.newPage();
          await p.addInitScript(() => {
            (window as any).__shares = [];
            Object.defineProperty(navigator, 'share', {
              value: async (data: any) => {
                (window as any).__shares.push({
                  text: data.text,
                  files: data.files?.map((f: File) => ({ type: f.type, size: f.size })),
                });
              },
            });
            Object.defineProperty(navigator, 'canShare', { value: () => true });
          });
          const verified = p.waitForResponse(
            (r) => r.url().endsWith('/api/verify-session') && r.ok(),
            { timeout: 60000 },
          );
          await p.goto(origin);
          await verified;
          assert.equal(await p.locator('table.ledger').count(), 0);
          row.checks.push('Initial no-peek and real official test Turnstile session');
          const submit = async (answer: string) => {
            await p.locator('#answer').fill(answer);
            const wait = p.waitForResponse((r) => r.url().endsWith('/api/claim'), {
              timeout: 45000,
            });
            await p.getByRole('button', { name: 'CALL DIBS', exact: true }).click();
            const response = await wait;
            return { status: response.status(), data: await response.json() };
          };
          for (const answer of [
            'dibs',
            'registrar',
            'Animals',
            'notarealanimalzz',
            '🐙',
            ' '.repeat(4),
            'x'.repeat(200),
          ]) {
            if (!answer.trim()) {
              await p.locator('#answer').fill(answer);
              await p.locator('#answer').press('Enter');
              continue;
            }
            const r = await submit(answer);
            assert.equal(r.status, 422);
            await expect(p.locator('.strikes-progress')).toContainText('STRIKES 0/5');
          }
          row.checks.push(
            'Easter eggs, invalid, whitespace, emoji, 200-character input cost no strike',
          );
          let r = await submit('axolot');
          assert.equal(r.status, 422);
          await expect(p.getByRole('button', { name: 'Did you mean AXOLOTL?' })).toBeVisible({
            timeout: 30000,
          });
          await p.getByRole('button', { name: 'Keep my spelling' }).click();
          r = await submit('oKaPi');
          assert.equal(r.status, 201);
          const key = r.data.recoveryKey;
          assert.ok(key);
          await p.getByRole('button', { name: 'Next dibs' }).click();
          r = await submit('Cat');
          assert.equal(r.status, 409);
          assert.equal(r.data.takenBy, 'RESERVED');
          r = await submit('Quokkas');
          assert.equal(r.status, 201);
          await p.getByRole('button', { name: 'Next dibs' }).click();
          r = await submit('Pangolin');
          assert.equal(r.status, 201);
          await p.locator('.day-certificate').waitFor();
          await expect(p.locator('table.ledger')).toBeVisible();
          row.checks.push(
            'Mixed case, plurals, RESERVED strike, three wins, certificate, ledger reveal',
          );
          await p.getByRole('button', { name: 'SHARE', exact: true }).click();
          assert.equal(await p.evaluate(() => (window as any).__shares.length), 1);
          row.checks.push('Native file-share payload (intercepted; nothing posted)');
          await p.getByText('More ways to share', { exact: true }).click();
          for (const platform of ['X', 'WhatsApp', 'Facebook']) {
            const href = await p
              .getByRole('link', { name: platform, exact: true })
              .getAttribute('href');
            assert.ok(href?.startsWith('https://'));
          }
          for (const format of ['Story PNG', 'Feed PNG']) {
            const download = p.waitForEvent('download');
            await p.getByRole('button', { name: format, exact: true }).click();
            await (
              await download
            ).saveAs(
              `review/round11/practice/${name}-${width}-${theme}-${format.split(' ')[0]}.png`,
            );
          }
          await p.getByRole('button', { name: 'Copy text', exact: true }).click();
          await expect(p.locator('.share-hint[role=status]')).not.toBeEmpty();
          row.checks.push('Share intents, copy text, feed/story downloads');
          await p.screenshot({
            path: `review/round11/practice/${name}-${width}-${theme}-completed.png`,
            fullPage: true,
          });
          const restored = await b.newContext(),
            rp = await restored.newPage();
          await rp.goto(origin);
          await rp.locator('#file-settings summary').click();
          await rp.locator('#restore-key').fill(key);
          await rp.getByRole('button', { name: 'Restore file', exact: true }).click();
          await rp.locator('.day-certificate').waitFor();
          row.checks.push('Recovery key restores the completed file in a second browser');
          await rp
            .locator('#file-settings summary')
            .click()
            .catch(() => {}); // Keep the panel open when the remount changed it.
          if (!(await rp.locator('#delete-key').isVisible()))
            await rp.locator('#file-settings summary').click();
          await rp.getByRole('button', { name: 'Delete my file', exact: true }).click();
          await rp.getByRole('button', { name: 'Yes, permanently delete my file' }).click();
          await expect(
            rp.getByText('Your file is removed. Past claims now belong to Withdrawn filer.', {
              exact: true,
            }),
          ).toBeVisible({ timeout: 60000 });
          row.checks.push('Live verified self-serve deletion');
          await restored.close();
          await c.close();
          row.passed = true;
        } catch (e) {
          row.passed = false;
          row.error = String(e);
        }
        writeFileSync('review/round11/practice-matrix.json', JSON.stringify(evidence, null, 2));
      }
  } finally {
    await b.close();
  }
}
console.log(evidence.map(({ checks, ...r }) => ({ ...r, checks: checks.length })));
if (evidence.some((r) => !r.passed)) process.exitCode = 1;
