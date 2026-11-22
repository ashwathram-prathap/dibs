import { it, expect } from 'vitest';
import { reminder } from '../shared/reminder';
import { dropAt } from '../worker/domain';
import { localTime } from '../shared/time';
import { LAUNCH_DATE } from '../shared/config';
import { readFileSync } from 'node:fs';
it('all reminder formats use five minutes before the supplied schedule, with Toronto daily recurrence', () => {
  for (const date of [LAUNCH_DATE, '2027-03-14', '2027-07-01', '2027-11-07']) {
    const at = dropAt(date),
      r = reminder(at),
      g = new URL(r.google),
      o = new URL(r.outlook);
    expect(localTime(r.start, 'America/Toronto').full).toBe('8:55 PM ET');
    expect(g.searchParams.get('dates')).toBe(
      date.replaceAll('-', '') + 'T205500/' + date.replaceAll('-', '') + 'T210000',
    );
    expect(g.searchParams.get('ctz')).toBe('America/Toronto');
    expect(g.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY');
    expect(o.searchParams.get('startdt')).toBe(r.start);
    expect(r.ics).toContain('DTSTART;TZID=America/Toronto:' + date.replaceAll('-', '') + 'T205500');
    expect(r.ics).toContain('RRULE:FREQ=DAILY');
    expect(r.ics).not.toContain('VALARM');
  }
  expect(reminder(dropAt(LAUNCH_DATE)).ics).toBe(readFileSync('public/reminder.ics', 'utf8'));
  expect(localTime(dropAt(LAUNCH_DATE), 'America/Toronto', true).full).toBe('Mon 9:00 PM ET');
  expect(localTime(reminder(dropAt(LAUNCH_DATE)).start, 'America/Vancouver').full).toBe(
    '6:55 PM PT',
  );
  const practice = reminder('2026-11-22T20:18:00Z', 'https://practice.dibs-7hz.pages.dev');
  expect(practice.start).toBe('2026-11-22T20:13:00.000Z');
  expect(practice.ics).toContain('practice.dibs-7hz.pages.dev');
});
