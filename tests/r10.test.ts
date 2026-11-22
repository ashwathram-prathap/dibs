import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dropAt, nextDrop } from '../worker/domain';
import { dropTime } from '../shared/time';
import { deploymentBlocked } from '../shared/deploy-window';
it('reminder is five minutes before the 9 PM Toronto event, including DST', () => {
  const ics = readFileSync('public/reminder.ics', 'utf8');
  expect(ics).toContain('DTSTART;TZID=America/Toronto:20261123T205500');
  expect(ics).not.toContain('TRIGGER:');
  expect(dropTime(nextDrop(new Date('2026-11-22T19:18:00Z')), 'America/Toronto').full).toBe(
    '9:00 PM ET',
  );
  expect(dropTime(dropAt('2027-07-01'), 'America/Toronto').full).toBe('9:00 PM ET');
  expect(dropTime(dropAt('2026-11-23'), 'Europe/London').full).toBe('Tue 2:00 AM GMT');
});
it('R10 freezes all base releases at the owner’s 5 PM deadline', () => {
  expect(deploymentBlocked(Date.parse('2026-11-23T16:59:59-05:00'))).toBe(false);
  expect(deploymentBlocked(Date.parse('2026-11-23T17:00:00-05:00'))).toBe(true);
});
it('all Canada coverage names resolve, without changing existing canonical rows', () => {
  const report = JSON.parse(readFileSync('review/round10/canada-coverage.json', 'utf8'));
  expect(report.reduce((n: number, r: any) => n + r.checked, 0)).toBe(119);
  expect(report.flatMap((r: any) => r.missing)).toEqual([]);
  const foods = JSON.parse(readFileSync('categories/foods.json', 'utf8'));
  expect(foods.answers.find((a: any) => a.display === 'Poutine').canonical).toBe('poutine');
  expect(
    foods.answers.find((a: any) => a.display === 'Bacon covered with cornmeal').aliases,
  ).toContain('Peameal bacon');
});
