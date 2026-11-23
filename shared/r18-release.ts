export const R18_PRODUCTION_DEADLINE = '2026-11-23T15:00:00-05:00';
export function r18DeploymentAllowed(now = Date.now()) {
  return now < Date.parse(R18_PRODUCTION_DEADLINE);
}
