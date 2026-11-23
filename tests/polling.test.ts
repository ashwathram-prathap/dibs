import { it, expect, vi } from 'vitest';
import { publish, watchRegistry } from '../src/live';
it('uses server pushes without client heartbeats; failed connections poll with jitter and stop hidden or done', async () => {
  vi.useFakeTimers();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const messages: any[] = [];
  let socket: any;
  class Socket {
    static OPEN = 1;
    readyState = 1;
    onclose: any;
    onmessage: any;
    onerror: any;
    constructor() {
      socket = this;
    }
    send(v: string) {
      messages.push(v);
    }
    close() {}
  }
  vi.stubGlobal('document', doc);
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('location', { href: 'https://dibs.here/', protocol: 'https:' });
  const fetch = vi.fn(async () =>
    Response.json({ today: { category: { id: 'animals' } }, rows: [] }),
  );
  vi.stubGlobal('fetch', fetch);
  publish({ today: { category: { id: 'animals' } } as any, rows: [], reset: true });
  const stop = watchRegistry(() => {});
  try {
    await vi.advanceTimersByTimeAsync(180000);
    expect(messages).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    socket.onclose();
    await vi.advanceTimersByTimeAsync(59999);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15001);
    expect(fetch).toHaveBeenCalledTimes(1);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(180000);
    expect(fetch).toHaveBeenCalledTimes(1);
    publish({
      today: { category: { id: 'animals' } } as any,
      rows: [],
      me: { file: { closed: true } } as any,
    });
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(180000);
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it('closes an expired socket before retrying verification over HTTP', async () => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  let socket: any;
  let sent: any;
  class Socket {
    static OPEN = 1;
    readyState = 1;
    onmessage: any;
    onclose: any;
    constructor() {
      socket = this;
    }
    send(raw: string) {
      sent = JSON.parse(raw);
    }
    close() {
      this.readyState = 3;
    }
  }
  vi.stubGlobal('document', doc);
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('location', { href: 'https://dibs.here/', protocol: 'https:' });
  const fetch = vi.fn(async () => Response.json({ sessionToken: 'new-session' }));
  vi.stubGlobal('fetch', fetch);
  const { api } = await import('../src/api');
  publish({ today: { category: { id: 'animals' } } as any, rows: [], reset: true });
  const stop = watchRegistry(() => {});
  try {
    const first = api('/verify-session', {});
    const failure = expect(first).rejects.toMatchObject({ status: 428 });
    socket.onmessage({
      data: JSON.stringify({ rpc: sent.rpc, status: 428, body: { code: 'VERIFY_AGAIN' } }),
    });
    await failure;
    expect(socket.readyState).toBe(3);
    expect(await api('/verify-session', {})).toEqual({ sessionToken: 'new-session' });
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    stop();
    vi.unstubAllGlobals();
  }
});
