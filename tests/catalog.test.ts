import { it, expect } from 'vitest';
import { fullDistance, distanceFrom, findTypo, type TypoNode } from '../shared/catalog';
it('finds one- and two-edit answers anywhere in a metric tree, including aliases', () => {
  const words = [
    'cat',
    'chameleon',
    'ornithorhynchusanatinus',
    'wolf',
    'mouse',
    'axolotl',
    'newyorkcity',
    'quokka',
  ];
  const tree: TypoNode[] = [];
  for (const [id, key] of words.entries()) {
    const node: TypoNode = [key, id, {}];
    if (!tree.length) {
      tree.push(node);
      continue;
    }
    let at = 0;
    while (true) {
      const d = fullDistance(key, tree[at][0]);
      const next = tree[at][2][d];
      if (next === undefined) {
        tree[at][2][d] = tree.length;
        tree.push(node);
        break;
      }
      at = next;
    }
  }
  for (const query of [
    'chamelon',
    'chamelom',
    'ornithorhynchusanatinis',
    'newyorkcty',
    'quokaa',
    'wolf',
    'invalid',
  ]) {
    const expected =
      words
        .map((word, id) => ({ id, d: fullDistance(query, word) }))
        .filter((r) => r.d <= 2)
        .sort((a, b) => a.d - b.d || a.id - b.id)[0]?.id ?? null;
    expect(findTypo(tree, query, 2)).toBe(expected);
  }
});

it('matches the dynamic-programming oracle for long, short, unicode and 32-bit boundary strings', () => {
  let seed = 8721;
  const rand = () => ((seed = Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const alphabet = 'abcdeéçxyz';
  for (let i = 0; i < 500; i++) {
    const word = () =>
      Array.from(
        { length: Math.floor(rand() * 40) },
        () => alphabet[Math.floor(rand() * alphabet.length)],
      ).join('');
    const a = word(),
      b = word();
    expect(distanceFrom(a)(b)).toBe(fullDistance(a, b));
  }
});
