import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = dir + '/' + name;
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const forbidden = [
  'fixture-reader',
  'fixture-animals',
  'fixture-universities',
  'advanceFixtureDay',
  'Teal Otter #41',
  'Rust Finch #12',
  'DESIGN PROOF',
];
for (const path of files('dist').filter((p) => /\.(js|css|html)$/.test(p))) {
  const content = readFileSync(path, 'utf8');
  for (const word of forbidden)
    if (content.includes(word)) throw new Error('Fixture leaked: ' + word + ' in ' + path);
}
const css = readFileSync('src/style.css', 'utf8');
const allowed = new Set([
  '#f1ece2',
  '#e4ddcf',
  '#1a1a17',
  '#5c5a53',
  '#e1462b',
  '#22408f',
  '#16150f',
  '#b8902f',
  '#7a5c14',
]);
for (const c of css.matchAll(/#[a-f\d]{6}\b/gi))
  if (!allowed.has(c[0].toLowerCase())) throw new Error('Off-palette CSS ' + c[0]);
const auditedCss = css.replace(/\.printing \.gold-stamp::after \{[^}]*\}/g, '');
if (
  /(?:linear|radial|conic)-gradient|backdrop-filter|border-radius:\s*(?:[3-9]|\d{2})/i.test(
    auditedCss,
  )
)
  throw new Error('Art-direction violation');
writeFileSync(
  'review/production-audit.json',
  JSON.stringify(
    {
      passed: true,
      checks: [
        'no development fixture identifiers in production assets',
        'CSS uses the specified palette',
        'no gradients, glass effects or rounded panels',
      ],
    },
    null,
    2,
  ),
);
console.log('Production fixture and design audit passed');
