import { expect, it } from 'vitest';
import { cleanReferenceRows, usableLatinReferenceName } from '../scripts/catalog-cleaning';
it('retains real short and numbered titles while excluding placeholder and offensive labels', () => {
  const rows = cleanReferenceRows([
    { display: ' X ', aliases: ['X band', 'Q123', 'shit'] },
    { display: '1917', aliases: [] },
    { display: 'Unknown', aliases: [] },
    { display: 'Q56789', aliases: [] },
    { display: 'Shit creek', aliases: [] },
  ]);
  expect(rows).toEqual([
    { display: 'X', aliases: ['X band'] },
    { display: '1917', aliases: [] },
  ]);
});
it('keeps symbol-spelled titles as aliases but prints a plain source name or transcription', () => {
  const rows = cleanReferenceRows([
    { display: 'F\u266f A\u266f \u221e', aliases: ['F sharp A sharp Infinity'] },
    { display: 'The Singles 81\u219285', aliases: [] },
    { display: 'Title\u2122', aliases: ['Title'] },
    { display: '\u221e', aliases: [] },
  ]);
  expect(rows[0].display).toBe('F sharp A sharp Infinity');
  expect(rows[0].aliases).toContain('F\u266f A\u266f \u221e');
  expect(rows[1].display).toBe('The Singles 81 to 85');
  expect(rows[1].aliases).toContain('The Singles 81\u219285');
  expect(rows[2].display).toBe('Title TM');
  expect(rows[2].aliases).toContain('Title');
  expect(rows[3].display).toBe('Infinity');
});

it('repairs reference encoding without promoting unrelated aliases or field-locality labels', () => {
  const rows = cleanReferenceRows([
    { display: 'PunarÃ©', aliases: [] },
    { display: 'X\u221eMultiplies', aliases: ['Nice Age'] },
    { display: 'Shpalman\u00ae', aliases: [] },
    { display: 'Section HK-12, Hárskút Ravine', scientificName: 'Example animal', aliases: [] },
  ]);
  expect(rows.map((r) => r.display)).toEqual(['Punaré', 'X infinity Multiplies', 'Shpalman']);
});

it('requires a usable Latin-script or numeric fallback title when no English article exists', () => {
  expect(usableLatinReferenceName('Pokémon Émeraude')).toBe(true);
  expect(usableLatinReferenceName('1942')).toBe(true);
  expect(usableLatinReferenceName('超级玛丽2')).toBe(false);
});
