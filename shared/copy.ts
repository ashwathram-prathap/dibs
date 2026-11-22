import {
  MAX_CLAIMS,
  MAX_STRIKES,
  DROP_TIME_LABEL,
  CLOSE_TIME_LABEL,
  LAUNCH_GOLDEN_PER_DAY,
  GOLDEN_PER_DAY,
} from './config';
export const GAME_EXPLANATION =
  "One category a day. Name something in it that nobody else has claimed. If you're first, it's yours, and your name goes on it for good.";
export const LIMIT_EXPLANATION = `You get ${MAX_CLAIMS} claims. Each guess someone already took costs a strike (${MAX_STRIKES} max).`;
export const GAME_DESCRIPTION = GAME_EXPLANATION + ' ' + LIMIT_EXPLANATION;
export const BACKUP_EXPLANATION =
  'Use this code to get your claims back on another device or browser.';
export const FINISH_EXPLANATION = `After ${MAX_CLAIMS} claims or ${MAX_STRIKES} strikes, you're done for the day and get your certificate.`;
export const SCHEDULE_EXPLANATION = `Each category opens at ${DROP_TIME_LABEL} ET and closes at ${CLOSE_TIME_LABEL} ET the next day.`;
export const GOLDEN_EXPLANATION = `A golden ticket is a secret answer that earns a gold stamp: ${LAUNCH_GOLDEN_PER_DAY} a day in launch week, then ${GOLDEN_PER_DAY} a day.`;
export const RESERVED_EXPLANATION =
  'Reserved means too obvious: nobody can claim it, and guessing it costs a strike.';
