// Budgeted, sequential draft uploads. Defaults to LOCAL D1; never approves a category.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalize } from '../worker/domain';
const args = process.argv.slice(2),
  remote = args.includes('--remote'),
  dry = args.includes('--dry-run');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length)
  throw Error(
    'Usage: tsx scripts/upload-drafts.ts [--remote] [--dry-run] categories/animals.json ...',
  );
if (remote && Date.now() < Date.parse('2026-11-22T00:00:00Z'))
  throw Error('Remote D1 is locked until November 21, 7 PM Toronto.');
const day = new Date().toISOString().slice(0, 10),
  stateFile = '.upload-state.json';
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const bucket = (state[(remote ? 'remote:' : 'local:') + day] ||= {
  reservedWrites: 0,
  completed: {},
});
const budget = 45000; // Leaves more than half of the daily allowance for maintenance/traffic.
const base = remote ? 'https://dibs.here/api' : 'http://127.0.0.1:8787/api';
const token =
  process.env.ADMIN_TOKEN ||
  (!remote && existsSync('.dev.vars')
    ? readFileSync('.dev.vars', 'utf8').match(/^ADMIN_TOKEN=(.*)$/m)?.[1]
    : '');
if (!dry && !token)
  throw Error('Set ADMIN_TOKEN in the environment; never pass it on the command line.');
if (remote && !dry) {
  const r = await fetch(base + '/today');
  if (!r.ok) throw Error('Registry availability could not be checked. No upload was sent.');
  const today = (await r.json()) as any;
  if (today.category)
    throw Error(
      'Draft uploads are reserved for closed-office days, keeping the traffic write allowance separate.',
    );
}
for (const file of files) {
  const body = JSON.parse(readFileSync(file, 'utf8'));
  if (body.status !== 'draft') throw Error(file + ': only drafts may be uploaded.');
  if (body.answers.length > 2200) throw Error(file + ': the free-tier catalog cap is 2,200.');
  const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  if (bucket.completed[file] === digest) {
    console.log(file + ': unchanged; skipped');
    continue;
  }
  const keys = body.answers.reduce(
    (n: number, a: any) => n + new Set([normalize(a.display), ...a.aliases.map(normalize)]).size,
    0,
  );
  // Include both deletion and insertion plus all maintained indexes, even for a new draft.
  const reservedWrites = 2 * (4 * body.answers.length + 3 * keys) + 10;
  if (bucket.reservedWrites + reservedWrites > budget)
    throw Error(
      'Daily upload budget would be exceeded. Remaining files stay local; resume after midnight UTC.',
    );
  console.log(
    JSON.stringify({
      file,
      mode: remote ? 'remote' : 'local',
      reservedWrites,
      budget,
      status: 'draft',
      dryRun: dry,
    }),
  );
  if (dry) continue;
  // Reserve BEFORE sending. Failed/uncertain writes never get a blind automatic retry.
  bucket.reservedWrites += reservedWrites;
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  const r = await fetch(base + '/admin/category', {
    method: 'POST',
    headers: {
      origin: 'https://dibs.here',
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...body, replaceDraft: true }),
  });
  const result = (await r.json()) as any;
  if (!r.ok) throw Error(`Upload stopped (${r.status}): ${result.message}. No retry was made.`);
  if (result.unchanged) bucket.reservedWrites -= reservedWrites;
  bucket.completed[file] = digest;
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ file, status: result.status, unchanged: !!result.unchanged }));
}
