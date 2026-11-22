// Reject popularity from an unrelated homonym. Scientific-name requests are already
// domain-qualified by the reference record; their redirect may be a common-name page.
export function pageMatchesScope(slug: string, description: string, scientificRequest = false) {
  const geography: Record<string, RegExp> = {
    castles:
      /castle|fortress|fortification|\bfort\b|palace|manor|country house|mansion|château|chateau|historic house|stately home|tower house/i,
    airports:
      /airport|airfield|airbase|air base|airstrip|aerodrome|seaplane|air station|air force (?:base|facility)|aviation facility/i,
    mountains: /mountain|peak|summit|volcano|massif|ridge|range|hill/i,
    rivers: /river|stream|watercourse|tributary|wadi|creek/i,
    lakes: /lake|reservoir|body of water|saltwater lagoon/i,
    islands: /island|islet|archipelago|atoll|crown dependency|autonomous territory/i,
    stations:
      /(?:railway|railroad|rail|train|metro|subway|tube|commuter rail) (?:station|terminal|terminus)|tram stop|tramway stop|transport.*station|station (?:in|on)/i,
  };
  if (geography[slug])
    return (
      geography[slug].test(description) &&
      !/film|album|novel|actor|company|video game/i.test(description)
    );
  if (
    ![
      'animals',
      'birds',
      'arthropods',
      'plants',
      'fruits-vegetables',
      'foods',
      'cities',
      'countries',
    ].includes(slug)
  )
    return true;
  if (
    /film|television|album|rock band|software|company|novel|actor|politician|team sport|sovereign state|country in|country primarily/i.test(
      description,
    )
  )
    return slug === 'countries';
  if (slug === 'cities')
    return /city|town|village|municipality|settlement|suburb|capital|commune|borough|district/i.test(
      description,
    );
  if (slug === 'countries') return true;
  if (scientificRequest) return true;
  if (slug === 'animals' || slug === 'arthropods')
    return /animal|mammal|bird|fish|insect|reptile|amphibian|arachnid|mollusc|crustacean|worm|rodent|salamander|canid|canine|feline|cat\b|bear|dolphin|whale|primate|snake|lizard|beetle|butterfl|moth|bee\b|spider|ungulate|marsupial|fauna|bat\b|bats\b|turtle|tortoise|crocodil|sponge|coral|polychaete|annelid|gastropod|clam|oyster|scorpion|arthropod|dragonfl|damselfl/i.test(
      description,
    );
  if (slug === 'birds')
    return /bird|avian|fowl|duck|chicken|goose|geese|swan|pigeon|dove|raptor|parrot|penguin|passerine/i.test(
      description,
    );
  if (slug === 'plants' || slug === 'fruits-vegetables')
    return /plant|tree|flower|fruit|vegetable|berry|berries|grass|shrub|herb(?:s|aceous)?\b|crop|legume|tuber|bulb|fern|moss|palm|bamboo|conifer|cactus|cacti|succulent|seed|squash|melon|cultivar|garden/i.test(
      description,
    );
  if (slug === 'foods')
    return (
      !/cooking (method|technique)|method of cooking|cooking process|chef|restaurateur|city|town|region of|province|language|ethnic group|military leader|statesman/i.test(
        description,
      ) &&
      /food|dish|drink|cuisine|ingredient|beverage|vegetable|fruit|seed|grain|cereal|spice|herb\b|condiment|sauce|dairy|cheese|milk|meat|fish|mushroom|pasta|noodle|soup|bread|pastry|dessert|cake|candy|chocolate|confection|sweet|sandwich|salad|sausage|meal|water|liquid|oil\b|salt\b|sugar|starch|protein|wine|beer|spirit|liqueur|juice|coffee|tea\b|edible|prepared|cooked|culinary|fermented|baked|roasted|boiled|seasoning|flour|flavor|flavour|yeast|vinegar|gelatin|cocoa|cacao|liver|egg|poultry|cream|potato|nut\b/i.test(
        description,
      )
    );
  return true;
}

// A castle in a school's location does not make the school itself a castle.
export function castleTitleDescriptionMatches(description: string) {
  const subject = description.split(
    /\b(?:in|at|near|overlooking|within|around|located|surrounding|containing|with)\b/i,
  )[0];
  return (
    /castle|fortress|fortification|palace|manor|historic house|country house|stately home|mansion|estate|historic landmark|royal residence|château|chateau|\bfort\b/i.test(
      subject,
    ) &&
    !/fictional|mythological|legendary|film|album|novel|actor|actress|singer|musician|song|video game|television|band\b|composer|football club|rock formation|geological|natural landmark|railway station|bridge|battle|siege|treaty|painting|sculpture|drawing|postage|poem|opera|ballet/i.test(
      subject,
    )
  );
}
