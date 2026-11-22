import { DROP_TIME_LOCAL, DROP_TIME_ZONE } from '../shared/config';
// Proper names retain their spelling: Cars and Car are different answers.
export function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => (word === 'st' ? 'saint' : word))
    .join('');
}
// Existing D1 registers and common-noun source deduplication use the legacy fold.
// New static registers accept plurals through explicit aliases instead.
export function normalizeCommonName(value: string) {
  let s = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  const irregular: Record<string, string> = {
    mice: 'mouse',
    wolves: 'wolf',
    calves: 'calf',
    leaves: 'leaf',
    octopi: 'octopus',
    octopuses: 'octopus',
    geese: 'goose',
    feet: 'foot',
    teeth: 'tooth',
    children: 'child',
    men: 'man',
    women: 'woman',
  };
  s = s
    .split(/\s+/)
    .map(
      (w) =>
        (w === 'st' ? 'saint' : Object.hasOwn(irregular, w) ? irregular[w] : undefined) ||
        (w.endsWith('ies') && w.length > 4
          ? w.slice(0, -3) + 'y'
          : /(ches|shes|xes|zes|sses)$/.test(w)
            ? w.slice(0, -2)
            : w.endsWith('s') && !/(ss|us|is)$/.test(w) && w.length > 3
              ? w.slice(0, -1)
              : w),
    )
    .join('');
  return s;
}
export function torontoDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DROP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function dropAt(date: string) {
  let t = Date.parse(date + 'T' + DROP_TIME_LOCAL + ':00Z');
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: DROP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(t));
    const get = (k: string) => parts.find((p) => p.type === k)!.value;
    const local = Date.parse(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`,
    );
    t += Date.parse(date + 'T' + DROP_TIME_LOCAL + ':00Z') - local;
  }
  return new Date(t).toISOString();
}
export function registryDate(now = new Date()) {
  const d = torontoDate(now);
  return now.toISOString() < dropAt(d)
    ? new Date(Date.parse(d + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
    : d;
}
export function nextDrop(now = new Date()) {
  const d = torontoDate(now),
    drop = dropAt(d);
  return drop > now.toISOString()
    ? drop
    : dropAt(new Date(Date.parse(d + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10));
}
export function streak(dates: string[], current: string) {
  const ordered = [...new Set(dates.filter((day) => day <= current))].sort().reverse();
  const prior = new Date(Date.parse(current + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  if (![current, prior].includes(ordered[0])) return 0;
  let n = 0,
    expected = ordered[0];
  for (const day of ordered) {
    if (day !== expected) break;
    n++;
    expected = new Date(Date.parse(day + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  }
  return n;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T12:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
