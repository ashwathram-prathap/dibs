// Called synchronously from the tap handler with the file prepared in advance.
export async function sharePrepared(file: File, link: { url: string; text: string }) {
  if (!navigator.share) return 'fallback';
  let capable = false;
  try {
    capable = !!navigator.canShare?.({ files: [file] });
  } catch {}
  if (capable) {
    try {
      await navigator.share({ files: [file] });
      return 'file';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'abort';
    }
  }
  try {
    await navigator.share({ url: link.url, text: link.text });
    return 'url';
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'abort' : 'fallback';
  }
}
