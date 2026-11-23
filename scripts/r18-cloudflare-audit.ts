import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const auth = spawnSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], {
  encoding: 'utf8',
});
if (auth.status) throw Error('Cloudflare authentication unavailable');
const token = JSON.parse(auth.stdout).token;
async function read(path: string) {
  const r = await fetch('https://api.cloudflare.com/client/v4/' + path, {
    headers: { authorization: 'Bearer ' + token },
  });
  const data: any = await r.json();
  return { status: r.status, success: data.success, result: data.result, errors: data.errors };
}
const zones = await read('zones?name=dibs.here');
const zone = zones.result?.[0]?.id;
const result: any = {
  at: new Date().toISOString(),
  zoneRead: { status: zones.status, success: zones.success, errors: zones.errors },
  settings: {},
};
if (zone)
  for (const endpoint of [
    'bot_management',
    'settings/security_level',
    'settings/browser_check',
    'rulesets/phases/http_request_firewall_custom/entrypoint',
    'rulesets/phases/http_request_firewall_managed/entrypoint',
    'firewall/access_rules/rules',
  ])
    result.settings[endpoint] = await read(`zones/${zone}/${endpoint}`);
writeFileSync('review/round18/cloudflare-bot-audit.json', JSON.stringify(result, null, 2));
console.log({
  zoneRead: result.zoneRead,
  checks: Object.entries(result.settings).map(([name, r]: any) => ({
    name,
    status: r.status,
    success: r.success,
  })),
});
