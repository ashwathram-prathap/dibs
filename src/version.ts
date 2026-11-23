import { getSnapshot } from './live';
declare const __BUILD_ID__: string;
export function mayReload(snapshot: ReturnType<typeof getSnapshot>, typing: boolean) {
  return !typing && !!snapshot && (!snapshot.today.category || !!snapshot.me?.file?.closed);
}
export function watchVersion() {
  let checking = false;
  const check = async () => {
    if (document.hidden || checking) return;
    checking = true;
    try {
      const r = await fetch('/version.json', { cache: 'no-cache' });
      if (!r.ok) return;
      const data = await r.json();
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        !!document.querySelector<HTMLInputElement>('#answer')?.value;
      if (
        typeof data.buildId === 'string' &&
        data.buildId > __BUILD_ID__ &&
        mayReload(getSnapshot(), typing)
      )
        location.reload();
    } catch {
    } finally {
      checking = false;
    }
  };
  const interval = setInterval(check, 600000);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  return () => {
    clearInterval(interval);
    window.removeEventListener('focus', check);
    document.removeEventListener('visibilitychange', check);
  };
}
