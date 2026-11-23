import { it, expect } from 'vitest';
import { credentialQuota } from '../worker/security';
import { expireSecurity } from '../worker/security';
it('expires durable credential counters and removes hashed network records without another request', async () => {
  const rows = new Map<string, any>();
  let alarm: number | null = null;
  const storage: any = {
    getAlarm: async () => alarm,
    setAlarm: async (t: number) => {
      alarm = t;
    },
    get: async (k: string) => rows.get(k),
    put: async (k: string, v: any) => rows.set(k, v),
    delete: async (keys: string[]) => keys.forEach((k) => rows.delete(k)),
    list: async () => new Map(rows),
    transaction: async (fn: any) => fn(storage),
  };
  for (let i = 0; i < 5; i++) expect(await credentialQuota(storage, 'network', 100)).toBe(true);
  expect(await credentialQuota(storage, 'network', 200)).toBe(false);
  expect(alarm).toBe(900100);
  alarm = null;
  await expireSecurity(storage, 900101);
  expect(rows.size).toBe(0);
  expect(await credentialQuota(storage, 'network', 900101)).toBe(true);
});
