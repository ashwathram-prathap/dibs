// Read-only production inventory. Never save private files, identities or selections.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = 'review/round20';
mkdirSync(dir, { recursive: true });
const account = '5cf62cff0219727f2121253b3924f886';
const auth = JSON.parse(
  execFileSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], { encoding: 'utf8' }),
).token;
async function cf(path: string) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
    headers: { authorization: 'Bearer ' + auth },
  });
  const d: any = await r.json();
  if (!r.ok || !d.success) throw Error('Metadata unavailable: ' + r.status);
  return d.result;
}
const [pages, worker] = await Promise.all([
  cf('pages/projects/dibs'),
  cf('workers/scripts/dibs-api/deployments'),
]);
const deployment = {
  at: new Date().toISOString(),
  account,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  pages: pages.canonical_deployment.id,
  pagesCommit: pages.canonical_deployment.deployment_trigger?.metadata?.commit_hash,
  worker: {
    id: worker.deployments[0].id,
    versions: worker.deployments[0].versions,
    created_on: worker.deployments[0].created_on,
  },
  sourceType: pages.source?.type ?? 'direct upload',
};
writeFileSync(dir + '/starting-deployment.json', JSON.stringify(deployment, null, 2));
const admin = readFileSync('.dev.vars', 'utf8')
  .match(/^ADMIN_TOKEN=(.+)$/m)?.[1]
  .trim()
  .replace(/^['"]|['"]$/g, '');
const r = await fetch('https://dibs.here/api/admin/live', {
  headers: { authorization: 'Bearer ' + admin, 'x-dibs-test': '1' },
});
if (r.ok) {
  const d: any = await r.json();
  const { feedback, ...safe } = d;
  writeFileSync(dir + '/starting-metrics.json', JSON.stringify(safe, null, 2));
  console.log({ metricsStatus: r.status, analyticsError: d.analyticsError, usage: d.usage });
} else console.log({ metricsStatus: r.status });
function query(sql: string) {
  return JSON.parse(
    execFileSync(
      './node_modules/.bin/wrangler',
      [
        'd1',
        'execute',
        'dibs-db',
        '--remote',
        '-c',
        'worker/wrangler.jsonc',
        '--json',
        '--command',
        sql,
      ],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    ),
  )[0];
}
const nights = query(
  `WITH f AS (SELECT day, json_extract(data,'$.file.dibs') dibs,json_extract(data,'$.file.strikes') strikes,json_extract(data,'$.file.closed') finished,json_extract(data,'$.user.hidden') hidden,json_extract(data,'$.file.eligible') eligible,json_extract(data,'$.user.handle') handle FROM r17_files WHERE day IN ('2026-11-23','2026-11-24','2026-11-27')) SELECT day,COUNT(*) mirroredFiles,SUM(hidden=1 OR eligible=0 OR handle='Withdrawn player') excluded,SUM(CASE WHEN COALESCE(hidden,0)=0 AND COALESCE(eligible,1)!=0 AND handle!='Withdrawn player' AND dibs+strikes>0 THEN 1 ELSE 0 END) participants,SUM(CASE WHEN COALESCE(hidden,0)=0 AND COALESCE(eligible,1)!=0 AND handle!='Withdrawn player' AND dibs>0 THEN 1 ELSE 0 END) claimers,SUM(CASE WHEN COALESCE(hidden,0)=0 AND COALESCE(eligible,1)!=0 AND handle!='Withdrawn player' THEN dibs ELSE 0 END) claims,SUM(CASE WHEN COALESCE(hidden,0)=0 AND COALESCE(eligible,1)!=0 AND handle!='Withdrawn player' AND (dibs>=3 OR strikes>=5) THEN 1 ELSE 0 END) finished FROM f GROUP BY day`,
);
const runway = query(
  "SELECT date,status,drop_at FROM categories WHERE date>='2026-11-28' ORDER BY date",
);
writeFileSync(
  dir + '/real-night-baseline.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      source:
        'Read-only D1 delayed mirror; active journal watermark unavailable in R19I. Friday incomplete until next close.',
      nights,
      runway,
      peakConnections: null,
      peakReason: 'R19I active day does not retain connection peak analytics.',
    },
    null,
    2,
  ),
);
console.log({ deployment, nights: nights.results, runway: runway.results });
