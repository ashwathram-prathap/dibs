// Imported by QA entrypoints so browser, fetch and load traffic cannot count as visits.
import { chromium, firefox, webkit } from '@playwright/test';
const send = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (
    [
      'dibs.here',
      'practice.dibs-7hz.pages.dev',
      'dibs-7hz.pages.dev',
      'localhost',
      '127.0.0.1',
    ].includes(url.hostname) ||
    url.hostname.endsWith('.workers.dev')
  ) {
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined),
    );
    headers.set('x-dibs-test', '1');
    return send(input, { ...init, headers });
  }
  return send(input, init);
};
for (const engine of [chromium, firefox, webkit]) {
  const launch = engine.launch.bind(engine);
  engine.launch = async (...args) => {
    const browser = await launch(...args);
    const context = browser.newContext.bind(browser);
    browser.newContext = (options) =>
      context({
        ...options,
        extraHTTPHeaders: { ...options?.extraHTTPHeaders, 'x-dibs-test': '1' },
      });
    const page = browser.newPage.bind(browser);
    browser.newPage = (options) =>
      page({ ...options, extraHTTPHeaders: { ...options?.extraHTTPHeaders, 'x-dibs-test': '1' } });
    return browser;
  };
}
