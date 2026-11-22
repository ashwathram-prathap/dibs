// Release guard: do not send an existing preview to an unavailable canonical domain.
// Run after the dashboard steps in MORNING_REPORT.md; exits before mutations if TLS fails.
for (const host of ['dibs.here', 'www.dibs.here']) {
  const response = await fetch('https://' + host + '/api/today', {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  if (![200, 301, 302].includes(response.status))
    throw Error(host + ' is not ready: HTTP ' + response.status);
  if (host === 'dibs.here' && response.status !== 200)
    throw Error('Apex must serve the current Dibs API before cutover.');
  if (host === 'dibs.here') {
    const data = (await response.json()) as any;
    if (typeof data.turnstileSiteKey !== 'string' || !('category' in data))
      throw Error('The apex does not serve Dibs.');
  }
}
console.log(
  'Both TLS hosts respond and the apex serves Dibs. Ready for the release commands in MORNING_REPORT.md.',
);
