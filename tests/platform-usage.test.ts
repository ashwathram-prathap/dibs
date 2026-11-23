import { afterEach, expect, it, vi } from 'vitest';
import { platformUsage } from '../worker/platform-usage';
import { alertConditions } from '../worker/monitoring';
afterEach(() => vi.unstubAllGlobals());
it('counts hibernating messages at 20:1 and includes separate DO SQLite and duration quotas', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        data: {
          viewer: {
            accounts: [
              {
                workersInvocationsAdaptive: [{ sum: { requests: 20 } }],
                d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 100, rowsWritten: 10 } }],
                durableObjectsInvocationsAdaptiveGroups: [
                  { dimensions: { type: 'http' }, sum: { requests: 3 } },
                  { dimensions: { type: 'alarm' }, sum: { requests: 1 } },
                  { dimensions: { type: 'hibernation' }, sum: { requests: 80 } },
                ],
                durableObjectsPeriodicGroups: [
                  {
                    sum: {
                      rowsRead: 1000,
                      rowsWritten: 71000,
                      duration: 9200,
                      inboundWebsocketMsgCount: 20,
                    },
                  },
                ],
                durableObjectsSqlStorageGroups: [
                  { max: { storedBytes: 1000 } },
                  { max: { storedBytes: 2000 } },
                ],
              },
            ],
          },
        },
      }),
    ),
  );
  const usage = await platformUsage({ CF_ANALYTICS_TOKEN: 'test', CF_ACCOUNT_ID: 'test' } as any);
  expect(usage).toMatchObject({
    requests: 20,
    reads: 100,
    writes: 10,
    doRequests: 9,
    doReads: 1000,
    doWrites: 71000,
    doDuration: 9200,
    doStorageBytes: 3000,
  });
  expect(alertConditions([], usage as any).map((a) => a.type)).toEqual([
    'doWrites-0.7',
    'doDuration-0.7',
  ]);
});
it('does not manufacture account totals without analytics credentials', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect(await platformUsage({} as any)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
