export const paperStocks = [
  ['sage', '#e5e9db', '#20271f'],
  ['blue-manila', '#dfe6e9', '#1d252a'],
  ['apricot', '#eee1d1', '#2d231b'],
  ['lilac-grey', '#e6e2e7', '#27232b'],
  ['oat', '#e9e3d4', '#29251d'],
  ['celadon', '#dce7df', '#1c2822'],
  ['rose', '#eadfdc', '#2d2220'],
  ['slate', '#dfe3e3', '#202728'],
  ['flax', '#ebe6cc', '#2b291c'],
  ['clay', '#e7ddd2', '#2a231e'],
  ['pearl', '#e8e6e0', '#262622'],
  ['olive', '#e2e4d1', '#252818'],
] as const;
export function categoryStyle(slug: string) {
  const fixed: Record<string, number> = { animals: 0, cities: 1, foods: 2, countries: 3 };
  const index =
    fixed[slug] ?? [...slug].reduce((n, c) => n + c.charCodeAt(0), 0) % paperStocks.length;
  const [stock, light, dark] = paperStocks[index];
  const plate =
    slug === 'animals'
      ? 'animals-b'
      : ['cities', 'countries', 'foods'].includes(slug)
        ? slug
        : 'seal-b';
  return { stock, light, dark, plate };
}
