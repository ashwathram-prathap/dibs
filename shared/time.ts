import { DROP_TIME_ZONE, LAUNCH_DATE } from './config';
export function viewerZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return DROP_TIME_ZONE;
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format();
    return zone;
  } catch {
    return DROP_TIME_ZONE;
  }
}
export function localTime(at: string, zone = viewerZone(), day = false) {
  const date = new Date(at);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(day ? { weekday: 'short' as const } : {}),
  })
    .format(date)
    .replace(',', '');
  const short =
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value || 'ET';
  const zoneLabel =
    zone === DROP_TIME_ZONE || zone === 'America/New_York'
      ? 'ET'
      : zone === 'America/Vancouver' || zone === 'America/Los_Angeles'
        ? 'PT'
        : short.replace(/^GMT[+-]0$/, 'GMT');
  return { label, zone: zoneLabel, full: `${label} ${zoneLabel}` };
}
export function dropTime(at: string, zone = viewerZone()) {
  const date = (z: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: z,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(at));
  return localTime(at, zone, date(zone) !== date(DROP_TIME_ZONE));
}
export const edition = (date: string) =>
  Math.max(
    1,
    Math.round(
      (Date.parse(date + 'T12:00:00Z') - Date.parse(LAUNCH_DATE + 'T12:00:00Z')) / 86400000,
    ) + 1,
  );
export const countdown = (target: string, now: number) => {
  const seconds = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
};
