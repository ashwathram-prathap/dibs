import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { renderDeskSound, SOUND_RATE } from '../src/sound-synthesis';
const ffmpeg = 'node_modules/ffmpeg-static/ffmpeg';
const filter =
  'highpass=f=150,equalizer=f=3000:t=q:w=0.8:g=4,volume=28dB,acompressor=threshold=0.12:ratio=3:attack=5:release=160';
function run(args: string[]) {
  return execFileSync(ffmpeg, ['-hide_banner', '-y', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function measure(path: string) {
  try {
    execFileSync(
      ffmpeg,
      [
        '-hide_banner',
        '-i',
        path,
        '-af',
        'loudnorm=I=-16:TP=-1:LRA=7:print_format=json',
        '-f',
        'null',
        '-',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch {}
  const child = requireMeasure(path);
  return JSON.parse(child.slice(child.lastIndexOf('{')));
}
import { spawnSync } from 'node:child_process';
function requireMeasure(path: string) {
  const r = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-i',
      path,
      '-af',
      'loudnorm=I=-16:TP=-1:LRA=7:print_format=json',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );
  if (r.status) throw Error(r.stderr);
  return r.stderr;
}
run([
  '-i',
  'public/audio/waiting-room.mp3',
  '-af',
  filter,
  '-ar',
  '48000',
  '.tmp/music-conditioned.wav',
]);
const stats = measure('.tmp/music-conditioned.wav');
const normal = `loudnorm=I=-16:TP=-1.5:LRA=7:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
run(['-i', '.tmp/music-conditioned.wav', '-af', normal, '-ar', '48000', '.tmp/music-master.wav']);
run([
  '-i',
  '.tmp/music-master.wav',
  '-c:a',
  'libopus',
  '-b:a',
  '64k',
  'public/audio/waiting-room.v2.webm',
]);
run([
  '-i',
  '.tmp/music-master.wav',
  '-c:a',
  'aac',
  '-b:a',
  '64k',
  '-movflags',
  '+faststart',
  'public/audio/waiting-room.v2.m4a',
]);
const output: any = {};
for (const ext of ['webm', 'm4a']) {
  const path = `public/audio/waiting-room.v2.${ext}`;
  output[ext] = { bytes: readFileSync(path).length, ...measure(path) };
}
for (const kind of ['stamp', 'gold', 'strike'] as const) {
  const pcm = renderDeskSound(kind);
  writeFileSync(`.tmp/${kind}.f32`, Buffer.from(pcm.buffer));
  // Repeat isolated transients with a fixed 400ms period for a reproducible loudness measurement.
  run([
    '-f',
    'f32le',
    '-ar',
    String(SOUND_RATE),
    '-ac',
    '1',
    '-i',
    `.tmp/${kind}.f32`,
    '-af',
    'apad=whole_dur=0.6,aloop=loop=20:size=28800',
    '-t',
    '10',
    `review/round15/${kind}.wav`,
  ]);
  output[kind] = measure(`review/round15/${kind}.wav`);
}
writeFileSync('review/round15/audio-loudness.json', JSON.stringify(output, null, 2));
console.log(output);
