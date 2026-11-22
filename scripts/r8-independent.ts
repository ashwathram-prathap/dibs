import { readFileSync, writeFileSync } from 'node:fs';
import { normalize } from '../worker/domain';
// Recheck the original seeded samples. Do not swap out a miss for an easier answer.
for (const slug of ['animals', 'birds', 'cities']) {
  const initial = JSON.parse(
    readFileSync(`review/coverage/${slug}-independent-initial.json`, 'utf8'),
  );
  const current = JSON.parse(readFileSync('categories/' + slug + '.json', 'utf8'));
  const keys = new Set(
    current.answers.flatMap((a: any) => [normalize(a.display), ...a.aliases.map(normalize)]),
  );
  const samples = initial.samples.map((r: any) => {
    const answer =
      slug === 'cities' ? r.answer.replace(/ \([^)]*\)$/, '').split(', ')[0] : r.answer;
    return {
      ...r,
      originalSourceLabel: r.answer,
      answer,
      initiallyPresent: r.present,
      present: keys.has(normalize(answer)),
    };
  });
  writeFileSync(
    `review/coverage/${slug}-independent.json`,
    JSON.stringify(
      {
        ...initial,
        method:
          initial.method +
          (slug === 'cities'
            ? ' Wikipedia administrative qualifiers are removed because the stated game rule matches the city name only. Original labels are retained.'
            : ''),
        answers: samples.map((r: any) => r.answer),
        samples,
      },
      null,
      2,
    ),
  );
  console.log(
    slug,
    'misses',
    samples.filter((r: any) => !r.present).map((r: any) => r.answer),
  );
}
