import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const auth = JSON.parse(
  execFileSync('./node_modules/.bin/wrangler', ['auth', 'token', '--json'], { encoding: 'utf8' }),
).token;
const account = '5cf62cff0219727f2121253b3924f886',
  day = new Date().toISOString().slice(0, 10);
const queries = {
  d1: 'd1AnalyticsAdaptiveGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten}}',
  durable:
    'durableObjectsPeriodicGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten duration inboundWebsocketMsgCount}} durableObjectsInvocationsAdaptiveGroups(limit:100,filter:{date:$day}){dimensions{type}sum{requests}} durableObjectsSqlStorageGroups(limit:10000,filter:{date:$day}){dimensions{namespaceId}max{storedBytes}}',
  workers:
    'workersInvocationsAdaptive(limit:1,filter:{datetime_geq:$start,datetime_leq:$end}){sum{requests}}',
};
const results: Record<string, unknown> = {};
for (const [name, fields] of Object.entries(queries)) {
  const declarations =
    name === 'workers' ? '$account:string!,$start:Time!,$end:Time!' : '$account:string!,$day:Date!';
  const variables =
    name === 'workers'
      ? { account, start: day + 'T00:00:00Z', end: new Date().toISOString() }
      : { account, day };
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query(${declarations}){viewer{accounts(filter:{accountTag:$account}){${fields}}}}`,
      variables,
    }),
  });
  const d: any = await r.json();
  results[name] = {
    status: r.status,
    errors: d.errors?.map((e: any) => e.message),
    data: d.data?.viewer?.accounts?.[0] ?? null,
  };
}
const report = {
  at: new Date().toISOString(),
  account,
  utcDay: day,
  configuredLoadAccount: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'].every((key) =>
    new RegExp('^' + key + '=([^\\s#]+)', 'm').test(readFileSync('.dev.vars.loadtest', 'utf8')),
  ),
  results,
};
writeFileSync('review/round20/account-usage.json', JSON.stringify(report, null, 2));
console.log(report);
