import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PUBLIC_ORIGIN, PUBLIC_HOST, certificateUrl } from '../shared/config';
describe('every printed and shared address is canonical', () => {
  it('does not print a local dev origin', () => {
    for (const value of [PUBLIC_ORIGIN, PUBLIC_HOST, certificateUrl('test')])
      expect(value).not.toMatch(/127\.0\.0\.1|localhost|5173/);
    for (const path of ['src/share.ts', 'worker/og.ts']) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/location\.(host|origin)|127\.0\.0\.1|localhost|5173/);
      expect(source).toContain('PUBLIC_HOST');
    }
  });
});
