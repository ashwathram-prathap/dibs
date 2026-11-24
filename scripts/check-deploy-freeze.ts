import { deploymentBlocked, R19H_GO_NO_GO } from '../shared/deploy-window';
const stage = process.argv.includes('--round19i')
  ? 'r19i'
  : process.argv.includes('--round19h')
    ? 'r19h'
    : process.argv.includes('--round19g')
      ? 'r19g'
      : process.argv.includes('--round19d')
        ? 'r19d'
        : process.argv.includes('--round19f')
          ? 'r19f'
          : process.argv.includes('--round9-brand')
            ? 'brand'
            : process.argv.includes('--round9-part-b')
              ? 'part-b'
              : process.argv.includes('--round9-part-a')
                ? 'part-a'
                : 'base';
if (
  process.argv.includes('--production') &&
  stage === 'r19h' &&
  process.argv.includes('--go-no-go') &&
  Date.now() >= R19H_GO_NO_GO
)
  throw Error('R19H go/no-go passed: no production release may start at or after 4:00 PM ET.');
if (process.argv.includes('--production') && deploymentBlocked(Date.now(), stage))
  throw Error(
    stage === 'r19i'
      ? 'R19I production cutoff: nothing ships at or after Tue Nov 24, 5:00 PM ET (or 8:30–10 PM).'
      : stage === 'r19h'
        ? 'R19H production cutoff: nothing ships at or after Tue Nov 24, 5:00 PM ET (or 8:30–10 PM).'
        : stage === 'r19g'
          ? 'R19G daily deployment freeze: 8:30–10:00 PM Toronto time.'
          : stage === 'r19d'
            ? 'R19D production deadline passed: no deployment after Mon Nov 23, 7:45 PM ET.'
            : `Launch freeze: ${stage} production releases are paused until Nov 24 midnight ET.`,
  );
