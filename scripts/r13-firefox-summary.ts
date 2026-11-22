import { readFileSync, writeFileSync } from 'node:fs';
const full = JSON.parse(
  readFileSync('.tmp/r13/firefox-full-failure/round13/browser-results.json', 'utf8'),
);
const final = JSON.parse(
  readFileSync('.tmp/r13/firefox-final/review/round13/browser-results.json', 'utf8'),
);
const cases = new Map<string, string>();
function collect(suites: any[]) {
  for (const suite of suites) {
    for (const spec of suite.specs || [])
      for (const test of spec.tests)
        cases.set([spec.file, spec.title, test.projectName].join(' | '), test.status);
    collect(suite.suites || []);
  }
}
collect(full.suites);
collect(final.suites);
const summary = {
  expected: [...cases.values()].filter((s) => s === 'expected').length,
  unexpected: [...cases.values()].filter((s) => s === 'unexpected').length,
  skipped: [...cases.values()].filter((s) => s === 'skipped').length,
  flaky: [...cases.values()].filter((s) => s === 'flaky').length,
  full: {
    url: 'https://github.com/ashwathram-prathap/dibs/actions/runs/45065447181',
    stats: full.stats,
  },
  final: {
    url: 'https://github.com/ashwathram-prathap/dibs/actions/runs/45067214703',
    stats: final.stats,
  },
  note: 'The full Firefox run passed 48 checks and failed six music visibility checks because Firefox lacks AudioParam.cancelAndHoldAtTime. Explicit gain-envelope tracking fixed that API incompatibility. The final focused run covers all 18 R13 checks (hero, sound/music and overlay keyboard at three desktop widths in both themes). It replaces those six failures and adds six keyboard checks. Audio used a real Web Audio context with a PulseAudio null output device in Linux CI.',
};
writeFileSync('review/round13/firefox-summary.json', JSON.stringify(summary, null, 2));
console.log(summary);
