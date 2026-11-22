import { expect, it } from 'vitest';
import { cleanReferenceRows } from '../scripts/catalog-cleaning';
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
  ]);
  expect(rows[0].display).toBe('F sharp A sharp Infinity');
  expect(rows[0].aliases).toContain('F\u266f A\u266f \u221e');
  expect(rows[1].display).toBe('The Singles 81 to 85');
  expect(rows[1].aliases).toContain('The Singles 81\u219285');
});
