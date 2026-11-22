import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildBinaryCatalog } from '../scripts/binary-catalog';
import {
  BINARY_CHUNK_BYTES,
  BINARY_MAGIC,
  openBinaryCatalog,
  lookupBinary,
} from '../shared/binary-catalog';

const hash = (key: string) => createHash('sha256').update(key).digest();
it('resolves aliases to the same row and rejects absent names without golden metadata', () => {
  const ids: Record<string, number> = { lakeontario: 0, ontario: 0, lacléman: 1 };
  const bytes = buildBinaryCatalog(Object.keys(ids), (key) => ids[key], [
    [0, 'Lake Ontario', 2],
    [1, 'Lac Léman', null],
  ]);
  const index = openBinaryCatalog([bytes]);
  expect(lookupBinary(index, hash('lakeontario'))).toEqual([0, 'Lake Ontario', 2]);
  expect(lookupBinary(index, hash('ontario'))).toEqual([0, 'Lake Ontario', 2]);
  expect(lookupBinary(index, hash('lacléman'))).toEqual([1, 'Lac Léman', null]);
  expect(lookupBinary(index, hash('unregistered'))).toBeNull();
});
it('decodes UTF-8 names across immutable chunk boundaries', () => {
  const name = Buffer.from('Lac Léman');
  const start = BINARY_CHUNK_BYTES - 5;
  const bytes = Buffer.alloc(start + name.length);
  [BINARY_MAGIC, 1, 1, 1, 48, 56, 0, bytes.length].forEach((n, i) => bytes.writeUInt32LE(n, i * 4));
  hash('leman').copy(bytes, 32, 0, 12);
  bytes.writeUInt32LE(start - 56, 48);
  bytes.writeUInt16LE(name.length, 52);
  name.copy(bytes, start);
  const index = openBinaryCatalog([
    bytes.subarray(0, BINARY_CHUNK_BYTES),
    bytes.subarray(BINARY_CHUNK_BYTES),
  ]);
  expect(lookupBinary(index, hash('leman'))).toEqual([0, 'Lac Léman', null]);
  expect(() => openBinaryCatalog([bytes.subarray(0, bytes.length - 1)])).toThrow();
});
