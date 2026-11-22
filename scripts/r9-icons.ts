import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { readFileSync, writeFileSync } from 'node:fs';
await initWasm(readFileSync('node_modules/@resvg/resvg-wasm/index_bg.wasm'));
const seal = readFileSync('public/art/seal.svg', 'utf8').replace(
  '<svg ',
  '<svg x="36" y="36" width="108" height="108" ',
);
for (const size of [180, 192, 512]) {
  const r = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 180 180"><path fill="#e5e9db" d="M0 0h180v180H0z"/>${seal}</svg>`,
  );
  const png = r.render();
  writeFileSync(`public/icon-${size}.png`, png.asPng());
  png.free();
  r.free();
}
