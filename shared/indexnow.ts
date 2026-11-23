import { PUBLIC_ORIGIN } from './config';
// Public ownership proof, deliberately committed (not an authentication secret).
export const INDEXNOW_KEY = '94ddccd26722e631edf15dfeaced2a64';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export async function pingIndexNow(paths: string[], send: typeof fetch = fetch) {
  try {
    const urls = [...new Set(paths.map((path) => new URL(path, PUBLIC_ORIGIN).href))];
    if (urls.some((url) => new URL(url).origin !== PUBLIC_ORIGIN))
      throw Error('Only production URLs can be submitted');
    const response = await send(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(PUBLIC_ORIGIN).hostname,
        key: INDEXNOW_KEY,
        keyLocation: PUBLIC_ORIGIN + '/' + INDEXNOW_KEY + '.txt',
        urlList: urls,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return { ok: response.ok, status: response.status, urls };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}
