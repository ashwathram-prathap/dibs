import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { renderDeskSound, SOUND_RATE } from '../src/sound-synthesis';
import { POOL_VERSION } from '../shared/flow-rules';
const pool = {
  version: POOL_VERSION,
  catalogVersion: '10210a86838c8eca',
  scoringVersion: 'r19e-pool-v1',
  poolSize: 3002,
  membership: 'out',
};
const claim = { id: 'fixture', points: 110, bonus: 0, percentile: 1, golden: false };
const bytes = (v: any) => Buffer.byteLength(JSON.stringify(v));
const audio = ['stamp', 'gold', 'strike', 'off'].map((kind) => {
  const start = performance.now();
  const s = renderDeskSound(kind as any);
  return {
    kind,
    generationMs: performance.now() - start,
    seconds: s.length / SOUND_RATE,
    peak: Math.max(...s.map(Math.abs)),
    rms: Math.sqrt(s.reduce((n, v) => n + v * v, 0) / s.length),
    sampleBytes: s.byteLength,
  };
});
writeFileSync(
  'review/r21-flow/payload-cost.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope: 'Local serialization/audio measurement; not hosted billing or heap profiling',
      additionalPerClaimBytes: bytes({ ...claim, pool, offRegisterOrdinal: 1000 }) - bytes(claim),
      additionalThreeClaimSnapshotBytes:
        3 * (bytes({ ...claim, pool, offRegisterOrdinal: 1000 }) - bytes(claim)),
      additionalPerGuessWrites: 0,
      additionalPerGuessAssetRequests: 0,
      poolFetches:
        'One retained pool asset per cold active category; existing score fetch unchanged',
      publicBoardBytes:
        'No new live public row metadata for concealed claims. Own/final offRegister boolean is 19 bytes when present; aggregate offRegisterPlayers count is one day field.',
      audio,
      limitations:
        'No hosted load: missing account-wide positive DO-duration headroom. Frame/heap and physical device measurements remain unverified.',
    },
    null,
    2,
  ),
);
