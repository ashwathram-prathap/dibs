export const colors =
  'Amber Ash Auburn Azure Beige Birch Black Blue Brass Bronze Brown Buff Burgundy Carmine Cedar Chalk Charcoal Chestnut Cobalt Copper Coral Cream Crimson Dove Ecru Fawn Flax Flint Forest Gold Granite Graphite Green Hazel Indigo Ink Ivory Jade Khaki Lavender Lemon Lilac Linen Mahogany Maroon Mint Moss Ochre Olive Onyx Opal Pearl Pewter Plum Rose Ruby Rust Saffron Sage Sand Scarlet Sepia Sienna Silver Slate Stone Tan Taupe Teal Umber Vermilion Violet Wheat White Willow'.split(
    ' ',
  );
export const animals =
  'Alpaca Antelope Badger Bat Bear Beaver Bison Bobcat Capybara Caribou Cat Chamois Chinchilla Chipmunk Civet Coati Crane Deer Dolphin Dove Duck Echidna Egret Elephant Elk Falcon Fawn Ferret Finch Fox Gazelle Gecko Gibbon Goat Goose Hare Hedgehog Heron Ibex Ibis Impala Jaguar Jay Kangaroo Kestrel Koala Lemur Leopard Llama Lynx Magpie Marmot Mink Mole Mongoose Moose Moth Newt Ocelot Okapi Opossum Otter Owl Panda Pangolin Parrot Pelican Penguin Pika Puffin Quail Quokka Rabbit Raccoon Raven Robin Seal Shrew Sloth Sparrow Stoat Swan Tapir Tern Tiger Toad Toucan Turtle Vole Wallaby Walrus Wombat Wren Yak Zebra'.split(
    ' ',
  );
const random = (n: number) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
};
export const handle = () =>
  `${colors[random(colors.length)]} ${animals[random(animals.length)]} #${random(999999) + 1}`;
export async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function verify(value: string, sig: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  if (!/^[a-f0-9]{64}$/.test(sig)) return false;
  return crypto.subtle.verify(
    'HMAC',
    key,
    Uint8Array.from(sig.match(/../g)!, (v) => parseInt(v, 16)),
    new TextEncoder().encode(value),
  );
}
export async function cookieUser(req: Request, secret: string) {
  const val = req.headers.get('Cookie')?.match(/(?:^|;\s*)dibs_session=([^;]+)/)?.[1];
  if (!val) return null;
  const [id, sig] = val.split('.');
  if (!id || !sig || !(await verify(id, sig, secret))) return null;
  return id;
}
