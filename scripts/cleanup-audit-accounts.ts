// Removes only the exact anonymous identities observed in our isolated Lighthouse run.
// Accounts with a claim are preserved. No timestamp guessing or broad DELETE is used.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const auditPath =
  process.argv[2] === 'live'
    ? 'review/live-qa-identities.json'
    : 'review/lighthouse/qa-identities.json';
const ids: string[] = JSON.parse(readFileSync(auditPath, 'utf8'));
if (!ids.length || ids.some((id) => !/^[a-f0-9-]{36}$/.test(id)))
  throw new Error('No valid audit identity list. Nothing deleted.');
const sql = `DELETE FROM users WHERE id IN (${ids.map((id) => "'" + id + "'").join(',')}) AND NOT EXISTS(SELECT 1 FROM claims WHERE user_id=users.id); SELECT id,status,date,total_registrable FROM categories; SELECT COUNT(*) users FROM users; SELECT COUNT(*) claims FROM claims;`;
const rows = JSON.parse(
  execFileSync(
    'node_modules/.bin/wrangler',
    [
      'd1',
      'execute',
      'dibs-db',
      '--remote',
      '-c',
      'worker/wrangler.jsonc',
      '--command',
      sql,
      '--json',
    ],
    { encoding: 'utf8' },
  ),
);
const before = JSON.parse(readFileSync('review/production-cleanup.json', 'utf8'));
const summary = {
  qaAccountsRemoved: before.qaAccountsRemoved + (rows[0].meta.changes || 0),
  remainingUsers: rows[2].results[0].users,
  remainingClaims: rows[3].results[0].claims,
  scope:
    'Only exact signed identities created by our Lighthouse and live-page browser checks; accounts with claims are preserved. No claims deleted.',
};
writeFileSync('review/production-cleanup.json', JSON.stringify(summary, null, 2));
writeFileSync('review/production-state.json', JSON.stringify(rows.slice(1), null, 2));
console.log(summary);
