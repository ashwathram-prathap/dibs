// Shared by domain imports; this never consults coverage fixtures.
const offensive = /\b(?:fuck|fucking|shit|cunt|nigger|faggot|kaffir|redskin|rape|nazi)\b/i;
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
    .map((r) => ({
      ...r,
      display: r.display.trim(),
      aliases: (r.aliases || []).filter(usableCatalogName).map((s: string) => s.trim()),
    }));
}
