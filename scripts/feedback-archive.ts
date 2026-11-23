import { mkdirSync, writeFileSync, readFileSync, statSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { archiveCsv, validateArchive } from '../shared/feedback-archive';

export async function archiveFeedback(
  base: string,
  token: string,
  { directory = 'feedback-archive', now = new Date(), dryRun = false } = {},
) {
  const request = async (ids?: string[]) => {
    const r = await fetch(base + '/admin/feedback-archive', {
      method: ids ? 'POST' : 'GET',
      headers: {
        origin: new URL(base).origin,
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
      },
      body: ids ? JSON.stringify({ ids }) : undefined,
    });
    if (!r.ok)
      throw Error(
        'Feedback archive request failed (' + r.status + '); local files, if any, are retained.',
      );
    return r.json() as Promise<any>;
  };
  const notes = validateArchive((await request()).notes);
  if (!notes.length) return 'No feedback to archive.';
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const stem = join(directory, now.toISOString().slice(0, 16).replace('T', '_').replace(':', ''));
  const json = JSON.stringify(notes, null, 2) + '\n',
    csv = archiveCsv(notes);
  writeFileSync(stem + '.json', json, { mode: 0o600, flag: 'wx' });
  writeFileSync(stem + '.csv', csv, { mode: 0o600, flag: 'wx' });
  const verified = validateArchive(JSON.parse(readFileSync(stem + '.json', 'utf8')));
  if (
    verified.length !== notes.length ||
    JSON.stringify(verified) !== JSON.stringify(notes) ||
    readFileSync(stem + '.csv', 'utf8') !== archiveCsv(verified) ||
    ['.json', '.csv'].some((ext) => (statSync(stem + ext).mode & 0o777) !== 0o600)
  )
    throw Error('Archive verification failed; nothing deleted.');
  if (dryRun)
    return `Dry run: archived ${notes.length} notes to ${stem}.json and .csv; nothing removed.`;
  const { removed } = await request(notes.map((n) => n.id));
  if (removed !== notes.length)
    throw Error(
      `Archive saved to ${stem}; ${removed} of ${notes.length} notes removed (another admin may have archived them).`,
    );
  return `Archived ${notes.length} notes to ${stem}.json and .csv and removed them from the site.`;
}
