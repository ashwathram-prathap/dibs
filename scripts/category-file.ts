import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// Large reference registers remain reviewable JSON, with the answer array in a
// checksum-verified gzip companion. This avoids Git's 100 MiB single-file limit.
export function readCategory(path: string): any {
  const category = JSON.parse(readFileSync(path, 'utf8'));
  if (!category.answersFile) return category;
  if (basename(category.answersFile) !== category.answersFile) throw Error('Invalid answer file');
  const bytes = readFileSync(join(dirname(path), category.answersFile));
  if (createHash('sha256').update(bytes).digest('hex') !== category.answersSha256)
    throw Error('Category answer checksum mismatch: ' + path);
  category.answers = JSON.parse(gunzipSync(bytes).toString());
  if (category.answers.length !== category.total_registrable)
    throw Error('Category count mismatch');
  return category;
}

export function writeCategory(path: string, category: any) {
  delete category.answersFile;
  delete category.answersSha256;
  const answers = JSON.stringify(category.answers);
  const companion = basename(path, '.json') + '.answers.json.gz';
  if (Buffer.byteLength(answers) > 40 * 1024 * 1024) {
    const bytes = gzipSync(answers, { level: 9 });
    writeFileSync(join(dirname(path), companion) + '.next', bytes);
    renameSync(join(dirname(path), companion) + '.next', join(dirname(path), companion));
    const { answers: _, ...metadata } = category;
    category = {
      ...metadata,
      answersFile: companion,
      answersSha256: createHash('sha256').update(bytes).digest('hex'),
    };
  } else if (existsSync(join(dirname(path), companion))) unlinkSync(join(dirname(path), companion));
  writeFileSync(path + '.next', JSON.stringify(category) + '\n');
  renameSync(path + '.next', path);
}
