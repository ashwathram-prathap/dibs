import { createHash } from 'node:crypto';
import { BINARY_MAGIC } from '../shared/binary-catalog';
import type { CatalogRow } from '../shared/catalog';

export function buildBinaryCatalog(
  keys: string[],
  ordinalFor: (key: string) => number,
  rows: CatalogRow[],
) {
  const records = keys
    .map((key) => ({
      hash: createHash('sha256').update(key).digest().subarray(0, 12),
      ordinal: ordinalFor(key),
    }))
    .sort((a, b) => Buffer.compare(a.hash, b.hash));
  for (let i = 1; i < records.length; i++)
    if (records[i - 1].hash.equals(records[i].hash)) throw Error('Catalog hash collision');
  const names = rows.map((r) => Buffer.from(r[1]));
  if (names.some((name) => name.length > 65535)) throw Error('Catalog name too long');
  const rowsOffset = 32 + records.length * 16;
  const namesOffset = rowsOffset + rows.length * 8;
  const bytes = Buffer.alloc(namesOffset + names.reduce((n, name) => n + name.length, 0));
  [BINARY_MAGIC, 1, records.length, rows.length, rowsOffset, namesOffset, 0, bytes.length].forEach(
    (n, i) => bytes.writeUInt32LE(n, i * 4),
  );
  records.forEach((r, i) => {
    r.hash.copy(bytes, 32 + i * 16);
    bytes.writeUInt32LE(r.ordinal, 44 + i * 16);
  });
  let nameOffset = 0;
  rows.forEach((row, i) => {
    const offset = rowsOffset + i * 8;
    bytes.writeUInt32LE(nameOffset, offset);
    bytes.writeUInt16LE(names[i].length, offset + 4);
    bytes.writeUInt8(row[2] || 0, offset + 6);
    names[i].copy(bytes, namesOffset + nameOffset);
    nameOffset += names[i].length;
  });
  return bytes;
}
