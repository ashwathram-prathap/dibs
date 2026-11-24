import { it, expect } from 'vitest';
import { closeLabel } from '../shared/time';
import {
  LIMIT_EXPLANATION,
  NIGHTLY_CLAIMS,
  SHARE_INVITATION,
  GAME_DESCRIPTION,
} from '../shared/copy';
import { deploymentBlocked } from '../shared/deploy-window';

it('says 3 claims a night in the explanation, invitation and How it works', () => {
  expect(LIMIT_EXPLANATION.startsWith('3 claims a night. 5 strikes and you')).toBe(true);
  expect(SHARE_INVITATION).toBe('One category. 3 claims a night. What can you claim? dibs.here');
  expect(NIGHTLY_CLAIMS).toBe('You get 3 claims every night.');
  // Strike, typo safety stay in the shared description used by previews and reminders.
  expect(GAME_DESCRIPTION).toContain(
    'Taken or reserved answers cost a strike. Typos and answers not on the list never do.',
  );
});

it('names the server close relative to the server clock, never hard-coding tomorrow', () => {
  const close = '2026-11-26T02:00:00.000Z'; // Wed Nov 25, 9:00 PM Toronto
  // Drop night, before midnight: closes tomorrow evening.
  expect(closeLabel(close, Date.parse('2026-11-24T22:30:00-05:00'), 'America/Toronto')).toBe(
    '9:00 PM ET tomorrow',
  );
  // After midnight the same category closes that evening.
  expect(closeLabel(close, Date.parse('2026-11-25T00:05:00-05:00'), 'America/Toronto')).toBe(
    '9:00 PM ET today',
  );
  expect(closeLabel(close, Date.parse('2026-11-25T20:59:00-05:00'), 'America/Toronto')).toBe(
    '9:00 PM ET today',
  );
  // Viewer zones use their own date and time.
  // 12:05 AM Toronto is still Nov 24 in Los Angeles; after Los Angeles midnight it closes today.
  expect(closeLabel(close, Date.parse('2026-11-25T00:05:00-05:00'), 'America/Los_Angeles')).toBe(
    '6:00 PM PT tomorrow',
  );
  expect(closeLabel(close, Date.parse('2026-11-25T03:05:00-05:00'), 'America/Los_Angeles')).toBe(
    '6:00 PM PT today',
  );
  expect(closeLabel(close, Date.parse('2026-11-24T22:30:00-05:00'), 'Asia/Tokyo')).toMatch(
    /^11:00 AM GMT\+9 (today|tomorrow)$/,
  );
  // Further away: weekday and date.
  expect(closeLabel(close, Date.parse('2026-11-23T10:00:00-05:00'), 'America/Toronto')).toBe(
    '9:00 PM ET Wednesday, Nov 25',
  );
});

it('R19H production cutoff: go/no-go 4 PM, nothing at or after 5 PM ET Nov 24', () => {
  expect(deploymentBlocked(Date.parse('2026-11-24T15:59:59-05:00'), 'r19h')).toBe(false);
  expect(deploymentBlocked(Date.parse('2026-11-24T16:59:59-05:00'), 'r19h')).toBe(false);
  expect(deploymentBlocked(Date.parse('2026-11-24T17:00:00-05:00'), 'r19h')).toBe(true);
  expect(deploymentBlocked(Date.parse('2026-11-24T21:00:00-05:00'), 'r19h')).toBe(true);
  expect(deploymentBlocked(Date.parse('2026-11-25T10:00:00-05:00'), 'r19h')).toBe(true);
  // The daily 8:30–10 PM freeze stays in force.
  expect(deploymentBlocked(Date.parse('2026-11-23T20:45:00-05:00'), 'r19h')).toBe(true);
  // Before the round started (no approved build), nothing either.
  expect(deploymentBlocked(Date.parse('2026-11-24T04:00:00-05:00'), 'r19h')).toBe(true);
  expect(deploymentBlocked(Date.parse('2026-11-24T04:03:00-05:00'), 'r19h')).toBe(false);
});
