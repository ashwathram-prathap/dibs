import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
it('loads the beacon only for real production visits', () => {
  const code = readFileSync('public/analytics.js', 'utf8');
  for (const test of [
    { host: 'dibs.here', allowed: true },
    { host: 'dibs.here', webdriver: true },
    { host: 'practice.dibs-7hz.pages.dev' },
    { host: 'localhost' },
    { host: '127.0.0.1' },
    { host: 'dibs.here', search: '?no-analytics=1' },
    { host: 'dibs.here', header: true },
  ]) {
    const scripts: any[] = [];
    runInNewContext(code, {
      navigator: { webdriver: test.webdriver },
      location: { hostname: test.host, search: test.search || '' },
      URLSearchParams,
      document: {
        querySelector: (q: string) =>
          q.includes('dibs-test')
            ? test.header
              ? {}
              : null
            : { getAttribute: () => '{"token":"public-beacon-id"}' },
        createElement: () => ({ setAttribute() {} }),
        head: { append: (s: any) => scripts.push(s) },
      },
    });
    expect(scripts.length).toBe(test.allowed ? 1 : 0);
  }
});
