import { readFileSync } from 'node:fs';
const vars = Object.fromEntries(
  readFileSync('.dev.vars.staging', 'utf8')
    .split('\n')
    .filter((s) => s.includes('='))
    .map((s) => {
      const i = s.indexOf('=');
      return [
        s.slice(0, i),
        s
          .slice(i + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ''),
      ];
    }),
);
export const origin = 'https://practice.dibs-7hz.pages.dev';
async function request(path: string, body?: any, cookie?: string, admin = false) {
  const r = await fetch(origin + '/api' + path, {
    signal: AbortSignal.timeout(20000),
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(admin ? { authorization: 'Bearer ' + vars.ADMIN_TOKEN } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response: r, data: (await r.json()) as any };
}

export async function api(path: string, body?: any, cookie?: string, admin = false) {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await request(path, body, cookie, admin);
      if (result.response.status >= 500 && attempt < 2 && (body === undefined || admin)) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      return result;
    } catch (error) {
      if (attempt >= 2 || !(body === undefined || admin))
        throw Error('Practice request failed: ' + path);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
