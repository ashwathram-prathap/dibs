export interface ArchivedNote {
  id: string;
  topic: string;
  text: string;
  created_at: string;
  player_hash: string;
}
export const archiveColumns = ['id', 'topic', 'text', 'created_at', 'player_hash'] as const;
export function archiveCsv(notes: ArchivedNote[]) {
  const cell = (value: string) => {
    // Spreadsheet applications must not evaluate player-submitted formula text.
    const safe = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return (
    [
      archiveColumns.join(','),
      ...notes.map((n) => archiveColumns.map((k) => cell(n[k])).join(',')),
    ].join('\r\n') + '\r\n'
  );
}
export function validateArchive(value: unknown): ArchivedNote[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (n) =>
        !n ||
        Object.keys(n).sort().join() !== [...archiveColumns].sort().join() ||
        archiveColumns.some((k) => typeof n[k] !== 'string') ||
        !/^[a-f0-9]{64}$/.test(n.player_hash),
    )
  )
    throw Error('Invalid feedback export; nothing deleted.');
  if (new Set(value.map((n) => n.id)).size !== value.length)
    throw Error('Duplicate note ids; nothing deleted.');
  return value;
}
