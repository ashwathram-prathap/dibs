import { PUBLIC_ORIGIN } from './config';

export const platforms = [
  'native',
  'x',
  'whatsapp',
  'facebook',
  'instagram-tiktok',
  'copy-link',
  'copy-text',
  'story',
  'feed',
] as const;
export type Platform = (typeof platforms)[number];
export const isPlatform = (value: unknown): value is Platform =>
  typeof value === 'string' && platforms.includes(value as Platform);
export const summaryUrl = (id: string) => `${PUBLIC_ORIGIN}/summary/${encodeURIComponent(id)}`;
export function attributedUrl(url: string, platform: Platform) {
  const result = new URL(url);
  result.searchParams.set('s', platform);
  return result.href;
}
export function intentUrl(platform: Platform, text: string, url: string) {
  const link = attributedUrl(url, platform);
  if (platform === 'x')
    return 'https://twitter.com/intent/tweet?' + new URLSearchParams({ text, url: link });
  if (platform === 'whatsapp')
    return 'https://wa.me/?' + new URLSearchParams({ text: text + ' ' + link });
  if (platform === 'facebook')
    return 'https://www.facebook.com/sharer/sharer.php?' + new URLSearchParams({ u: link });
  return '';
}
