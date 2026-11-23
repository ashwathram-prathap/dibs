export const colors =
  'Amber Ash Auburn Azure Beige Birch Black Blue Brass Bronze Brown Buff Burgundy Carmine Cedar Chalk Charcoal Chestnut Cobalt Copper Coral Cream Crimson Dove Ecru Fawn Flax Flint Forest Gold Granite Graphite Green Hazel Indigo Ink Ivory Jade Khaki Lavender Lemon Lilac Linen Mahogany Maroon Mint Moss Ochre Olive Onyx Opal Pearl Pewter Plum Rose Ruby Rust Saffron Sage Sand Scarlet Sepia Sienna Silver Slate Stone Tan Taupe Teal Umber Vermilion Violet Wheat White Willow Apricot Aqua Arctic Biscuit Blush Cerulean Citron Clay Denim Dusty Emerald Fern Frost Honey Iris Mauve Ocean Peach Pine Russet Salmon Smoke Snow Spruce Steel Topaz Turquoise Walnut'.split(
    ' ',
  );
export const animals =
  'Alpaca Antelope Badger Bat Bear Beaver Bison Bobcat Capybara Caribou Cat Chamois Chinchilla Chipmunk Civet Coati Crane Deer Dolphin Dove Duck Echidna Egret Elephant Elk Falcon Fawn Ferret Finch Fox Gazelle Gecko Gibbon Goat Goose Hare Hedgehog Heron Ibex Ibis Impala Jaguar Jay Kangaroo Kestrel Koala Lemur Leopard Llama Lynx Magpie Marmot Mink Mole Mongoose Moose Moth Newt Ocelot Okapi Opossum Otter Owl Panda Pangolin Parrot Pelican Penguin Pika Puffin Quail Quokka Rabbit Raccoon Raven Robin Seal Shrew Sloth Sparrow Stoat Swan Tapir Tern Tiger Toad Toucan Turtle Vole Wallaby Walrus Wombat Wren Yak Zebra Aardvark Axolotl Beetle Butterfly Cormorant Coyote Dingo Dormouse Dragonfly Firefly Flamingo Fossa Frog Gannet Gaur Gerenuk Grouse Gull Hamster Harrier Hoopoe Hyrax Jackal Kingfisher Kudu Lark Loris Manatee Mandrill Meerkat Myna Narwhal Numbat Oryx Ostrich Peacock Plover Porcupine Salamander Sandpiper Serval Shrike Skink Snipe Squirrel Tamarin Tenrec Thrush Vervet Vicuna Weasel'.split(
    ' ',
  );
const random = (n: number) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
};
export const handle = () => `${colors[random(colors.length)]} ${animals[random(animals.length)]}`;
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
  if (!id || !/^[a-f0-9-]{36}$/.test(id) || !sig || !(await verify(id, sig, secret))) return null;
  return id;
}

export async function constantEqual(a: string, b: string) {
  return verify(a, await hmac(b, b), b);
}
export async function sessionCookie(id: string, secret: string, local = false) {
  // Host-only: the canonical host receives it, sibling subdomains do not.
  return `dibs_session=${id}.${await hmac(id, secret)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${local ? '' : '; Secure'}`;
}

export async function fileKey(uid: string, secret: string) {
  const hex = (await hmac('file-key:' + uid, secret)).slice(0, 20).toUpperCase();
  return 'DIBS-' + hex.match(/.{1,5}/g)!.join('-');
}
export const normalizeFileKey = (key: string) => key.toUpperCase().replace(/[^A-Z0-9]/g, '');
