import { edition, localTime } from '../shared/time';
import { guesses } from '../shared/guesses';
import { PUBLIC_HOST } from '../shared/config';
import { type Claim, type DayFile, type Category, serial } from './types';
import { WORDMARK_WIDTH, WORDMARK_PATH, WORDMARK_BLOCK_X } from '../shared/brand';
import { fitText } from '../shared/typography';
// Canvas avoids Safari's SVG foreignObject restrictions. Font faces are self-hosted.
export async function exportCertificate(claim: Claim, story: boolean) {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(
      '900 100px Archivo, ArchivoSupplement',
      'DIBS ' + claim.display.toUpperCase(),
    ),
    document.fonts.load('900 100px ArchivoSupplement', claim.display.toUpperCase()),
    document.fonts.load('400 30px Instrument'),
    document.fonts.load('400 20px Plex'),
  ]);
  await Promise.all([
    document.fonts.load('400 24px Plex'),
    document.fonts.load('900 100px ArchivoSupplement'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = story ? 1920 : 1350;
  const c = canvas.getContext('2d')!;
  const h = story ? 1500 : 1350;
  c.fillStyle = '#F1ECE2';
  c.fillRect(0, 0, 1080, canvas.height);
  if (story) c.translate(0, 80);
  c.strokeStyle = '#1A1A17';
  c.fillStyle = '#1A1A17';
  c.lineWidth = 2;
  c.strokeRect(36, 36, 1008, h - 72);
  c.strokeRect(47, 47, 986, h - 94);
  const mono = (s: string, x: number, y: number, size = 19) => {
    c.font = `400 ${size}px Plex`;
    c.fillText(s, x, y);
  };
  const line = (y: number) => {
    c.beginPath();
    c.moveTo(80, y);
    c.lineTo(1000, y);
    c.stroke();
  };
  for (const x of [36, 1044])
    for (const y of [36, h - 36]) {
      c.beginPath();
      c.moveTo(x - 13, y);
      c.lineTo(x + 13, y);
      c.moveTo(x, y - 13);
      c.lineTo(x, y + 13);
      c.stroke();
    }
  mono(
    claim.category_id === 'practice' ? 'PRACTICE — NOT THE PUBLIC RECORD' : 'REGISTRY OF CLAIMS',
    80,
    105,
  );
  mono('FORM D-1', 890, 105);
  line(135);
  mono('CERTIFICATE OF DIBS', 80, 200, 22);
  mono('No. ' + serial(claim.claim_no), 80, 237, 22);
  c.save();
  c.translate(800, 162);
  c.scale(200 / WORDMARK_WIDTH, 200 / WORDMARK_WIDTH);
  c.fill(new Path2D(WORDMARK_PATH));
  c.fillStyle = '#E1462B';
  c.fillRect(WORDMARK_BLOCK_X, 67, 18, 18);
  c.restore();
  const top = 340;
  c.font = '400 34px Instrument';
  c.fillText('Let the record show.', 80, top);
  c.fillText('I called dibs on', 80, top + 48);
  const { lines, size } = fitText(
    claim.display.toUpperCase(),
    (text, size) => {
      c.font = `900 ${size}px Archivo, ArchivoSupplement`;
      return c.measureText(text).width;
    },
    910,
    { startSize: 145, minSize: 20, maxLines: 3, maxHeight: 270, lineHeight: 0.9 },
  );
  c.font = `900 ${size}px Archivo, ArchivoSupplement`;
  let y = top + 110;
  for (const row of lines) {
    y += size * 0.9;
    c.fillText(row, 80, y);
  }
  y += 45;
  line(y);
  mono(claim.category_name.toUpperCase(), 80, y + 38, 20);
  mono(claim.category_date, 820, y + 38, 20);
  line(y + 65);
  const holder = y + 120;
  mono('HELD BY', 80, holder, 19);
  c.font = '600 42px Instrument';
  c.fillText(claim.handle, 80, holder + 60);
  c.font = '400 26px Instrument';
  mono('OBSCURITY', 80, h - 250);
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.arc(93 + i * 42, h - 211, 12, 0, Math.PI * 2);
    if (claim.obscurity && i < claim.obscurity) c.fill();
    else c.stroke();
  }
  mono(claim.obscurity ? 'Wikipedia pageviews' : 'Unrated: pageviews unavailable', 80, h - 165, 16);
  c.save();
  c.translate(795, h - 247);
  c.rotate(((((claim.claim_no * 7.31) % 7) - 4) * Math.PI) / 180);
  c.strokeStyle = claim.golden ? '#B8902F' : '#E1462B';
  c.fillStyle = claim.golden ? '#B8902F' : '#E1462B';
  c.lineWidth = 5;
  c.strokeRect(-166, -67, 332, 147);
  c.strokeRect(-156, -57, 312, 127);
  c.font = '900 110px Archivo, ArchivoSupplement';
  c.textAlign = 'center';
  c.fillText('DIBS', 0, 32);
  c.fillStyle = '#1A1A17';
  c.font = '400 22px Plex';
  c.fillStyle = claim.golden ? '#7A5C14' : '#1A1A17';
  c.fillText(
    claim.golden
      ? 'GOLDEN TICKET'
      : claim.obscurity && claim.obscurity >= 4
        ? 'DEEP CUT'
        : 'REGISTERED',
    0,
    61,
  );
  c.restore();
  c.setLineDash([6, 6]);
  line(h - 120);
  c.setLineDash([]);
  mono(`ONE OF ${claim.total_registrable.toLocaleString()}. ONLY ONE YOURS.`, 80, h - 80, 17);
  mono(PUBLIC_HOST, 740, h - 80, 17);
  return canvasFile(
    canvas,
    `dibs-${claim.display.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${story ? 'story' : 'feed'}.png`,
  );
}
async function canvasFile(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'),
  );
  return new File([blob], name, { type: 'image/png' });
}

export function summaryText(file: DayFile, category: Category) {
  return `Dibs #${edition(category.date)} ${file.events.map((e) => (e.kind === 'dibs' ? '■' : '□')).join('')} ${file.dibs}/3 dibs · ${file.strikes} ${file.strikes === 1 ? 'strike' : 'strikes'} · filed ${localTime(file.completedAt!, 'America/Toronto').full} · Next drop: 9 PM ET`;
}
export async function exportSummary(file: DayFile, category: Category, story: boolean) {
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(
      '900 100px Archivo, ArchivoSupplement',
      guesses(file)
        .map((e) => e.display)
        .join(' '),
    ),
    document.fonts.load('900 100px ArchivoSupplement'),
    document.fonts.load('400 24px Plex'),
    document.fonts.load('600 42px Instrument'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = story ? 1920 : 1350;
  const c = canvas.getContext('2d')!;
  const h = story ? 1760 : 1350;
  c.fillStyle = '#F1ECE2';
  c.fillRect(0, 0, 1080, canvas.height);
  if (story) c.translate(0, 80);
  const ink = '#1A1A17',
    red = '#B93420',
    gold = '#7A5C14';
  c.fillStyle = ink;
  c.strokeStyle = ink;
  c.lineWidth = 2;
  c.strokeRect(36, 36, 1008, h - 72);
  c.strokeRect(47, 47, 986, h - 94);
  const text = (s: string, x: number, y: number, size = 22, face = 'Plex', weight = 400) => {
    c.font = `${weight} ${size}px ${face}`;
    c.fillText(s, x, y);
  };
  const fit = (
    s: string,
    x: number,
    y: number,
    width: number,
    size: number,
    face = 'Archivo, ArchivoSupplement',
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
    category.id === 'practice' ? 'PRACTICE — NOT THE PUBLIC RECORD' : 'REGISTRY OF CLAIMS',
    80,
    105,
    19,
  );
  text('FORM D-3', 885, 105, 19);
  line(132);
  text('DAY CERTIFICATE', 80, 198);
  text('dibs #' + edition(category.date), 80, 235);
  c.save();
  c.translate(800, 166);
  c.scale(200 / WORDMARK_WIDTH, 200 / WORDMARK_WIDTH);
  c.fill(new Path2D(WORDMARK_PATH));
  c.fillStyle = '#E1462B';
  c.fillRect(WORDMARK_BLOCK_X, 67, 18, 18);
  c.restore();
  text('FILE CLOSED.', 80, 365, 114, 'Archivo', 900);
  fit(category.name.toUpperCase(), 80, 422, 680, 30);
  text(category.date, 825, 422, 21);
  text(
    `${file.dibs}/3 dibs · ${file.strikes} ${file.strikes === 1 ? 'strike' : 'strikes'} · filed ${localTime(file.completedAt!).full}`,
    80,
    480,
    22,
  );
  text('ACCEPTED & REJECTED FILINGS / IN ORDER', 80, 538, 18);
  const rows = guesses(file),
    rowHeight = Math.min(105, (h - 790) / Math.max(1, rows.length));
  rows.forEach((event, i) => {
    const y = 565 + i * rowHeight;
    c.fillStyle = ink;
    c.strokeStyle = ink;
    line(y);
    text(String(i + 1).padStart(2, '0'), 80, y + 35, 18);
    const display = (event.display || '').toUpperCase();
    fit(display, 132, y + 35, event.kind === 'dibs' ? 590 : 850, Math.min(42, rowHeight * 0.32));
    if (event.kind === 'strike') {
      c.beginPath();
      c.moveTo(132, y + 25);
      c.lineTo(Math.min(980, 132 + c.measureText(display).width), y + 25);
      c.stroke();
      const held = event.house
        ? 'Held by the Registry'
        : event.holder
          ? `Taken by ${event.holder}${event.heldAt ? ' at ' + localTime(event.heldAt).full : ''}`
          : 'Holder details were not retained';
      fit(held, 132, y + 65, 850, 20, 'Plex', 400);
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
      if ((event.obscurity || 0) >= 4) text('DEEP CUT', 755, y + 82, 17);
    }
  });
  c.fillStyle = ink;
  c.strokeStyle = ink;
  const holderTop = 565 + rows.length * rowHeight + 30;
  line(holderTop);
  text('FILED UNDER', 80, holderTop + 38, 18);
  fit(
    file.handle || file.claims[0]?.handle || 'Anonymous filer',
    80,
    holderTop + 85,
    650,
    38,
    'Instrument',
    600,
  );
  text(`${file.streak || 0} DAY STREAK`, 790, holderTop + 80, 20);
  if (story && h - 100 - (holderTop + 140) > 240) {
    const y = holderTop + 210;
    c.setLineDash([6, 6]);
    line(y - 28);
    c.setLineDash([]);
    text('FILED DAILY.', 80, y + 90, 88, 'Archivo', 900);
    text('HELD BRIEFLY.', 80, y + 185, 88, 'Archivo', 900);
    text('NEXT DROP: 9 PM EASTERN', 80, y + 245, 24);
  }
  line(h - 100);
  text('ALL CLAIMS ENTIRELY CEREMONIAL.', 80, h - 66, 16);
  text(PUBLIC_HOST, 825, h - 66, 18);
  return canvasFile(canvas, `dibs-day-${category.date}-${story ? 'story' : 'feed'}.png`);
}
