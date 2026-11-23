// Canonical public address for printed copies, previews and shared links.
declare const DIBS_PUBLIC_ORIGIN: string | undefined;
export const PUBLIC_ORIGIN =
  typeof DIBS_PUBLIC_ORIGIN === 'string' ? DIBS_PUBLIC_ORIGIN : 'https://dibs.here';
export const PUBLIC_HOST = new URL(PUBLIC_ORIGIN).host;
export const certificateUrl = (id: string) =>
  `${PUBLIC_ORIGIN}/certificate/${encodeURIComponent(id)}`;

// Set through scripts/configure-drop.ts; DROP_TIME.txt may override the default.
export const DROP_TIME_LOCAL = '21:00';
export const DROP_TIME_ZONE = 'America/Toronto';
export const LAUNCH_DATE = '2026-11-23';
export const DROP_TIME_LABEL = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
}).format(new Date('2000-01-01T' + DROP_TIME_LOCAL + ':00Z'));

// Beta dates are registry dates; schedule and commitment format stay unchanged.
export const GOLDEN_PER_DAY = 3;
export const goldenPerDay = (date: string) =>
  date >= '2026-11-23' && date <= '2026-11-29' ? LAUNCH_GOLDEN_PER_DAY : GOLDEN_PER_DAY;

// Game limits and copy use the same values as the API.
export const MAX_CLAIMS = 3;
export const MAX_STRIKES = 5;
export const RESERVED_COUNT = 10;
export const CLOSE_TIME_LOCAL = DROP_TIME_LOCAL; // The following day's drop.
export const CLOSE_TIME_LABEL = DROP_TIME_LABEL;
export const LAUNCH_GOLDEN_PER_DAY = 10;

// Inclusive drop dates; extend these without changing clue logic.
export const CLUE_START_DATE = '2026-11-23';
export const CLUE_END_DATE = '2026-11-29';
