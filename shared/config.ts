// Canonical public address for printed copies, previews and shared links.
export const PUBLIC_ORIGIN = 'https://dibs.here';
export const PUBLIC_HOST = new URL(PUBLIC_ORIGIN).host;
export const certificateUrl = (id: string) =>
  `${PUBLIC_ORIGIN}/certificate/${encodeURIComponent(id)}`;
