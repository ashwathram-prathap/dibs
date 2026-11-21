// Unattended delivery helper. Only commits complete category drafts, never other work.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const git = (args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 2_000_000 });
const history: any[] = existsSync('review/category-pushes.json')
  ? JSON.parse(readFileSync('review/category-pushes.json', 'utf8'))
  : [];
let done = false;
while (!done) {
  const complete: string[] = [];
  for (const name of readdirSync('categories').filter((n) => /^[a-z-]+\.json$/.test(n))) {
    const path = 'categories/' + name;
    try {
      const c = JSON.parse(readFileSync(path, 'utf8'));
      if (
        c.status === 'draft' &&
        c.provenance?.identityPolicy === 'exclude-cross-title-redirects-v1' &&
        c.answers?.length >= 2000 &&
        c.total_registrable === c.answers.length
      )
        complete.push(path);
    } catch {}
  }
  for (const path of complete) {
    if (!git(['status', '--porcelain', '--', path]).trim()) continue;
    git(['add', '--', path]);
    const staged = git(['diff', '--cached', '--name-only']);
    if (staged.split('\n').some((n) => /\.dev\.vars|(^|\/)\.env|MORNING_REPORT|secret/i.test(n)))
      throw new Error('Unexpected sensitive staged path; push stopped');
    git(['commit', '--only', path, '-m', 'M4: build measured ' + path.slice(11, -5) + ' draft']);
    console.log(git(['status', '--short']));
    git(['push']);
    history.push({ path, commit: git(['rev-parse', 'HEAD']).trim(), at: new Date().toISOString() });
    writeFileSync('review/category-pushes.json', JSON.stringify(history, null, 2));
    console.log('PUSHED ' + path + ' (' + complete.length + '/30 available)');
  }
  done = complete.length === 30;
  if (!done) await new Promise((r) => setTimeout(r, 20000));
}
console.log('All 30 category drafts have been pushed.');
