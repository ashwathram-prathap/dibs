import './test-traffic';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const results = [];
for (const phase of ['before', 'after']) {
  const code = await build({
    stdin: {
      contents: `import {og} from './worker/og';export default {fetch(){return og({claim_no:1,category_name:'Animals',category_date:'2026-11-23',display:'SEALED',concealed:true,handle:'Rust Finch #12'});}}`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    plugins: [
      {
        name: 'version',
        setup(b) {
          if (phase === 'before')
            b.onLoad({ filter: /\/worker\/og.ts$/ }, () => ({
              contents: execFileSync('git', ['show', 'r17-done:worker/og.ts'], {
                encoding: 'utf8',
              }),
              loader: 'ts',
            }));
          b.onResolve({ filter: /\.wasm$/ }, () => ({ path: './resvg.wasm', external: true }));
        },
      },
    ],
    loader: { '.woff': 'binary', '.otf': 'binary' },
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'image',
          modules: [
            { type: 'ESModule', path: 'worker.mjs', contents: code.outputFiles[0].text },
            {
              type: 'CompiledWasm',
              path: 'resvg.wasm',
              contents: readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'),
            },
          ],
          compatibilityDate: '2026-11-20',
        },
      ],
    }),
  );
  try {
    const r = await mf.dispatchFetch('http://localhost');
    const bytes = Buffer.from(await r.arrayBuffer());
    writeFileSync(`review/round18/exports/${phase}-og.${'jpg'}`, bytes);
    results.push({
      phase,
      bytes: bytes.length,
      type: r.headers.get('content-type'),
      status: r.status,
    });
  } finally {
    await mf.dispose();
  }
}
writeFileSync('review/round18/og-sizes.json', JSON.stringify(results, null, 2));
console.log(results);
