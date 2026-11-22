import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { renderDeskSound, SOUND_RATE, type DeskSound } from '../src/sound-synthesis';
const rate = SOUND_RATE;
function wav(samples: Float32Array) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.round(v * 32767), 44 + i * 2));
  return b;
}
const metrics = [];
for (const kind of ['stamp', 'gold', 'strike'] as DeskSound[]) {
  const samples = renderDeskSound(kind),
    peak = samples.reduce((m, n) => Math.max(m, Math.abs(n)), 0);
  writeFileSync(`review/round13/${kind}.wav`, wav(samples));
  const png = new PNG({ width: 1000, height: 220 });
  png.data.fill(245);
  for (let x = 0; x < 1000; x++) {
    const start = Math.floor((x / 1000) * samples.length),
      end = Math.max(start + 1, Math.floor(((x + 1) / 1000) * samples.length));
    let lo = 0,
      hi = 0;
    for (let i = start; i < end; i++) {
      lo = Math.min(lo, samples[i]);
      hi = Math.max(hi, samples[i]);
    }
    for (
      let y = Math.round(110 - (hi / 0.15) * 100);
      y <= Math.round(110 - (lo / 0.15) * 100);
      y++
    ) {
      const at = (y * 1000 + x) * 4;
      png.data[at] = 180;
      png.data[at + 1] = 50;
      png.data[at + 2] = 28;
      png.data[at + 3] = 255;
    }
  }
  writeFileSync(`review/round13/${kind}-waveform.png`, PNG.sync.write(png));
  metrics.push({
    kind,
    seconds: samples.length / rate,
    peak,
    dbFS: 20 * Math.log10(peak),
    attackMs: 6,
    releaseMs: 12,
  });
}
// Original 32-second electric-piano loop, four warm voicings, no percussion or melody.
// Render tails through the boundary so the decoded loop is continuous.
const music = new Float32Array(rate * 32);
const chords = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [41, 48, 52, 57],
  [43, 50, 53, 59],
];
for (let bar = 0; bar < 4; bar++)
  for (const beat of [0, 4.5])
    chords[bar].forEach((midi, n) => {
      const start = bar * 8 + beat + n * 0.025,
        hz = 440 * 2 ** ((midi - 69) / 12);
      for (let i = 0; i < rate * 7; i++) {
        const t = i / rate,
          env = Math.min(1, t / 0.03) * Math.exp(-t / 1.7) * Math.min(1, (7 - t) / 0.15);
        const v =
          (Math.sin(
            2 * Math.PI * hz * t + 0.22 * Math.sin(2 * Math.PI * hz * 2 * t) * Math.exp(-t / 0.7),
          ) +
            0.08 * Math.sin(2 * Math.PI * hz * 3 * t)) *
          env;
        music[(Math.round(start * rate) + i) % music.length] += v;
      }
    });
const peak = music.reduce((m, n) => Math.max(m, Math.abs(n)), 0);
for (let i = 0; i < music.length; i++) music[i] *= 0.03 / peak;
writeFileSync('.tmp/r13/waiting-room.wav', wav(music));
mkdirSync('public/audio', { recursive: true });
const ffmpeg = process.env.FFMPEG || '.tmp/r13/audio-tools/node_modules/ffmpeg-static/ffmpeg';
const r = spawnSync(
  ffmpeg,
  [
    '-y',
    '-i',
    '.tmp/r13/waiting-room.wav',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '64k',
    '-ar',
    '48000',
    'public/audio/waiting-room.mp3',
  ],
  { encoding: 'utf8' },
);
if (r.status) throw Error(r.stderr);
writeFileSync(
  'review/round13/audio-metrics.json',
  JSON.stringify({ sounds: metrics, music: { seconds: 32, peak: 0.03, original: true } }, null, 2),
);
console.log(metrics);
