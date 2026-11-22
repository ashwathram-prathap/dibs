// Reject popularity from an unrelated homonym. Scientific-name requests are already
// domain-qualified by the reference record; their redirect may be a common-name page.
export function pageMatchesScope(slug: string, description: string, scientificRequest = false) {
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
  if (slug === 'animals')
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
    return !/cooking (method|technique)|method of cooking|cooking process|chef|restaurateur|city|town|region of|province|language|ethnic group/i.test(
      description,
    );
  return true;
}
