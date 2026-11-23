import { GAME_DESCRIPTION } from '../shared/copy';
type ExportFont = 'Archivo' | '"Instrument Sans"';
import { cleanHandle, cleanStoredHandles } from '../shared/handles';
import { noOrphan, countLabel } from '../shared/text';
import { bellPath, bellArea, bellSigma, bellY, bellX, rarityLabel } from '../shared/rarity';
import { MAX_CLAIMS } from '../shared/config';
import { REGISTRAR_STROKE } from '../shared/moments';
import { edition, localTime } from '../shared/time';
import { guesses } from '../shared/guesses';
import { PUBLIC_HOST } from '../shared/config';
import { type Claim, type DayFile, type Category, serial } from './types';
import {
  WORDMARK_WIDTH,
  WORDMARK_PATH,
  WORDMARK_BLOCK_X,
  WORDMARK_OFFSET_X,
  WORDMARK_OFFSET_Y,
} from '../shared/brand';
import { fitText } from '../shared/typography';
// Canvas avoids Safari's SVG foreignObject restrictions. Font faces are self-hosted.
export async function exportCertificate(claim: Claim, story: boolean) {
  claim = cleanStoredHandles(claim);
  if (!claim.revealed)
    claim = { ...claim, display: 'SEALED', obscurity: null, percentile: null, golden: false };
  const dark = document.documentElement.dataset.theme === 'dark';
  const ink = dark ? '#F1ECE2' : '#1A1A17',
    paper = dark ? '#1F1E18' : '#F1ECE2';
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('900 100px Archivo', 'DIBS ' + claim.display.toUpperCase()),
    document.fonts.load('400 30px "Instrument Sans"'),
    document.fonts.load('400 20px "IBM Plex Mono"'),
  ]);
  await Promise.all([document.fonts.load('400 24px "IBM Plex Mono"')]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = story ? 1920 : 1350;
  const c = canvas.getContext('2d')!;
  const h = story ? 1500 : 1350;
  await paintPaper(c, paper);
  if (story) c.translate(0, 80);
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 2;
  c.strokeRect(36, 36, 1008, h - 72);
  const text = (s: string, x: number, y: number, size = 26) => {
    c.font = `400 ${size}px "Instrument Sans"`;
    c.fillText(noOrphan(s), x, y);
  };
  const line = (y: number) => {
    c.beginPath();
    c.moveTo(80, y);
    c.lineTo(1000, y);
    c.stroke();
  };
  text(
    claim.category_id === 'practice' ? 'Practice — not the public record' : 'Registry of claims',
    80,
    105,
  );
  formText(c, 'number', 'Form D-1', 825, 105);
  line(135);
  text('Certificate of Dibs', 80, 200, 22);
  formText(c, 'number', 'No. ' + serial(claim.claim_no), 80, 237);
  c.save();
  c.translate(800, 162);
  c.scale(200 / WORDMARK_WIDTH, 200 / WORDMARK_WIDTH);
  c.translate(WORDMARK_OFFSET_X, WORDMARK_OFFSET_Y);
  c.fill(new Path2D(WORDMARK_PATH));
  c.fillStyle = '#E1462B';
  c.fillRect(WORDMARK_BLOCK_X, 67, 18, 18);
  c.restore();
  const top = 340;
  c.font = '400 34px "Instrument Sans"';
  c.fillText('Let the record show.', 80, top);
  c.fillText('I called dibs on', 80, top + 48);
  const { lines, size } = fitText(
    claim.display.toUpperCase(),
    (text, size) => {
      c.font = `900 ${size}px Archivo`;
      return c.measureText(text).width;
    },
    910,
    { startSize: 145, minSize: 20, maxLines: 3, maxHeight: 270, lineHeight: 0.9 },
  );
  c.font = `900 ${size}px Archivo`;
  let y = top + 110;
  for (const row of lines) {
    y += size * 0.9;
    c.fillText(row, 80, y);
  }
  y += 45;
  line(y);
  text(claim.category_name, 80, y + 38, 20);
  formText(c, 'date', claim.category_date, 820, y + 38);
  line(y + 65);
  const holder = y + 120;
  formText(c, 'label', 'Held by', 80, holder);
  c.font = '600 42px "Instrument Sans"';
  if (claim.founder) c.fillStyle = dark ? '#e7c86b' : '#795700';
  c.fillText(cleanHandle(claim.handle), 80, holder + 60);
  if (claim.founder) text('Founder', 80, holder + 90, 18);
  c.fillStyle = ink;
  c.font = '400 26px "Instrument Sans"';
  c.save();
  c.translate(790, h - 240);
  c.scale(0.9, 0.9);
  c.lineWidth = 1.4;
  c.stroke(new Path2D(REGISTRAR_STROKE));
  c.restore();
  text('The Registrar', 790, h - 180, 18);
  if (claim.revealed && claim.percentile != null) {
    text(rarityLabel(claim.percentile, claim.category_name), 80, h - 250, 18);
    text(countLabel(claim.points || 0, 'point'), 80, h - 220, 18);
    await drawCurve(c, claim.percentile, 80, h - 205, 290, 68, !!claim.golden);
  }
  c.save();
  c.translate(550, h - 247);
  c.rotate(((((claim.claim_no * 7.31) % 7) - 4) * Math.PI) / 180);
  c.strokeStyle = claim.golden ? '#B8902F' : '#E1462B';
  c.fillStyle = claim.golden ? '#B8902F' : '#E1462B';
  c.lineWidth = 5;
  c.strokeRect(-166, -67, 332, 147);
  c.font = '900 110px Archivo';
  c.textAlign = 'center';
  c.fillText('DIBS', 0, 32);
  c.fillStyle = ink;
  c.font = '400 24px "Instrument Sans"';
  c.fillStyle = claim.golden ? (dark ? '#e7c86b' : '#7A5C14') : ink;
  c.fillText(
    claim.golden
      ? 'Golden ticket'
      : claim.obscurity && claim.obscurity >= 4
        ? 'Deep cut'
        : 'Registered',
    0,
    61,
  );
  c.restore();
  line(h - 120);
  text(`One of ${claim.total_registrable.toLocaleString()}. Only one yours.`, 80, h - 80, 17);
  text(PUBLIC_HOST, 740, h - 80, 17);
  return canvasFile(
    canvas,
    `dibs-${claim.display.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${story ? 'story' : 'feed'}.jpg`,
  );
}
export async function canvasFile(canvas: HTMLCanvasElement, name: string) {
  for (const quality of [0.85, 0.8, 0.7, 0.6, 0.5]) {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error('Image export failed'))),
        'image/jpeg',
        quality,
      ),
    );
    if (blob.size < 350_000) return new File([blob], name, { type: 'image/jpeg' });
  }
  throw Error('Image exceeds 350 KB');
}
async function drawCurve(
  c: CanvasRenderingContext2D,
  p: number,
  x: number,
  y: number,
  w: number,
  h: number,
  golden: boolean,
) {
  const ink = document.documentElement.dataset.theme === 'dark' ? '#F1ECE2' : '#1A1A17';
  const accent = golden ? '#B8902F' : '#E1462B',
    plotHeight = h - 26;
  const matrix = new DOMMatrix([w / 520, 0, 0, plotHeight / 120, x, y]);
  const area = new Path2D(),
    line = new Path2D();
  area.addPath(new Path2D(bellArea()), matrix);
  line.addPath(new Path2D(bellPath()), matrix);
  const marker = x + (bellX(p) / 520) * w,
    baseline = y + (108 / 120) * plotHeight;
  const dotY = y + (bellY(bellSigma(p)) / 120) * plotHeight;
  c.save();
  c.fillStyle = ink;
  c.globalAlpha = 0.1;
  c.fill(area);
  c.save();
  c.beginPath();
  c.rect(marker, y, x + w - marker, plotHeight);
  c.clip();
  c.fillStyle = accent;
  c.globalAlpha = 0.25;
  c.fill(area);
  c.restore();
  c.globalAlpha = 1;
  c.strokeStyle = ink;
  c.lineWidth = 1.75;
  c.lineCap = 'round';
  c.stroke(line);
  c.lineWidth = 0.75;
  c.globalAlpha = 0.5;
  c.beginPath();
  c.moveTo(x + (w * 28) / 520, baseline);
  c.lineTo(x + (w * 492) / 520, baseline);
  c.stroke();
  c.globalAlpha = 1;
  c.strokeStyle = accent;
  c.lineWidth = 1.75;
  c.beginPath();
  c.moveTo(marker, dotY);
  c.lineTo(marker, baseline + 2);
  c.stroke();
  c.fillStyle = accent;
  c.beginPath();
  c.arc(marker, dotY, 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = ink;
  c.font = '400 11px "Instrument Sans"';
  c.textAlign = 'center';
  c.fillText('You', marker, baseline + 12);
  c.font = '400 10px "IBM Plex Mono"';
  c.textAlign = 'left';
  c.fillText('Familiar', x + (w * 28) / 520, y + h);
  c.textAlign = 'right';
  c.fillText('Obscure', x + (w * 492) / 520, y + h);
  c.restore();
}

export function summaryText(file: DayFile, category: Category) {
  const squares = file.events
    .map((event) => (event.kind === 'strike' ? '\u2b1b' : event.golden ? '\u{1f7e8}' : '\u{1f7e5}'))
    .join('');
  return `Dibs #${edition(category.date)} · ${category.name}\n${squares}\n${file.points ?? 0} ${file.points === 1 ? 'pt' : 'pts'}${file.rank ? ` · #${file.rank} of ${file.players}` : ''} · streak ${file.streak || 0}\n${PUBLIC_HOST}`;
}
export async function exportSummary(file: DayFile, category: Category, story: boolean) {
  file = cleanStoredHandles(file);
  const dark = document.documentElement.dataset.theme === 'dark';
  const ink = dark ? '#F1ECE2' : '#1A1A17',
    paper = dark ? '#1F1E18' : '#F1ECE2';
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(
      '900 100px Archivo',
      guesses(file)
        .map((e) => e.display)
        .join(' '),
    ),
    document.fonts.load('400 24px "IBM Plex Mono"'),
    document.fonts.load('600 42px "Instrument Sans"'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = story ? 1920 : 1350;
  const c = canvas.getContext('2d')!;
  const h = story ? 1760 : 1350;
  await paintPaper(c, paper);
  if (story) c.translate(0, 80);
  const red = '#E1462B',
    gold = dark ? '#e7c86b' : '#7A5C14';
  c.fillStyle = ink;
  c.strokeStyle = ink;
  c.lineWidth = 2;
  c.strokeRect(36, 36, 1008, h - 72);
  const text = (
    s: string,
    x: number,
    y: number,
    size = 22,
    face: ExportFont = '"Instrument Sans"',
    weight = 400,
  ) => {
    c.font = `${weight} ${size}px ${face}`;
    c.fillText(noOrphan(s), x, y);
  };
  const fit = (
    s: string,
    x: number,
    y: number,
    width: number,
    size: number,
    face: ExportFont = 'Archivo',
    weight = 900,
  ) => {
    const f = fitText(
      s,
      (t, z) => {
        c.font = `${weight} ${z}px ${face}`;
        return c.measureText(t).width;
      },
      width,
      { startSize: size, minSize: 17, maxLines: 2, maxHeight: size * 1.6, lineHeight: 1 },
    );
    f.lines.forEach((line, i) => text(line, x, y + i * f.size, f.size, face, weight));
  };
  const line = (y: number) => {
    c.beginPath();
    c.moveTo(80, y);
    c.lineTo(1000, y);
    c.stroke();
  };
  text(
    category.id === 'practice' ? 'Practice — not the public record' : 'Registry of claims',
    80,
    105,
    19,
  );
  formText(c, 'number', 'Form D-3', 825, 105);
  line(132);

  text('Day certificate', 80, 198);
  formText(c, 'number', 'Dibs #' + edition(category.date), 80, 235);
  c.save();
  c.translate(800, 166);
  c.scale(200 / WORDMARK_WIDTH, 200 / WORDMARK_WIDTH);
  c.translate(WORDMARK_OFFSET_X, WORDMARK_OFFSET_Y);
  c.fill(new Path2D(WORDMARK_PATH));
  c.fillStyle = '#E1462B';
  c.fillRect(WORDMARK_BLOCK_X, 67, 18, 18);
  c.restore();
  text('File closed.', 80, 365, 114, 'Archivo', 900);
  fit(category.name, 80, 422, 680, 30);
  formText(c, 'date', category.date, 825, 422);
  text(
    `${file.dibs}/${MAX_CLAIMS} claims · ${file.strikes} ${file.strikes === 1 ? 'strike' : 'strikes'} · filed ${localTime(file.completedAt!).full}`,
    80,
    480,
    22,
  );
  text(
    `${countLabel(file.points ?? 0, 'point')}${file.rank ? ` · #${file.rank} of ${file.players}` : ''} · streak ${file.streak || 0}`,
    80,
    538,
    24,
  );
  const rows = guesses(file).map((e) =>
      file.revealed
        ? e
        : {
            ...e,
            display: 'Revealed when the day closes',
            holder: undefined,
            heldAt: undefined,
            house: false,
            golden: false,
          },
    ),
    rowHeight = Math.min(105, (h - 940) / Math.max(1, rows.length));
  rows.forEach((event, i) => {
    const y = 565 + i * rowHeight;
    c.fillStyle = ink;
    c.strokeStyle = ink;
    line(y);
    formText(c, 'number', String(i + 1).padStart(2, '0'), 80, y + 35);
    const display = (event.display || '').toUpperCase();
    fit(display, 132, y + 35, event.kind === 'dibs' ? 590 : 850, Math.min(42, rowHeight * 0.32));
    if (event.kind === 'strike') {
      c.beginPath();
      c.moveTo(132, y + 25);
      c.lineTo(Math.min(980, 132 + c.measureText(display).width), y + 25);
      c.stroke();
      const held = event.house
        ? 'RESERVED'
        : event.holder
          ? `Taken by ${event.holder}${event.holderFounder ? ' / Founder' : ''}${event.heldAt ? ' at ' + localTime(event.heldAt).full : ''}`
          : 'Holder details were not retained';
      if (event.holderFounder) c.fillStyle = dark ? '#e7c86b' : '#795700';
      fit(
        held,
        132,
        y + rowHeight * 0.82,
        850,
        Math.min(20, rowHeight * 0.27),
        '"Instrument Sans"',
        400,
      );
    } else {
      c.save();
      c.translate(866, y + 32);
      c.rotate(-0.045);
      c.fillStyle = event.golden ? gold : red;
      c.strokeStyle = c.fillStyle;
      c.lineWidth = 2;
      c.strokeRect(-112, -22, 224, 45);
      text(event.golden ? 'DIBS / GOLD' : 'DIBS', -98, 9, 26, 'Archivo', 900);
      c.restore();
      c.fillStyle = ink;
      if ((event.obscurity || 0) >= 4) text('Deep cut', 755, y + rowHeight * 0.85, 17);
    }
  });
  for (const [i, event] of rows.entries()) {
    const claim = file.claims.find((c) => c.id === event.claimId);
  }
  c.fillStyle = ink;
  c.strokeStyle = ink;
  const holderTop = 565 + rows.length * rowHeight + 30;
  line(holderTop);
  formText(c, 'label', 'Filed under', 80, holderTop + 38);
  if (file.founder) c.fillStyle = dark ? '#e7c86b' : '#795700';
  fit(
    file.handle || file.claims[0]?.handle || 'Anonymous filer',
    80,
    holderTop + 85,
    650,
    38,
    '"Instrument Sans"',
    600,
  );
  if (file.founder) text('Founder', 80, holderTop + 112, 18);
  c.fillStyle = ink;
  c.save();
  c.translate(780, h - 210);
  c.lineWidth = 1.4;
  c.stroke(new Path2D(REGISTRAR_STROKE));
  c.restore();
  text('The Registrar', 780, h - 145, 18);
  line(h - 100);
  text('All claims entirely ceremonial.', 80, h - 66, 16);
  text(PUBLIC_HOST, 825, h - 66, 18);
  return canvasFile(canvas, `dibs-day-${category.date}-${story ? 'story' : 'feed'}.jpg`);
}

function formText(
  c: CanvasRenderingContext2D,
  role: 'number' | 'label' | 'date',
  value: string,
  x: number,
  y: number,
) {
  if (role === 'label' && value.trim().split(/\s+/).length > 3)
    throw Error('Form labels must be short');
  c.font = '400 24px "IBM Plex Mono"';
  c.fillText(value, x, y);
}
async function paintPaper(c: CanvasRenderingContext2D, paper: string) {
  c.fillStyle = paper;
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  try {
    const grain = new Image();
    grain.src = '/grain.v2.webp';
    await grain.decode();
    const pattern = c.createPattern(grain, 'repeat');
    if (pattern) {
      c.save();
      c.globalAlpha = 0.04;
      c.fillStyle = pattern;
      c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      c.restore();
    }
  } catch {
    /* The paper colour remains readable if the texture is unavailable. */
  }
}

export function certificateText(claim: Claim) {
  if (!claim.revealed) return GAME_DESCRIPTION;
  return `Dibs · ${claim.category_name}${claim.revealed ? ' · ' + claim.display : ''}${claim.percentile != null ? '\n' + rarityLabel(claim.percentile, claim.category_name) : ''}${claim.points != null ? ' · ' + countLabel(claim.points, 'point') : ''}\n${GAME_DESCRIPTION}\n${PUBLIC_HOST}`;
}
