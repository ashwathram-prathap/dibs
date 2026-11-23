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
