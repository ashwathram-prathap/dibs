import pluralize from 'pluralize';
export function personNameAliases(name: string) {
  const plain = name
    .replace(
      /^(?:(?:sir|dame|dr\.?|prof\.?|professor|datuk(?: seri)?|dato[’']?(?: seri)?|tan sri|tun)\s+)+/i,
      '',
    )
    .trim();
  return plain && plain !== name ? [plain] : [];
}
export function castleNameAliases(name: string) {
  const kinds =
    'castle|château|chateau|castillo|castelo|castell|schloss|burg|fortress|fort|fortaleza|festung|palace|palacio|palácio|palais|alcázar|alcazar';
  const prefix = name.match(
    new RegExp('^(' + kinds + ')\\s+(?:(?:of|de|do|da|du|des)\\s+)?(.+)$', 'i'),
  );
  const suffix = name.match(new RegExp('^(.+?)\\s+(' + kinds + ')$', 'i'));
  if (!prefix && !suffix) return [];
  const kind = (prefix?.[1] || suffix![2]).toLowerCase();
  const base = (prefix?.[2] || suffix![1]).trim();
  if (base.length < 3) return [];
  const english = /^(fortress|fort|fortaleza|festung)$/.test(kind)
    ? 'Fortress'
    : /^(palace|palacio|palácio|palais)$/.test(kind)
      ? 'Palace'
      : /^(alcázar|alcazar)$/.test(kind)
        ? 'Alcazar'
        : 'Castle';
  return [
    ...new Set([
      base,
      base + ' ' + english,
      english + ' of ' + base,
      ...(english === 'Castle' ? ['Chateau de ' + base] : []),
    ]),
  ].filter((value) => value !== name);
}
export function geographicAliases(slug: string, name: string) {
  if (slug === 'castles') return castleNameAliases(name);
  const patterns: Record<string, RegExp> = {
    rivers: /^(?:river)\s+|\s+(?:river)$/gi,
    lakes: /^(?:lake)\s+|\s+(?:lake)$/gi,
    mountains: /^(?:mount|mt\.?|mountain)\s+|\s+(?:mountain)$/gi,
    islands: /^(?:island of)\s+|\s+(?:island)$/gi,
    stations:
      /\s+(?:(?:underground|tube|subway|metro|railway|railroad|rail|train)\s+)?(?:station|terminus|terminal)$/gi,
  };
  const pattern = patterns[slug];
  if (!pattern) return [];
  const short = name.replace(pattern, '').trim();
  const variants = short && short !== name ? [short] : [];
  if (short) {
    if (slug === 'rivers') variants.push(short + ' River', 'River ' + short);
    if (slug === 'lakes') variants.push('Lake ' + short, short + ' Lake');
    if (
      slug === 'mountains' &&
      !/\b(?:mount|mt|mountain|peak|range|volcano|mountains)\b/i.test(short)
    )
      variants.push('Mount ' + short, 'Mt ' + short);
    if (slug === 'stations') variants.push(short + ' Station', short + ' railway station');
  }
  return [...new Set(variants)].filter((variant) => variant !== name);
}
export function titleArticleAliases(name: string) {
  const shorter = name.replace(/^(?:the|an|a)\s+/i, '').trim();
  if (/^(?:the|an|a)$/i.test(shorter)) return [];
  return shorter !== name ? [shorter] : ['The ' + name];
}
export function shipNameAliases(name: string) {
  const variants = new Set<string>();
  const withoutQualifier = (value: string) => value.replace(/\s+\([^)]*\)$/, '').trim();
  variants.add(withoutQualifier(name));
  const short = name
    .replace(
      /^(?:(?:HMS|HMAS|HMCS|HMNZS|HNLMS|HSwMS|USS|USNS|SS|RMS|RRS|MS|MV|RV|TS|TSS|PS|HMY|INS|SMS|IJN|ARA|ARC|ARM|ARP|BAP|BRP|BNS|CNS|EML|FGS|FNS|FS|HNoMS|HDMS|HTMS|IRIS|ITS|JDS|JS|KD|KRI|NNS|NRP|ORP|PNS|RFS|ROKS|ROCS|RSS|SAS|ST|STS|TCG|USCGC)\s+)+/i,
      '',
    )
    .trim();
  if (short !== name) {
    variants.add(short);
    variants.add(withoutQualifier(short));
  }
  const named = name
    .replace(
      /^.+?\b(?:aircraft carrier|battleship|destroyer|cruiser|frigate|corvette|submarine|gunboat|torpedo boat|ship|boat|icebreaker|sloop|steamship|tugboat|tug|cutter|minesweeper|survey vessel|ferry)\s+/i,
      '',
    )
    .trim();
  if (named !== name) {
    variants.add(named);
    variants.add(withoutQualifier(named));
  }
  return [...variants].filter((variant) => variant !== name && variant.length >= 3);
}
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
