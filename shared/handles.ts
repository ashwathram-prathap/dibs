/** R17 accidentally exposed the first eight hexadecimal identity characters. */
export const cleanHandle = (name: string) => name.replace(/ #[0-9a-f]{8}$/i, '');
export function cleanStoredHandles<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanStoredHandles) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === 'string' && ['handle', 'holder', 'takenBy', 'crackedBy'].includes(key)
          ? cleanHandle(item)
          : cleanStoredHandles(item),
      ]),
    ) as T;
  return value;
}
export function playerNumber(id: string) {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return 10 + ((hash >>> 0) % 990);
}
/** IDs stay private. Only colliding visible players receive a stable decimal suffix. */
export function displayNames(
  players: { id: string; handle: string; founder?: boolean | number }[],
) {
  const names = new Map<string, Set<string>>();
  for (const p of players) {
    const name = cleanHandle(p.handle);
    if (!p.founder && !['Withdrawn player', 'Record withheld', 'RESERVED'].includes(name)) {
      if (!names.has(name)) names.set(name, new Set());
      names.get(name)!.add(p.id);
    }
  }
  return new Map(
    players.map((p) => {
      const name = cleanHandle(p.handle);
      return [
        p.id,
        !p.founder && (names.get(name)?.size || 0) > 1 ? `${name} #${playerNumber(p.id)}` : name,
      ];
    }),
  );
}
