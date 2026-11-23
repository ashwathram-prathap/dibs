// Called synchronously from the tap handler with the file prepared in advance.
export async function sharePrepared(
  file: File,
  link: { url: string; text: string },
  savePreference?: () => Promise<void>,
) {
  // Persist the explicit owner opt-in while opening the native sheet. Waiting
  // for the network first can consume Safari's transient user activation.
  const saved = savePreference?.();
  const [, result] = await Promise.all([saved, shareImage(file, link)]);
  return result;
}
async function shareImage(file: File, link: { url: string; text: string }) {
  if (!navigator.share) return 'fallback';
  let capable = false;
  try {
    capable = !!navigator.canShare?.({ files: [file] });
  } catch {}
  if (capable) {
    try {
      const caption = `${link.text} ${link.url}`;
      const android = /Android/i.test(navigator.userAgent);
      let mixed = false;
      try {
        mixed = android && !!navigator.canShare?.({ files: [file], text: caption });
      } catch {}
      // Apple AirDrop rejects mixed payloads. Clipboard preparation must not delay share().
      const copied = !android
        ? navigator.clipboard?.writeText(caption).then(
            () => true,
            () => false,
          )
        : undefined;
      await navigator.share(mixed ? { files: [file], text: caption } : { files: [file] });
      if (mixed) return 'file-caption';
      return (await copied) ? 'file-caption-copied' : 'file';
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
