import { createHash } from 'node:crypto';
import { BINARY_MAGIC } from '../shared/binary-catalog';
import type { CatalogRow } from '../shared/catalog';

export function buildBinaryCatalog(
  keys: string[],
  ordinalFor: (key: string) => number,
  rows: CatalogRow[],
) {
  // Packed records and typed-array ordering keep million-key builds within CI memory.
  const records = Buffer.alloc(keys.length * 16);
  keys.forEach((key, i) => {
    createHash('sha256')
      .update(key)
      .digest()
      .copy(records, i * 16, 0, 12);
    records.writeUInt32LE(ordinalFor(key), i * 16 + 12);
  });
  const compare = (a: number, b: number) =>
    records.readUInt32BE(a * 16) - records.readUInt32BE(b * 16) ||
    records.readUInt32BE(a * 16 + 4) - records.readUInt32BE(b * 16 + 4) ||
    records.readUInt32BE(a * 16 + 8) - records.readUInt32BE(b * 16 + 8);
  const order = Uint32Array.from({ length: keys.length }, (_, i) => i).sort(compare);
  for (let i = 1; i < order.length; i++)
    if (compare(order[i - 1], order[i]) === 0) throw Error('Catalog hash collision');
  let totalNames = 0;
  const lengths = Uint16Array.from(rows, (row) => {
    const length = Buffer.byteLength(row[1]);
    if (length > 65535) throw Error('Catalog name too long');
    totalNames += length;
    return length;
  });
  const rowsOffset = 32 + keys.length * 16;
  const namesOffset = rowsOffset + rows.length * 8;
  const bytes = Buffer.alloc(namesOffset + totalNames);
  [BINARY_MAGIC, 1, keys.length, rows.length, rowsOffset, namesOffset, 0, bytes.length].forEach(
    (n, i) => bytes.writeUInt32LE(n, i * 4),
  );
  order.forEach((record, i) => records.copy(bytes, 32 + i * 16, record * 16, record * 16 + 16));
  let nameOffset = 0;
  rows.forEach((row, i) => {
    const offset = rowsOffset + i * 8;
    bytes.writeUInt32LE(nameOffset, offset);
    bytes.writeUInt16LE(lengths[i], offset + 4);
    bytes.writeUInt8(row[2] || 0, offset + 6);
    bytes.write(row[1], namesOffset + nameOffset, lengths[i], 'utf8');
    nameOffset += lengths[i];
  });
  return bytes;
}
