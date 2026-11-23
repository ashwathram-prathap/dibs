let loading: Promise<void> | undefined;
function loadScript() {
  if ((window as any).turnstile) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    document.getElementById('turnstile-script')?.remove();
    const s = document.createElement('script');
    s.id = 'turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = () => resolve();
    s.onerror = () => {
      loading = undefined;
      reject(Error('Verification could not load. Please try a regular browser.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
// One reusable widget per mounted verification container. A ready token never enters storage.
type Check = {
  promise: Promise<string>;
  token?: string;
  expires: number;
  widget?: string;
  refresh?: ReturnType<typeof setTimeout>;
  dispose: () => void;
};
const checks = new WeakMap<HTMLElement, Check>();
export function clearTurnstile(container: HTMLElement) {
  checks.get(container)?.dispose();
}
export function runTurnstile(sitekey: string, container: HTMLElement): Promise<string> {
  if (!sitekey)
    return Promise.reject(Error('Verification is not configured. The clerk has been notified.'));
  const old = checks.get(container);
  if (old && (!old.token || old.expires > Date.now() + 15000)) return old.promise;
  old?.dispose();
  let resolve!: (token: string) => void, reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  let timeout: ReturnType<typeof setTimeout>;
  const check: Check = {
    promise,
    expires: 0,
    dispose: () => {
      clearTimeout(timeout);
      clearTimeout(check.refresh);
      if (check.widget) (window as any).turnstile?.remove(check.widget);
      document.removeEventListener('visibilitychange', visible);
      checks.delete(container);
    },
  };
  const renew = () => {
    check.dispose();
    if (container.isConnected && !document.hidden) {
      const next = runTurnstile(sitekey, container);
      if (!check.token) void next.then(resolve, reject);
      else void next.catch(() => {});
    } else if (!check.token) reject(Error('Verification expired. Please try again.'));
  };
  const visible = () => {
    if (!document.hidden && check.expires && check.expires <= Date.now() + 15000) renew();
  };
  checks.set(container, check);
  document.addEventListener('visibilitychange', visible);
  void loadScript()
    .then(() => {
      if (checks.get(container) !== check) return;
      const api = (window as any).turnstile;
      container.replaceChildren();
      timeout = setTimeout(() => {
        check.dispose();
        reject(Error('Verification took too long. Please try again.'));
      }, 90000);
      check.widget = api.render(container, {
        sitekey,
        action: 'claim',
        theme: document.documentElement.dataset.theme,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => {
          clearTimeout(timeout);
          check.token = token;
          check.expires = Date.now() + 300000;
          check.refresh = setTimeout(renew, 280000);
          resolve(token);
        },
        'error-callback': () => {
          check.dispose();
          reject(Error('Verification failed. Please try again.'));
        },
        'expired-callback': renew,
      });
      api.execute(check.widget);
    })
    .catch((e) => {
      check.dispose();
      reject(e);
    });
  return promise;
}
