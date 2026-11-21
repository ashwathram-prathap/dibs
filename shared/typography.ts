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
  const words = text.trim().split(/\s+/);
  for (let size = options.startSize; size >= options.minSize; size -= 5) {
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
  throw new Error('This entry does not fit the certificate.');
}
