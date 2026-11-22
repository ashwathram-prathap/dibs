// Shared by domain imports; this never consults coverage fixtures.
const offensive = /\b(?:fuck|fucking|shit|cunt|nigger|faggot|kaffir|redskin|rape|nazi)\b/i;
const iconGlyph = /[\u2190-\u21ff\u2500-\u27bf\u{1f000}-\u{1ffff}]/u;
const writtenGlyphs: Record<string, string> = {
  '\u2192': ' to ',
  '\u2190': ' from ',
  '\u2191': ' up ',
  '\u2193': ' down ',
  '\u2194': ' and ',
  '\u279d': ' to ',
  '\u266f': ' sharp ',
  '\u266d': ' flat ',
  '\u266e': ' natural ',
  '\u2661': ' heart ',
  '\u2665': ' heart ',
  '\u2764': ' heart ',
  '\u2605': ' star ',
  '\u2606': ' star ',
  '\u25b3': ' triangle ',
  '\u25b2': ' triangle ',
  '\u266a': ' - ',
  '\u266b': ' - ',
  '\u266c': ' - ',
  '\u25a0': ' square ',
};
function displayWithoutIcons(row: any) {
  if (!iconGlyph.test(row.display)) return row.display.trim();
  const alternative = (row.aliases || []).find(
    (name: string) => usableCatalogName(name) && !iconGlyph.test(name),
  );
  if (alternative) return alternative.trim();
  const written = [...row.display]
    .map((character) => writtenGlyphs[character] || character)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return iconGlyph.test(written) ? null : written;
}
export function usableCatalogName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= 120 &&
    !offensive.test(value) &&
    !value.includes('\uFFFD') &&
    !/^(?:Q\d+|unknown|unnamed|untitled|not known|no name)$/i.test(value.trim())
  );
}
export function cleanReferenceRows(rows: any[]) {
  return rows
    .filter((r) => usableCatalogName(r.display))
    .map((r) => {
      const display = displayWithoutIcons(r);
      if (!display || !usableCatalogName(display)) return null;
      return {
        ...r,
        display,
        aliases: [...(display !== r.display.trim() ? [r.display] : []), ...(r.aliases || [])]
          .filter(usableCatalogName)
          .map((s: string) => s.trim()),
      };
    })
    .filter(Boolean);
}
