import { cleanStoredHandles } from '../shared/handles';
import { noOrphan } from '../shared/text';
import encodeJpeg from './jpeg-encoder';
import { MAX_CLAIMS, MAX_STRIKES, DROP_TIME_LABEL } from '../shared/config';
import { svgPath } from '../shared/svg-path';
import { PUBLIC_HOST, PUBLIC_ORIGIN } from '../shared/config';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { parse, type Font } from 'opentype.js';
import {
  WORDMARK_WIDTH,
  WORDMARK_PATH,
  WORDMARK_BLOCK_X,
  WORDMARK_OFFSET_X,
  WORDMARK_OFFSET_Y,
} from '../shared/brand';
import { fitText } from '../shared/typography';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import archivoFont from '../public/fonts/archivo-og.woff';
import archivoExtended from '../public/fonts/archivo-og-latin-ext.woff';
import archivoVietnamese from '../public/fonts/archivo-og-vietnamese.woff';
import archivoSupplement from '../public/fonts/archivo-supplement-900.otf';
import instrumentFont from '../public/fonts/instrument-og.otf';
import plexFont from '../public/fonts/plex-og.woff';
let fonts: Font[] | undefined;
let textFont: Font, formFont: Font;
let ready: Promise<void> | undefined;
// Render self-hosted type to vector outlines before PNG rasterization. No remote fonts or HTML parser.
export async function og(claim: any, summary?: any) {
  claim = cleanStoredHandles(claim);
  summary = cleanStoredHandles(summary);
  ready ||= initWasm(resvgWasm);
  await ready;
  fonts ||= [archivoFont, archivoExtended, archivoVietnamese, archivoSupplement].map((data) =>
    parse(data),
  );
  textFont ||= parse(instrumentFont);
  formFont ||= parse(plexFont);
  const faceFor = (ch: string) =>
    fonts!.find((face) => face.charToGlyphIndex(ch) !== 0) || fonts![0];
  const width = (value: string, size: number) =>
    [...value].reduce((n, ch) => {
      const face = faceFor(ch);
      return n + ((face.charToGlyph(ch).advanceWidth || 0) * size) / face.unitsPerEm;
    }, 0);
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = '#1A1A17',
    role: 'display' | 'text' | 'form' = 'text',
  ) => {
    let out = '';
    for (const ch of noOrphan(value)) {
      const candidate = role === 'text' ? textFont : role === 'form' ? formFont : undefined;
      const face = candidate?.charToGlyphIndex(ch) ? candidate : faceFor(ch);
      const glyph = face.charToGlyph(ch);
      out += `<path fill="${color}" d="${svgPath(glyph.getPath(x, y, size).commands)}"/>`;
      x += ((glyph.advanceWidth || 0) * size) / face.unitsPerEm;
    }
    return out;
  };
  const home = !summary && !claim;
  const category = summary?.category?.name || claim?.category_name || '';
  const file = summary?.file || claim?.score || {};
  const title = category.toUpperCase();
  const { lines, size } = fitText(title, width, 1020, {
    startSize: 130,
    minSize: 15,
    maxLines: 2,
    maxHeight: 190,
    lineHeight: 0.95,
  });
  const wordmark = (x: number, y: number, w: number) =>
    `<g transform="translate(${x} ${y}) scale(${w / WORDMARK_WIDTH}) translate(${WORDMARK_OFFSET_X} ${WORDMARK_OFFSET_Y})"><path fill="#1A1A17" d="${WORDMARK_PATH}"/><path fill="#E1462B" d="M${WORDMARK_BLOCK_X} 67h18v18h-18z"/></g>`;
  const stamp = `<g transform="translate(965 529) rotate(-3)"><path fill="none" stroke="#E1462B" stroke-width="4" d="M-150-42h300v80h-300z"/>${text('DIBS', -110, 17, 58, '#E1462B', 'display')}</g>`;
  const content = home
    ? `${wordmark(60, 73, 500)}${text('One category a day.', 60, 310, 48)}${text("Call it first, it's yours.", 60, 375, 48)}${text(`${MAX_CLAIMS} claims · ${MAX_STRIKES} strikes · new drop ${DROP_TIME_LABEL.replace(':00', '')} ET`, 60, 465, 28)}`
    : `${wordmark(960, 45, 170)}${text(summary?.category?.date || claim?.category_date || '', 60, 95, 24, '#1A1A17', 'form')}${lines.map((line, i) => text(line, 60, 180 + size + i * size * 0.95, size, '#1A1A17', 'display')).join('')}${text(`${file.points ?? claim?.points ?? 0} pts${file.rank ? ' · #' + file.rank + ' of ' + file.players : ''} · Streak ${file.streak || claim?.streak || 0}`, 60, 445, 32)}${(file.events || []).map((e: any, i: number) => `<rect x="${60 + i * 42}" y="495" width="28" height="28" fill="${e.kind === 'dibs' ? '#E1462B' : 'none'}" stroke="#1A1A17" stroke-width="2"/>`).join('')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="627"><path fill="#F1ECE2" d="M0 0h1200v627H0z"/><path fill="none" stroke="#1A1A17" stroke-width="2" d="M20 20h1160v587H20z"/>${content}${stamp}${!home ? text(file.handle || claim?.handle || '', 60, 558, 20) : ''}${text(PUBLIC_HOST, 60, 585, 20)}</svg>`;
  const renderer = new Resvg(svg);
  try {
    const png = renderer.render();
    try {
      const bytes = encodeJpeg({ data: png.pixels, width: png.width, height: png.height }, 85).data;
      if (bytes.byteLength > 600000) throw Error('Preview exceeds image size limit');
      return new Response(bytes.buffer as ArrayBuffer, {
        headers: {
          'content-type': 'image/jpeg',
          'cache-control': 'public, max-age=300',
          'x-robots-tag': 'noindex',
          'x-public-origin': PUBLIC_ORIGIN,
        },
      });
    } finally {
      png.free();
    }
  } finally {
    renderer.free();
  }
}
