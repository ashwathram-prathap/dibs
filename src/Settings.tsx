import { useState, useRef, useEffect, type FormEvent } from 'react';
import { setMusic } from './music';
import { soundEnabled, setSoundEnabled, prepareSound } from './sound';
import { viewerZone } from '../shared/time';
import { BACKUP_EXPLANATION } from '../shared/copy';
import { api, isDemo } from './api';
import { Icon } from './Icon';
import { runTurnstile } from './turnstile';
export function Settings({
  sitekey,
  refresh,
  focusZone,
}: {
  sitekey: string;
  refresh: () => Promise<void>;
  focusZone: boolean;
}) {
  useEffect(() => {
    if (focusZone) document.querySelector<HTMLSelectElement>('.timezone-control select')?.focus();
  }, [focusZone]);
  return (
    <>
      <SoundToggle />
      <MusicToggle />
      <TimezonePicker />
      <div id="settings-content">
        <BackupSettings sitekey={sitekey} refresh={refresh} />
      </div>
    </>
  );
}
export function MusicToggle() {
  const [on, setOn] = useState(false);
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem('dibs-music') === 'on';
    } catch {
      return false;
    }
  });
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const choice = useRef(0);
  return (
    <button
      className="music-toggle"
      aria-pressed={on}
      aria-label={`Music: ${on ? 'On' : 'Off'} · ${on ? 'Turn music off' : saved ? 'Resume music' : 'Turn music on'}`}
      onClick={() => {
        const next = !on,
          version = ++choice.current;
        setOn(next);
        setSaved(next);
        setFailed(false);
        try {
          localStorage.setItem('dibs-music', next ? 'on' : 'off');
        } catch {}
        setLoading(next);
        void setMusic(next)
          .finally(() => {
            if (version === choice.current) setLoading(false);
          })
          .catch(() => {
            if (version === choice.current) {
              setOn(false);
              setFailed(true);
            }
          });
      }}
      aria-busy={loading}
      title={failed ? 'Music unavailable; tap to retry' : undefined}
    >
      Music: {on ? 'On' : 'Off'}
    </button>
  );
}
export function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  return (
    <button
      className="sound-toggle"
      aria-label={`Sound: ${on ? 'On' : 'Off'} · ${on ? 'Turn stamp sound off' : 'Turn stamp sound on'}`}
      aria-pressed={on}
      onClick={() => {
        setSoundEnabled(!on);
        setOn(!on);
        void prepareSound();
      }}
    >
      Sound: {on ? 'On' : 'Off'}
    </button>
  );
}
export function TimezonePicker() {
  const [zone, setZone] = useState(viewerZone);
  const common: [string, string][] = [
    ['Pacific/Honolulu', 'Hawaii'],
    ['America/Anchorage', 'Alaska'],
    ['America/Vancouver', 'Pacific Time (Vancouver, LA)'],
    ['America/Edmonton', 'Mountain Time (Edmonton, Denver)'],
    ['America/Winnipeg', 'Central Time (Winnipeg, Chicago)'],
    ['America/Toronto', 'Eastern Time (Toronto, New York)'],
    ['America/Halifax', 'Atlantic Time (Halifax)'],
    ['America/St_Johns', 'Newfoundland (St. John’s)'],
    ['America/Sao_Paulo', 'Brazil (São Paulo)'],
    ['Europe/London', 'UK (London)'],
    ['Europe/Paris', 'Central Europe (Paris, Berlin)'],
    ['Africa/Lagos', 'West Africa (Lagos)'],
    ['Africa/Johannesburg', 'South Africa (Johannesburg)'],
    ['Asia/Dubai', 'Gulf (Dubai)'],
    ['Asia/Karachi', 'Pakistan (Karachi)'],
    ['Asia/Kolkata', 'India (Mumbai, Delhi)'],
    ['Asia/Colombo', 'Sri Lanka (Colombo)'],
    ['Asia/Singapore', 'Singapore, Malaysia'],
    ['Asia/Shanghai', 'China (Shanghai)'],
    ['Asia/Tokyo', 'Japan, Korea (Tokyo, Seoul)'],
    ['Australia/Sydney', 'Australia East (Sydney)'],
    ['Pacific/Auckland', 'New Zealand (Auckland)'],
  ];
  const label = (z: string) =>
    common.find(([id]) => id === z)?.[1] || z.split('/').pop()!.replaceAll('_', ' ');
  const options: [string, string][] = common.some(([id]) => id === zone)
    ? common
    : [[zone, label(zone)], ...common];
  return (
    <label className="timezone-control">
      Time zone
      <select
        aria-label="Timezone"
        value={zone}
        onChange={(e) => {
          setZone(e.target.value);
          try {
            localStorage.setItem('dibs-timezone', e.target.value);
          } catch {}
          window.dispatchEvent(new Event('dibs-zone'));
        }}
      >
        {options.map(([z, name]) => (
          <option key={z} value={z}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function BackupSettings({
  sitekey,
  refresh,
}: {
  sitekey: string;
  refresh: () => Promise<void>;
}) {
  const [restoreKey, setRestoreKey] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('file-key') || '',
  );
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (location.hash === '#file-settings' || restoreKey) {
      const panel = document.querySelector<HTMLDetailsElement>('.header-settings');
      if (panel) panel.open = true;
      const backup = document.querySelector<HTMLDetailsElement>('#file-settings');
      if (backup) backup.open = true;
    }
    if (location.hash.startsWith('#file-key=')) history.replaceState(null, '', location.pathname);
  }, []);
  async function restore(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/recover', { key: restoreKey });
      setRestoreKey('');
      await refresh();
      setMessage('Your claims are restored.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <details id="file-settings" className="file-key-panel" open={restoreKey ? true : undefined}>
      <summary>
        Backup code <Icon name="chevron" />
      </summary>
      <p>{BACKUP_EXPLANATION}</p>
      <form onSubmit={restore}>
        <label htmlFor="restore-key">Backup code</label>
        <input
          id="restore-key"
          value={restoreKey}
          onChange={(e) => setRestoreKey(e.target.value)}
          autoComplete="off"
          maxLength={60}
        />
        <button>Restore claims</button>
      </form>
      <p role="status">{message}</p>
      <DeleteFile sitekey={sitekey} initialKey={restoreKey} />
    </details>
  );
}
export function DeleteFile({ sitekey, initialKey = '' }: { sitekey: string; initialKey?: string }) {
  const [confirm, setConfirm] = useState(false),
    [key, setKey] = useState(initialKey),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const box = useRef<HTMLDivElement>(null);
  return (
    <section className="delete-file">
      <h3>Delete my data</h3>
      <p>This removes your name, backup code and streak; past claims stay as ‘Withdrawn player’.</p>
      <p>{BACKUP_EXPLANATION}</p>
      <label htmlFor="delete-key">Backup code (optional on this device)</label>
      <input
        id="delete-key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="off"
        maxLength={60}
      />
      {!confirm ? (
        <button onClick={() => setConfirm(true)}>Delete my data</button>
      ) : (
        <>
          <p>Delete your data permanently?</p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const turnstileToken = isDemo ? 'demo' : await runTurnstile(sitekey, box.current!);
                const result = await api<{ message: string }>('/delete-file', {
                  key,
                  confirm: 'DELETE MY FILE',
                  turnstileToken,
                });
                setMessage(result.message);
                setConfirm(false);
                setKey('');
                if (!isDemo) location.replace('/?file-deleted');
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete permanently
          </button>
          <button disabled={busy} onClick={() => setConfirm(false)}>
            Keep my data
          </button>
        </>
      )}
      <div ref={box} />
      <p role="status">{message}</p>
    </section>
  );
}
