import {
  MAX_CLAIMS,
  RESERVED_COUNT,
  MAX_STRIKES,
  DROP_TIME_LABEL,
  CLOSE_TIME_LABEL,
  LAUNCH_GOLDEN_PER_DAY,
  GOLDEN_PER_DAY,
} from './config';
export const GAME_EXPLANATION =
  "One category a day. Name something in it that nobody else has claimed. If you're first, it's yours, and your name goes on it for good.";
export const SCORING_EXPLANATION =
  'Rarer answers score more. Taken or reserved answers cost a strike. Typos and answers not on the list never do.';
export const RARITY_EXPLANATION =
  "Rarity uses English Wikipedia readership. Answers without data get the category's standard score.";
export const LAUNCH_EXPLANATION =
  'One category a day. Name something nobody else has claimed. Your name stays on it.';
export const SHARE_INVITATION = `One category. ${MAX_CLAIMS} claims a night. What can you claim? dibs.here`;
export const LIMIT_EXPLANATION = `${MAX_CLAIMS} claims a night. ${MAX_STRIKES} strikes and you're out. ${SCORING_EXPLANATION}`;
/** How it works opens with the nightly allowance; many players assumed one round. */
export const NIGHTLY_CLAIMS = `You get ${MAX_CLAIMS} claims every night.`;
/** R19I: a repeat of an already-struck answer is free (server-enforced per answer_id). */
export const REPEAT_GUESS_EXPLANATION =
  'Guessing the same taken answer twice never costs a second strike.';
export const GAME_DESCRIPTION = GAME_EXPLANATION + ' ' + LIMIT_EXPLANATION;
export const BACKUP_EXPLANATION =
  'Use this code to get your claims back on another device or browser.';
export const FINISH_EXPLANATION = `After ${MAX_CLAIMS} claims or ${MAX_STRIKES} strikes, you're done for the day and get your certificate.`;
export const SCHEDULE_EXPLANATION = `Each category opens at ${DROP_TIME_LABEL} ET and closes at ${CLOSE_TIME_LABEL} ET the next day.`;
export const GOLDEN_EXPLANATION = `A golden ticket is a secret answer that earns a gold stamp: ${LAUNCH_GOLDEN_PER_DAY} a day in launch week, then ${GOLDEN_PER_DAY} a day.`;
export const RESERVED_EXPLANATION = `Each day the house holds the ${RESERVED_COUNT} best-known answers. Guessing one costs a strike.`;
