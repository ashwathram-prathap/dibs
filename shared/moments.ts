export function clerkReply(answer: string, category: string) {
  const value = answer.trim().toLocaleLowerCase();
  if (value === 'dibs') return 'The clerk appreciates the enthusiasm.';
  if (value === 'registrar') return 'Flattery will get you nowhere.';
  if (value === category.toLocaleLowerCase()) return 'Very funny.';
  return null;
}
const notes: Record<string, string> = {
  animals: 'Someone always takes the axolotl first.',
  cities: 'Nobody ever claims Mississauga. Prove us wrong.',
  foods: 'The filing cabinet is not a refrigerator.',
  countries: 'Borders stay where they are. This is paperwork.',
  birds: 'The early bird still needs to file.',
  plants: 'Watering the register is discouraged.',
  'fruits-vegetables': 'Tomato disputes go in the other drawer.',
  mountains: 'A modest claim to higher ground.',
  rivers: 'Please keep the paperwork dry.',
  lakes: 'Depth is no substitute for punctuality.',
  islands: 'No boat is included.',
  films: 'The credits do not include the clerk.',
  television: 'One episode of paperwork per day.',
  songs: 'The clerk requests no humming at the counter.',
  albums: 'Filed in order of arrival, not track listing.',
  bands: 'No reunion tour is implied.',
  novels: 'The clerk has read the title.',
  poems: 'The form does not require a rhyme.',
  poets: 'Brevity is appreciated at this counter.',
  paintings: 'Please leave the frame on the wall.',
  painters: 'The ink is already mixed.',
  composers: 'A short pause before the next movement.',
  actors: 'No audition required. Just good timing.',
  footballers: 'The clerk has checked the offside rule. It does not apply.',
  'video-games': 'No extra lives in the filing cabinet.',
  universities: 'This certificate carries no academic credit.',
  museums: 'Please do not touch the exhibits.',
  castles: 'The moat is somebody else’s problem.',
  ships: 'All claims remain firmly on paper.',
  stations: 'Mind the gap between thinking and filing.',
  airports: 'No boarding pass required at this counter.',
  architects: 'The form has already been designed.',
  asteroids: 'A small claim in a rather large register.',
  arthropods: 'Every leg accounted for.',
};
export const categoryNote = (slug: string) => notes[slug] || 'A fresh register. The same old ink.';
// One pen stroke, shared by screen and exported certificates.
export const REGISTRAR_STROKE =
  'M4 30C18 15 36 7 42 12C48 17 23 38 22 30L38 7M20 18C38 15 62 10 65 15M43 27C49 17 53 16 50 26C48 33 60 24 65 21C61 31 68 31 73 23C77 17 82 22 77 27C73 31 69 29 76 23L90 16C82 36 85 45 78 45C70 44 84 26 98 21C91 30 102 27 107 20C108 16 103 19 107 23C116 29 110 33 104 30L124 16M116 29L128 8M117 20L139 17M125 28C131 17 137 15 132 25C130 30 139 23 146 19C138 31 146 28 152 22C158 16 163 20 155 25C150 29 152 31 164 23L174 18M169 28C173 16 177 15 177 20C182 15 190 19 184 23L179 28C190 26 196 22 203 25M16 39C62 31 139 35 212 31';
