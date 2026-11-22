import { syncClock } from './clock';
import { api, isDemo } from './api';
import type { Claim, Today, Me } from './types';
export type Snapshot = { today: Today; rows: Claim[]; me?: Me; reset?: boolean; version?: number };
let latest: Snapshot | null = null;
let cursor = 0;
const listeners = new Set<(s: Snapshot) => void>();
export const getSnapshot = () => latest;
export function publish(s: Snapshot, optimistic = false) {
  if (!optimistic) syncClock(s.today.serverTime);
  const same = latest?.today.category?.id === s.today.category?.id && !s.reset;
  if (!same) cursor = 0;
  if (!optimistic) cursor = Math.max(cursor, ...s.rows.map((r) => r.claim_no), 0);
  const rows = new Map<string, Claim>((same ? latest?.rows || [] : []).map((r) => [r.id, r]));
  s.rows.forEach((r) => rows.set(r.id, r));
  latest = { ...s, reset: false, rows: [...rows.values()].sort((a, b) => b.claim_no - a.claim_no) };
  listeners.forEach((fn) => fn(latest!));
}
export function subscribe(fn: (s: Snapshot) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function publishClaim(claim: Claim, me?: Me) {
  if (!latest) return;
  const exists = latest.rows.some((r) => r.id === claim.id);
  publish(
    {
      ...latest,
      me,
      rows: [claim],
      today: {
        ...latest.today,
        specials: latest.today.specials
          ? {
              ...latest.today.specials,
              goldenFound: latest.today.specials.goldenFound + (!exists && claim.golden ? 1 : 0),
            }
          : undefined,
        claimed: latest.today.claimed + (exists ? 0 : 1),
        open: latest.today.open - (exists ? 0 : 1),
        lastClaimAt: claim.created_at,
      },
    },
    true,
  );
}
// Poll messages share one hibernatable connection. Hidden tabs send nothing.
export function watchRegistry(onError: (message: string) => void) {
  let socket: WebSocket | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false,
    failed = false,
    started = Date.now();
  const schedule = () => {
    clearTimeout(timer);
    if (!stopped && !document.hidden)
      timer = setTimeout(tick, failed ? 120000 : Date.now() - started >= 120000 ? 60000 : 15000);
  };
  const tick = async () => {
    if (stopped || document.hidden) return;
    try {
      if (isDemo) {
        const today = await api<Today>('/today');
        const since = cursor;
        const data = today.category
          ? await api<{ rows: Claim[] }>(`/ledger?category=${today.category.id}&since=${since}`)
          : { rows: [] };
        const changed = latest?.today.category?.id !== today.category?.id;
        const me = changed ? await api<Me>('/me') : undefined;
        publish({ today, rows: data.rows, me, reset: changed });
      } else if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            category: latest?.today.category?.id,
            version: latest?.version || 0,
            since: cursor,
          }),
        );
      } else if (failed) publish(await api<Snapshot>('/bootstrap'));
    } catch (e) {
      onError((e as Error).message);
    }
    schedule();
  };
  if (!isDemo) {
    const url = new URL('/api/live', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(url);
    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.error) onError(data.error.message);
        else publish(data);
      } catch {}
    };
    socket.onclose = () => {
      failed = true;
      schedule();
    };
    socket.onerror = () => {
      failed = true;
      socket?.close();
      schedule();
    };
  }
  const visible = () => {
    if (document.hidden) clearTimeout(timer);
    else {
      void api<Snapshot>('/bootstrap')
        .then(publish)
        .catch(() => {});
      void tick();
    }
  };
  document.addEventListener('visibilitychange', visible);
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', visible);
    socket?.close();
  };
}
