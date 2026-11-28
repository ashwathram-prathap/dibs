import { rarityTier, tierRank, tierCopy } from '../shared/flow-rules';
import { claimScore } from '../shared/claim-copy';
import { SHARE_INVITATION } from '../shared/copy';
import { editionLabel } from '../shared/sharing';
type ExportFont = 'Archivo' | '"Instrument Sans"';
import { cleanHandle, cleanStoredHandles } from '../shared/handles';
import { noOrphan, countLabel } from '../shared/text';
import { bellPath, bellArea, bellSigma, bellY, bellX, rarityLabel } from '../shared/rarity';
import { MAX_CLAIMS } from '../shared/config';
import { REGISTRAR_STROKE } from '../shared/moments';
import { edition, localTime, zoneName, filingTime, viewerZone } from '../shared/time';
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
import { fitText, fitLine } from '../shared/typography';
// Canvas avoids Safari's SVG foreignObject restrictions. Font faces are self-hosted.
function offStamp(c: CanvasRenderingContext2D, x: number, y: number, size = 24) {
  c.save();
  c.translate(x, y);
  c.rotate((-3 * Math.PI) / 180);
  c.strokeStyle = c.fillStyle = '#B93420';
  c.lineWidth = 2;
  c.font = `900 ${size}px Archivo`;
  c.textAlign = 'left';
  const width = c.measureText('OFF THE REGISTER').width;
  c.strokeRect(-5, -size, width + 10, size + 10);
  c.fillText('OFF THE REGISTER', 0, 0);
  c.restore();
}
export async function exportCertificate(claim: Claim, story: boolean, hideAnswers = false) {
  claim = cleanStoredHandles(claim);
  if (hideAnswers || claim.concealed) claim = { ...claim, display: 'SEALED' };
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
  const h = 1350;
  await paintPaper(c, paper);
  if (story) c.translate(0, (canvas.height - h) / 2);
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
  c.fillStyle = claim.golden ? (dark ? '#e7c86b' : '#795700') : ink;
  fitCanvasLine(c, claim.golden ? 'Form D-1 · Golden ticket' : 'Form D-1', 640, 105, 360, 24);
  if (claim.golden) {
    c.strokeStyle = c.fillStyle;
    c.strokeRect(42, 42, 996, h - 84);
    c.strokeStyle = ink;
  }
  c.fillStyle = ink;
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
  if (!claim.concealed && rarityTier(claim.percentile, claim.pool) === 'Off the register')
    offStamp(c, 400, y + 45, 22);
  const holder = y + 120;
  formText(c, 'label', 'Held by', 80, holder);
  c.font = '600 42px "Instrument Sans"';
  if (claim.founder) c.fillStyle = dark ? '#e7c86b' : '#795700';
  c.fillText(cleanHandle(claim.handle), 80, holder + 60);
  if (claim.founder) text('Founder', 80, holder + 90, 18);
  c.fillStyle = ink;
  c.font = '400 26px "Instrument Sans"';
  c.save();
  c.translate(790, h - 500);
  c.scale(0.9, 0.9);
  c.lineWidth = 1.4;
  c.stroke(new Path2D(REGISTRAR_STROKE));
  c.restore();
  text('The Registrar', 790, h - 440, 18);
  fitCanvasLine(
    c,
    `${claim.points ?? 0} points${claim.bonus ? ` · ${(claim.points ?? 0) - claim.bonus} + ${claim.bonus} golden bonus` : ''}`,
    80,
    h - 350,
    920,
    30,
  );
  if (!claim.concealed)
    fitCanvasLine(
      c,
      claim.percentile == null
        ? 'Standard score (no readership data for this answer)'
        : tierCopy(claim) ||
            rarityLabel(claim.percentile, claim.category_slug || claim.category_name),
      80,
      h - 392,
      920,
      27,
    );
  if (!claim.concealed && claim.percentile != null)
    await drawCurve(c, claim.percentile, 80, h - 310, 400, 105, !!claim.golden);
  c.save();
  c.translate(780, h - 265);
  c.rotate(((((claim.claim_no * 7.31) % 7) - 4) * Math.PI) / 180);
  c.strokeStyle = claim.golden ? (dark ? '#e7c86b' : '#795700') : '#E1462B';
  c.fillStyle = claim.golden ? (dark ? '#e7c86b' : '#795700') : '#E1462B';
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
      : claim.percentile != null && claim.obscurity && claim.obscurity >= 4
        ? 'Deep cut'
        : 'Registered',
    0,
    61,
  );
  c.restore();
  line(h - 120);
  text(`One of ${claim.total_registrable.toLocaleString()}. Only one yours.`, 80, h - 80, 17);
  fitCanvasLine(c, `${PUBLIC_HOST}/c/${claim.id}`, 80, h - 52, 920, 17);
  fitCanvasLine(c, SHARE_INVITATION, 80, h - 148, 920, 23);
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
  const accent = golden
      ? document.documentElement.dataset.theme === 'dark'
        ? '#e7c86b'
        : '#795700'
      : '#E1462B',
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
  c.fillText('You', Math.max(x + 14, Math.min(x + w - 14, marker)), y - 4);
  c.textAlign = 'left';
  formText(c, 'label', 'Familiar', x + (w * 28) / 520, y + h, 10);
  c.textAlign = 'right';
  formText(c, 'label', 'Obscure', x + (w * 492) / 520, y + h, 10);
  c.restore();
}

export function summaryText(file: DayFile, category: Category, hideAnswers = false) {
  const answers = hideAnswers ? [] : (file.claims || []).filter((c) => !c.concealed && c.display);
  const best = answers
    .map((c) => rarityTier(c.percentile, c.pool))
    .filter((t) => tierRank(t) >= 0)
    .sort((a, b) => tierRank(b) - tierRank(a))[0];
  return `${editionLabel(category.date)} · ${category.name}${file.title ? ' · ' + file.title.name + (file.title.provisional ? ' so far' : '') : ''}${best ? ' · ' + best : ''}${answers.length ? ' · ' + answers.map((c) => `${c.display} (${claimScore(c)})`).join(', ') : ''} · ${file.points ?? 0} pts${file.rank ? ` · #${file.rank} of ${file.players} players today` : ''}. ${PUBLIC_HOST}`;
}
export async function exportSummary(
  file: DayFile,
  category: Category,
  story: boolean,
  hideAnswers = false,
  zone = viewerZone(),
) {
  file = cleanStoredHandles(file);
  const dark = document.documentElement.dataset.theme === 'dark';
  const ink = dark ? '#F1ECE2' : '#1A1A17',
    paper = dark ? '#1F1E18' : '#F1ECE2';
  const gold = dark ? '#e7c86b' : '#795700',
    red = '#E1462B';
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load('900 100px Archivo'),
    document.fonts.load('400 24px "IBM Plex Mono"'),
    document.fonts.load('600 42px "Instrument Sans"'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = story ? 1920 : 1350;
  const c = canvas.getContext('2d')!;
  const h = Math.min(1350, 900 + file.events.length * 76);
  await paintPaper(c, paper);
  c.translate(0, (canvas.height - h) / 2);
  const golden = file.claims.some((c) => c.golden);
  c.strokeStyle = golden ? gold : ink;
  c.lineWidth = 2;
  c.strokeRect(36, 36, 1008, h - 72);
  const line = (y: number) => {
    c.beginPath();
    c.moveTo(80, y);
    c.lineTo(1000, y);
    c.stroke();
  };
  c.fillStyle = ink;
  fitCanvasLine(c, 'Day certificate · ' + editionLabel(category.date), 80, 105, 920, 26);
  line(135);
  c.save();
  c.translate(800, 175);
  c.scale(200 / WORDMARK_WIDTH, 200 / WORDMARK_WIDTH);
  c.translate(WORDMARK_OFFSET_X, WORDMARK_OFFSET_Y);
  c.fill(new Path2D(WORDMARK_PATH));
  c.fillStyle = red;
  c.fillRect(WORDMARK_BLOCK_X, 67, 18, 18);
  c.restore();
  fitCanvasLine(c, category.name.toUpperCase(), 80, 265, 690, 105, 'Archivo', 900);
  fitCanvasLine(c, `${file.points ?? 0} points`, 80, 350, 920, 66, 'Archivo', 900);
  fitCanvasLine(
    c,
    file.rank ? `#${file.rank} of ${file.players} players today` : 'Your day on file',
    80,
    395,
    920,
    30,
  );
  const at = file.completedAt || file.claims.at(-1)?.created_at;
  const filed = at ? ` · filed ${filingTime(at, zone)}` : '';
  fitCanvasLine(
    c,
    `${file.dibs}/${MAX_CLAIMS} claims · ${file.strikes} ${file.strikes === 1 ? 'strike' : 'strikes'}${filed}`,
    80,
    440,
    920,
    24,
  );
  c.fillStyle = golden ? gold : ink;
  fitCanvasLine(
    c,
    file.title
      ? file.title.name + (file.title.provisional ? ' · so far' : '')
      : golden
        ? 'Golden ticket found'
        : 'File closed.',
    80,
    485,
    920,
    26,
  );
  const rows = guesses(file),
    rowHeight = Math.min(76, (h - 840) / Math.max(1, rows.length));
  rows.forEach((event, i) => {
    const y = 515 + i * rowHeight;
    const claim = file.claims.find((c) => c.id === event.claimId);
    const isGold = !!claim?.golden;
    c.strokeStyle = isGold ? gold : ink;
    line(y);
    c.fillStyle = ink;
    formText(c, 'number', String(i + 1).padStart(2, '0'), 80, y + 31, 22);
    c.fillStyle = isGold ? gold : red;
    if (event.kind === 'dibs') c.fillRect(130, y + 13, 20, 20);
    else {
      c.strokeStyle = ink;
      c.lineWidth = 2;
      c.strokeRect(130, y + 13, 20, 20);
    }
    const answer = !hideAnswers && claim && !claim.concealed ? claim.display : 'Claim';
    c.fillStyle = isGold ? gold : ink;
    fitCanvasLine(
      c,
      event.kind === 'strike'
        ? 'Strike · −10 points'
        : `${answer}${claim ? ` · ${claim.points ?? 0} points` : ''}${isGold ? ` · Golden ticket · +${claim?.bonus ?? 100}` : ''}`,
      175,
      y + 31,
      825,
      29,
      '"Instrument Sans"',
      600,
    );
    if (
      !hideAnswers &&
      claim &&
      !claim.concealed &&
      rarityTier(claim.percentile, claim.pool) === 'Off the register'
    )
      offStamp(c, 690, y + 31, 19);
    if (claim && !claim.concealed)
      fitCanvasLine(
        c,
        (claim.bonus
          ? `${(claim.points ?? 0) - claim.bonus} + ${claim.bonus} golden bonus · `
          : '') +
          (claim.percentile == null
            ? 'Standard score (no readership data for this answer)'
            : tierCopy(claim) ||
              rarityLabel(claim.percentile, claim.category_slug || claim.category_name)),
        175,
        y + 60,
        825,
        22,
      );
  });
  const holderTop = 515 + rows.length * rowHeight + 25;
  c.strokeStyle = ink;
  c.fillStyle = ink;
  line(holderTop);
  formText(c, 'label', 'Filed under', 80, holderTop + 35, 22);
  fitCanvasLine(
    c,
    file.handle || file.claims[0]?.handle || 'Anonymous filer',
    80,
    holderTop + 82,
    660,
    38,
    '"Instrument Sans"',
    600,
  );
  c.save();
  c.translate(780, holderTop + 35);
  c.lineWidth = 1.4;
  c.stroke(new Path2D(REGISTRAR_STROKE));
  c.restore();
  fitCanvasLine(c, SHARE_INVITATION, 80, h - 135, 920, 25);
  line(h - 110);
  fitCanvasLine(c, `${PUBLIC_HOST}/summary/${file.summaryId}`, 80, h - 77, 920, 19);
  fitCanvasLine(c, 'All claims entirely ceremonial.', 80, h - 50, 920, 16);
  return canvasFile(canvas, `dibs-day-${category.date}-${story ? 'story' : 'feed'}.jpg`);
}

// Measure the rendered glyph bounds, shrink to a readable minimum, then elide the middle.
function fitCanvasLine(
  c: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  start = 24,
  face: ExportFont = '"Instrument Sans"',
  weight = 400,
) {
  const fitted = fitLine(
    value,
    (text, size) => {
      c.font = `${weight} ${size}px ${face}`;
      const m = c.measureText(text);
      return Math.max(m.width, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
    },
    width,
    start,
  );
  c.font = `${weight} ${fitted.size}px ${face}`;
  c.fillText(fitted.text, x + Math.max(0, c.measureText(fitted.text).actualBoundingBoxLeft), y);
}

function formText(
  c: CanvasRenderingContext2D,
  role: 'number' | 'label' | 'date',
  value: string,
  x: number,
  y: number,
  size = 24,
) {
  if (role === 'label' && value.trim().split(/\s+/).length > 3)
    throw Error('Form labels must be short');
  c.font = `400 ${size}px "IBM Plex Mono"`;
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

export function certificateText(
  claim: Claim,
  score?: Pick<DayFile, 'points' | 'rank' | 'players'>,
  hideAnswers = false,
) {
  const result =
    !hideAnswers && !claim.concealed
      ? `${claim.display} · ${claimScore(claim)}`
      : `${claim.points ?? 0} points`;
  return `${editionLabel(claim.category_date)} · ${claim.category_name} · ${result}${score?.rank ? ` · #${score.rank} of ${score.players} players today` : ''}. ${PUBLIC_HOST}`;
}
