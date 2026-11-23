// Older printed certificates used the first 16 characters. Never resolve an
// ambiguous prefix to somebody else's certificate.
export function resolveCertificate<T extends { id: string; voided?: unknown }>(
  records: Iterable<T>,
  id: string,
): T | undefined {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return;
  const active = [...records].filter((record) => !record.voided);
  const exact = active.find((record) => record.id === id);
  if (exact) return exact;
  const matches = active.filter((record) => record.id.startsWith(id));
  return matches.length === 1 ? matches[0] : undefined;
}
