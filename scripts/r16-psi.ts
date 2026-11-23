import './test-traffic';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase = process.argv[2] || 'before';
const dir = `review/round16/psi-${phase}`;
mkdirSync(dir, { recursive: true });
const records: any[] = [];
const once = process.argv.includes('--once');
for (let run = 1; run <= (once ? 1 : 3); run++)
  for (const strategy of once ? ['mobile'] : ['mobile', 'desktop']) {
    const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    url.searchParams.set('url', 'https://dibs.here');
    url.searchParams.set('strategy', strategy);
    for (const category of ['performance', 'accessibility', 'best-practices', 'seo'])
      url.searchParams.append('category', category);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      const raw = await response.text();
      writeFileSync(`${dir}/${strategy}-${run}.json`, raw);
      const data = JSON.parse(raw);
      const record = {
        strategy,
        run,
        status: response.status,
        at: new Date().toISOString(),
        scores: data.lighthouseResult
          ? Object.fromEntries(
              Object.entries(data.lighthouseResult.categories).map(([k, v]: any) => [
                k,
                v.score * 100,
              ]),
            )
          : null,
        error: data.error?.message,
      };
      records.push(record);
      console.log(record);
    } catch (e) {
      const record = { strategy, run, error: String(e) };
      records.push(record);
      writeFileSync(`${dir}/${strategy}-${run}.json`, JSON.stringify(record));
      console.log(record);
    }
    writeFileSync(`${dir}/summary.json`, JSON.stringify(records, null, 2));
  }
