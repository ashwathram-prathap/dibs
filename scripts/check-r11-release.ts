import { readFileSync } from 'node:fs';
if (Date.now() >= Date.parse('2026-11-23T17:00:00-05:00'))
  throw Error('Round 11 production deadline has passed.');
let gates: any;
try {
  gates = JSON.parse(readFileSync('review/round11/release-gates.json', 'utf8'));
} catch {
  throw Error('Round 11 production gate has not been signed off.');
}
const required = [
  'visualVsR7',
  'unitApi',
  'browserMatrix',
  'practiceMatrix',
  'timedRehearsal',
  'publicRehearsalScheduled',
  'loadTest',
  'personas',
  'lighthouse',
  'productionSmokeFeasible',
];
const failed = required.filter((k) => gates[k] !== true);
if (failed.length || gates.openHighSeverity !== 0)
  throw Error('Round 11 production blocked: ' + failed.join(', '));
console.log('Round 11 gates passed.');
