import { deploymentBlocked } from '../shared/deploy-window';
const stage = process.argv.includes('--round19f')
  ? 'r19f'
  : process.argv.includes('--round9-brand')
    ? 'brand'
    : process.argv.includes('--round9-part-b')
      ? 'part-b'
      : process.argv.includes('--round9-part-a')
        ? 'part-a'
        : 'base';
if (process.argv.includes('--production') && deploymentBlocked(Date.now(), stage))
  throw Error(`Launch freeze: ${stage} production releases are paused until Nov 24 midnight ET.`);
