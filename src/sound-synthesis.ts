import { rarityTier, type PoolEvidence } from '../shared/flow-rules';
import { MAX_STRIKES } from '../shared/config';
export type DeskSound = 'stamp' | 'gold' | 'strike' | 'off';
export const SOUND_RATE = 48000;
export const SOUND_LENGTH = { stamp: 0.145, gold: 0.48, off: 0.5, strike: 0.115 } as const;
export const SOUND_PEAK = { stamp: 0.7, gold: 0.7, off: 0.7, strike: 0.5 } as const;

// Only the response to an intentional claim can select a sound. A closing strike is silent.
export function claimSound(
  status: number,
  data: {
    replayed?: boolean;
    claim?: { golden?: boolean | number; percentile?: number | null; pool?: PoolEvidence };
    file?: { strikes?: number };
    me?: { file?: { strikes?: number } | null };
  } = {},
): DeskSound | null {
  if (data.replayed) return null;
  if (status === 201 && data.claim)
    return data.claim.golden
      ? 'gold'
      : rarityTier(data.claim.percentile, data.claim.pool) === 'Off the register'
        ? 'off'
        : 'stamp';
  const strikes = data.me?.file?.strikes ?? data.file?.strikes;
  if (status === 409 && typeof strikes === 'number' && strikes > 0 && strikes < MAX_STRIKES)
    return 'strike';
  return null;
}
function envelope(t: number, length: number, decay: number) {
  if (t < 0 || t >= length) return 0;
  return Math.min(1, t / 0.006) * Math.min(1, (length - t) / 0.012) * Math.exp(-t / decay);
}
function normalize(samples: Float32Array, peak: number) {
  const max = samples.reduce((m, n) => Math.max(m, Math.abs(n)), 0);
  for (let i = 0; i < samples.length; i++) samples[i] *= peak / max;
}
// Deterministic PCM avoids browser-specific oscillator/filter gain differences.
// The body is a damped 240 Hz desk resonance; two low-pass stages soften the paper.
export function renderDeskSound(kind: DeskSound, rate = SOUND_RATE): Float32Array<ArrayBuffer> {
  const dull = kind === 'strike';
  const length = dull ? SOUND_LENGTH.strike : SOUND_LENGTH.stamp;
  const out = new Float32Array(Math.round(SOUND_LENGTH[kind] * rate));
  let seed = 73129,
    lp1 = 0,
    lp2 = 0;
  const alpha = 1 - Math.exp((-2 * Math.PI * (dull ? 280 : 1100)) / rate);
  for (let i = 0; i < Math.round(length * rate); i++) {
    const t = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    lp1 += alpha * (seed / 2147483648 - 1 - lp1);
    lp2 += alpha * (lp1 - lp2);
    const body = Math.sin(2 * Math.PI * (dull ? 190 : 240) * t) * envelope(t, length, 0.026);
    const paper = lp2 * envelope(t, dull ? length : 0.052, dull ? 0.024 : 0.014);
    out[i] = body * 0.75 + paper * (dull ? 0.5 : 3.5);
  }
  normalize(out, SOUND_PEAK[kind]);
  if (kind === 'gold' || kind === 'off') {
    const ping = new Float32Array(Math.round(0.36 * rate));
    for (let i = 0; i < ping.length; i++) {
      const t = i / rate;
      ping[i] =
        (Math.sin(2 * Math.PI * (kind === 'off' ? 330 : 784) * t) +
          0.16 * Math.sin(2 * Math.PI * (kind === 'off' ? 659 : 1573) * t)) *
        envelope(t, 0.36, 0.085);
    }
    normalize(ping, SOUND_PEAK.stamp * 0.4);
    for (let i = 0; i < ping.length; i++) out[i + Math.round(0.12 * rate)] += ping[i];
  }
  out[out.length - 1] = 0;
  return out;
}
