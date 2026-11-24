// Read-only, dependency-free gate: idle scheduled runs never install or build anything.
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => (word === 'st' ? 'saint' : word))
    .join('');

export function needsRollout(state, recipes, coverage, now = Date.now()) {
  if (!Array.isArray(state.days) || !Array.isArray(state.library) || state.days.length !== 60)
    throw Error('Invalid calendar response; refusing to silently skip the rollout.');
  const eligible = recipes.filter((r) => coverage.some((c) => c.slug === r.slug && c.ready));
  if (!eligible.length) throw Error('No coverage-passed local recipes.');
  const reasons = new Set();
  for (const recipe of eligible) {
    const remote = state.library.find((r) => r.slug === recipe.slug);
    if (!remote?.ready || !remote.uploaded || canonical(remote.recipe) !== canonical(recipe))
      reasons.add('library-update');
  }
  const firstDate = state.days[0]?.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) throw Error('Invalid calendar start date.');
  const lastBuildDate = new Date(Date.parse(firstDate + 'T12:00:00Z') + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  for (const day of state.days) {
    const hours = (Date.parse(day.dropAt) - now) / 3600000;
    if (
      !Number.isFinite(hours) ||
      ![
        'empty',
        'requested',
        'needs recipe',
        'building',
        'ready',
        'live',
        'closed',
        'archived',
        'failed',
      ].includes(day.status)
    )
      throw Error('Invalid calendar day; refusing to silently skip the rollout.');
    if (hours <= 0 || day.readOnly) continue;
    if (hours <= 48 && ['empty', 'failed', 'needs recipe'].includes(day.status))
      reasons.add('48-hour-fallback');
    if (day.date <= lastBuildDate && day.slug && ['requested', 'building'].includes(day.status))
      reasons.add('pending-day');
    if (
      day.request &&
      ['requested', 'needs recipe'].includes(day.status) &&
      eligible.some((r) =>
        (r.requestNames || [r.name, r.slug]).some(
          (name) => normalize(name) === normalize(day.request),
        ),
      )
    )
      reasons.add('matched-request');
  }
  return { needed: reasons.size > 0, reasons: [...reasons] };
}

export async function main() {
  let result;
  if (process.env.VALIDATE_ONLY === 'true')
    result = { needed: true, reasons: ['manual-validation'] };
  else {
    const token = process.env.DIBS_ADMIN_TOKEN;
    if (!token) throw Error('DIBS_ADMIN_TOKEN is required for the read-only preflight.');
    const origin = process.env.DIBS_ORIGIN || 'https://dibs.here';
    if (!['https://dibs.here', 'https://practice.dibs-7hz.pages.dev'].includes(origin))
      throw Error('Unsupported rollout origin.');
    const response = await fetch(origin + '/api/admin/schedule', {
      headers: { authorization: 'Bearer ' + token, origin, 'x-dibs-test': '1' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('Calendar preflight failed (HTTP ' + response.status + ').');
    const recipes = readdirSync('recipes')
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync('recipes/' + f, 'utf8')));
    for (const recipe of recipes)
      if (
        createHash('sha256').update(readFileSync(recipe.sourceSnapshot)).digest('hex') !==
        recipe.snapshotSha256
      )
        throw Error('A recipe snapshot is unpinned; review it before running rollout.');
    result = needsRollout(
      await response.json(),
      recipes,
      JSON.parse(readFileSync('review/coverage/results.json', 'utf8')),
    );
  }
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `needed=${result.needed}\n`);
  console.log(JSON.stringify(result));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
