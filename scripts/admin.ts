import { readFileSync } from 'node:fs';
const [command, target, date] = process.argv.slice(2);
const token = process.env.ADMIN_TOKEN;
if (!token)
  throw new Error(
    'Set ADMIN_TOKEN from your local MORNING_REPORT.md. Never put it in a command argument.',
  );
const base = process.env.DIBS_API || 'https://dibs.here/api';
let body: any;
let path = '';
if (command === 'upload' || command === 'replace-draft') {
  path = '/admin/category';
  body = JSON.parse(readFileSync(target, 'utf8'));
  body.status = 'draft';
  if (command === 'replace-draft') body.replaceDraft = true;
} else if (command === 'approve') {
  if (!date) throw new Error('Provide the reviewed category ID and a future YYYY-MM-DD date.');
  path = '/admin/approve';
  body = { id: target, date, reviewed: true };
} else if (['hide-user', 'void-claim'].includes(command)) {
  path = '/admin/' + command;
  body = { id: target };
} else if (command === 'practice-reset') {
  path = '/admin/practice-reset';
  body = {};
} else if (command === 'stats') path = '/admin/stats';
else
  throw new Error(
    'Usage: tsx scripts/admin.ts upload <file> | replace-draft <file> | approve <id> <date> | hide-user <id> | void-claim <id> | stats',
  );
const r = await fetch(base + path, {
  method: body ? 'POST' : 'GET',
  headers: {
    origin: new URL(base).origin,
    authorization: 'Bearer ' + token,
    'content-type': 'application/json',
  },
  body: body ? JSON.stringify(body) : undefined,
});
console.log(r.status, await r.text());
if (!r.ok) process.exitCode = 1;
