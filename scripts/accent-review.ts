import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
mkdirSync('review/accents', { recursive: true });
const claim = {
  id: 'accent-proof',
  display: 'Cheẑichʼed Biny',
  category_name: 'Lakes',
  category_date: '2026-11-21',
  claim_no: 31,
  total_registrable: 2200,
  handle: 'Teal Otter #41',
  school: 'University of Waterloo',
  obscurity: 5,
  created_at: '2026-11-22T02:01:00Z',
};
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
] as const) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const loadedFonts = new Set<string>();
  page.on('response', (response) => {
    if (response.url().includes('/fonts/') && response.ok())
      loadedFonts.add(response.url().split('/').pop()!);
  });
  await page.addInitScript('window.__name = (fn) => fn');
  await page.goto('http://127.0.0.1:5173');
  await page.evaluate(() => document.fonts.ready);
  for (const [label, display] of [
    ['circumflex', 'Cheẑichʼed Biny'],
    ['okina', 'University of Hawaiʻi at Hilo'],
    ['vietnamese', 'Nguyễn Đình Chiểu'],
    ['extended', 'Władysław Walter'],
  ]) {
    const data = await page.evaluate(
      async ({ claim, display }) => {
        const { exportCertificate } = await import('/src/share.ts');
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
        const create = URL.createObjectURL;
        let rendered: Blob | undefined;
        URL.createObjectURL = (blob) => {
          rendered = blob as Blob;
          return create(blob);
        };
        await exportCertificate(
          { ...claim, display },
          false,
          'Proof',
          'https://dibs-7hz.pages.dev',
        );
        URL.createObjectURL = create;
        if (!rendered) throw new Error('No PNG rendered');
        return Array.from(new Uint8Array(await rendered.arrayBuffer()));
      },
      { claim, display },
    );
    writeFileSync(`review/accents/${name}-${label}.png`, Buffer.from(data));
  }
  for (const name of [
    'archivo.woff2',
    'archivo-latin-ext.woff2',
    'archivo-vietnamese.woff2',
    'archivo-supplement-900.otf',
  ]) {
    if (!loadedFonts.has(name)) throw new Error('Required self-hosted face did not load: ' + name);
  }
  await browser.close();
}
const resources: any[] = [];
const require = createRequire(import.meta.url);
const bundle = await build({
  stdin: {
    contents: `import {og} from './worker/og';export default {fetch(){return og('http://localhost',${JSON.stringify(claim)}).catch(e=>new Response(String(e.stack),{status:500}))}}`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  plugins: [
    {
      name: 'worker-assets',
      setup(build) {
        build.onResolve({ filter: /\.(wasm|woff|otf)$/ }, (args) => {
          const source = args.path.startsWith('.')
            ? resolve(args.resolveDir, args.path)
            : require.resolve(args.path);
          const name = basename(source);
          resources.push({
            type: name.endsWith('.wasm') ? 'CompiledWasm' : 'Data',
            path: resolve('.tmp', name),
            contents: readFileSync(source),
          });
          return { path: './' + name, external: true };
        });
      },
    },
  ],
});
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'og-proof',
        modules: [
          {
            type: 'ESModule',
            path: resolve('.tmp/og-proof.mjs'),
            contents: bundle.outputFiles[0].text,
          },
          ...resources,
        ],
        compatibilityDate: '2026-11-20',
      },
    ],
  }),
);
try {
  const response = await mf.dispatchFetch('http://localhost/og');
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('image/png'))
    throw new Error('OG image failed: ' + (await response.text()));
  writeFileSync('review/accents/og-circumflex.png', Buffer.from(await response.arrayBuffer()));
} finally {
  await mf.dispose();
}
writeFileSync(
  'review/accents/results.json',
  JSON.stringify(
    {
      passed: true,
      canvas: 'Four accented names in Chromium and WebKit',
      og: 'Actual Worker renderer with compound circumflex glyph',
    },
    null,
    2,
  ),
);
console.log('Eight accented canvas proofs and Worker OG passed.');
