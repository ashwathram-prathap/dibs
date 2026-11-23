import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'review/round19d/golden/exports';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const results: any[] = [];
try {
  const page = await browser.newPage();
  await page.addInitScript({ content: 'globalThis.__name=(fn)=>fn;' });
  await page.goto('http://127.0.0.1:5223/?r19');
  await page.evaluate(() => document.fonts.ready);
  for (const theme of ['light', 'dark'])
    for (const variant of ['first', 'second', 'third', 'two', 'strikes'])
      for (const story of [false, true]) {
        const data = await page.evaluate(
          async ({ theme, variant, story }) => {
            document.documentElement.dataset.theme = theme;
            const { exportSummary, exportCertificate } = await import('/src/share.ts' as string);
            const { claimScore } = await import('/shared/claim-copy.ts' as string);
            const C = CanvasRenderingContext2D.prototype,
              original = C.fillText,
              rect = C.strokeRect;
            const drawings: any[] = [],
              frames = new WeakMap<HTMLCanvasElement, any>();
            C.strokeRect = function (x, y, w, h) {
              if (x === 36 && y === 36) {
                const m = this.getTransform();
                frames.set(this.canvas, {
                  left: x + m.e,
                  top: y + m.f,
                  right: x + w + m.e,
                  bottom: y + h + m.f,
                });
              }
              return rect.call(this, x, y, w, h);
            };
            C.fillText = function (value, x, y, ...args) {
              const size = this.measureText(value),
                m = this.getTransform();
              const corners = [
                [-size.actualBoundingBoxLeft, -size.actualBoundingBoxAscent],
                [size.actualBoundingBoxRight, -size.actualBoundingBoxAscent],
                [-size.actualBoundingBoxLeft, size.actualBoundingBoxDescent],
                [size.actualBoundingBoxRight, size.actualBoundingBoxDescent],
              ].map(([dx, dy]) => new DOMPoint(x + dx, y + dy).matrixTransform(m));
              drawings.push({
                value,
                corners: corners.map((p) => ({ x: p.x, y: p.y })),
                frame: frames.get(this.canvas),
              });
              return original.call(this, value, x, y, ...args);
            };
            const category = {
              id: 'fixture',
              slug: 'animals',
              name: 'Animals',
              date: '2026-11-22',
              total_registrable: 200000,
              drop_at: '2026-11-22T02:00:00Z',
            };
            const claims = ['Okapi', 'Quokka', 'Sarcastic fringehead'].map((display, i) => {
              const golden =
                variant === 'two'
                  ? i !== 1
                  : variant === 'strikes'
                    ? i === 1
                    : ['first', 'second', 'third'].indexOf(variant) === i;
              return {
                id: `2026-11-22-ad24b000-0000-4000-8000-00000000000${i}`,
                claim_no: i + 1,
                display,
                category_id: 'fixture',
                category_name: 'Animals',
                category_slug: 'animals',
                category_date: '2026-11-22',
                created_at: '2026-11-23T02:52:00Z',
                total_registrable: 200000,
                handle: 'Tan Dove',
                golden,
                bonus: golden ? 100 : 0,
                points: 60 + (golden ? 100 : 0),
                percentile: 0.55,
                owned: true,
              };
            });
            const events = claims.map((c) => ({
              at: c.created_at,
              kind: 'dibs',
              claimId: c.id,
              display: c.display,
              golden: c.golden,
            }));
            if (variant === 'strikes')
              for (let i = 0; i < 4; i++)
                events.splice(i * 2, 0, {
                  at: claims[0].created_at,
                  kind: 'strike',
                  display: 'SECRET STRUCK GUESS',
                } as any);
            const file = {
              category_id: 'fixture',
              summaryId: '2026-11-22-ad24b000-0000-4000-8000-111111111111',
              claims,
              events,
              dibs: 3,
              strikes: variant === 'strikes' ? 4 : 0,
              closed: true,
              completedAt: claims[0].created_at,
              points: claims.reduce((s, c) => s + c.points, 0) - (variant === 'strikes' ? 40 : 0),
              rank: 3,
              players: 8,
              handle: 'Tan Dove',
            };
            try {
              const summary = await exportSummary(file, category, story);
              const certificate = await exportCertificate(
                claims.find((c) => c.golden)!,
                story,
              );
              const hideStart = drawings.length;
              const hide = await exportSummary(file, category, story, true);
              const sealed = await exportCertificate(
                claims.find((c) => c.golden)!,
                story,
                true,
              );
              const hiddenDrawings = drawings.slice(hideStart);
              const caption = (await import('/src/share.ts' as string)).summaryText(file, category);
              const encode = async (f: File) => ({
                name: f.name,
                size: f.size,
                base64: await new Promise<string>((resolve) => {
                  const r = new FileReader();
                  r.onload = () => resolve(String(r.result).split(',')[1]);
                  r.readAsDataURL(f);
                }),
              });
              return {
                summary: await encode(summary),
                certificate: await encode(certificate),
                hide: await encode(hide),
                sealed: await encode(sealed),
                hiddenDrawings,
                caption,
                drawings,
                score: claimScore(claims.find((c) => c.golden)!),
              };
            } finally {
              C.fillText = original;
              C.strokeRect = rect;
            }
          },
          { theme, variant, story },
        );
        for (const d of data.drawings) {
          assert.ok(!d.value.includes('SECRET STRUCK GUESS'));
          if (d.frame)
            for (const p of d.corners) {
              assert.ok(p.x >= d.frame.left - 1 && p.x <= d.frame.right + 1, JSON.stringify(d));
              assert.ok(p.y >= d.frame.top - 1 && p.y <= d.frame.bottom + 1, JSON.stringify(d));
            }
        }
        for (const [kind, file] of Object.entries({
          summary: data.summary,
          certificate: data.certificate,
          hidden: data.hide,
          sealed: data.sealed,
        })) {
          assert.ok(file.size < 350000);
          writeFileSync(
            `${dir}/${theme}-${variant}-${story ? 'story' : 'feed'}-${kind}.jpg`,
            Buffer.from(file.base64, 'base64'),
          );
        }
        assert.ok(
          data.hiddenDrawings.every((d: any) => !/Okapi|Quokka|Sarcastic fringehead/.test(d.value)),
        );
        assert.ok(data.hiddenDrawings.some((d: any) => d.value === 'SEALED'));
        assert.ok(
          data.caption.includes('160 points') && data.caption.includes('60 + 100 golden bonus'),
        );
        const urls = data.drawings
          .filter((d: any) => /^practice\.dibs.*\/(c|summary)\//.test(d.value))
          .map((d: any) => d.value);
        assert.ok(urls.length >= 3);
        assert.ok(
          urls.every((s: string) => s.endsWith('111111111111') || /00000000000[012]$/.test(s)),
        );
        assert.ok(data.score.startsWith('160 points'));
        assert.ok(data.score.endsWith('60 + 100 golden bonus'));
        results.push({
          theme,
          variant,
          story,
          passed: true,
          bytes: [data.summary.size, data.certificate.size, data.hide.size, data.sealed.size],
          printedUrls: [...new Set(urls)],
        });
      }
} finally {
  await browser.close();
}
writeFileSync(
  'review/round19d/export-proof.json',
  JSON.stringify({ passed: true, results }, null, 2),
);
console.log(
  `Verified ${results.length * 4} exports: bounds, full practice URLs, golden totals and size.`,
);
