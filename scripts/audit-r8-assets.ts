import { readdirSync, statSync, writeFileSync } from 'node:fs';
function files(path: string): { path: string; bytes: number }[] {
  return readdirSync(path).flatMap((name) => {
    const child = path + '/' + name;
    const stat = statSync(child);
    return stat.isDirectory() ? files(child) : [{ path: child, bytes: stat.size }];
  });
}
const assets = files('dist');
const largest = [...assets].sort((a, b) => b.bytes - a.bytes).slice(0, 10);
const report = {
  at: new Date().toISOString(),
  scope: 'Current local production build; deployment versions are recorded separately',
  files: assets.length,
  totalBytes: assets.reduce((sum, file) => sum + file.bytes, 0),
  largest,
  limits: { pagesFreeFiles: 20000, pagesFileBytes: 25 * 1024 * 1024 },
  passed: assets.length <= 20000 && largest.every((file) => file.bytes <= 25 * 1024 * 1024),
  source: 'https://developers.cloudflare.com/pages/platform/limits/',
};
writeFileSync('review/round8/asset-capacity.json', JSON.stringify(report, null, 2) + '\n');
console.log({ files: report.files, largest: largest[0], passed: report.passed });
if (!report.passed) process.exitCode = 1;
