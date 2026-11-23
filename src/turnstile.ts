export async function runTurnstile(sitekey: string, container: HTMLElement): Promise<string> {
  if (!sitekey) throw new Error('Verification is not configured. The clerk has been notified.');
  const win = window as any;
  if (!win.turnstile) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('turnstile-script');
      if (existing) existing.remove();
      const s = document.createElement('script');
      s.id = 'turnstile-script';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error('Verification could not load. Please try a regular browser.'));
      document.head.appendChild(s);
    });
  }
  container.replaceChildren();
  return new Promise((resolve, reject) => {
    let widget: string;
    const timeout = setTimeout(() => {
      if (widget) win.turnstile.remove(widget);
      reject(new Error('Verification took too long. Please try again.'));
    }, 90000);
    widget = win.turnstile.render(container, {
      sitekey,
      action: 'claim',
      theme: document.documentElement.dataset.theme,
      callback: (t: string) => {
        clearTimeout(timeout);
        win.turnstile.remove(widget);
        resolve(t);
      },
      'error-callback': () => {
        clearTimeout(timeout);
        win.turnstile.remove(widget);
        reject(new Error('Verification failed. Please try again.'));
      },
      'expired-callback': () => {
        clearTimeout(timeout);
        win.turnstile.remove(widget);
        reject(new Error('Verification expired. Please try again.'));
      },
    });
  });
}
