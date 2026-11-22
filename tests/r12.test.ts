import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readCategory } from '../scripts/category-file';
import { notes } from '../shared/moments';
import {
  MAX_CLAIMS,
  MAX_STRIKES,
  DROP_TIME_LABEL,
  CLOSE_TIME_LABEL,
  LAUNCH_DATE,
  goldenPerDay,
  LAUNCH_GOLDEN_PER_DAY,
  GOLDEN_PER_DAY,
} from '../shared/config';
import {
  GAME_DESCRIPTION,
  LIMIT_EXPLANATION,
  FINISH_EXPLANATION,
  SCHEDULE_EXPLANATION,
  GOLDEN_EXPLANATION,
} from '../shared/copy';
import { HOME_DESCRIPTION, rulesHtml } from '../shared/seo';
import { reminder } from '../shared/reminder';
it('clerk notes invent no player behaviour and name no answer from their own full catalog', () => {
  for (const [slug, note] of Object.entries(notes)) {
    expect(note).not.toMatch(/\b(always|nobody|everyone|someone|first)\b/i);
    const names = readCategory(`categories/${slug}.json`).answers.flatMap((a: any) => [
      a.display,
      ...(a.aliases || []),
    ]);
    const normalized = ' ' + note.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
    for (const name of names) {
      const key = String(name)
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      if (key)
        expect(normalized.includes(' ' + key + ' '), `${slug}: ${note} names ${name}`).toBe(false);
    }
  }
}, 120000);
it('public rules, metadata, reminders and share copy use the canonical limits and schedule', () => {
  expect(HOME_DESCRIPTION).toBe(GAME_DESCRIPTION);
  expect(LIMIT_EXPLANATION).toContain(`${MAX_CLAIMS} claims`);
  expect(LIMIT_EXPLANATION).toContain(`${MAX_STRIKES} max`);
  expect(FINISH_EXPLANATION).toContain(`${MAX_CLAIMS} claims or ${MAX_STRIKES} strikes`);
  expect(SCHEDULE_EXPLANATION).toContain(`${DROP_TIME_LABEL} ET`);
  expect(SCHEDULE_EXPLANATION).toContain(`${CLOSE_TIME_LABEL} ET the next day`);
  expect(goldenPerDay(LAUNCH_DATE)).toBe(LAUNCH_GOLDEN_PER_DAY);
  expect(goldenPerDay('2026-11-30')).toBe(GOLDEN_PER_DAY);
  expect(GOLDEN_EXPLANATION).toContain(
    `${LAUNCH_GOLDEN_PER_DAY} a day in launch week, then ${GOLDEN_PER_DAY}`,
  );
  expect(rulesHtml).toContain(LIMIT_EXPLANATION);
  expect(new URL(reminder('2026-11-24T02:00:00Z').google).searchParams.get('details')).toContain(
    GAME_DESCRIPTION,
  );
  for (const path of [
    'src/App.tsx',
    'src/share.ts',
    'shared/preview.ts',
    'shared/seo.ts',
    'shared/reminder.ts',
    'worker/og.ts',
    'index.html',
  ]) {
    const source = readFileSync(path, 'utf8');
    expect(source, path).not.toMatch(
      /(?:three|3) (?:dibs|claims)|(?:five|5) strikes|9(?::00)? PM|\bfile key\b/i,
    );
  }
});
