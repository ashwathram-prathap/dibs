/** Owner-authorized Saturday release; rollback is a mutation too. */
export const R20_OPEN = Date.parse('2026-11-28T00:30:00-05:00');
export const R20_FREEZE = Date.parse('2026-11-28T10:00:00-05:00');
export const R20_GO_NO_GO = Date.parse('2026-11-28T12:00:00-05:00');
export const R20_CUTOFF = Date.parse('2026-11-28T16:00:00-05:00');
export function eveningFreeze(now: number) {
  if (!Number.isFinite(now)) return true;
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(now)),
  );
  return hour >= 18 && hour < 23;
}
export function releaseBlocked(now: number, reserveMs = 30 * 60000) {
  return (
    !Number.isFinite(now) ||
    reserveMs < 0 ||
    !Number.isFinite(reserveMs) ||
    now < R20_OPEN ||
    now + reserveMs >= R20_CUTOFF ||
    eveningFreeze(now)
  );
}
export function assertProductionWindow(now = Date.now(), reserveMs = 30 * 60000) {
  if (releaseBlocked(now, reserveMs))
    throw Error(
      'R20/R21 production gate: Saturday Nov 28, 00:30–16:00 Toronto only, with recovery reserve; never 18:00–23:00.',
    );
}
/** Calendar may resume on a future owner-authorized round; scheduled opening is independent. */
export function assertProductionWriter(now = Date.now()) {
  assertProductionWindow(now);
}
