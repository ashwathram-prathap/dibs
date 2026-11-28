import { assertProductionWriter } from '../shared/release-window';
// Remove inactive Pages deployments older than seven days. Keep the active
// production deployment and the five newest of each environment for rollback.
const token = process.env.CLOUDFLARE_API_TOKEN,
  account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account)
  throw Error('Scoped Cloudflare API credentials required for platform cleanup.');
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/dibs`;
async function call(path: string, method = 'GET') {
  if (method !== 'GET') assertProductionWriter();
  const r = await fetch(base + path, { method, headers: { authorization: 'Bearer ' + token } });
  const d: any = await r.json();
  if (!r.ok || !d.success) throw Error('Pages cleanup API failed (' + r.status + ').');
  return d;
}
const project = (await call('')).result;
const current = project.canonical_deployment?.id;
const all: any[] = [];
for (let page = 1; page <= 20; page++) {
  const d = await call('/deployments?per_page=25&page=' + page);
  all.push(...d.result);
  if (d.result.length < 25) break;
}
const protect = new Set([current]);
for (const env of ['production', 'preview'])
  all
    .filter((d) => d.environment === env)
    .sort((a, b) => b.created_on.localeCompare(a.created_on))
    .slice(0, 5)
    .forEach((d) => protect.add(d.id));
let deleted = 0;
for (const d of all) {
  if (
    protect.has(d.id) ||
    Date.parse(d.created_on) > Date.now() - 7 * 86400000 ||
    d.aliases?.length ||
    ['active', 'pending', 'running'].includes(d.latest_stage?.status)
  )
    continue;
  await call('/deployments/' + encodeURIComponent(d.id), 'DELETE');
  deleted++;
}
console.log(
  'Removed ' +
    deleted +
    ' inactive deployments; active deployment and recent rollback copies retained.',
);
