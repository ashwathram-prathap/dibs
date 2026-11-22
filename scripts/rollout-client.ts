import { readFileSync, existsSync } from 'node:fs';
export const practice = process.argv.includes('--practice');
export const origin =
  process.env.DIBS_ORIGIN ||
  (practice ? 'https://practice.dibs-7hz.pages.dev' : 'https://dibs.here');
const file = practice ? '.dev.vars.staging' : '.dev.vars';
const token =
  process.env.DIBS_ADMIN_TOKEN ||
  process.env.ADMIN_TOKEN ||
  (existsSync(file) ? readFileSync(file, 'utf8').match(/^ADMIN_TOKEN=(.+)$/m)?.[1] : null);
export async function admin(path: string, data?: any, retry = 0): Promise<any> {
  if (!token) throw Error('DIBS_ADMIN_TOKEN is required.');
  const r = await fetch(origin + '/api/admin/schedule' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      authorization: 'Bearer ' + token,
      origin,
      ...(data !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (r.status === 429 && retry < 3) {
    console.log('Admin rate limit: resuming in one minute.');
    await new Promise((resolve) => setTimeout(resolve, 60000));
    return admin(path, data, retry + 1);
  }
  const out: any = await r.json();
  if (!r.ok) throw Error(`${path || 'calendar'}: ${out.message || r.status}`);
  return out;
}
