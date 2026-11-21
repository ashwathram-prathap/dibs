import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { parse, type Font } from 'opentype.js';
import { WORDMARK_WIDTH, WORDMARK_PATH, WORDMARK_BLOCK_X } from '../shared/brand';
import { fitText } from '../shared/typography';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import archivoFont from '../public/fonts/archivo-og.woff';
import archivoExtended from '../public/fonts/archivo-og-latin-ext.woff';
import archivoVietnamese from '../public/fonts/archivo-og-vietnamese.woff';
import archivoSupplement from '../public/fonts/archivo-supplement-900.otf';
let fonts: Font[] | undefined;
let ready: Promise<void> | undefined;
// Render self-hosted type to vector outlines before PNG rasterization. No remote fonts or HTML parser.
export async function og(site: string, claim: any) {
  ready ||= initWasm(resvgWasm);
  await ready;
  fonts ||= [archivoFont, archivoExtended, archivoVietnamese, archivoSupplement].map((data) =>
    parse(data),
  );
  const faceFor = (ch: string) =>
    fonts!.find((face) => face.charToGlyphIndex(ch) !== 0) || fonts![0];
  const width = (value: string, size: number) =>
    [...value].reduce((n, ch) => {
      const face = faceFor(ch);
      return n + ((face.charToGlyph(ch).advanceWidth || 0) * size) / face.unitsPerEm;
    }, 0);
  const text = (value: string, x: number, y: number, size: number, color = '#1A1A17') => {
    let out = '';
    for (const ch of value) {
      const face = faceFor(ch);
      const glyph = face.charToGlyph(ch);
      out += `<path fill="${color}" d="${glyph.getPath(x, y, size).toPathData(2)}"/>`;
      x += ((glyph.advanceWidth || 0) * size) / face.unitsPerEm;
    }
    return out;
  };
  const title = claim ? claim.display.toUpperCase() : 'DIBS.';
  const { lines, size } = fitText(title, width, 1060, {
    startSize: 155,
    minSize: 15,
    maxLines: 3,
    maxHeight: 205,
    lineHeight: 0.95,
  });
  const number = claim
    ? 'CERTIFICATE OF DIBS No. ' + String(claim.claim_no).padStart(4, '0')
    : 'REGISTRY OF CLAIMS / FORM C-1';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><path fill="#F1ECE2" d="M0 0h1200v630H0z"/><g fill="none" stroke="#1A1A17" stroke-width="2"><path d="M20 20h1160v590H20z M30 30h1140v570H30z M60 130h1080 M60 470h1080"/></g>${text(number, 60, 85, 22)}<g transform="translate(960 45) scale(${170/WORDMARK_WIDTH})"><path fill="#1A1A17" d="${WORDMARK_PATH}"/><path fill="#E1462B" d="M${WORDMARK_BLOCK_X} 67h18v18h-18z"/></g>${text(claim ? claim.category_date : 'FIRST COME. FIRST SERVED.', 60, 125, 14)}${text(claim ? 'I called dibs on' : 'One category. One claim.', 60, 210, 30)}${lines.map((line, i) => text(line, 60, 240 + size + i * size * 0.95, size)).join('')}${text(claim ? claim.handle : 'Yours for the day.', 60, 530, 30)}${claim ? text(claim.category_name.toUpperCase(), 60, 565, 18) : ''}<g transform="translate(935 538) rotate(-3)"><path fill="none" stroke="#E1462B" stroke-width="4" d="M-150-42h300v80h-300z"/>${text(claim ? 'REGISTERED' : 'DIBS', -132, 14, claim ? 37 : 52, '#E1462B')}</g></svg>`;
  const renderer = new Resvg(svg);
  try {
    const png = renderer.render();
    try {
      return new Response(png.asPng().buffer as ArrayBuffer, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=300',
          'x-robots-tag': 'noindex',
        },
      });
    } finally {
      png.free();
    }
  } finally {
    renderer.free();
  }
}
