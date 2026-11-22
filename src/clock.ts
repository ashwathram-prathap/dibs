import { useSyncExternalStore } from 'react';
let anchor = Date.now(),
  sampled = performance.now(),
  now = anchor;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
export const serverNow = () => anchor + performance.now() - sampled;
const tick = () => {
  now = serverNow();
  listeners.forEach((fn) => fn());
};
export function syncClock(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return;
  anchor = parsed;
  sampled = performance.now();
  tick();
}
function visibility() {
  clearInterval(timer);
  timer = undefined;
  if (!document.hidden && listeners.size) {
    tick();
    timer = setInterval(tick, 1000);
  }
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', visibility);
    visibility();
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    }
  };
}
export const useServerNow = () => useSyncExternalStore(subscribe, () => now);
