// Shared by domain imports; this never consults coverage fixtures.
const offensive = /\b(?:fuck|fucking|shit|cunt|nigger|faggot|kaffir|redskin|rape|nazi)\b/i;
const iconGlyph = /[\u2190-\u27bf\u{1f000}-\u{1ffff}]|\p{Extended_Pictographic}/u;
const writtenGlyphs: Record<string, string> = {
  '\u221e': ' infinity ',
  '\u00a9': '',
  '\u00ae': '',
  '\u2122': ' TM',
  '\u2212': '-',
  '\u2260': ' not equal ',
  '\u2252': ' nearly equal ',
  '\u221a': ' root ',
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
export function repairSourceEncoding(name: string) {
  // Recover UTF-8 that a reference exporter incorrectly decoded as Windows-1252.
  const windows: Record<string, number> = {
    '€': 128,
    '‚': 130,
    ƒ: 131,
    '„': 132,
    '…': 133,
    '†': 134,
    '‡': 135,
    ˆ: 136,
    '‰': 137,
    Š: 138,
    '‹': 139,
    Œ: 140,
    Ž: 142,
    '‘': 145,
    '’': 146,
    '“': 147,
    '”': 148,
    '•': 149,
    '–': 150,
    '—': 151,
    '˜': 152,
    '™': 153,
    š: 154,
    '›': 155,
    œ: 156,
    ž: 158,
    Ÿ: 159,
  };
  for (let pass = 0; pass < 2 && /(?:Ã.|Â.|â€)/.test(name); pass++) {
    const codes = [...name].map((character) => windows[character] ?? character.charCodeAt(0));
    if (codes.some((code) => code > 255)) break;
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(codes));
      if (decoded === name) break;
      name = decoded;
    } catch {
      break;
    }
  }
  return name;
}
function displayWithoutIcons(row: any) {
  if (!iconGlyph.test(row.display)) return row.display.trim();
  const written = [...row.display]
    .map((character) =>
      Object.hasOwn(writtenGlyphs, character) ? writtenGlyphs[character] : character,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const plain = (row.aliases || []).filter(
    (name: string) =>
      usableCatalogName(name) && !iconGlyph.test(name) && /[\p{Script=Latin}\d]/u.test(name),
  );
  if (written && !iconGlyph.test(written)) {
    const key = (name: string) =>
      name
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
    const matching = plain.find((name: string) => key(name) === key(written));
    return matching?.trim() || written[0].toUpperCase() + written.slice(1);
  }
  return plain[0]?.trim() || null;
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
    .filter(
      (r) =>
        usableCatalogName(r.display) &&
        !(
          r.scientificName &&
          /^(?:section|sample|site)\s+[A-Z]{1,5}[- ]?\d+.*\b(?:formation|ravine|mountains|mts|locality)\b/i.test(
            r.display,
          )
        ),
    )
    .map((r) => {
      const decoded = {
        ...r,
        display: repairSourceEncoding(r.display),
        aliases: [
          ...(r.aliases || []).map(repairSourceEncoding),
          ...(/[\u00a9\u00ae\u2122]/.test(repairSourceEncoding(r.display))
            ? [
                repairSourceEncoding(r.display)
                  .replace(/[\u00a9\u00ae\u2122]/g, '')
                  .trim(),
              ]
            : []),
        ],
      };
      const display = displayWithoutIcons(decoded);
      if (!display || !usableCatalogName(display)) return null;
      return {
        ...r,
        display,
        aliases: [
          ...(display !== decoded.display.trim() ? [decoded.display] : []),
          ...decoded.aliases,
        ]
          .filter(usableCatalogName)
          .map((s: string) => s.trim()),
      };
    })
    .filter(Boolean);
}

export function usableLatinReferenceName(value: string) {
  return (
    /[\p{Script=Latin}\d]/u.test(value) &&
    ![...value].some(
      (character) =>
        /\p{L}/u.test(character) && !/[\p{Script_Extensions=Latin}\p{Lm}]/u.test(character),
    )
  );
}
