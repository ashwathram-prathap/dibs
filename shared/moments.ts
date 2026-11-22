export function clerkReply(answer: string, category: string) {
  const value = answer.trim().toLocaleLowerCase();
  if (value === 'dibs') return 'The clerk appreciates the enthusiasm.';
  if (value === 'registrar') return 'Flattery will get you nowhere.';
  if (value === category.toLocaleLowerCase()) return 'Very funny.';
  return null;
}
export const notes: Record<string, string> = {
  animals: 'The ink is provided.',
  cities: 'Paperwork, with a straight face.',
  foods: 'The ink is provided.',
  countries: 'Please leave the stamp pad here.',
  birds: 'The ink is provided.',
  plants: 'The ink is provided.',
  'fruits-vegetables': 'The ink is provided.',
  mountains: 'Ink supplied at this counter.',
  rivers: 'Paperwork persists.',
  lakes: 'Paperwork persists.',
  islands: 'No appointment needed.',
  films: 'Paperwork persists.',
  television: 'No appointment needed.',
  songs: 'Stamp pads provided.',
  albums: 'Bureaucracy, briefly.',
  bands: 'Please leave the stamp pad here.',
  novels: 'Paperwork persists.',
  poets: 'The ink is provided.',
  paintings: 'Paperwork persists.',
  painters: 'The ink is provided.',
  composers: 'Please leave the stamp pad here.',
  actors: 'Please leave the stamp pad here.',
  footballers: 'The ink is provided.',
  'video-games': 'Paperwork persists.',
  universities: 'The ink is provided.',
  museums: 'The ink is provided.',
  castles: 'No appointment needed.',
  ships: 'The ink is provided.',
  stations: 'Paperwork, with a straight face.',
  airports: 'Paperwork persists.',
  architects: 'The ink is provided.',
  asteroids: 'No appointment needed.',
  arthropods: 'The ink is provided.',
};
export const categoryNote = (slug: string) => notes[slug] || 'A fresh register. The same old ink.';
// One pen stroke, shared by screen and exported certificates.
export const REGISTRAR_STROKE =
  'M4 30C18 15 36 7 42 12C48 17 23 38 22 30L38 7M20 18C38 15 62 10 65 15M43 27C49 17 53 16 50 26C48 33 60 24 65 21C61 31 68 31 73 23C77 17 82 22 77 27C73 31 69 29 76 23L90 16C82 36 85 45 78 45C70 44 84 26 98 21C91 30 102 27 107 20C108 16 103 19 107 23C116 29 110 33 104 30L124 16M116 29L128 8M117 20L139 17M125 28C131 17 137 15 132 25C130 30 139 23 146 19C138 31 146 28 152 22C158 16 163 20 155 25C150 29 152 31 164 23L174 18M169 28C173 16 177 15 177 20C182 15 190 19 184 23L179 28C190 26 196 22 203 25M16 39C62 31 139 35 212 31';
