import { setLiveTransport } from './transport';
import { syncClock } from './clock';
import { api, isDemo } from './api';
import type { Claim, Today, Me } from './types';
export type Snapshot = {
  leaderboard?: import('./types').Standings;
  today: Today;
  rows: Claim[];
  me?: Me;
  reset?: boolean;
  version?: number;
};
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
  const previousMe = latest?.today.category?.id === s.today.category?.id ? latest?.me : undefined;
  const me = s.me || previousMe;
  const updatedMe =
    me?.file && s.leaderboard
      ? {
          ...me,
          file: {
            ...me.file,
            rank: s.leaderboard.own?.rank || null,
            players: s.leaderboard.total,
            comparison: s.leaderboard.comparison,
          },
        }
      : me;
  latest = {
    ...s,
    me: updatedMe,
    reset: false,
    rows: [...rows.values()].sort((a, b) => b.claim_no - a.claim_no),
  };
  listeners.forEach((fn) => fn(latest!));
}
export function subscribe(fn: (s: Snapshot) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function publishClaim(claim: Claim, me?: Me, leaderboard?: import('./types').Standings) {
  if (!latest) return;
  const exists = latest.rows.some((r) => r.id === claim.id);
  publish(
    {
      ...latest,
      me,
      leaderboard: leaderboard || latest.leaderboard,
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
// Hibernating sockets receive server pushes. No application heartbeats.
export function watchRegistry(onError: (message: string) => void) {
  let socket: WebSocket | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let socketIdentity: string | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let handshake: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
  let stopped = false,
    failed = false;
  const pending = new Map<
    string,
    {
      resolve: (r: Response) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  setLiveTransport((path, body) => {
    // Bootstrap may issue the first cookie at opening, or recovery can change it.
    // An existing socket keeps its old identity; this request must use fresh HTTP.
    if (socketIdentity !== latest?.me?.user?.id) {
      socket?.close(1000, 'Identity changed');
      socket = undefined;
      connect();
      return;
    }
    if (
      socket?.readyState !== WebSocket.OPEN ||
      !['/claim', '/verify-session', '/events/share'].includes(path)
    )
      return;
    return new Promise<Response>((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error('Request timed out'));
      }, 20000);
      pending.set(id, { resolve, reject, timer });
      socket!.send(JSON.stringify({ rpc: id, path, body }));
    });
  });
  const schedule = () => {
    clearTimeout(timer);
    if (!stopped && !document.hidden && (failed || isDemo))
      timer = setTimeout(tick, 60000 + Math.random() * 15000);
  };
  const tick = async () => {
    if (stopped || document.hidden) return;
    try {
      if (isDemo) {
        const today = await api<Today>('/today');
        const data = today.category
          ? await api<{ rows: Claim[] }>(`/ledger?category=${today.category.id}&since=${cursor}`)
          : { rows: [] };
        const changed = latest?.today.category?.id !== today.category?.id;
        publish({
          today,
          rows: data.rows,
          me: changed ? await api<Me>('/me') : undefined,
          reset: changed,
        });
      } else if (failed) publish(await api<Snapshot>('/bootstrap'));
    } catch (e) {
      onError((e as Error).message);
    }
    schedule();
  };
  const connect = () => {
    if (isDemo || stopped || document.hidden || !online() || (socket && socket.readyState < 2))
      return;
    clearTimeout(retry);
    const url = new URL('/api/live', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socketIdentity = latest?.me?.user?.id;
    socket = new WebSocket(url);
    const connection = socket;
    handshake = setTimeout(() => {
      if (socket === connection && connection.readyState !== WebSocket.OPEN) connection.close();
    }, 10000);
    socket.onopen = () => {
      if (socket !== connection) return;
      failed = false;
      clearTimeout(handshake);
      clearTimeout(timer);
      // HTTP bootstrap reattaches identity and reconciles accepted requests after a lost ack.
      // Submissions are never automatically replayed; the UI retains their requestId.
      void api<Snapshot>('/bootstrap')
        .then((s) => {
          if (!stopped && socket === connection) {
            failures = 0;
            publish(s);
          }
        })
        .catch((e) => {
          if (!stopped) onError(e.message);
        });
    };
    socket.onmessage = (e) => {
      if (socket !== connection) return;
      try {
        const data = JSON.parse(e.data);
        if (data.rpc) {
          const request = pending.get(data.rpc);
          if (request) {
            clearTimeout(request.timer);
            pending.delete(data.rpc);
            // A day/network rollover requires a new attachment. Close synchronously so
            // verification retries use HTTP instead of repeating an expired socket RPC.
            if (data.status === 428) socket?.close(1000, 'Refresh session');
            request.resolve(new Response(JSON.stringify(data.body), { status: data.status }));
          }
          return;
        }
        if (data.error) onError(data.error.message);
        else publish(data);
      } catch {}
    };
    socket.onclose = () => {
      if (socket !== connection) return;
      socket = undefined;
      clearTimeout(handshake);
      failed = true;
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(Error('Connection closed'));
      }
      pending.clear();
      reconnect();
      schedule();
    };
    socket.onerror = () => {
      if (socket !== connection) return;
      failed = true;
      socket?.close();
      reconnect();
      schedule();
    };
  };
  const reconnect = () => {
    clearTimeout(retry);
    if (!stopped && !document.hidden && online())
      retry = setTimeout(
        connect,
        Math.min(30000, 500 * 2 ** Math.min(failures++, 6)) * (0.75 + Math.random() * 0.25),
      );
  };
  const visible = () => {
    if (document.hidden) {
      clearTimeout(timer);
      clearTimeout(retry);
    } else {
      // Sleep/wake can leave a TCP connection apparently open but unusable.
      // A handshake already in progress is fresh; cancelling it logs a WebKit error.
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Refresh connection');
        socket = undefined;
      }
      connect();
      schedule();
    }
  };
  const pageShown = (event: PageTransitionEvent) => {
    // Initial pageshow follows mount; only a back/forward-cache restore needs a wake-up.
    if (event.persisted) visible();
  };
  const offline = () => {
    clearTimeout(retry);
    clearTimeout(timer);
    socket?.close();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', visible);
    window.addEventListener('offline', offline);
    window.addEventListener('pageshow', pageShown);
  }
  connect();
  schedule();
  document.addEventListener('visibilitychange', visible);
  return () => {
    setLiveTransport();
    stopped = true;
    clearTimeout(timer);
    clearTimeout(retry);
    clearTimeout(handshake);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', visible);
      window.removeEventListener('offline', offline);
      window.removeEventListener('pageshow', pageShown);
    }
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(Error('Connection closed'));
    }
    pending.clear();
    document.removeEventListener('visibilitychange', visible);
    socket?.close();
  };
}
