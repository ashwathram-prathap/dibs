import type { CatalogRow } from './catalog';

export const BINARY_CHUNK_BYTES = 8 * 1024 * 1024;
export const BINARY_MAGIC = 0x33424944; // DIB3, little endian
export type BinaryCatalog = { chunks: Uint8Array[]; views: DataView[]; size: number };
function viewAt(index: BinaryCatalog, offset: number) {
  return index.views[Math.floor(offset / BINARY_CHUNK_BYTES)];
}
function uint32(index: BinaryCatalog, offset: number) {
  return viewAt(index, offset).getUint32(offset % BINARY_CHUNK_BYTES, true);
}
export function openBinaryCatalog(chunks: Uint8Array[]): BinaryCatalog {
  const index = {
    chunks,
    views: chunks.map((c) => new DataView(c.buffer, c.byteOffset, c.byteLength)),
    size: chunks.reduce((n, c) => n + c.length, 0),
  };
  if (
    index.size < 32 ||
    uint32(index, 0) !== BINARY_MAGIC ||
    uint32(index, 4) !== 1 ||
    uint32(index, 28) !== index.size ||
    chunks.some((c, i) => i < chunks.length - 1 && c.length !== BINARY_CHUNK_BYTES) ||
    uint32(index, 16) !== 32 + 16 * uint32(index, 8) ||
    uint32(index, 20) !== uint32(index, 16) + 8 * uint32(index, 12) ||
    uint32(index, 20) > index.size
  )
    throw Error('Invalid binary catalog');
  return index;
}
const decoder = new TextDecoder();
export function lookupBinary(index: BinaryCatalog, hash: Uint8Array): CatalogRow | null {
  if (hash.length < 12) throw Error('Invalid catalog hash');
  let low = 0,
    high = uint32(index, 8) - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const offset = 32 + mid * 16;
    const bytes = index.chunks[Math.floor(offset / BINARY_CHUNK_BYTES)];
    const local = offset % BINARY_CHUNK_BYTES;
    let comparison = 0;
    for (let i = 0; i < 12 && comparison === 0; i++) comparison = bytes[local + i] - hash[i];
    if (comparison < 0) low = mid + 1;
    else if (comparison > 0) high = mid - 1;
    else {
      const ordinal = uint32(index, offset + 12);
      if (ordinal >= uint32(index, 12)) throw Error('Invalid catalog ordinal');
      const rowOffset = uint32(index, 16) + ordinal * 8;
      const view = viewAt(index, rowOffset);
      const rowLocal = rowOffset % BINARY_CHUNK_BYTES;
      const nameOffset = uint32(index, 20) + view.getUint32(rowLocal, true);
      const length = view.getUint16(rowLocal + 4, true);
      const obscurity = view.getUint8(rowLocal + 6) || null;
      if (nameOffset + length > index.size) throw Error('Invalid catalog name');
      const chunk = Math.floor(nameOffset / BINARY_CHUNK_BYTES);
      const start = nameOffset % BINARY_CHUNK_BYTES;
      let name = index.chunks[chunk].subarray(start, start + length);
      if (name.length < length) {
        const joined = new Uint8Array(length);
        joined.set(name);
        joined.set(index.chunks[chunk + 1].subarray(0, length - name.length), name.length);
        name = joined;
      }
      return [ordinal, decoder.decode(name), obscurity];
    }
  }
  return null;
}
