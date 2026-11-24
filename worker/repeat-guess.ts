// R19I: a player is never charged a second strike for the same resolved answer on one night.
// "Same" is the resolved answer_id (case, plural and aliases fold to one catalog row); house
// words resolve the same way. Strike events carry answerId from R19I on; strikes journaled
// earlier that night are resolved once from their typed text.
export type StruckCache = Map<string, string | null>;
type Event = { kind: string; at: string; answerId?: string; display?: string };
const key = (uid: string, e: Event) => uid + '\u0000' + e.at;

/** Resolve pre-R19I strike events (no answerId) to an answer_id, once each. */
export async function resolveLegacyStrikes(
  cache: StruckCache,
  uid: string,
  events: Event[],
  resolve: (typed: string) => Promise<string | null>,
) {
  for (const e of events) {
    if (e.kind !== 'strike' || e.answerId || cache.has(key(uid, e))) continue;
    cache.set(key(uid, e), typeof e.display === 'string' ? await resolve(e.display) : null);
  }
}

/** The earlier strike for this answer_id, if any. Synchronous: safe inside the claim's no-await window. */
export function struckEvent<E extends Event>(
  cache: StruckCache,
  uid: string,
  events: E[],
  aid: string,
): E | undefined {
  return events.find(
    (e) =>
      e.kind === 'strike' && (e.answerId ? e.answerId === aid : cache.get(key(uid, e)) === aid),
  );
}
