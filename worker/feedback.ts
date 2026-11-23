import { hmac } from './identity';
import { clientIp } from './security';
import type { Env } from './routes';
export function feedbackText(
  value: unknown,
): { ok: true; text: string } | { ok: false; message: string } {
  if (typeof value !== 'string' || value.length > 500)
    return { ok: false, message: 'Write up to 500 characters.' };
  const text = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const urls = text.match(/(?:https?:\/\/|www\.)[^\s<>]+/gi) || [];
  const remainder = text
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, '')
    .replace(/[\s.,;:!?()[\]{}<>"'—–-]/g, '');
  if (!text || urls.length > 2 || (urls.length && !remainder))
    return { ok: false, message: 'Write a note with no more than two links.' };
  return { ok: true, text };
}
export async function reserveFeedback(req: Request, env: Env, uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  const ip = clientIp(req, env.LOCAL_TEST) || 'unknown';
  const ipHash = await hmac('feedback:' + day + ':' + ip, env.COOKIE_SECRET);
  const stub = env.REGISTRY!.get(env.REGISTRY!.idFromName('public-registry-v1'));
  return (stub as any).reserveFeedbackQuota(uid, ipHash, Date.now()) as Promise<string | null>;
}
export async function feedbackQuota(
  storage: DurableObjectStorage,
  uid: string,
  ipHash: string,
  now: number,
) {
  const day = new Date(now).toISOString().slice(0, 10);
  return storage.transaction(async (tx) => {
    const key = 'feedback-quota';
    const old = await tx.get<{
      day: string;
      total: number;
      ips: Record<string, number>;
      users: Record<string, number[]>;
    }>(key);
    // One bounded record; yesterday's IP hashes are discarded at UTC midnight.
    const state = old?.day === day ? old : { day, total: 0, ips: {}, users: old?.users || {} };
    const recent = (state.users[uid] || []).filter((t) => t > now - 3600000);
    if (recent.length >= 3) return 'Feedback limit reached; try again in an hour.';
    if (state.total >= 300) return 'Feedback is full for today. Try again tomorrow.';
    if ((state.ips[ipHash] || 0) >= 20) return 'Feedback limit reached; try again tomorrow.';
    state.total++;
    state.ips[ipHash] = (state.ips[ipHash] || 0) + 1;
    state.users = Object.fromEntries(
      Object.entries(state.users)
        .map(([id, times]) => [id, times.filter((t) => t > now - 3600000)])
        .filter(([, times]) => (times as number[]).length),
    );
    state.users[uid] = [...recent, now];
    await tx.put(key, state);
    return null;
  });
}
