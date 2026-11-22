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
