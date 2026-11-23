import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import { sharePrepared } from './native-share';
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
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
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
  }, [render, theme]);
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
    const file = files[platform === 'feed' || platform === 'native' ? 'feed' : 'story'];
    const data = { title: 'Dibs', text, url: attributedUrl(url, platform) };
    setBusy(true);
    setCopy('');
    try {
      if (platform === 'native' || platform === 'instagram-tiktok') {
        const result = await sharePrepared(file, data);
        if (result === 'abort') return;
        if (result === 'file' || result === 'url') {
          setStatus(result === 'file' ? 'Image shared.' : 'Link shared.');
          return;
        }
        download(file);
        try {
          await navigator.clipboard.writeText(data.url);
          setStatus("Couldn't share. Link copied instead.");
        } catch {
          setCopy(data.url);
          setStatus("Couldn't share. Save the image or copy the link below.");
        }
      } else {
        download(file);
        setStatus(platform === 'story' ? storyTip : 'Image saved.');
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
        <button
          className="primary"
          aria-label="SHARE"
          disabled={!files || busy}
          onClick={() => void share('native')}
        >
          {busy ? 'Sharing…' : files ? 'Share' : 'Preparing image…'} <Icon />
        </button>
        <button className="copy-result" onClick={() => void clipboard('copy-text')}>
          {status === 'Copied' ? 'Copied' : 'Copy result'}
        </button>
      </div>
      <div className="share-platforms linkedin-share">
        <a
          href={intentUrl('linkedin', text, url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => tap('linkedin')}
        >
          Post on LinkedIn
        </a>
        <button disabled={!files || busy} onClick={() => void share('feed')}>
          Download image
        </button>
      </div>
      <p className="share-hint">
        For the best post, download the image and add it to your LinkedIn post.
      </p>
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
            Story JPEG
          </button>
          <button disabled={!files || busy} onClick={() => void share('feed')}>
            Feed JPEG
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
            Open image to save manually <Icon />
          </a>
          <p className="share-hint">
            If the download is blocked, open the image or press and hold this image to save.
          </p>
          <img src={manual.href} alt="Your Dibs image. Press and hold to save." />
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
