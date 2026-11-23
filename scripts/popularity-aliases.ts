interface Reading {
  total: number | null;
  days: number;
  title?: string;
  [key: string]: unknown;
}
interface Answer {
  display: string;
  canonical?: string;
  aliases?: string[];
  scientificName?: string;
  pageviews?: Reading;
}
const key = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/[^\p{L}\p{N}]/gu, '');
export const measured = (p?: Reading) =>
  !!p && p.days > 0 && typeof p.total === 'number' && Number.isFinite(p.total);
export function resolvePopularity(answers: Answer[]) {
  const titles = new Map<string, Answer[]>(),
    names = new Map<string, Answer[]>();
  const add = (map: Map<string, Answer[]>, k: string | undefined, a: Answer) => {
    if (k) {
      const normalized = key(k);
      const list = map.get(normalized) || [];
      if (!list.includes(a)) list.push(a);
      map.set(normalized, list);
    }
  };
  for (const a of answers)
    if (measured(a.pageviews)) {
      add(titles, a.pageviews!.title, a);
      for (const n of [a.display, a.canonical, a.scientificName, ...(a.aliases || [])])
        add(names, n, a);
    }
  const mappings: { answer: string; canonical: string; title?: string }[] = [];
  const readings = answers.map((a) => {
    if (measured(a.pageviews)) return a.pageviews!;
    const donors = a.pageviews?.title ? titles.get(key(a.pageviews.title)) : undefined;
    const matches = donors || [
      ...new Set(
        [a.display, a.canonical, a.scientificName, ...(a.aliases || [])]
          .filter((n): n is string => !!n)
          .flatMap((n) => names.get(key(n)) || []),
      ),
    ];
    if (!matches?.length) return a.pageviews;
    const p = matches[0].pageviews!;
    // Ambiguous readings remain missing; do not infer a popularity value.
    if (
      matches.some(
        (m) =>
          m.pageviews!.total !== p.total ||
          m.pageviews!.days !== p.days ||
          m.pageviews!.start !== p.start ||
          m.pageviews!.end !== p.end,
      )
    )
      return a.pageviews;
    mappings.push({ answer: a.display, canonical: matches[0].display, title: p.title });
    return { ...p };
  });
  return {
    readings,
    mappings,
    before: answers.filter((a) => !measured(a.pageviews)).length,
    after: readings.filter((p) => !measured(p)).length,
  };
}
