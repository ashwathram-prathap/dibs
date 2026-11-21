import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { normalize } from '../worker/domain';
mkdirSync('public/catalog', { recursive: true });
for (const file of readdirSync('categories').filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync('categories/' + file, 'utf8'));
  writeFileSync(
    `public/catalog/${c.slug}.json`,
    JSON.stringify(
      c.answers.map((a: any) => ({
        display: a.display,
        keys: [...new Set([normalize(a.display), ...a.aliases.map(normalize)])],
      })),
    ),
  );
}
