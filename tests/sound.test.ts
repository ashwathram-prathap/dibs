import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  claimSound,
  renderDeskSound,
  SOUND_RATE,
  SOUND_LENGTH,
  SOUND_PEAK,
} from '../src/sound-synthesis';
describe('one desk: only three direct claim outcomes', () => {
  it('maps ordinary/gold wins and counted taken/reserved strikes', () => {
    expect(claimSound(201, { claim: {} })).toBe('stamp');
    expect(claimSound(201, { claim: { golden: 1 } })).toBe('gold');
    for (let strikes = 1; strikes < 5; strikes++) {
      expect(claimSound(409, { file: { strikes } })).toBe('strike');
      expect(claimSound(409, { me: { file: { strikes } } })).toBe('strike');
    }
  });
  it('keeps all nonclaim events, invalid, typo, free reply, limits and replays silent', () => {
    for (const status of [0, 200, 400, 401, 403, 404, 422, 429, 500, 503])
      expect(claimSound(status, {})).toBeNull();
    for (const strikes of [0, 5, 6]) expect(claimSound(409, { file: { strikes } })).toBeNull();
    expect(claimSound(409, {})).toBeNull();
    expect(claimSound(0, undefined)).toBeNull();
    expect(claimSound(403, { file: { strikes: 2 } })).toBeNull();
    expect(claimSound(201, {})).toBeNull();
    expect(claimSound(201, { claim: { golden: true }, replayed: true })).toBeNull();
    expect(claimSound(409, { file: { strikes: 1 }, replayed: true })).toBeNull();
  });
  it('renders bounded, deterministic, attack/release-smoothed waveforms', () => {
    for (const kind of ['stamp', 'strike', 'gold'] as const) {
      const s = renderDeskSound(kind),
        max = s.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
      expect(s.length / SOUND_RATE).toBe(SOUND_LENGTH[kind]);
      expect(max).toBeCloseTo(SOUND_PEAK[kind], 6);
      expect(s[0]).toBe(0);
      expect(Math.abs(s[s.length - 1])).toBeLessThan(0.00001);
      expect(s).toEqual(renderDeskSound(kind));
      expect(s.every(Number.isFinite)).toBe(true);
    }
    const gold = renderDeskSound('gold');
    const ping = gold.slice(Math.ceil(0.15 * SOUND_RATE));
    expect(ping.reduce((m, x) => Math.max(m, Math.abs(x)), 0)).toBeLessThanOrEqual(SOUND_PEAK.stamp * 0.4 + .00001);
    expect(gold.slice(0, 0.12 * SOUND_RATE)).toEqual(
      renderDeskSound('stamp').slice(0, 0.12 * SOUND_RATE),
    );
  });
});
describe('playback authorization and deduplication', () => {
  let starts: number, stored: string | null, ended: (() => void) | undefined;
  beforeEach(() => {
    vi.resetModules();
    starts = 0;
    stored = null;
    ended = undefined;
    vi.stubGlobal('localStorage', { getItem: () => stored });
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal('CustomEvent', class {});
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        destination = {};
        createBuffer() {
          return { copyToChannel() {}, duration: 0.145 };
        }
        createBufferSource() {
          return {
            connect() {},
            disconnect() {},
            set onended(fn: () => void) {
              ended = fn;
            },
            start() {
              starts++;
            },
          };
        }
      },
    );
  });
  it('requires a prepared context, ignores overlap and replays, remembers mute', async () => {
    const { playClaimSound, prepareSound } = await import('../src/sound');
    playClaimSound('stamp', 'before');
    expect(starts).toBe(0);
    await prepareSound();
    playClaimSound(null, 'silent');
    expect(starts).toBe(0);
    playClaimSound('stamp', 'a');
    playClaimSound('stamp', 'a');
    playClaimSound('gold', 'b');
    expect(starts).toBe(1);
    ended?.();
    playClaimSound('stamp', 'a');
    expect(starts).toBe(1);
    playClaimSound('strike', 'c');
    expect(starts).toBe(2);
    ended?.();
    stored = 'off';
    playClaimSound('stamp', 'd');
    expect(starts).toBe(2);
  });
});

it('audio device failures never interrupt claim handling', async () => {
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      createBuffer() {
        throw Error('Audio device unavailable');
      }
    },
  );
  const { prepareSound, playClaimSound } = await import('../src/sound');
  await prepareSound();
  expect(() => playClaimSound('stamp', 'successful-claim')).not.toThrow();
});

it('mute still works for the session when browser storage is blocked', async () => {
  vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem() {
      throw Error('Storage blocked');
    },
    setItem() {
      throw Error('Storage blocked');
    },
  });
  const { soundEnabled, setSoundEnabled } = await import('../src/sound');
  expect(soundEnabled()).toBe(true);
  setSoundEnabled(false);
  expect(soundEnabled()).toBe(false);
  setSoundEnabled(true);
  expect(soundEnabled()).toBe(true);
});

it('keeps a fast claim sound until its gesture-started audio context has resumed', async () => {
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class {});
  let ready!: () => void,
    starts = 0;
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'suspended';
      destination = {};
      resume() {
        return new Promise<void>((resolve) => {
          ready = () => {
            this.state = 'running';
            resolve();
          };
        });
      }
      createBuffer() {
        return { copyToChannel() {}, duration: 0.145 };
      }
      createBufferSource() {
        return {
          connect() {},
          disconnect() {},
          start() {
            starts++;
          },
        };
      }
    },
  );
  const { prepareSound, playClaimSound } = await import('../src/sound');
  const preparing = prepareSound();
  playClaimSound('stamp', 'fast-claim');
  playClaimSound('stamp', 'fast-claim');
  expect(starts).toBe(0);
  ready();
  await preparing;
  await Promise.resolve();
  expect(starts).toBe(1);
});
