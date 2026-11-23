import { noOrphan } from './text';
export function fitText(
  text: string,
  measure: (text: string, size: number) => number,
  width: number,
  options: {
    startSize: number;
    minSize: number;
    maxLines: number;
    maxHeight: number;
    lineHeight: number;
  },
) {
  const words = noOrphan(text.trim()).split(/[ \t\r\n]+/);
  for (const splitWords of [false, true]) {
    for (let size = options.startSize; size >= options.minSize; size -= 5) {
      if (!splitWords && words.some((word) => measure(word, size) > width)) continue;
      const lines: string[] = [];
      let row = '';
      for (const word of words) {
        if (measure(word, size) > width) {
          if (row) {
            lines.push(row);
            row = '';
          }
          for (const ch of word) {
            if (row && measure(row + ch, size) > width) {
              lines.push(row);
              row = '';
            }
            row += ch;
          }
        } else {
          const candidate = row ? row + ' ' + word : word;
          if (row && measure(candidate, size) > width) {
            lines.push(row);
            row = word;
          } else row = candidate;
        }
      }
      if (row) lines.push(row);
      if (
        lines.length <= options.maxLines &&
        lines.length * size * options.lineHeight <= options.maxHeight
      )
        return { lines, size };
    }
  }
  throw new Error('This entry does not fit the certificate.');
}

// Preserve both ends of long identifiers after reaching a readable minimum size.
export function fitLine(
  value: string,
  measure: (value: string, size: number) => number,
  width: number,
  startSize: number,
  minSize = 14,
) {
  const minimum = Math.min(startSize, minSize);
  let size = startSize;
  while (size > minimum && measure(value, size) > width) size = Math.max(minimum, size - 0.5);
  if (measure(value, size) <= width) return { text: value, size };
  const chars = [...value];
  for (let keep = chars.length - 1; keep >= 0; keep--) {
    const left = Math.ceil(keep / 2),
      right = Math.floor(keep / 2);
    const text = chars.slice(0, left).join('') + '…' + (right ? chars.slice(-right).join('') : '');
    if (measure(text, size) <= width) return { text, size };
  }
  return { text: '', size };
}
