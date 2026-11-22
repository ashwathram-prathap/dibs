export type Topic = {
  slug: string;
  name: string;
  kind: string;
  priority: number;
  ready: boolean;
  uploaded?: boolean;
  score?: number;
  checkedAt?: string;
  lastUsed?: string;
  recipe?: any;
};
export type CalendarDay = {
  date: string;
  slug: string | null;
  request?: string | null;
  status: string;
  category_id?: string | null;
  auto_picked?: number;
  reason?: string;
  build_result?: string;
  updated_at?: string;
  built_at?: string | null;
  revision: number;
  dropAt?: string;
  readOnly?: boolean;
};
export const dayAfter = (date: string, n = 1) =>
  new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function chooseTopic(date: string, days: CalendarDay[], topics: Topic[]) {
  const used = new Set(
    days.filter((d) => d.date >= dayAfter(date, -21) && d.date < date && d.slug).map((d) => d.slug),
  );
  const before = days.find((d) => d.date === dayAfter(date, -1));
  const next = days.find((d) => d.date === dayAfter(date));
  const kinds = [before, next]
    .map((d) => topics.find((t) => t.slug === d?.slug)?.kind)
    .filter(Boolean);
  const candidates = topics.filter((t) => t.ready && !used.has(t.slug) && !kinds.includes(t.kind));
  // Also avoid already planned repeats within 21 days in the other direction.
  const future = new Set(
    days.filter((d) => d.date > date && d.date <= dayAfter(date, 21) && d.slug).map((d) => d.slug),
  );
  const available = candidates.filter((t) => !future.has(t.slug));
  available.sort((a, b) => {
    const last = (slug: string) =>
      days.filter((d) => d.slug === slug && d.date < date).at(-1)?.date || '';
    return (
      last(a.slug).localeCompare(last(b.slug)) ||
      a.priority - b.priority ||
      a.slug.localeCompare(b.slug)
    );
  });
  if (!available.length)
    throw Error(
      'No coverage-passed topic satisfies the 21-day and neighbouring-type rules. Add another recipe or choose a day manually.',
    );
  const topic = available[0];
  return {
    topic,
    reason: `Auto-picked ${topic.name}: coverage passed; no use within 21 days; different type from adjacent days; broad topics and least recent use preferred.`,
  };
}
export function leadTime(drop: string, now: number, isNew = false) {
  const hours = isNew ? 72 : 24;
  if (Date.parse(drop) - now < hours * 3600000)
    throw Error(
      `${isNew ? 'New requests' : 'Library changes'} need ${hours} hours before the drop.`,
    );
}
export function pruneCatalogs(
  rows: {
    slug: string;
    version: string;
    date: string | null;
    closeAt?: string;
    removed?: boolean;
  }[],
  now: number,
) {
  const keep = new Set<string>();
  for (const r of rows)
    if (!r.removed && r.date && (!r.closeAt || Date.parse(r.closeAt) + 7 * 86400000 > now))
      keep.add(r.slug + '/' + r.version);
  return keep;
}
