import './test-traffic';
import { createHash } from 'node:crypto';
const id = process.argv[2];
if (!id || !/^[a-z0-9-]+$/.test(id))
  throw Error('Usage: npx tsx scripts/verify-golden.ts <closed-category-id>');
const origin = process.env.DIBS_ORIGIN || 'https://dibs.here';
const response = await fetch(origin + '/api/archive?id=' + encodeURIComponent(id));
if (!response.ok) throw Error('Archive HTTP ' + response.status);
const data = (await response.json()) as any;
const category = data.categories.find((c: any) => c.id === id),
  proof = category?.specials;
if (!proof?.reveal)
  throw Error('No reveal yet. Wait until the next daily drop closes this register.');
const payload = JSON.stringify({
  v: 1,
  category: id,
  seed: proof.reveal.seed,
  answers: proof.reveal.answers.map((a: any) => a.id).sort(),
});
const digest = createHash('sha256').update(payload).digest('hex');
if (digest !== proof.commitment || payload !== proof.reveal.payload)
  throw Error('Commitment mismatch');
console.log('Verified ' + id + ': ' + digest);
