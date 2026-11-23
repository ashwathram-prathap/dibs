/** Keep a short final word with its neighbour; cap the pair for narrow, enlarged text. */
export function noOrphan(text: string, maxPair = 18) {
  return text.replace(/(\S+)[ \t]+(\S{1,9})([ \t]*)$/, (all, before, last, tail) =>
    before.length + last.length + 1 <= maxPair ? before + '\u00a0' + last + tail : all,
  );
}
export const countLabel = (n: number, singular: string, plural = singular + 's') =>
  `${n} ${n === 1 ? singular : plural}`;
