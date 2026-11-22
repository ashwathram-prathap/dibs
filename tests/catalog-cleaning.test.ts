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
