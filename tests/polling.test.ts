import { it, expect, vi } from 'vitest';
import { publish, publishClaim, watchRegistry } from '../src/live';
it('polls at 15s, backs off at two minutes, pauses hidden tabs, and preserves the server cursor after an own claim', async () => {
  vi.useFakeTimers();
  const doc = new EventTarget() as EventTarget & { hidden: boolean };
  doc.hidden = false;
  const messages: any[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    onmessage: any;
    onclose: any;
    onerror: any;
    send(v: string) {
      messages.push(JSON.parse(v));
    }
    close() {}
  }
  vi.stubGlobal('document', doc);
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('location', { href: 'https://dibs-7hz.pages.dev/', protocol: 'https:' });
  const today: any = { category: { id: 'animals' }, claimed: 1, open: 2199 };
  publish({ today, rows: [{ id: 'one', claim_no: 1 } as any], reset: true });
  const stop = watchRegistry(() => {});
  try {
    await vi.advanceTimersByTimeAsync(14999);
    expect(messages).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(messages).toHaveLength(1);
    publishClaim({ id: 'mine', claim_no: 5, created_at: new Date().toISOString() } as any);
    await vi.advanceTimersByTimeAsync(15000);
    expect(messages.at(-1).since).toBe(1);
    await vi.advanceTimersByTimeAsync(90000);
    expect(messages).toHaveLength(8);
    await vi.advanceTimersByTimeAsync(59999);
    expect(messages).toHaveLength(8);
    await vi.advanceTimersByTimeAsync(1);
    expect(messages).toHaveLength(9);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(120000);
    expect(messages).toHaveLength(9);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(messages).toHaveLength(10);
  } finally {
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
