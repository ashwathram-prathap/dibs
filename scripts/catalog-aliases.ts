import pluralize from 'pluralize';
const alternatives: Record<string, string[]> = {
  cactus: ['cacti', 'cactuses'],
  hippopotamus: ['hippopotami', 'hippopotamuses'],
  rhinoceros: ['rhinoceroses'],
  ibis: ['ibises'],
  octopus: ['octopi', 'octopuses', 'octopodes'],
};
export function commonNamePlurals(name: string) {
  const match = name.match(/^(.*?)(\S+)$/);
  if (!match) return [];
  return [
    ...new Set([
      pluralize(name),
      pluralize.singular(name),
      ...(name.match(/^(.*?) (of|in) (.+)$/i)
        ? [
            name.replace(
              /^(.*?) (of|in) (.+)$/i,
              (_, head, join, tail) => pluralize(head) + ' ' + join + ' ' + tail,
            ),
          ]
        : []),
      ...(Object.hasOwn(alternatives, match[2].toLowerCase())
        ? alternatives[match[2].toLowerCase()]
        : []
      ).map((word) => match[1] + word),
    ]),
  ];
}
