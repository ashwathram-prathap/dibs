import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
const families = ['Archivo', 'Instrument Sans', 'IBM Plex Mono'];
const css = readFileSync('src/style.css', 'utf8');
const source = readFileSync('src/share.ts', 'utf8');
const normalize = (s: string) => s.trim().replace(/^['"]|['"]$/g, '');
const formSelectors = new Set([
  '.form-label',
  '.form-value',
  '.postmark-date',
  '.guess-number',
  '.cert-category time',
  '.ledger time',
  '.ledger .entry-number',
  '.backup-code',
  '.your-backup-code output',
  '#restore-key',
  '#delete-key',
]);
it('allows only the three brand families in CSS, including shorthand, and only explicit form roles for Plex', () => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of clean.matchAll(/(?:^|[;{])\s*(font-family|font)\s*:\s*([^;{}]+);/g)) {
    let value = match[2].replace(/\s*!important$/, '').trim();
    if (value === 'inherit') continue;
    if (match[1] === 'font') {
      value = value.replace(/(?:clamp|max|min)\([^)]*\)/g, '16px');
      value = value.replace(/^.*?\d(?:px|rem|em|%)\s*(?:\/[^\s]+\s*)?/, '').trim();
    }
    for (const family of value.split(',').map(normalize))
      expect([...families, 'sans-serif', 'monospace']).toContain(family);
    if (value.includes('IBM Plex Mono')) {
      const before = clean.slice(0, match.index! + 1);
      const selector = before
        .slice(Math.max(before.lastIndexOf('}'), before.lastIndexOf('{', before.length - 2)) + 1)
        .replace(/\{\s*$/, '')
        .trim();
      if (selector === '@font-face') continue;
      for (const part of selector.split(',').map((s) => s.trim()))
        expect(formSelectors.has(part), `Plex outside a form role: ${part}`).toBe(true);
    }
  }
  expect(clean).not.toMatch(/\bdashed\b|\bdouble\b|content:\s*['"]\+['"]/);
});
it('restricts canvas font assignments to brand faces and formText, with explicit valid form roles', () => {
  const assignments = [...source.matchAll(/c\.font\s*=\s*([^;]+);/g)];
  expect(assignments.length).toBeGreaterThan(5);
  for (const assignment of assignments) {
    const expr = assignment[1];
    if (expr.includes('${face}'))
      expect(source).toContain(`type ExportFont = 'Archivo' | '\"Instrument Sans\"'`);
    const family = expr
      .split(/px\s+/)
      .at(-1)!
      .replace(/[`'";]/g, '')
      .trim();
    expect([...families, '${face}']).toContain(family);
    if (expr.includes('IBM Plex Mono')) {
      expect(assignment.index).toBeGreaterThan(source.indexOf('function formText('));
      expect(assignment.index).toBeLessThan(source.indexOf('async function paintPaper('));
    }
  }
  for (const call of source.matchAll(/formText\(c,\s*'([^']+)',\s*([^,]+)/g)) {
    expect(['number', 'label', 'date']).toContain(call[1]);
    if (call[1] === 'label') expect(normalize(call[2]).split(/\s+/).length).toBeLessThanOrEqual(3);
  }
  expect(source).not.toMatch(
    /ArchivoClock|ArchivoSupplement|\bGeorgia\b|\bArial\b|setLineDash\(\[/,
  );
});
it('uses no other face in SVGs or first-paint CSS and ships no unused duplicate browser fonts', () => {
  for (const name of readdirSync('public/art').filter((n) => n.endsWith('.svg'))) {
    const svg = readFileSync('public/art/' + name, 'utf8');
    for (const [, value] of svg.matchAll(/font-family(?:=|:)['"]?([^;"'<>]+)/g))
      for (const family of value.split(',').map(normalize))
        expect([...families, 'sans-serif', 'monospace']).toContain(family);
  }
  expect(readFileSync('shared/critical.ts', 'utf8')).not.toMatch(/system-ui|Arial|Georgia/);
  const faces = readdirSync('public/fonts').filter((n) => /\.(woff2?|otf)$/.test(n));
  for (const face of faces)
    expect(
      css.includes(face) || readFileSync('worker/og.ts', 'utf8').includes(face),
      `Unused font ${face}`,
    ).toBe(true);
});
it('authorizes the exact branded first-paint stylesheet without unsafe inline styles',async()=>{
  const { CRITICAL_CSS }=await import('../shared/critical');
  const { CSP }=await import('../shared/security');
  const { createHash }=await import('node:crypto');
  expect(CSP).toContain("'sha256-"+createHash('sha256').update(CRITICAL_CSS).digest('base64')+"'");
});
