import type { Env } from './routes';
// Optional account analytics include edge cache hits, cron jobs and other account workloads.
// Cloudflare documents these datasets in D1 Metrics and Querying Workers Metrics.
export async function platformUsage(env: Env) {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return null;
  const now = new Date(),
    day = now.toISOString().slice(0, 10);
  const query = `query($account:string!,$start:Time!,$end:Time!,$day:Date!){viewer{accounts(filter:{accountTag:$account}){
    workersInvocationsAdaptive(limit:1,filter:{datetime_geq:$start,datetime_leq:$end}){sum{requests}}
    d1AnalyticsAdaptiveGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten}}
    durableObjectsInvocationsAdaptiveGroups(limit:100,filter:{date:$day}){dimensions{type}sum{requests}}
    durableObjectsPeriodicGroups(limit:1,filter:{date:$day}){sum{rowsRead rowsWritten duration inboundWebsocketMsgCount}}
    durableObjectsSqlStorageGroups(limit:10000,filter:{date:$day}){dimensions{namespaceId}max{storedBytes}}
  }}}`;
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + env.CF_ANALYTICS_TOKEN,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        account: env.CF_ACCOUNT_ID,
        start: day + 'T00:00:00Z',
        end: now.toISOString(),
        day,
      },
    }),
  });
  const data: any = await r.json();
  if (!r.ok || data.errors?.length)
    throw Error('Account analytics unavailable; showing measured API counters.');
  const a = data.data?.viewer?.accounts?.[0];
  if (!a) throw Error('Account analytics returned no account.');
  const durable = a.durableObjectsPeriodicGroups?.[0]?.sum || {};
  // Hibernating WebSocket events are reported as invocations; ordinary socket
  // messages are reported by the periodic dataset. Only incoming messages cost.
  const doRequests = (a.durableObjectsInvocationsAdaptiveGroups || []).reduce(
    (n: number, row: any) =>
      n + Number(row.sum.requests || 0) / (row.dimensions.type === 'hibernation' ? 20 : 1),
    Number(durable.inboundWebsocketMsgCount || 0) / 20,
  );
  return {
    requests: Number(a.workersInvocationsAdaptive?.[0]?.sum?.requests || 0),
    reads: Number(a.d1AnalyticsAdaptiveGroups?.[0]?.sum?.rowsRead || 0),
    writes: Number(a.d1AnalyticsAdaptiveGroups?.[0]?.sum?.rowsWritten || 0),
    doRequests,
    doReads: Number(durable.rowsRead || 0),
    doWrites: Number(durable.rowsWritten || 0),
    doDuration: Number(durable.duration || 0),
    // Sum each namespace's daily high-water mark, conservatively.
    doStorageBytes: (a.durableObjectsSqlStorageGroups || []).reduce(
      (n: number, row: any) => n + Number(row.max.storedBytes || 0),
      0,
    ),
    at: now.toISOString(),
  };
}
