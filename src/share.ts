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
  if (story) c.translate(0, 160);
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
  mono('REGISTRY OF CLAIMS', 80, 105);
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
  c.strokeStyle = '#E1462B';
  c.fillStyle = '#E1462B';
  c.lineWidth = 5;
  c.strokeRect(-166, -67, 332, 147);
  c.strokeRect(-156, -57, 312, 127);
  c.font = '900 110px Archivo, ArchivoSupplement';
  c.textAlign = 'center';
  c.fillText('DIBS', 0, 32);
  c.fillStyle = '#1A1A17';
  c.font = '400 22px Plex';
  c.fillText(claim.obscurity && claim.obscurity >= 4 ? 'DEEP CUT' : 'REGISTERED', 0, 61);
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
  const edition = Math.max(
    1,
    Math.round(
      (Date.parse(category.date + 'T12:00:00Z') - Date.parse('2026-11-24T12:00:00Z')) / 86400000,
    ) + 1,
  );
  const time = new Date(file.completedAt!).toLocaleTimeString('en-US', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Dibs #${edition} ${file.events.map((e) => (e.kind === 'dibs' ? '■' : '□')).join('')} ${file.dibs}/3 · ${file.strikes} ${file.strikes === 1 ? 'strike' : 'strikes'} · filed ${time}`;
}
export async function exportSummary(file: DayFile, category: Category, story: boolean) {
  await document.fonts.ready;
  await document.fonts.load(
    '900 100px Archivo, ArchivoSupplement',
    file.claims.map((c) => c.display).join(' '),
  );
  await Promise.all([
    document.fonts.load('400 24px Plex'),
    document.fonts.load('900 100px ArchivoSupplement'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = story ? 1920 : 1350;
  const c = canvas.getContext('2d')!,
    h = story ? 1500 : 1350;
  c.fillStyle = '#F1ECE2';
  c.fillRect(0, 0, 1080, canvas.height);
  if (story) c.translate(0, 160);
  c.fillStyle = '#1A1A17';
  c.strokeStyle = '#1A1A17';
  c.lineWidth = 3;
  c.strokeRect(40, 40, 1000, h - 80);
  const mono = (s: string, y: number, size = 24) => {
    c.font = `400 ${size}px Plex`;
    c.fillText(s, 80, y);
  };
  mono('DIBS / REGISTRY OF CLAIMS — FORM D-3', 110);
  mono(category.date + ' / ' + category.name.toUpperCase(), 190);
  c.font = '900 120px Archivo';
  c.fillText('FILE CLOSED.', 80, 350);
  c.font = '900 90px Archivo';
  c.fillText(`${file.dibs} / 3 DIBS`, 80, 480);
  mono(`${file.strikes} / 5 STRIKES`, 560);
  for (let i = 0; i < 5; i++) {
    c.strokeRect(80 + i * 72, 590, 48, 48);
    if (i < file.strikes) c.fillRect(84 + i * 72, 594, 40, 40);
  }
  let y = story ? 850 : 745;
  for (let i = 0; i < 3; i++) {
    const label = file.claims[i]?.display.toUpperCase() || '— UNCLAIMED';
    const fitted = fitText(
      label,
      (t, size) => {
        c.font = `900 ${size}px Archivo, ArchivoSupplement`;
        return c.measureText(t).width;
      },
      850,
      { startSize: 54, minSize: 18, maxLines: 2, maxHeight: 95, lineHeight: 1 },
    );
    c.beginPath();
    c.moveTo(80, y - 60);
    c.lineTo(1000, y - 60);
    c.stroke();
    c.font = `900 ${fitted.size}px Archivo, ArchivoSupplement`;
    for (const [j, line] of fitted.lines.entries()) c.fillText(line, 80, y + j * fitted.size);
    y += 120;
  }
  mono(
    'FILED ' +
      new Date(file.completedAt!).toLocaleTimeString('en-US', {
        timeZone: 'America/Toronto',
        hour: 'numeric',
        minute: '2-digit',
      }) +
      ' / TORONTO',
    h - 150,
  );
  mono('NEXT DROP / 9 PM TORONTO', h - 105, 22);
  mono(PUBLIC_HOST, h - 65, 20);
  return canvasFile(canvas, `dibs-day-${category.date}-${story ? 'story' : 'feed'}.png`);
}
