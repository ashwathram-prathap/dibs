import pluralize from 'pluralize';
export function conjunctionAliases(name: string) {
  return [
    ...(name.includes('&') ? [name.replace(/&/g, ' and ')] : []),
    ...(/\band\b/i.test(name) ? [name.replace(/\band\b/gi, '&')] : []),
  ];
}
export function workSubtitleAliases(name: string) {
  const afterColon = name.match(/^[^:]+:\s*(.+)$/)?.[1];
  if (!afterColon) return [];
  const subtitle = afterColon
    .replace(/^(?:episode|part|book|volume|vol\.)\s+(?:[ivxlcdm]+|\d+)\s*[-–—:]\s*/i, '')
    .split(/\s+[–—]\s+/)
    .at(-1)!
    .trim();
  if (
    subtitle.split(/\s+/).length < 2 ||
    /^(?:part|episode|season|volume|vol\.)\s+(?:[ivxlcdm]+|\d+)$/i.test(subtitle)
  )
    return [];
  return [subtitle];
}
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
