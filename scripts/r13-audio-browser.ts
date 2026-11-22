import { musicLoopBounds } from '../src/music-loop';
import { chromium, webkit } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const results = [];
for (const engine of [chromium, webkit]) {
  const b = await engine.launch();
  try {
    const p = await b.newPage();
    await p.goto('http://127.0.0.1:5175/?r7-closed');
    const music = await p.evaluate(async () => {
      const context = new OfflineAudioContext(1, 48000, 48000);
      const buffer = await context.decodeAudioData(
        await (await fetch('/audio/waiting-room.mp3')).arrayBuffer(),
      );
      const data = buffer.getChannelData(0);
      let peak = 0,
        square = 0;
      for (const n of data) {
        peak = Math.max(peak, Math.abs(n));
        square += n * n;
      }
      return {
        duration: buffer.duration,
        frames: data.length,
        sampleRate: buffer.sampleRate,
        peak,
        rms: Math.sqrt(square / data.length),
        boundaryJump: Math.abs(
          data[buffer.duration > 32.01 ? 576 : 0] -
            data[(buffer.duration > 32.01 ? 576 : 0) + 32 * buffer.sampleRate - 1],
        ),
      };
    });
    console.log(engine.name(), music);
    assert.equal(musicLoopBounds(music.duration).end - musicLoopBounds(music.duration).start, 32);
    assert.ok(music.peak <= 0.032);
    assert.ok(music.boundaryJump < 0.002);
    results.push({ engine: engine.name(), music, passed: true });
  } finally {
    await b.close();
    writeFileSync('review/round13/decoded-audio.json', JSON.stringify(results, null, 2));
  }
}
console.log(results);
