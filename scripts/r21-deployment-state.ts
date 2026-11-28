import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const token = JSON.parse(
  execFileSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], { encoding: 'utf8' }),
).token;
const base = 'https://api.cloudflare.com/client/v4/accounts/5cf62cff0219727f2121253b3924f886/';
const get = async (path: string) => {
  const r = await fetch(base + path, { headers: { authorization: 'Bearer ' + token } });
  const d: any = await r.json();
  if (!r.ok || !d.success) throw Error('Deployment read failed');
  return d.result;
};
const workers = await get('workers/scripts/dibs-api-staging/deployments');
const pages = await get('pages/projects/dibs/deployments');
const page = pages.find((p: any) => p.deployment_trigger?.metadata?.branch === 'practice');
writeFileSync(
  'review/r21-flow/deployment.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      pages: page.id,
      workerVersion: workers.deployments[0].versions[0].version_id,
      workerDeployment: workers.deployments[0].id,
      production: false,
      policyActivated: false,
    },
    null,
    2,
  ),
);
