import { it, expect, vi, afterEach } from 'vitest';
import { publish, watchRegistry } from '../src/live';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('reconnects a visible finished player with bounded backoff and fresh rank sync, including offline and wake', async () => {
  vi.useFakeTimers();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const win = new EventTarget();
  const sockets: any[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 0;
    onopen: any;
    onclose: any;
    onmessage: any;
    onerror: any;
    constructor() {
      sockets.push(this);
    }
    send() {}
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('location', { href: 'https://dibs.here/', protocol: 'https:' });
  vi.stubGlobal('navigator', { onLine: true });
  const fetch = vi.fn(async () =>
    Response.json({
      today: { category: { id: 'a' } },
      rows: [],
      leaderboard: { rows: [], total: 30, own: { rank: 7 } },
    }),
  );
  vi.stubGlobal('fetch', fetch);
  publish({
    today: { category: { id: 'a' } } as any,
    rows: [],
    me: { file: { closed: true }, user: { id: 'a' } } as any,
    reset: true,
  });
  const stop = watchRegistry(() => {});
  try {
    sockets[0].readyState = 1;
    sockets[0].onopen();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    sockets[0].close();
    await vi.advanceTimersByTimeAsync(1600);
    expect(sockets.length).toBe(2);
    sockets[1].readyState = 1;
    sockets[1].onopen();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    sockets[1].close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(sockets.length).toBe(2);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(sockets.length).toBe(3);
    (navigator as any).onLine = false;
    win.dispatchEvent(new Event('offline'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(sockets.length).toBe(3);
    (navigator as any).onLine = true;
    win.dispatchEvent(new Event('online'));
    expect(sockets.length).toBe(4);
  } finally {
    stop();
  }
});
it('times out a stalled Turnstile loader after 10 seconds and allows retry', async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const scripts: any[] = [];
  const doc = Object.assign(new EventTarget(), {
    getElementById: () => scripts.at(-1),
    createElement: () => ({ remove: vi.fn() }),
    head: { appendChild: (s: any) => scripts.push(s) },
  });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', {});
  const { preloadTurnstile } = await import('../src/turnstile');
  const p = preloadTurnstile();
  const rejection = expect(p).rejects.toThrow('Verification is slow. Retry');
  await vi.advanceTimersByTimeAsync(10001);
  await rejection;
  expect(scripts[0].remove).toHaveBeenCalled();
  const next = preloadTurnstile();
  expect(scripts.length).toBe(2);
  (window as any).turnstile = {};
  scripts[1].onload();
  await next;
});
