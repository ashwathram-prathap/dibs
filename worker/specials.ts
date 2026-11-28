import { prepareDayRules, wantsNewRules, savedPolicy } from './day-rules';
import { cluedId, clueText, clueEnabled } from './clue';
import { catalogMeta, rowAt, answerId, persistAnswer, answerType } from './catalog';
import { goldenPerDay, GOLDEN_PER_DAY } from '../shared/config';
import houseWords from './house-words.json';
import { dropAt } from './domain';
import type { Env } from './routes';
export const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
export const commitmentText = (category: string, seed: string, answers: string[]) =>
  JSON.stringify({ v: 1, category, seed, answers: [...answers].sort() });
// Configured unbiased draws without replacement, using a cryptographic server seed.
export async function selectGolden(ids: string[], seed: string, count = GOLDEN_PER_DAY) {
  const remaining = [...ids].sort(),
    selected: string[] = [];
  let counter = 0;
  while (selected.length < count && remaining.length) {
    const n = parseInt((await sha256(seed + ':' + counter++)).slice(0, 8), 16);
    const bound = Math.floor(0x100000000 / remaining.length) * remaining.length;
    if (n >= bound) continue;
    selected.push(remaining.splice(n % remaining.length, 1)[0]);
  }
  return selected.sort();
}
export function closeAt(category: any) {
  return dropAt(
    new Date(Date.parse(category.date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10),
  );
}
// This object is private: only the commitment and aggregate counts leave the server.
export async function ensureSpecials(env: Env, category: any) {
  const saved = await env.DB.prepare(
    'SELECT s.*,r.policy_json,r.policy_digest,r.pool_json FROM daily_specials s LEFT JOIN day_rules r ON r.category_id=s.category_id WHERE s.category_id=?',
  )
    .bind(category.id)
    .first<any>();
  if (saved) {
    const policy = savedPolicy(saved);
    if (
      policy &&
      ((await sha256(saved.policy_json)) !== saved.policy_digest ||
        (await sha256(saved.pool_json)) !== policy.eligibleDigest)
    )
      throw Error('Committed rules failed integrity check');
    return saved;
  }
  const meta = catalogMeta(category);
  const pool: { id: string; display: string }[] = meta
    ? meta.house.map((r: any) => ({ id: answerId(category, r), display: r[1] }))
    : (
        await env.DB.prepare('SELECT id,display FROM answers WHERE category_id=? ORDER BY id')
          .bind(category.id)
          .all<any>()
      ).results;
  const names = (houseWords as Record<string, string[]>)[category.slug] || [];
  const house = meta ? pool : pool.filter((a) => names.includes(a.display));
  const seed = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  const rules = wantsNewRules(category) ? await prepareDayRules(category) : null;
  let golden = await selectGolden(
    pool.filter((a) => !house.some((h) => h.id === a.id)).map((a) => a.id),
    seed,
    goldenPerDay(category.date),
  );
  if (rules && meta) {
    const eligibleIds = rules.eligible.map((i) => answerId(category, [i, '', null] as any));
    golden = await selectGolden(eligibleIds, seed, rules.policy.count);
    const rows = await Promise.all(
      golden.map((id) => rowAt(category, Number(id.split(':').at(-1)))),
    );
    await env.DB.batch([...meta.house, ...rows].map((r) => persistAnswer(env, category, r)));
  } else if (meta) {
    const chosen = new Set<number>();
    let counter = 0;
    while (chosen.size < goldenPerDay(category.date) && chosen.size < meta.count - 10) {
      const n = parseInt((await sha256(seed + ':' + counter++)).slice(0, 8), 16);
      const available = meta.count - 10;
      const bound = Math.floor(0x100000000 / available) * available;
      if (n < bound) chosen.add(10 + (n % available));
    }
    const rows = await Promise.all([...chosen].map((i) => rowAt(category, i)));
    await env.DB.batch([...meta.house, ...rows].map((r) => persistAnswer(env, category, r)));
    golden = rows.map((r) => answerId(category, r)).sort();
  }
  const commitment = await sha256(commitmentText(category.id, seed, golden));
  await env.DB.batch([
    ...(rules
      ? [
          env.DB.prepare(
            'INSERT INTO day_rules VALUES(?,?,?,?,?) ON CONFLICT(category_id) DO NOTHING',
          ).bind(category.id, rules.json, rules.digest, rules.poolJson, new Date().toISOString()),
        ]
      : []),
    ...house.map((a) =>
      env.DB.prepare('INSERT OR IGNORE INTO house_words(category_id,answer_id) VALUES(?,?)').bind(
        category.id,
        a.id,
      ),
    ),
    env.DB.prepare('INSERT OR IGNORE INTO daily_specials VALUES(?,?,?,?,?)').bind(
      category.id,
      seed,
      JSON.stringify(golden),
      commitment,
      new Date().toISOString(),
    ),
  ]);
  return env.DB.prepare(
    'SELECT s.*,r.policy_json,r.policy_digest,r.pool_json FROM daily_specials s LEFT JOIN day_rules r ON r.category_id=s.category_id WHERE s.category_id=?',
  )
    .bind(category.id)
    .first<any>();
}
export async function specialStatus(env: Env, category: any, reveal = false) {
  const closed = reveal && env.STAGING !== 'true' && closeAt(category) <= new Date().toISOString();
  // A missed drop must never manufacture a retrospective proof.
  const saved = closed
    ? await env.DB.prepare(
        'SELECT s.*,r.policy_json,r.policy_digest,r.pool_json FROM daily_specials s LEFT JOIN day_rules r ON r.category_id=s.category_id WHERE s.category_id=?',
      )
        .bind(category.id)
        .first<any>()
    : await ensureSpecials(env, category);
  if (!saved)
    return {
      houseCount: ((houseWords as Record<string, string[]>)[category.slug] || []).length,
      houseWords: ((houseWords as Record<string, string[]>)[category.slug] || []).map(
        (display) => ({ display, handle: 'RESERVED' }),
      ),
      goldenFound: 0,
      goldenTotal: goldenPerDay(category.date),
      commitment: '',
      committedAt: '',
      verified: false,
    };
  const house = (
    await env.DB.prepare(
      'SELECT a.display,h.revealed FROM house_words h JOIN answers a ON a.id=h.answer_id WHERE h.category_id=? ORDER BY a.display',
    )
      .bind(category.id)
      .all<any>()
  ).results;
  let found = await env.DB.prepare(
    'SELECT COUNT(*) n FROM claims c JOIN daily_specials s ON s.category_id=c.category_id WHERE c.category_id=? AND c.voided=0 AND c.answer_id IN (SELECT value FROM json_each(s.golden_json))',
  )
    .bind(category.id)
    .first<any>();
  const policy = savedPolicy(saved);
  const selected = clueEnabled(category, Date.now(), !!policy?.clues)
    ? cluedId(JSON.parse(saved.golden_json), saved.commitment)
    : null;
  const clueAnswer = selected
    ? await env.DB.prepare('SELECT display FROM answers WHERE id=?').bind(selected).first<any>()
    : null;
  let cracked = selected
    ? await env.DB.prepare(
        "SELECT CASE WHEN u.provider_subject LIKE 'withdrawn:%' THEN 'Withdrawn player' ELSE COALESCE(f.name,u.handle) END handle FROM claims c JOIN users u ON u.id=c.user_id LEFT JOIN founder_role f ON f.user_id=u.id WHERE c.answer_id=? AND c.category_id=? AND c.voided=0 AND u.hidden=0",
      )
        .bind(selected, category.id)
        .first<any>()
    : null;
  if (closed && env.R17_STORAGE === 'true') {
    const files = (
      await env.DB.prepare('SELECT data FROM r17_files WHERE category_id=?')
        .bind(category.id)
        .all<any>()
    ).results.map((r) => JSON.parse(r.data));
    const mirrored = files.flatMap((s) =>
      s.file.claims
        .filter((c: any) => !c.voided)
        .map((c: any) => ({
          ...c,
          handle: s.user.hidden ? 'Record withheld' : s.user.handle,
          hidden: s.user.hidden,
        })),
    );
    const ids = new Set(mirrored.filter((c) => c.golden).map((c) => c.id));
    const legacy = (
      await env.DB.prepare(
        'SELECT id FROM claims WHERE category_id=? AND voided=0 AND answer_id IN (SELECT value FROM json_each(?))',
      )
        .bind(category.id, saved.golden_json)
        .all<any>()
    ).results;
    for (const c of legacy) ids.add(c.id);
    found = { n: ids.size };
    const match = mirrored.find((c) => c.answer_id === selected && !c.hidden);
    if (match) cracked = { handle: match.handle };
  }
  const base = {
    clue: clueAnswer
      ? {
          text: clueText(
            clueAnswer.display,
            category.date,
            await answerType(category, selected!),
            policy?.count,
          ),
          crackedBy: cracked?.handle || null,
        }
      : null,
    houseCount: house.length,
    houseWords: house
      .filter((h) => closed || h.revealed)
      .map((h) => ({ display: h.display, handle: 'RESERVED' })),
    goldenFound: Number(found?.n || 0),
    goldenTotal: JSON.parse(saved.golden_json).length,
    goldenBonus: policy?.bonus ?? 100,
    policy: policy ? { ...policy, digest: saved.policy_digest } : undefined,
    commitment: saved.commitment,
    committedAt: saved.committed_at,
  };
  if (!closed) return base;
  const ids = JSON.parse(saved.golden_json) as string[];
  const answers = (
    await env.DB.prepare(
      'SELECT id,display FROM answers WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id',
    )
      .bind(saved.golden_json)
      .all()
  ).results;
  return {
    ...base,
    reveal: {
      seed: saved.seed,
      answers: answers.map((a) => ({ ...a, clued: a.id === selected })),
      algorithm: 'SHA-256 of JSON.stringify({v:1,category,seed,answers:sortedAnswerIds})',
      payload: commitmentText(category.id, saved.seed, ids),
    },
    verified:
      (await sha256(commitmentText(category.id, saved.seed, ids))) === saved.commitment &&
      (!policy ||
        ((await sha256(saved.policy_json)) === saved.policy_digest &&
          (await sha256(saved.pool_json)) === policy.eligibleDigest &&
          ids.length === policy.count &&
          ids.every((id) => JSON.parse(saved.pool_json).includes(Number(id.split(':').at(-1)))))),
  };
}
