import { it, expect } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
it('turns D1 quota failures into a dated clerk notice', async () => {
  const result = await build({
    stdin: {
      contents:
        "import {safeError} from './worker/routes'; export default {fetch(){return safeError(new Error('D1_ERROR: daily row read limit 7500'), {LOCAL_TEST:'false'});}}",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    external: ['cloudflare:workers'],
    loader: { '.wasm': 'binary', '.woff': 'binary', '.otf': 'binary' },
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'quota-test',
          modules: true,
          script: result.outputFiles[0].text,
          compatibilityDate: '2026-11-20',
        },
      ],
    }),
  );
  try {
    const r = await mf.dispatchFetch('http://localhost/');
    const body = (await r.json()) as any;
    expect(r.status).toBe(503);
    expect(body.code).toBe('REGISTRY_CLOSED');
    expect(body.message).toContain('Registry closed for the day');
    expect(Date.parse(body.retryAt)).toBeGreaterThan(Date.now());
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
  } finally {
    await mf.dispose();
  }
});
