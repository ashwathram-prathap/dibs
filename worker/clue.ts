import { CLUE_START_DATE, CLUE_END_DATE, goldenPerDay } from '../shared/config';
export function cluedId(ids: string[], commitment: string) {
  const sorted = [...ids].sort();
  return sorted.length ? sorted[parseInt(commitment.slice(0, 8), 16) % sorted.length] : null;
}
export function clueText(display: string, date: string, type?: string) {
  const letters = [...display].filter((c) => /\p{L}/u.test(c));
  return `One of tonight's ${goldenPerDay(date)} golden tickets: ${type ? type + ', ' : ''}${letters.length} letters, starts with ${letters[0]?.toLocaleUpperCase() || ''}.`;
}
export const clueEnabled = (category: { date: string; drop_at: string }, now = Date.now()) =>
  category.date >= CLUE_START_DATE &&
  category.date <= CLUE_END_DATE &&
  Date.parse(category.drop_at) <= now;
