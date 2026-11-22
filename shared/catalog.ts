// FNV-1a gives bounded lookup shards without exposing any special status.
export function shardFor(key: string) {
  let n = 2166136261;
  for (let i = 0; i < key.length; i++) n = Math.imul(n ^ key.charCodeAt(i), 16777619);
  return (n >>> 0) % 256;
}
export type CatalogRow = [number, string, number | null];
export type TypoNode = [string, number, Record<string, number>];
// Myers' bit-parallel Levenshtein recurrence. Reuse the query mask across the whole search.
export function distanceFrom(a: string): (b: string) => number {
  if (!a.length) return (b) => b.length;
  if (a.length > 32) return (b) => fullDistance(a, b);
  const masks: Record<string, number> = Object.create(null);
  for (let i = 0; i < a.length; i++) masks[a[i]] = (masks[a[i]] || 0) | (1 << i);
  const last = 1 << (a.length - 1);
  return (b) => {
    let positive = -1,
      negative = 0,
      score = a.length;
    for (let i = 0; i < b.length; i++) {
      const equal = masks[b[i]] || 0;
      const vertical = equal | negative;
      const horizontal = (((equal & positive) + positive) ^ positive) | equal;
      let plus = negative | ~(horizontal | positive);
      let minus = positive & horizontal;
      if (plus & last) score++;
      if (minus & last) score--;
      plus = (plus << 1) | 1;
      minus <<= 1;
      positive = minus | ~(vertical | plus);
      negative = plus & vertical;
    }
    return score;
  };
}
// Exact distance is required for metric-tree pruning; a capped distance is not safe here.
export function fullDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j - 1] + 1, above + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}
export function findTypo(tree: TypoNode[], key: string, radius = 2) {
  const measure = distanceFrom(key);
  const todo = tree.length ? [0] : [];
  let best: number | null = null,
    distance = radius + 1;
  while (todo.length) {
    const [word, id, children] = tree[todo.pop()!];
    const d = measure(word);
    if (d <= radius && (d < distance || (d === distance && (best === null || id < best)))) {
      best = id;
      distance = d;
    }
    const bound = Math.min(radius, distance);
    for (const edge in children)
      if (+edge >= d - bound && +edge <= d + bound) todo.push(children[edge]);
  }
  return best;
}
export function editDistance(a: string, b: string, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        next[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      best = Math.min(best, next[j]);
    }
    if (best > max) return max + 1;
    previous = next;
  }
  return previous[b.length];
}
