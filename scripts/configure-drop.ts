import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const input = existsSync('DROP_TIME.txt') ? readFileSync('DROP_TIME.txt', 'utf8').trim() : '21:00';
const match = input.match(/^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)?$/i);
if (!match) throw Error('DROP_TIME.txt must be HH:MM or h:mm AM/PM.');
let hour = Number(match[1]);
if (match[3]) {
  if (hour < 1 || hour > 12) throw Error('Invalid hour');
  hour = (hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
}
if (hour > 23) throw Error('Invalid hour');
const time = String(hour).padStart(2, '0') + ':' + (match[2] || '00');
const path = 'shared/config.ts';
writeFileSync(
  path,
  readFileSync(path, 'utf8').replace(
    /export const DROP_TIME_LOCAL = '[^']+';/,
    `export const DROP_TIME_LOCAL = '${time}';`,
  ),
);
// Hourly checks also cover DST without a second manually maintained local drop time.
const wrangler = 'worker/wrangler.jsonc';
writeFileSync(
  wrangler,
  readFileSync(wrangler, 'utf8').replace(
    /"crons": \[[^\]]*\]/,
    `"crons": ["17 5 * * *", "${Number(match[2] || 0)} * * * *"]`,
  ),
);
console.log(`Drop configured: ${time} America/Toronto`);
