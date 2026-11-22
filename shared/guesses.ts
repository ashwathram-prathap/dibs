import type { DayFile, Guess } from '../src/types';
// Older files have scores but no retained miss text. Never invent a rejected answer.
export function guesses(file: DayFile): Guess[] {
  let win = 0;
  return file.events.map((event) => {
    if (event.kind === 'strike') return { ...event, display: event.display || 'Unrecorded entry' };
    const claim = file.claims[win++];
    return {
      display: claim?.display || 'Record withheld',
      claimId: claim?.id,
      obscurity: claim?.obscurity,
      ...event,
    };
  });
}
