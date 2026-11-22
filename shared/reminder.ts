import { DROP_TIME_ZONE, PUBLIC_ORIGIN } from './config';
const compact = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
function localStamp(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DROP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return (
    ['year', 'month', 'day'].map((k) => parts.find((p) => p.type === k)!.value).join('') +
    'T' +
    ['hour', 'minute', 'second'].map((k) => parts.find((p) => p.type === k)!.value).join('')
  );
}
export function reminder(at: string, origin = PUBLIC_ORIGIN) {
  const start = new Date(Date.parse(at) - 5 * 60000),
    end = new Date(at);
  const title = 'Dibs drops in five minutes',
    details = `Three dibs. Five strikes. ${origin}/`;
  const google = new URL('https://calendar.google.com/calendar/render');
  google.search = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details,
    dates: `${localStamp(start)}/${localStamp(end)}`,
    ctz: DROP_TIME_ZONE,
    recur: 'RRULE:FREQ=DAILY',
  }).toString();
  const outlook = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlook.search = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    body: details + ' Set Repeat to Daily to keep the appointment.',
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  }).toString();
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dibs//Daily Drop//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:America/Toronto',
    'BEGIN:DAYLIGHT',
    'DTSTART:20070311T020000',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'DTSTART:20071104T020000',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:daily-drop@${new URL(origin).host}`,
    `DTSTAMP:${compact(new Date('2026-11-22T00:00:00Z'))}`,
    `DTSTART;TZID=${DROP_TIME_ZONE}:${localStamp(start)}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${title}`,
    `DESCRIPTION:${details}`,
    `URL:${origin}/`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  return { google: google.href, outlook: outlook.href, ics, start: start.toISOString() };
}
