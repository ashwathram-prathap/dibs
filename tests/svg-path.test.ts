import { it, expect } from 'vitest';
import { svgPath } from '../shared/svg-path';
it('serializes floating point residues without invalid SVG coordinates', () => {
  expect(
    svgPath([
      { type: 'M', x: 804.0000000000001, y: 309.75 },
      { type: 'Q', x1: 1e-13, y1: 2, x: 3, y: 4 },
      { type: 'Z' },
    ]),
  ).toBe('M804 309.75Q0 2 3 4Z');
});
