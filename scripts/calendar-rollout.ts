import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  statSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { admin, practice, origin } from './rollout-client';
import { discoverRecipe } from './recipe-discovery';
import { dayAfter, chooseTopic, pruneCatalogs } from '../shared/calendar';
import { deploymentBlocked } from '../shared/deploy-window';
const flag = (s: string) => process.argv.includes(s);
const now = Date.now();
if (!practice && deploymentBlocked(now, 'part-b'))
  throw Error('Part B launch freeze: no production rollout until Nov 24 midnight ET.');
const recipes = readdirSync('recipes')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync('recipes/' + f, 'utf8')));
const coverage = JSON.parse(readFileSync('review/coverage/results.json', 'utf8'));
function checkRecipe(r: any) {
  const digest = createHash('sha256').update(readFileSync(r.sourceSnapshot)).digest('hex');
  if (digest !== r.snapshotSha256)
    throw Error(
      'Recipe snapshot changed: ' + r.slug + '; explicitly review and re-pin the recipe.',
    );
}
if (flag('--publish-library')) {
  for (const r of recipes) {
    checkRecipe(r);
    const c = coverage.find((c: any) => c.slug === r.slug);
    if (!c?.ready) continue;
    const manifest = JSON.parse(readFileSync(`public/catalog/${r.slug}/manifest.json`, 'utf8'));
    await admin('/library', { recipe: r, coverage: c, manifest });
  }
  console.log('Published coverage-passed recipe library.');
}
if (flag('--seed')) {
  await admin('/seed', {});
  let state = await admin('');
  if (practice) {
    const plan = JSON.parse(
      readFileSync('review/round8/production-registers-before.json', 'utf8'),
    ).filter((d: any) => d.date && d.status === 'approved');
    for (const p of plan) {
      const existing = state.days.find((d: any) => d.date === p.date);
      if (
        existing &&
        !existing.slug &&
        !existing.request &&
        Date.parse(existing.dropAt) - Date.now() >= 24 * 3600000
      )
        await admin('', {
          action: 'library',
          date: p.date,
          slug: p.id,
          revision: existing.revision,
        });
    }
    state = await admin('');
  }
  const days = state.days;
  const start = process.env.CALENDAR_SEED_START || '2026-11-28',
    end = process.env.CALENDAR_SEED_END || '2026-12-31';
  for (let date = start; date <= end; date = dayAfter(date)) {
    const d = days.find((d: any) => d.date === date);
    if (!d || d.slug || d.request) continue;
    const pick = chooseTopic(date, days, state.library);
    await admin('', { action: 'pick', date, revision: d.revision });
    Object.assign(d, { slug: pick.topic.slug, status: 'requested' });
  }
  console.log('Seeded empty days through ' + end + '; existing dates preserved.');
}
if (flag('--discover')) {
  const plan = await admin('/plan');
  for (const d of plan.days.filter(
    (d: any) => d.request && ['needs recipe', 'requested'].includes(d.status),
  )) {
    const result = discoverRecipe(d.request, recipes, coverage);
    await admin('/request-result', { date: d.date, revision: d.revision, ...result });
    console.log(d.date + ': ' + (result.slug ? 'recipe matched' : 'needs recipe'));
  }
}
if (flag('--build')) {
  let result: any;
  for (let i = 0; i < 10; i++) {
    result = await admin('/tick', {});
    if (result.idle || result.frozen) break;
    console.log('Calendar run:', JSON.stringify(result));
  }
  await admin('/run', {
    status: 'success',
    message: 'Coverage-passed recipes built; upcoming seven days checked.',
    at: new Date().toISOString(),
  });
}
if (flag('--prune-assets')) {
  const plan = await admin('/plan');
  const needed = pruneCatalogs(plan.categories, now);
  for (const d of plan.days)
    if (d.slug && Date.parse(d.date + 'T23:59:59Z') > now) {
      const m = `public/catalog/${d.slug}/manifest.json`;
      if (existsSync(m)) needed.add(d.slug + '/' + JSON.parse(readFileSync(m, 'utf8')).version);
    }
  for (const slug of readdirSync('dist/catalog'))
    for (const version of readdirSync('dist/catalog/' + slug)) {
      const p = join('dist/catalog', slug, version);
      if (statSync(p).isDirectory() && !needed.has(slug + '/' + version))
        rmSync(p, { recursive: true, force: true });
    }
  // Unscheduled topics lose their manifest too. Source recipes stay in the private repo for rebuilding.
  for (const slug of readdirSync('dist/catalog')) {
    const p = join('dist/catalog', slug);
    if (![...needed].some((k) => k.startsWith(slug + '/')))
      rmSync(p, { recursive: true, force: true });
  }
  mkdirSync('.tmp', { recursive: true });
  writeFileSync(
    '.tmp/calendar-prune.json',
    JSON.stringify({
      needed: [...needed],
      archived: plan.days
        .filter(
          (d: any) =>
            d.category_id &&
            plan.categories.some(
              (c: any) =>
                c.id === d.category_id && c.closeAt && Date.parse(c.closeAt) + 7 * 86400000 <= now,
            ),
        )
        .map((d: any) => d.date),
    }),
  );
  console.log(
    'Kept ' +
      needed.size +
      ' referenced catalog versions; pruned only unreferenced and expired full indexes.',
  );
}
if (flag('--inventory')) {
  let files = 0,
    bytes = 0,
    maxBytes = 0;
  function walk(dir: string) {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n),
        s = statSync(p);
      if (s.isDirectory()) walk(p);
      else {
        files++;
        bytes += s.size;
        maxBytes = Math.max(maxBytes, s.size);
      }
    }
  }
  walk('dist');
  if (files > 20000 || maxBytes > 25 * 1024 * 1024)
    throw Error('Pages Free asset budget exceeded.');
  await admin('/assets', { files, bytes, maxBytes, at: new Date().toISOString() });
  if (existsSync('.tmp/calendar-prune.json'))
    for (const date of JSON.parse(readFileSync('.tmp/calendar-prune.json', 'utf8')).archived)
      await admin('/archive', { date });
  console.log('Asset inventory stored:', { files, bytes, maxBytes });
}
