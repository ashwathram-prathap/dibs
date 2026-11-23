import './test-traffic';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const token = JSON.parse(
  execFileSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], { encoding: 'utf8' }),
).token;
async function get(path: string) {
  const r = await fetch('https://api.cloudflare.com/client/v4/' + path, {
    headers: { authorization: 'Bearer ' + token },
  });
  const d: any = await r.json();
  return { status: r.status, data: d.result, errors: d.errors?.map((e: any) => e.message) };
}
const account = '5cf62cff0219727f2121253b3924f886';
const p = await get(`accounts/${account}/pages/projects/dibs`);
const w = await get(`accounts/${account}/workers/scripts/dibs-api/deployments`);
const zones = await get('zones?name=dibs.here');
const zone = zones.data?.[0]?.id;
const security: any = { zoneFound: !!zone };
if (zone) {
  for (const path of ['bot_management', 'settings/security_level', 'rulesets']) {
    const r = await get(`zones/${zone}/${path}`);
    security[path] = { status: r.status, data: r.data, errors: r.errors };
  }
}
// Never serialize project env vars or bindings: they may contain production secrets.
const evidence = {
  at: new Date().toISOString(),
  pages: p.data?.canonical_deployment?.id,
  worker: w.data?.deployments?.[0]?.versions?.[0]?.version_id,
  analytics: {
    production: !!p.data?.deployment_configs?.production?.web_analytics_token,
    preview: !!p.data?.deployment_configs?.preview?.web_analytics_token,
  },
  security,
};
writeFileSync('review/round19b/infrastructure.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
