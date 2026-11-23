import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { attributedUrl, intentUrl, type Platform } from '../shared/sharing';

const storyTip = 'Saved. Open Instagram or TikTok, add it to your story, and add a link sticker.';
export function ShareSheet({
  url,
  text,
  render,
}: {
  url: string;
  text: string;
  render: (story: boolean) => Promise<File>;
}) {
  const [files, setFiles] = useState<{ story: File; feed: File }>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<{ href: string; name: string }>();
  const [copy, setCopy] = useState('');
  const object = useRef('');
  // Prepare before the tap: awaiting canvas/fonts would lose Safari's user activation.
  useEffect(() => {
    let alive = true;
    setFiles(undefined);
    Promise.all([render(true), render(false)])
      .then(([story, feed]) => {
        if (alive) setFiles({ story, feed });
      })
      .catch(() => {
        if (alive) setStatus('The image could not be printed. Copy the link or caption below.');
      });
    return () => {
      alive = false;
    };
  }, [render]);
  useEffect(
    () => () => {
      if (object.current) URL.revokeObjectURL(object.current);
    },
    [],
  );
  function tap(platform: Platform) {
    // Aggregate only the platform, including cancellations and blocked attempts.
    void api('/events/share', { platform }).catch(() => {});
  }
  function download(file: File) {
    if (object.current) URL.revokeObjectURL(object.current);
    object.current = URL.createObjectURL(file);
    setManual({ href: object.current, name: file.name });
    const a = document.createElement('a');
    a.href = object.current;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
  }
  async function share(platform: 'native' | 'instagram-tiktok' | 'story' | 'feed') {
    tap(platform);
    if (!files) return;
    const file = files[platform === 'feed' ? 'feed' : 'story'];
    const data = { title: 'Dibs', text, url: attributedUrl(url, platform) };
    setBusy(true);
    setCopy('');
    try {
      let fileSupported = false;
      try {
        fileSupported = !!navigator.share && !!navigator.canShare?.({ files: [file] });
      } catch {}
      if ((platform === 'native' || platform === 'instagram-tiktok') && fileSupported) {
        await navigator.share({ ...data, files: [file] });
        setStatus(
          platform === 'instagram-tiktok' ? storyTip : 'A certified copy has left the office.',
        );
        return;
      }
      if (platform === 'native' && navigator.share) {
        await navigator.share(data);
        setStatus('Link shared. Save the Story PNG below to take the image too.');
        // Offer the image explicitly; do not open a second sheet after native sharing.
        return;
      }
      download(file);
      setStatus(
        platform === 'instagram-tiktok'
          ? storyTip
          : 'PNG prepared. Copy text supplies the caption.',
      );
    } catch (e) {
      if ((e as Error).name === 'AbortError') setStatus('Copy retained at the office.');
      else {
        download(file);
        setStatus('This browser kept the share sheet closed. Save the PNG and copy the caption.');
      }
    } finally {
      setBusy(false);
    }
  }
  async function clipboard(platform: 'copy-link' | 'copy-text') {
    tap(platform);
    const value = platform === 'copy-link' ? attributedUrl(url, platform) : text;
    try {
      await navigator.clipboard.writeText(value);
      setCopy('');
      setStatus('Copied');
    } catch {
      setCopy(value);
      setStatus('Press and hold the text below to copy.');
    }
  }
  return (
    <div className="share-area" aria-label="Share Dibs">
      <div className="share-buttons">
        <button className="primary copy-result" onClick={() => void clipboard('copy-text')}>
          {status === 'Copied' ? 'Copied' : 'Copy result'}
        </button>
        <button className="primary" disabled={!files || busy} onClick={() => void share('native')}>
          {busy ? 'SHARING…' : files ? 'SHARE' : 'PREPARING PNG…'} <Icon />
        </button>
      </div>
      <details className="share-options">
        <summary>More ways to share</summary>
        <div className="share-platforms" aria-label="Share by platform">
          {(['x', 'whatsapp', 'facebook'] as const).map((platform, i) => (
            <a
              key={platform}
              href={intentUrl(platform, text, url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => tap(platform)}
            >
              {['X', 'WhatsApp', 'Facebook'][i]}
            </a>
          ))}
          <button disabled={!files || busy} onClick={() => void share('instagram-tiktok')}>
            Instagram / TikTok story
          </button>
          <button onClick={() => void clipboard('copy-link')}>Copy link</button>
        </div>
        <div className="share-formats">
          <button disabled={!files || busy} onClick={() => void share('story')}>
            Story PNG
          </button>
          <button disabled={!files || busy} onClick={() => void share('feed')}>
            Feed PNG
          </button>
          <button onClick={() => void clipboard('copy-text')}>Copy text</button>
        </div>
      </details>
      <p className="share-hint" role="status">
        {status}
      </p>
      {manual && (
        <div className="share-manual">
          <a href={manual.href} target="_blank" rel="noopener">
            Open PNG to save manually <Icon />
          </a>
          <p className="share-hint">
            If the download is blocked, open the PNG or press and hold this image to save.
          </p>
          <img src={manual.href} alt="Your Dibs PNG. Press and hold to save." />
        </div>
      )}
      {copy && (
        <textarea
          className="share-copy"
          aria-label="Share text to copy"
          readOnly
          value={copy}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  );
}
