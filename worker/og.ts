import { claimScore } from '../shared/claim-copy';
import { editionLabel } from '../shared/sharing';
import { SHARE_INVITATION } from '../shared/copy';
import { rarityLabel, bellPath, bellArea, bellX, bellY, bellSigma } from '../shared/rarity';
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
import { fitText, fitLine } from '../shared/typography';
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
export async function ogLayout(claim: any, summary?: any, dark = false) {
  const ink = dark ? '#F1ECE2' : '#1A1A17';
  const paper = dark ? '#1F1E18' : '#F1ECE2';
  const gold = dark ? '#e7c86b' : '#795700';
  const textBounds: {
    value: string;
    printed: string;
    size: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }[] = [];
  claim = cleanStoredHandles(claim);
  summary = cleanStoredHandles(summary);
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
    color = ink,
    role: 'display' | 'text' | 'form' = 'text',
  ) => {
    const measure = (value: string, z: number) =>
      [...value].reduce((n, ch) => {
        const candidate = role === 'text' ? textFont : role === 'form' ? formFont : undefined;
        const face = candidate?.charToGlyphIndex(ch) ? candidate : faceFor(ch);
        return n + ((face.charToGlyph(ch).advanceWidth || 0) * z) / face.unitsPerEm;
      }, 0);
    const fitted = fitLine(noOrphan(value), measure, 1140 - x, size, Math.min(size, 28));
    size = fitted.size;
    let out = '';
    const bounds = {
      value,
      printed: fitted.text,
      size,
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity,
    };
    for (const ch of fitted.text) {
      const candidate = role === 'text' ? textFont : role === 'form' ? formFont : undefined;
      const face = candidate?.charToGlyphIndex(ch) ? candidate : faceFor(ch);
      const glyph = face.charToGlyph(ch);
      const path = glyph.getPath(x, y, size);
      if (path.commands.length) {
        const box = path.getBoundingBox();
        bounds.left = Math.min(bounds.left, box.x1);
        bounds.top = Math.min(bounds.top, box.y1);
        bounds.right = Math.max(bounds.right, box.x2);
        bounds.bottom = Math.max(bounds.bottom, box.y2);
      }
      out += `<path fill="${color}" d="${svgPath(path.commands)}"/>`;
      x += ((glyph.advanceWidth || 0) * size) / face.unitsPerEm;
    }
    textBounds.push(bounds);
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
    `<g transform="translate(${x} ${y}) scale(${w / WORDMARK_WIDTH}) translate(${WORDMARK_OFFSET_X} ${WORDMARK_OFFSET_Y})"><path fill="${ink}" d="${WORDMARK_PATH}"/><path fill="#E1462B" d="M${WORDMARK_BLOCK_X} 67h18v18h-18z"/></g>`;
  const stamp = () =>
    `<g transform="translate(910 330) rotate(-3)"><path fill="none" stroke="#B93420" stroke-width="2" d="M-205-82h410v172h-410z"/>${text('DIBS', -174, 52, 130, dark ? '#FF836B' : '#B93420', 'display')}</g>`;
  const claims = summary?.file?.claims || [];
  const golden = claim?.golden || claims.some((c: any) => c.golden);
  let content: string;
  if (home)
    content = `${wordmark(60, 150, 500)}${text("Call it first. It's yours.", 60, 365, 46)}${stamp()}`;
  else if (claim) {
    const shown = !claim.concealed;
    content = `${wordmark(960, 45, 170)}${text(`Form D-1${claim.golden ? ' · Golden ticket' : ''} · ${editionLabel(claim.category_date)}`, 60, 90, 32, claim.golden ? gold : ink)}${text(shown ? claim.display : 'SEALED', 60, 220, 95, ink, 'display')}${text(category, 60, 270, 40)}${text(shown ? claimScore(claim) : `${claim.points ?? 0} points · Sealed until the day closes.`, 60, 330, 36)}${text(claim.handle || '', 60, 555, 40)}`;
    if (shown && claim.percentile != null) {
      const x = bellX(claim.percentile),
        y = bellY(bellSigma(claim.percentile));
      content += `<g transform="translate(60 375)"><path fill="${ink}" opacity=".08" d="${bellArea()}"/><defs><clipPath id="rarity-tail"><rect x="${x}" y="0" width="${520 - x}" height="120"/></clipPath></defs><path fill="${golden ? gold : '#E1462B'}" opacity=".25" clip-path="url(#rarity-tail)" d="${bellArea()}"/><path fill="none" stroke="${ink}" stroke-width="2" d="${bellPath()}"/><path stroke="${golden ? gold : '#E1462B'}" stroke-width="3" d="M${x} ${y}V108"/><circle fill="${golden ? gold : '#E1462B'}" cx="${x}" cy="${y}" r="4"/></g>`;
    }
  } else {
    content = `${text(editionLabel(summary.category.date), 60, 55, 32)}${text(title, 60, 120, 64, ink, 'display')}${text(`${file.points ?? 0} points${file.rank ? ` · #${file.rank} of ${file.players} players today` : ''}`, 60, 175, 40)}`;
    const rows = file.events?.length
      ? file.events
      : claims.map((c: any) => ({ kind: 'dibs', claimId: c.id }));
    const compact = rows.length > 4;
    let y = 220;
    let claimIndex = 0;
    rows.slice(0, 7).forEach((event: any, i: number) => {
      const number = String(i + 1).padStart(2, '0');
      if (event.kind === 'strike') {
        content +=
          text(number, 60, y, 28, ink, 'form') +
          `<rect x="94" y="${y - 16}" width="16" height="16" fill="none" stroke="${ink}" stroke-width="2"/>` +
          text('Strike · −10 points', 125, y, 32);
        y += 40;
        return;
      }
      const c = claims.find((c: any) => c.id === event.claimId) || claims[claimIndex];
      claimIndex++;
      if (!c) return;
      const color = c.golden ? gold : ink;
      content += text(number, 60, y, 28, ink, 'form');
      content += `<rect x="94" y="${y - 16}" width="16" height="16" fill="${c.golden ? gold : '#E1462B'}"/>`;
      content += text(
        `${!c.concealed ? c.display : 'Claim'} · ${c.points ?? 0} points${c.golden ? ' · Golden ticket · +100' : ''}`,
        125,
        y,
        36,
        color,
      );
      content += text(
        c.concealed
          ? 'Sealed until the day closes.'
          : (c.bonus ? `${c.points - c.bonus} + ${c.bonus} golden bonus · ` : '') +
              (c.percentile == null
                ? 'Standard score (no readership data for this answer)'
                : rarityLabel(c.percentile, c.category_slug || category)),
        125,
        y + 29,
        28,
        color,
      );
      if (c.golden) content += `<path stroke="${gold}" stroke-width="1" d="M60 ${y + 36}H1140"/>`;
      y += 68;
    });
    content += text(file.handle || '', 60, 595, 36);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="627"><path fill="${paper}" d="M0 0h1200v627H0z"/><path fill="none" stroke="${golden ? gold : ink}" stroke-width="2" d="M20 20h1160v587H20z"/>${content}</svg>`;
  return { svg, textBounds };
}
export async function og(claim: any, summary?: any, dark = false) {
  ready ||= initWasm(resvgWasm);
  await ready;
  const { svg } = await ogLayout(claim, summary, dark);
  const home = !summary && !claim;
  const renderer = new Resvg(svg);
  try {
    const png = renderer.render();
    try {
      const bytes = encodeJpeg({ data: png.pixels, width: png.width, height: png.height }, 90).data;
      if (bytes.byteLength > 300000) throw Error('Preview exceeds image size limit');
      return new Response(bytes.buffer as ArrayBuffer, {
        headers: {
          'content-type': 'image/jpeg',
          'cache-control': home ? 'public, max-age=300' : 'no-store',
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
