export const MUSIC_SECONDS = 32;
// This original 48 kHz LAME file has 576 encoder-delay samples. WebKit retains
// them (32.04 s decoded); Chromium/Firefox honor the gapless tag (32 s).
export function musicLoopBounds(decodedDuration: number) {
  const start = decodedDuration > MUSIC_SECONDS + 0.01 ? 576 / 48000 : 0;
  return { start, end: start + MUSIC_SECONDS };
}
