import { createPortal } from 'react-dom';
import { Clue } from './Clue';
import { watchVersion } from './version';
import { Handle } from './Handle';
import { Leaderboard } from './Leaderboard';
import {
  GAME_EXPLANATION,
  LIMIT_EXPLANATION,
  GAME_DESCRIPTION,
  BACKUP_EXPLANATION,
  FINISH_EXPLANATION,
  SCHEDULE_EXPLANATION,
  GOLDEN_EXPLANATION,
  RESERVED_EXPLANATION,
} from '../shared/copy';
import {
  MAX_CLAIMS,
  MAX_STRIKES,
  goldenPerDay,
  LAUNCH_DATE,
  DROP_TIME_ZONE,
} from '../shared/config';
import { categoryNote, REGISTRAR_STROKE } from '../shared/moments';
import { reminder } from '../shared/reminder';
import { Calendar } from './Calendar';
import { categoryStyle, paperStocks } from '../shared/category-style';
import { clerkLine } from '../shared/clerk-lines';
import { setMusic } from './music';
import { claimSound } from './sound-synthesis';
import { prepareSound, playClaimSound, soundEnabled, setSoundEnabled } from './sound';
import { submittedSpelling } from './spelling';
import { HOME_TITLE, archiveTitle } from '../shared/seo';
import { Icon } from './Icon';
import { SHOW_CREATOR_CREDIT, CREATOR_URL, X_URL } from '../shared/creator';
import { categoryPlural } from '../shared/category-copy';
import { dropTime, localTime, countdown, edition, viewerZone } from '../shared/time';
import { guesses } from '../shared/guesses';
import { useServerNow, serverNow } from './clock';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type FormEvent,
} from 'react';
import { m as motion, LazyMotion, domAnimation, useReducedMotion } from 'framer-motion';
import { api, ApiError, isDemo } from './api';
import { type Category, type Claim, type DayFile, type Me, type Today, serial } from './types';
import {
  getSnapshot,
  publish,
  publishClaim,
  subscribe,
  watchRegistry,
  type Snapshot,
} from './live';
import { PUBLIC_HOST, PUBLIC_ORIGIN, certificateUrl } from '../shared/config';
import { ShareSheet } from './ShareSheet';
import { summaryUrl, isPlatform } from '../shared/sharing';
import { exportCertificate, exportSummary, summaryText } from './share';
import {
  WORDMARK_WIDTH,
  WORDMARK_PATH,
  WORDMARK_BLOCK_X,
  WORDMARK_OFFSET_X,
  WORDMARK_OFFSET_Y,
} from '../shared/brand';
function Signature() {
  return (
    <span className="registrar-signature">
      <svg viewBox="0 0 220 50" role="img" aria-label="Signed, The Registrar">
        <path
          d={REGISTRAR_STROKE}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>The Registrar</span>
    </span>
  );
}
function Wordmark() {
  return (
    <svg className="brand-mark" role="img" aria-label="dibs." viewBox={`0 0 ${WORDMARK_WIDTH} 100`}>
      <g transform={`translate(${WORDMARK_OFFSET_X} ${WORDMARK_OFFSET_Y})`}>
        <path fill="currentColor" d={WORDMARK_PATH} />
        <path fill="#E1462B" d={`M${WORDMARK_BLOCK_X} 67h18v18h-18z`} />
      </g>
    </svg>
  );
}

function time(at: string) {
  const value = localTime(at);
  return (
    <time
      dateTime={at}
      title={value.full}
      tabIndex={0}
      className="local-time"
      aria-label={value.full}
    >
      {value.label}
      <span className="zone-tip"> {value.zone}</span>
    </time>
  );
}
function RelativeTime({ at }: { at: string }) {
  const now = useServerNow();
  const seconds = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  return (
    <time dateTime={at} title={localTime(at).full}>
      {seconds < 60
        ? 'just now'
        : seconds < 3600
          ? `${Math.floor(seconds / 60)}m ago`
          : localTime(at).full}
    </time>
  );
}
function DropTime({ at }: { at: string }) {
  const value = localTime(at, viewerZone(), true);
  return (
    <span className="local-drop">
      {value.label} {value.zone}
    </span>
  );
}
const dateLabel = (s: string) =>
  new Date(s + 'T12:00:00Z').toLocaleDateString('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
function usePath() {
  const [path, set] = useState(location.pathname);
  useEffect(() => {
    const on = () => set(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return path;
}
function navigate(path: string) {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
function Link({
  to,
  children,
  ...props
}: {
  to: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <a
      href={to}
      {...props}
      onClick={(e: React.MouseEvent) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
function Clock({ target, slim = false }: { target: string; slim?: boolean }) {
  const now = useServerNow();
  const remaining = Math.max(0, Date.parse(target) - now);
  const minutes = Math.ceil(remaining / 60000);
  const [announcement, setAnnouncement] = useState('');
  const announcedAt = useRef(-Infinity);
  useEffect(() => {
    // Server resyncs may straddle a minute boundary; never repeat announcements rapidly.
    if (performance.now() - announcedAt.current < 60000) return;
    announcedAt.current = performance.now();
    setAnnouncement(minutes ? `${minutes} minutes remaining.` : 'Opening…');
  }, [minutes]);
  return (
    <section
      className={slim ? 'round-countdown' : 'drop-countdown'}
      aria-label={slim ? 'Round countdown' : 'Next drop countdown'}
    >
      <span className="eyebrow">{slim ? 'Round closes in' : 'Opens in'}</span>
      <span className="clock" aria-hidden="true">
        {remaining
          ? countdown(target, now)
              .split(' ')
              .map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && ' '}
                  <span className="clock-part">{part}</span>
                </Fragment>
              ))
          : 'Opening…'}
      </span>
      {!slim && (
        <p>
          Next drop: <DropTime at={target} />
        </p>
      )}
      <span className="sr-only">
        {slim ? 'Round closes' : 'Next drop'} at {dropTime(target).full}.
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </section>
  );
}
function MusicToggle() {
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
      aria-label={on ? 'Turn music off' : saved ? 'Resume music' : 'Turn music on'}
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
      title={failed ? 'Music unavailable; tap to retry' : undefined}
    >
      {loading ? 'Music · loading' : saved && !on ? 'Music · resume' : 'Music'}
    </button>
  );
}
function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  return (
    <button
      className="sound-toggle"
      aria-label={on ? 'Turn stamp sound off' : 'Turn stamp sound on'}
      aria-pressed={on}
      onClick={() => {
        setSoundEnabled(!on);
        setOn(!on);
        void prepareSound();
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M3 9h4l5-4v14l-5-4H3z" />
        {on ? <path d="M16 8q5 4 0 8M19 5q8 7 0 14" /> : <path d="m16 9 5 6m0-6-5 6" />}
      </svg>
    </button>
  );
}
function TimezonePicker() {
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
      Times in {localTime(new Date().toISOString(), zone).zone} · change
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
function Filters() {
  return (
    <svg className="filters" aria-hidden="true">
      <defs>
        <filter id="ink">
          <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="8" />
          <feDisplacementMap
            in="SourceGraphic"
            scale="1.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
let arrivalCounted = false;
export default function App() {
  const path = usePath();
  const [, updateZone] = useState(0);
  useEffect(() => {
    const changed = () => updateZone((n) => n + 1);
    window.addEventListener('dibs-zone', changed);
    return () => window.removeEventListener('dibs-zone', changed);
  }, []);
  useEffect(() => {
    const platform = new URLSearchParams(location.search).get('s');
    if (!isPlatform(platform)) return;
    try {
      // A first arrival per browser, with no visitor ID or attribution cookie.
      if (localStorage.getItem('dibs-arrived')) return;
      localStorage.setItem('dibs-arrived', '1');
    } catch {
      // Without storage, count once for this page lifetime; do not fingerprint.
      if (arrivalCounted) return;
    }
    arrivalCounted = true;
    void api('/events/arrival', { platform }).catch(() => {});
  }, []);
  const [theme, setTheme] = useState(() => {
    try {
      return (
        localStorage.getItem('dibs-theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      );
    } catch {
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  });
  useEffect(watchVersion, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const active = document.activeElement;
      const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      document.documentElement.classList.toggle(
        'keyboard-open',
        typing || (!!viewport && viewport.height < window.innerHeight * 0.75),
      );
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  const [today, setToday] = useState<Today | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const retryDelay = useRef(3000);
  useEffect(() => {
    if (!error) {
      retryDelay.current = 3000;
      return;
    }
    const timer = setTimeout(() => {
      if (!document.hidden) void refresh();
    }, retryDelay.current);
    retryDelay.current = Math.min(60000, retryDelay.current * 2);
    return () => clearTimeout(timer);
  }, [error, today]);
  const refresh = async () => {
    try {
      const data = await api<Snapshot>('/bootstrap');
      publish({ ...data, reset: true });
      setToday(data.today);
      setMe(data.me!);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    const off = subscribe((s) => {
      setToday(s.today);
      setError('');
      setMe(
        (previous) =>
          s.me ||
          (previous
            ? {
                ...previous,
                claim: previous.claim?.category_id === s.today.category?.id ? previous.claim : null,
                file:
                  previous.file && previous.file.category_id === s.today.category?.id
                    ? {
                        ...previous.file,
                        ...(s.leaderboard
                          ? { rank: s.leaderboard.own?.rank || null, players: s.leaderboard.total }
                          : {}),
                      }
                    : null,
              }
            : null),
      );
    });
    let stop = () => {};
    let mounted = true;
    void refresh().then(() => {
      if (mounted)
        stop = watchRegistry((message) => {
          const snapshot = getSnapshot();
          // At the boundary, retain Opening… and its retry loop through transient server failures.
          if (snapshot && serverNow() >= Date.parse(snapshot.today.nextDrop)) return;
          setError(message);
        });
    });
    return () => {
      mounted = false;
      off();
      stop();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('dibs-theme', theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    if (!path.startsWith('/archive'))
      document.title = path.startsWith('/certificate')
        ? 'Dibs | Certificate of Dibs'
        : path === '/about'
          ? 'Dibs | Office notice, rules and privacy'
          : HOME_TITLE;
  }, [path]);
  return (
    <LazyMotion features={domAnimation}>
      <Filters />
      <a className="skip" href="#main">
        Skip to game
      </a>
      <div className={'page ' + (path === '/' ? 'home-page' : '')}>
        {(today?.practice || location.hostname === 'practice.dibs-7hz.pages.dev') && (
          <div className="practice-banner">PRACTICE — NOT THE PUBLIC RECORD</div>
        )}
        <header className="masthead">
          <Link to="/" className="wordmark" aria-label="Dibs home">
            <Wordmark />
          </Link>
          <p className="mast-note">
            DEPARTMENT OF
            <br />
            FIRST COME, FIRST SERVED.
          </p>
          <details className="header-settings">
            <summary>Settings</summary>
            <div className="header-controls">
              <SoundToggle />
              <MusicToggle />
              <button
                className="theme-toggle"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                <span className="theme-swatch" />
                {theme === 'light' ? 'Carbon copy' : 'Paper copy'}
              </button>
              <TimezonePicker />
              <div id="settings-content" />
            </div>
          </details>
          <nav aria-label="Main navigation">
            {[
              ['/', 'Play', 'play'],
              ['/leaderboard', 'Leaderboard', 'board'],
              ['/archive', 'Archive', 'archive'],
              ['/how-it-works', 'How it works', 'rules'],
            ].map(([url, label, icon]) => (
              <Link
                key={url}
                to={url}
                aria-current={
                  url === '/'
                    ? path === '/'
                      ? 'page'
                      : undefined
                    : path.startsWith(url)
                      ? 'page'
                      : undefined
                }
              >
                <Icon name={icon as 'play'} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          {me?.user && (
            <span className="header-player">
              <Handle
                name={me.file?.handle || me.claim?.handle || me.user.handle}
                founder={me.file?.founder || me.claim?.founder}
              />
              <span>Streak {me.streak}</span>
            </span>
          )}
        </header>
        {isDemo && (
          <div className="demo-label">
            DESIGN PROOF · DEVELOPMENT FIXTURES · NOT THE PUBLIC RECORD
          </div>
        )}
        <main id="main">
          {error ? (
            <div className="notice" role="alert">
              <span className="eyebrow">Office notice</span>
              <h1>
                {error.includes('Registry closed')
                  ? 'Registry closed for the day.'
                  : 'The clerk is away.'}
              </h1>
              <p>{error.replace(/^Registry closed for the day\.\s*/, '')}</p>
              <button onClick={() => void refresh()}>Try again</button>
            </div>
          ) : !today || !me ? (
            <div className="loading" role="status">
              LOADING THE GAME<span className="loading-dots"> . . .</span>
            </div>
          ) : path === '/' ? (
            <Home
              key={today.category?.id || 'closed'}
              today={today}
              me={me}
              refresh={refresh}
              setMe={setMe}
            />
          ) : path.startsWith('/summary/') ? (
            <SummaryPage key={path} id={decodeURIComponent(path.split('/').pop()!)} />
          ) : path.startsWith('/certificate/') ? (
            <CertificatePage id={decodeURIComponent(path.split('/').pop()!)} />
          ) : path.startsWith('/archive') ? (
            <Archive />
          ) : path === '/leaderboard' ? (
            <Leaderboard category={today.category?.id} practice={today.practice} />
          ) : path === '/how-it-works' ? (
            <section className="how-page">
              <h1>How it works</h1>
              <Introduction />
              <Rules />
              <Clue clue={today.specials?.clue} />
              <p>
                Each night during launch week we post a clue to one golden ticket. The rest stay
                secret.
              </p>
            </section>
          ) : path === '/about' ? (
            <About nextDrop={today.nextDrop} />
          ) : path === '/admin/schedule' ? (
            <Calendar />
          ) : path === '/admin/live' ? (
            <LiveAdmin />
          ) : path === '/stats' ? (
            <Stats />
          ) : (
            <div className="notice">
              <h1>Page not found.</h1>
              <Link to="/">Return to today</Link>
            </div>
          )}
        </main>
        <footer>
          <Link to="/" className="footer-logo">
            <Wordmark />
          </Link>
          <span>Call it first. It’s yours.</span>
          <Link to="/about">Office</Link>
          <a href="/about#privacy">Privacy</a>
          <a href="/about#sources">Sources</a>
          <Feedback sitekey={today?.turnstileSiteKey || ''} />
        </footer>
      </div>
    </LazyMotion>
  );
}
function CategoryHeading({ name }: { name: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const heading = ref.current!;
    let alive = true;
    const fit = () => {
      if (!alive || !heading.isConnected) return;
      heading.style.fontSize = '';
      heading.style.fontStretch = '';
      const size = parseFloat(getComputedStyle(heading).fontSize);
      const range = document.createRange();
      range.selectNodeContents(heading);
      let width = range.getBoundingClientRect().width;
      if (width > heading.clientWidth) {
        const stretch = parseFloat(getComputedStyle(heading).fontStretch) || 125;
        heading.style.fontStretch =
          Math.max(62.5, (stretch * (heading.clientWidth - 1)) / width) + '%';
        width = range.getBoundingClientRect().width;
      }
      if (width > heading.clientWidth)
        heading.style.fontSize =
          Math.floor(((size * (heading.clientWidth - 1)) / width) * 10) / 10 + 'px';
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(heading);
    void document.fonts.ready.then(fit);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [name]);
  return (
    <h1 ref={ref} className={name.length > 12 ? 'category long' : 'category'}>
      {name}
    </h1>
  );
}
function Home({
  today,
  me,
  refresh,
  setMe,
}: {
  today: Today;
  me: Me;
  refresh: () => Promise<void>;
  setMe: (m: Me) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [keyCopyMessage, setKeyCopyMessage] = useState('');
  const [restoreKey, setRestoreKey] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('file-key') || '',
  );
  const spellingVersion = useRef(0);
  const submitting = useRef(false);
  const pendingRequest = useRef<{ answer: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [guessed, setGuessed] = useState(false);
  const [message, setMessage] = useState('');
  const [taken, setTaken] = useState(false);
  const [houseStrike, setHouseStrike] = useState(false);
  const [takenHolder, setTakenHolder] = useState<{
    name: string;
    founder: boolean;
    answer: string;
  } | null>(null);
  const [claim, setClaim] = useState<Claim | null>(me.claim);
  const file = useMemo(
    () =>
      me.file ? { ...me.file, handle: me.file.handle || me.user?.handle, streak: me.streak } : null,
    [me.file, me.user?.handle, me.streak],
  );
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (file?.closed) {
      window.scrollTo(0, 0);
      void refresh();
    }
  }, [file?.closed]);

  const reduced = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const nextDibs = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (landed && !file?.closed) nextDibs.current?.focus({ preventScroll: true });
  }, [landed, file?.closed]);
  const turnstileBox = useRef<HTMLDivElement>(null);
  const verification = useRef<{ token: string; expires: number } | null>(null);
  const verifying = useRef<Promise<string> | null>(null);
  const [sessionNotice, setSessionNotice] = useState('');
  function verifySession(): Promise<string> {
    if (isDemo) return Promise.resolve('demo');
    if (verification.current && verification.current.expires > Date.now() + 10000)
      return Promise.resolve(verification.current.token);
    if (verifying.current) return verifying.current;
    verifying.current = runTurnstile(today.turnstileSiteKey, turnstileBox.current!)
      .then((turnstileToken) =>
        api<{ sessionToken: string; expires: number; sessionNotice?: string }>('/verify-session', {
          turnstileToken,
        }),
      )
      .then((data) => {
        verification.current = { token: data.sessionToken, expires: data.expires };
        if (data.sessionNotice) setSessionNotice(data.sessionNotice);
        return data.sessionToken;
      })
      .finally(() => {
        verifying.current = null;
      });
    return verifying.current;
  }
  useEffect(() => {
    if (today.category && !file?.closed && turnstileBox.current)
      void verifySession().catch(() => {});
  }, [today.category?.id]);
  useEffect(() => setClaim(me.claim), [me.claim]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const keepFormVisible = () => {
      const focused = document.activeElement === input.current;
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${focused && viewport ? Math.max(0, innerHeight - viewport.height) : 0}px`,
      );
      if (!focused || !viewport) return;
      const row = input.current?.closest('.input-row')?.getBoundingClientRect();
      if (row && row.bottom > viewport.height + viewport.offsetTop - 16) {
        window.scrollBy(0, row.bottom - viewport.height - viewport.offsetTop + 16);
      }
    };
    viewport?.addEventListener('resize', keepFormVisible);
    document.addEventListener('focusin', keepFormVisible);
    document.addEventListener('focusout', keepFormVisible);
    return () => {
      viewport?.removeEventListener('resize', keepFormVisible);
      document.removeEventListener('focusin', keepFormVisible);
      document.removeEventListener('focusout', keepFormVisible);
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, []);

  const now = useServerNow();
  const retry = useRef({ at: 0, delay: 1000, busy: false });
  useEffect(() => {
    if (
      document.hidden ||
      now < Date.parse(today.nextDrop) ||
      retry.current.busy ||
      performance.now() < retry.current.at
    )
      return;
    retry.current.busy = true;
    void api<Snapshot>('/bootstrap')
      .then((data) => publish({ ...data, reset: true }))
      .catch(() => {})
      .finally(() => {
        retry.current.busy = false;
        retry.current.at = performance.now() + retry.current.delay;
        retry.current.delay = Math.min(30000, retry.current.delay * 2);
      });
  }, [now, today.nextDrop]);
  useEffect(() => {
    if (location.hash === '#file-settings') {
      const panel = document.getElementById('file-settings') as HTMLDetailsElement | null;
      if (panel) {
        panel.open = true;
        panel.scrollIntoView({ block: 'start' });
        panel.querySelector('summary')?.focus({ preventScroll: true });
      }
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
      setOutcome('CLAIMS RESTORED');
    } catch (e) {
      setMessage((e as Error).message);
      setOutcome('BACKUP CODE');
    }
  }
  async function sendMissing() {
    try {
      const r = await api<{ message: string }>('/missing', { answer });
      setMessage(r.message);
      setMissing(false);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function identity(action: string, body: unknown) {
    try {
      const data = await api<{ user: Me['user']; file?: DayFile }>('/me/' + action, body);
      setMe({ ...me, user: data.user, file: data.file || me.file });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function submit(e: FormEvent, confirmed?: string) {
    e.preventDefault();
    if (submitting.current || busy || !answer.trim()) return;
    submitting.current = true;
    void prepareSound();
    setBusy(true);
    setGuessed(true);
    setMessage('');
    setSuggestion(null);
    setMissing(false);
    const value = confirmed || answer;
    const spellingAttempt = ++spellingVersion.current;
    try {
      const token = await verifySession();
      if (!pendingRequest.current || pendingRequest.current.answer !== value)
        pendingRequest.current = { answer: value, id: crypto.randomUUID() };
      const send = (sessionToken: string) =>
        api<{
          claim: Claim;
          me?: Me;
          leaderboard?: import('./types').Standings;
          recoveryKey?: string;
          sessionNotice?: string;
        }>('/claim', {
          answer: value,
          requestId: pendingRequest.current!.id,
          sessionToken,
        });
      let result;
      try {
        result = await send(token);
      } catch (e) {
        if ((e as ApiError).data?.code !== 'VERIFY_AGAIN') throw e;
        if ((e as ApiError).data?.sessionNotice)
          setSessionNotice((e as ApiError).data.sessionNotice);
        verification.current = null;
        result = await send(await verifySession());
      }
      if (result.sessionNotice) setSessionNotice(result.sessionNotice);
      playClaimSound(claimSound(201, result), pendingRequest.current!.id);
      pendingRequest.current = null;
      setOutcome(result.claim.golden ? 'GOLD' : 'DIBS');
      setMessage(result.claim.display.toUpperCase());
      if (result.recoveryKey) setRecoveryKey(result.recoveryKey);
      setAnswer('');
      setTaken(false);
      setHouseStrike(false);
      setClaim(result.claim);
      setLanded(true);
      if (result.me) setMe(result.me);
      publishClaim(result.claim, result.me, result.leaderboard);
    } catch (e) {
      const err = e as ApiError;
      playClaimSound(claimSound(err.status, err.data), pendingRequest.current?.id || '');
      if (err.data?.me) {
        setMe(err.data.me);
        const snapshot = getSnapshot();
        if (snapshot)
          publish(
            {
              ...snapshot,
              rows: [],
              me: err.data.me,
              leaderboard: err.data.leaderboard || snapshot.leaderboard,
            },
            true,
          );
      } else if (err.data?.file) setMe({ ...me, file: err.data.file });
      if (err.status && err.status < 500) pendingRequest.current = null;
      setSuggestion(err.data?.suggestion || null);
      if (!err.data?.suggestion && err.data?.spellingCatalog) {
        void submittedSpelling(err.data.spellingCatalog, value).then((suggested) => {
          if (spellingVersion.current === spellingAttempt) setSuggestion(suggested);
        });
      }
      setMissing(err.data?.code === 'NOT_REGISTERED');
      setOutcome(
        err.status === 409
          ? err.data.house
            ? 'RESERVED'
            : 'TAKEN'
          : err.data?.code === 'CLERK_NOTE'
            ? 'A NOTE FROM THE CLERK'
            : err.data?.code === 'NOT_REGISTERED'
              ? 'NOT ON THE LIST'
              : err.status === 403
                ? 'DONE FOR TODAY'
                : 'TRY AGAIN',
      );
      setTaken(err.status === 409);
      setHouseStrike(!!err.data?.house);
      setTakenHolder(
        err.status === 409 && !err.data.house
          ? { name: err.data.takenBy, founder: !!err.data.founder, answer: value.toUpperCase() }
          : null,
      );
      setMessage(
        err.status === 409
          ? err.data.house
            ? `${value.toUpperCase()} is reserved (too obvious, nobody can claim it); try another answer.`
            : `Taken: ${value.toUpperCase()} is ${err.data.takenBy}'s.`
          : err.data?.code === 'NOT_REGISTERED'
            ? "Not on today's list; check the spelling."
            : err.message,
      );
      input.current?.focus();
    } finally {
      submitting.current = false;
      setBusy(false);
      requestAnimationFrame(() => {
        input.current?.focus({ preventScroll: true });
      });
    }
  }
  const playing = !!today.category && !file?.closed;
  return (
    <div className={playing ? 'focused-play' : 'completed-play'}>
      {location.search.includes('file-deleted') && (
        <p role="status">Your data is removed; past claims now show “Withdrawn player”.</p>
      )}
      {!today.category ? (
        <section className="closed-office">
          <div className="closed-copy">
            <Clock target={today.nextDrop} />
            <Reminder at={today.nextDrop} />
            <OpeningTime
              at={today.nextDrop}
              first={
                new Intl.DateTimeFormat('en-CA', { timeZone: DROP_TIME_ZONE }).format(
                  new Date(today.nextDrop),
                ) === LAUNCH_DATE
              }
            />
          </div>
          <Introduction />
        </section>
      ) : file?.closed ? (
        <>
          <span className="file-closed-stamp" role="status">
            DONE FOR TODAY
          </span>
          <p className="done-score">
            {file.points ?? 0} points{file.rank ? ` · #${file.rank} of ${file.players} today` : ''}
          </p>
          <RevealTime today={today} />
          <p className="clerk-aside">{categoryNote(today.category.slug)}</p>
          <DaySummary file={file} today={today} showLedger />
        </>
      ) : (
        <section
          className={'claim-section' + (landed ? ' has-payoff' : '')}
          aria-label="Play today's category"
        >
          <div className="play-heading register-arrival">
            <CategoryHeading name={today.category.name} />
          </div>
          <div className={'claim-paper stock-' + categoryStyle(today.category.slug).stock}>
            {!landed && <Progress dibs={file?.dibs || 0} strikes={file?.strikes || 0} />}
            {landed && claim ? (
              <div
                className={'result-panel win-beat ' + (claim.golden ? 'gold-result' : '')}
                role="status"
              >
                <strong
                  className="win-stamp"
                  style={{ rotate: `${((claim.claim_no * 7.31) % 7) - 4}deg` }}
                >
                  DIBS<span>{claim.display.toUpperCase()}</span>
                </strong>
                <div className="claim-payoff">
                  <p>Yours. {claim.display} has your name on it for good.</p>
                  <p className="points-earned">
                    +{claim.points ?? 0} points
                    {claim.percentile != null
                      ? ` · rarer than ${Math.round(claim.percentile * 100)}% of ${today.category.name.toLowerCase()}`
                      : ' · popularity unknown'}
                    {!!claim.golden && ' · Golden ticket +100'}
                  </p>
                  <p>
                    {MAX_CLAIMS - (file?.dibs || 1)} claims left ·{' '}
                    {MAX_STRIKES - (file?.strikes || 0)} strikes left
                  </p>
                  <RevealTime today={today} />
                </div>
                <div className="win-actions">
                  <button
                    className="primary"
                    ref={nextDibs}
                    tabIndex={0}
                    onClick={() => {
                      setLanded(false);
                      setMessage('');
                      setOutcome('');
                      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
                    }}
                  >
                    Next claim <Icon />
                  </button>
                  <Link to={'/certificate/' + claim.id}>View certificate</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit}>
                <label className="sr-only" htmlFor="answer">
                  Your answer
                </label>
                <div className="input-row">
                  <input
                    ref={input}
                    onFocus={(e) => {
                      if (
                        innerHeight <= 600 &&
                        innerWidth <= 900 &&
                        (!window.visualViewport || window.visualViewport.height >= innerHeight - 1)
                      )
                        e.currentTarget.closest('.input-row')?.scrollIntoView({ block: 'center' });
                    }}
                    id="answer"
                    name="answer"
                    value={answer}
                    placeholder={
                      today.category.slug === 'animals' ? 'Name an animal…' : 'Name an answer…'
                    }
                    onChange={(e) => setAnswer(e.target.value)}
                    readOnly={busy}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="go"
                    maxLength={120}
                  />
                  <button className="primary" disabled={busy || !me.user}>
                    {busy ? 'Claiming…' : 'CALL DIBS'}
                    <Icon />
                  </button>
                </div>
                <p className="claim-subline">Claim this answer as yours.</p>
                {message && (
                  <div
                    className={'result-panel ' + (taken ? 'taken' : '')}
                    role="status"
                    aria-atomic="true"
                  >
                    <p>
                      {taken && <Icon name="cross" />}
                      {taken ? (
                        <>
                          {houseStrike
                            ? 'Reserved (too obvious). −10 points.'
                            : `Taken. −10 points. ${MAX_STRIKES - (file?.strikes || 0)} strikes left.`}
                        </>
                      ) : takenHolder?.founder ? (
                        <>
                          Taken: {takenHolder.answer} is <Handle name={takenHolder.name} founder />
                          ’s.
                        </>
                      ) : (
                        message
                      )}
                    </p>
                    {taken && (
                      <strong className="strike-count">
                        Strike {file?.strikes || 0} of {MAX_STRIKES}
                      </strong>
                    )}
                    {suggestion && (
                      <>
                        <button type="button" onClick={(e) => void submit(e, suggestion)}>
                          Did you mean {suggestion.toUpperCase()}?
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSuggestion(null);
                            input.current?.focus();
                          }}
                        >
                          Keep my spelling
                        </button>
                      </>
                    )}
                    {missing && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void sendMissing()}
                      >
                        Send feedback
                      </button>
                    )}
                  </div>
                )}
              </form>
            )}
            <details
              className="play-introduction play-rules"
              key={String(guessed) + ':' + message}
              open={!guessed && !file?.dibs && !file?.strikes}
            >
              <summary>
                How it works <Icon name="chevron" />
              </summary>
              <Introduction />
              <Rules />
              <Clue clue={today.specials?.clue} />
            </details>
            {taken && <p className="clerk-aside">{clerkLine('strike', file?.strikes || 0)}</p>}
            <div ref={turnstileBox} className="turnstile" />
            {sessionNotice && (
              <p className="session-notice" role="status">
                {sessionNotice}
              </p>
            )}
          </div>
        </section>
      )}
      <Clue clue={today.specials?.clue} />
      {playing && (
        <section className="locked-ledger" aria-label="Answers hidden until the day closes">
          <p>
            {today.claimed.toLocaleString()} claimed · {today.open.toLocaleString()} open
          </p>
          <span>Answers appear when the day closes</span>
        </section>
      )}
      <Leaderboard category={today.category?.id} practice={today.practice} />
      {document.getElementById('settings-content') &&
        createPortal(
          <details
            id="file-settings"
            className="file-key-panel"
            open={restoreKey ? true : undefined}
          >
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
            <DeleteFile sitekey={today.turnstileSiteKey} initialKey={restoreKey} />
          </details>,
          document.getElementById('settings-content')!,
        )}
      {file?.closed && (
        <>
          {recoveryKey && (
            <section className="file-key-panel">
              <h2>Your backup code</h2>
              <strong>{recoveryKey}</strong>
              <p>{BACKUP_EXPLANATION} Keep it private.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function Reminder({ at }: { at: string }) {
  const links = reminder(at);
  const appleFirst = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const mac = /Mac/.test(navigator.platform) && !appleFirst;
  const apple = (
    <a key="apple" href={'/reminder.ics?at=' + encodeURIComponent(at)}>
      Apple Calendar{mac ? ' (downloads a file, then open it)' : ''}
    </a>
  );
  const google = (
    <a key="google" href={links.google} target="_blank" rel="noopener noreferrer">
      Google Calendar
    </a>
  );
  return (
    <details
      className="reminder-menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.currentTarget.open = false;
          e.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="reminder-button">
        Remind me <Icon name="chevron" />
      </summary>
      <div className="reminder-options">
        <p>
          Five minutes before <DropTime at={at} />. Daily.
        </p>
        {appleFirst ? [apple, google] : [google, apple]}
        <a href={links.outlook} target="_blank" rel="noopener noreferrer">
          Outlook
        </a>
        <small>Outlook opens one event. Set Repeat to Daily.</small>
      </div>
    </details>
  );
}

function RevealTime({ today }: { today: Today }) {
  const at = today.closesAt || today.nextDrop;
  return (
    <div className="reveal-time">
      <p>The full board and golden tickets reveal when the day closes.</p>
      <div>
        <span>Closes {dropTime(at).full} your time.</span>
        <Reminder at={at} />
      </div>
    </div>
  );
}

function InstallHint() {
  const [show, setShow] = useState(() => {
    try {
      return (
        matchMedia('(max-width: 600px)').matches &&
        !localStorage.getItem('dibs-install-hint') &&
        !matchMedia('(display-mode: standalone)').matches
      );
    } catch {
      return false;
    }
  });
  return show ? (
    <aside className="install-hint">
      <p>Keep Dibs handy: browser menu, then Add to Home Screen.</p>
      <button
        onClick={() => {
          try {
            localStorage.setItem('dibs-install-hint', '1');
          } catch {}
          setShow(false);
        }}
      >
        Got it
      </button>
    </aside>
  ) : null;
}
function Introduction() {
  return (
    <section className="game-intro" aria-label="How to play Dibs">
      <div className="game-explanation">
        <p>{GAME_EXPLANATION}</p>
        <p>{LIMIT_EXPLANATION}</p>
      </div>
      <div className="worked-example" aria-label="Example">
        <p>
          <strong>Example:</strong> Today's category is <strong>Animals</strong>.
        </p>
        <p>
          You type <strong>Okapi</strong>. Nobody has claimed it yet, so <strong>it's yours</strong>
          . <span className="example-stamp yours">YOURS</span>
        </p>
        <p>
          You type <strong>Lion</strong>. Someone already claimed it, so you get{' '}
          <strong>a strike</strong>. <span className="example-stamp taken">TAKEN</span>
        </p>
      </div>
    </section>
  );
}
function Rules() {
  return (
    <div className="plain-rules">
      <p>{FINISH_EXPLANATION}</p>
      <p>{SCHEDULE_EXPLANATION}</p>
      <p>{GOLDEN_EXPLANATION}</p>
      <p>{RESERVED_EXPLANATION}</p>
    </div>
  );
}
function OpeningTime({ at, first }: { at: string; first: boolean }) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: viewerZone(),
  }).format(new Date(at));
  return (
    <h1>
      The {first ? 'first' : 'next'} category opens{' '}
      <strong>
        {weekday} at {localTime(at).label}
      </strong>{' '}
      your time{' '}
      <span className="opening-zone">
        (in Toronto time it's {localTime(at, DROP_TIME_ZONE).full}).
      </span>
    </h1>
  );
}

function Progress({ dibs, strikes }: { dibs: number; strikes: number }) {
  return (
    <div className="file-progress">
      <span className="dibs-progress">
        <strong>
          Claims {dibs} of {MAX_CLAIMS}
        </strong>
        <span className="dibs-marks" aria-hidden="true">
          {Array.from({ length: MAX_CLAIMS }, (_, i) => (
            <i key={i} className={i < dibs ? 'used' : ''}>
              D
            </i>
          ))}
        </span>
      </span>
      <span className="strikes-progress">
        <strong>
          Strikes {strikes} of {MAX_STRIKES}
        </strong>
        <span className="strike-row" role="img" aria-label={`${strikes} of ${MAX_STRIKES} strikes`}>
          {Array.from({ length: MAX_STRIKES }, (_, i) => (
            <i key={i} className={i < strikes ? 'used' : ''} />
          ))}
        </span>
      </span>
    </div>
  );
}
function DaySummary({
  file,
  today,
  showLedger = false,
}: {
  file: DayFile;
  today: Today;
  showLedger?: boolean;
}) {
  const render = useCallback(
    (story: boolean) => exportSummary(file, today.category!, story),
    [file, today.category],
  );
  return (
    <section className="day-summary">
      <article
        className={
          'summary-paper day-certificate stock-' + categoryStyle(today.category!.slug).stock
        }
        aria-label="Day summary"
      >
        <div className="day-cert-heading">
          <span className="eyebrow">Day certificate</span>
          <Wordmark />
        </div>
        <div className="day-category">
          <h2>{today.category!.name}</h2>
        </div>
        <div className="signed-date">
          <p className="postmark-date">{dateLabel(today.category!.date)}</p>
          <Signature />
        </div>
        <p className="certificate-score">
          {file.points ?? 0} points{file.rank ? ` · #${file.rank} of ${file.players}` : ''} · Streak{' '}
          {file.streak || 0}
        </p>
        <p className="file-tally">
          {file.dibs}/{MAX_CLAIMS} claims · {file.strikes}{' '}
          {file.strikes === 1 ? 'strike' : 'strikes'} · filed {time(file.completedAt!)}
        </p>
        <Progress dibs={file.dibs} strikes={file.strikes} />

        <ol className="summary-answers">
          {guesses(file).map((event, i) => (
            <li key={i} className={event.kind === 'strike' ? 'rejected-filing' : 'accepted-filing'}>
              <span className="guess-number">{String(i + 1).padStart(2, '0')}</span>
              <div>
                {event.kind === 'dibs' ? (
                  <>
                    {event.claimId ? (
                      <>
                        <strong>{event.display}</strong>{' '}
                        <Link className="view-certificate" to={'/certificate/' + event.claimId}>
                          view
                        </Link>
                      </>
                    ) : (
                      <strong>{event.display}</strong>
                    )}
                    <span className={'mini-stamp ' + (event.golden ? 'gold-mini' : '')}>
                      DIBS{event.golden ? ' / GOLD' : ''}
                      {(event.obscurity || 0) >= 4 ? ' / DEEP CUT' : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <s>{event.display}</s>
                    <small>
                      {event.house ? (
                        'RESERVED'
                      ) : event.holder ? (
                        <>
                          Taken by <Handle name={event.holder} founder={event.holderFounder} />
                          {event.heldAt && <> at {time(event.heldAt)}</>}
                        </>
                      ) : (
                        'Holder details were not retained'
                      )}
                    </small>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="day-cert-holder">
          <span className="eyebrow">Your name</span>
          <strong>
            <Handle
              name={file.handle || file.claims[0]?.handle || 'Anonymous filer'}
              founder={file.founder || file.claims.some((c) => c.founder)}
            />
          </strong>
        </div>
        <div className="cert-footer">
          <span>ALL CLAIMS ENTIRELY CEREMONIAL.</span>
          <span>{PUBLIC_HOST}</span>
        </div>
      </article>
      <aside className="day-companions">
        {showLedger && <Introduction />}
        <ShareSheet
          url={summaryUrl(file.summaryId!)}
          text={summaryText(file, today.category!)}
          render={render}
        />
        <Reminder at={today.nextDrop} />
        <Clock target={today.nextDrop} />
        <InstallHint />
        {showLedger && today.revealed && (
          <>
            <Ledger
              category={today.category!}
              open={today.open}
              goldenFound={today.specials?.goldenFound}
              goldenTotal={today.specials?.goldenTotal}
            />
          </>
        )}
      </aside>
    </section>
  );
}
async function runTurnstile(sitekey: string, container: HTMLElement): Promise<string> {
  if (!sitekey) throw new Error('Verification is not configured. The clerk has been notified.');
  const win = window as any;
  if (!win.turnstile) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('turnstile-script');
      if (existing) existing.remove();
      const s = document.createElement('script');
      s.id = 'turnstile-script';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error('Verification could not load. Please try a regular browser.'));
      document.head.appendChild(s);
    });
  }
  container.replaceChildren();
  return new Promise((resolve, reject) => {
    let widget: string;
    const timeout = setTimeout(() => {
      if (widget) win.turnstile.remove(widget);
      reject(new Error('Verification took too long. Please try again.'));
    }, 90000);
    widget = win.turnstile.render(container, {
      sitekey,
      action: 'claim',
      theme: document.documentElement.dataset.theme,
      callback: (t: string) => {
        clearTimeout(timeout);
        win.turnstile.remove(widget);
        resolve(t);
      },
      'error-callback': () => {
        clearTimeout(timeout);
        win.turnstile.remove(widget);
        reject(new Error('Verification failed. Please try again.'));
      },
      'expired-callback': () => {
        clearTimeout(timeout);
        win.turnstile.remove(widget);
        reject(new Error('Verification expired. Please try again.'));
      },
    });
  });
}
function Streak({ me }: { me: Me }) {
  return (
    <div className="streak">
      <span className="eyebrow">
        ATTENDANCE RECORD / {me.streak} {me.streak === 1 ? 'DAY' : 'DAYS'}
      </span>
      <div aria-label={`${me.streak} consecutive days with a claim`}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={i < Math.min(7, me.streak) ? 'marked' : ''}>
            {i < Math.min(7, me.streak) ? 'D' : '—'}
          </span>
        ))}
      </div>
    </div>
  );
}
function Ledger({
  category,
  open,
  goldenFound,
  goldenTotal,
}: {
  category: Category | null;
  open?: number;
  goldenFound?: number;
  goldenTotal?: number;
}) {
  const [rows, setRows] = useState<Claim[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    setRows([]);
    let version = getSnapshot()?.version || 0;
    const accept = (s: Snapshot) => {
      if (s.today.category?.id === category?.id) {
        const reset = version !== (s.version || 0);
        version = s.version || 0;
        setRows((previous) => {
          setNewIds(
            new Set(s.rows.filter((r) => !previous.some((p) => p.id === r.id)).map((r) => r.id)),
          );
          return reset
            ? s.rows
            : [...new Map([...previous, ...s.rows].map((r) => [r.id, r])).values()].sort(
                (a, b) => b.claim_no - a.claim_no,
              );
        });
        setError('');
      }
    };
    const snapshot = getSnapshot();
    if (snapshot && snapshot.today.category?.id === category?.id) accept(snapshot);
    else if (category)
      api<{ rows: Claim[] }>(
        '/ledger?category=' +
          category.id +
          (location.pathname === '/archive' && new URLSearchParams(location.search).get('before')
            ? '&before=' + encodeURIComponent(new URLSearchParams(location.search).get('before')!)
            : ''),
      )
        .then((d) => {
          if (alive) setRows(d.rows);
        })
        .catch(() => {
          if (alive) setError('Results could not refresh; try again shortly.');
        });
    const off = subscribe(accept);
    return () => {
      alive = false;
      off();
    };
  }, [category?.id]);
  const filtered = rows.filter((r) =>
    `${r.display} ${r.handle}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="ledger-section">
      <div className="section-heading">
        <div>
          <span className="section-number">LEDGER</span>
          <h2>
            Today’s claims
            <span className="live-mark" aria-hidden="true" />
          </h2>
        </div>
        <label className="search">
          <span className="eyebrow">Search claims</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Answer or player"
            aria-label="Search claims"
          />
        </label>
      </div>
      {error && <p role="status">{error}</p>}
      {goldenFound !== undefined && (
        <p className="gold-announcement" role="status">
          Golden tickets: {goldenFound} of{' '}
          {goldenTotal ?? goldenPerDay(category?.date || LAUNCH_DATE)} found today
        </p>
      )}
      {category && open !== undefined && rows.length < 10 && (
        <p className="open-pool">
          {open.toLocaleString()} of {category.total_registrable.toLocaleString()}{' '}
          {categoryPlural(category)} still unclaimed. Be early.
        </p>
      )}
      <table className={'ledger ' + (rows.length < 10 ? 'first-filings' : '')}>
        <caption className="sr-only">Claims in {category?.name || 'today’s registry'}</caption>
        <thead>
          <tr>
            <th>No.</th>
            <th>ANSWER</th>
            <th>PLAYER</th>
            <th className="time-col">TIME</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className={newIds.has(r.id) ? 'new-row' : ''}>
              <td>{serial(r.claim_no)}</td>
              <td>
                <Link to={'/certificate/' + r.id}>
                  {!!r.golden && <Icon name="star" />}
                  {r.display}
                </Link>
              </td>
              <td>
                <Handle name={r.handle} founder={r.founder} />
                <span className="mobile-meta">{time(r.created_at)}</span>
              </td>
              <td className="time-col">
                <RelativeTime at={r.created_at} />
              </td>
            </tr>
          ))}
          {!filtered.length && (query || !category) && (
            <tr className="empty-row">
              <td colSpan={4}>
                {query
                  ? 'No matching entries in this register.'
                  : category
                    ? 'The first line is still blank. A fine place for your name.'
                    : 'No claims yet.'}
              </td>
            </tr>
          )}
          {!query &&
            category &&
            rows.length < 10 &&
            Array.from({ length: Math.min(3, 10 - rows.length) }, (_, i) => (
              <tr className="open-filing" key={'blank' + i}>
                <td colSpan={4}>
                  No. {serial(Math.max(0, ...rows.map((r) => r.claim_no)) + i + 1)} — open
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {rows.length >= 50 && (
        <button
          className="load-older"
          onClick={async () => {
            try {
              const before = Math.min(...rows.map((r) => r.claim_no));
              const data = await api<{ rows: Claim[] }>(
                '/ledger?category=' + category?.id + '&before=' + before + '&limit=50',
              );
              setRows((previous) => [
                ...previous,
                ...data.rows.filter((r) => !previous.some((p) => p.id === r.id)),
              ]);
              if (!data.rows.length) setError('You have reached the first filing.');
            } catch {
              setError('Older filings could not be loaded. Please try again.');
            }
          }}
        >
          Load earlier filings
        </button>
      )}
      <div className="ledger-foot">
        <span>{rows.length.toLocaleString()} filed</span>
        <span>Live</span>
      </div>
    </section>
  );
}
export function Certificate({ claim, animated = false }: { claim: Claim; animated?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={
        'certificate stock-' +
        categoryStyle(claim.category_name.toLowerCase()).stock +
        ' ' +
        (animated ? 'printing ' : '') +
        (claim.golden ? 'gold-certificate' : '')
      }
      initial={animated && !reduced ? { y: 80, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.25 }}
      aria-label={'Certificate of Dibs for ' + claim.display}
    >
      <div className="cert-rule">
        <span>
          {claim.category_id === 'practice'
            ? 'PRACTICE — NOT THE PUBLIC RECORD'
            : 'REGISTRY OF CLAIMS'}
        </span>
        <span>FORM D-1</span>
      </div>
      <div className="cert-top">
        <span className="eyebrow">
          CERTIFICATE OF DIBS
          <br />
          No. {serial(claim.claim_no)}
        </span>
        <span className="cert-emblem" aria-hidden="true">
          <Wordmark />
        </span>
      </div>
      <p className="cert-intro">
        Let the record show.
        <br />I called dibs on
      </p>
      <h2 className={'cert-answer ' + (claim.display.length > 15 ? 'long-answer' : '')}>
        {claim.display}
      </h2>
      <div className="cert-category">
        <span>{claim.category_name.toUpperCase()}</span>
        <span>{dateLabel(claim.category_date)}</span>
      </div>
      <Signature />
      <div className="cert-holder">
        <span className="eyebrow">Held by</span>
        <strong>
          <Handle name={claim.handle} founder={claim.founder} />
        </strong>
      </div>
      <div className="cert-bottom">
        <div>
          <span className="eyebrow">Obscurity</span>
          <div
            className="obscurity"
            role="img"
            aria-label={claim.obscurity ? `${claim.obscurity} out of 5` : 'Unrated'}
          >
            {claim.obscurity
              ? Array.from({ length: MAX_STRIKES }, (_, i) => (
                  <span
                    aria-hidden="true"
                    key={i}
                    className={'obscurity-dot ' + (i < claim.obscurity! ? 'filled' : '')}
                  />
                ))
              : 'UNRATED'}
          </div>
          <span className="cert-source">
            {claim.obscurity ? 'Wikipedia pageviews' : 'Pageview data unavailable'}
          </span>
        </div>
        <motion.div
          className={'dibs-stamp ' + (claim.golden ? 'gold-stamp' : '')}
          style={{ rotate: ((claim.claim_no * 7.31) % 7) - 4 }}
          initial={animated && !reduced ? { scale: 1.4, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.18, delay: 0.65 }}
        >
          <strong>DIBS</strong>
          <span>
            {claim.golden ? (
              <>
                <Icon name="star" /> GOLDEN TICKET
              </>
            ) : claim.obscurity && claim.obscurity >= 4 ? (
              'DEEP CUT'
            ) : (
              'REGISTERED'
            )}
          </span>
        </motion.div>
      </div>

      <div className="cert-footer">
        <span>ONE OF {claim.total_registrable.toLocaleString()}. ONLY ONE YOURS.</span>
        <span>
          {PUBLIC_HOST}/c/{claim.id.slice(0, 16)}
        </span>
      </div>
    </motion.article>
  );
}
function ShareButtons({ claim }: { claim: Claim }) {
  const render = useCallback((story: boolean) => exportCertificate(claim, story), [claim]);
  return <ShareSheet url={certificateUrl(claim.id)} text={GAME_DESCRIPTION} render={render} />;
}
function SummaryPage({ id }: { id: string }) {
  const [data, setData] = useState<{
    file: DayFile;
    category: Category;
    nextDrop: string;
    specials?: Today['specials'];
  }>();
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ file: DayFile; category: Category; nextDrop: string; specials?: Today['specials'] }>(
      '/summary/' + encodeURIComponent(id),
    )
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <section className="summary-page">
      <div className="page-heading">
        <span className="eyebrow">Day certificate</span>
        <h1>A day on file.</h1>
        <Link to="/">
          Play today’s Dibs <Icon />
        </Link>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : data ? (
        <DaySummary
          file={data.file}
          today={{
            category: data.category,
            specials: data.specials,
            nextDrop: data.nextDrop,
            claimed: 0,
            open: 0,
            turnstileSiteKey: '',
          }}
        />
      ) : (
        <p role="status">Opening the file…</p>
      )}
    </section>
  );
}
function CertificatePage({ id }: { id: string }) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ claim: Claim }>('/certificate/' + id)
      .then((d) => setClaim(d.claim))
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <section className="certificate-page">
      <div className="page-heading">
        <span className="eyebrow">Certificate</span>
        <h1>On the record.</h1>
        <p>Temporary ownership. Permanent bragging rights.</p>
      </div>
      {claim ? (
        <>
          <Certificate claim={claim} />
          <ShareButtons claim={claim} />
        </>
      ) : (
        <p role="status">{error || 'Retrieving the original…'}</p>
      )}
      <Link to="/">
        <Icon name="back" /> Back to the register
      </Link>
    </section>
  );
}
function Archive() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ categories: Category[] }>('/archive')
      .then((d) => {
        setCategories(d.categories);
        setSelected(
          d.categories.find((c) => c.date === new URLSearchParams(location.search).get('date')) ||
            d.categories[0] ||
            null,
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (selected) {
      const before = Math.max(
        0,
        Math.floor(Number(new URLSearchParams(location.search).get('before')) || 0),
      );
      document.title = archiveTitle(selected) + (before ? ' | Filings before #' + before : '');
      document
        .querySelector('link[rel="canonical"]')
        ?.setAttribute(
          'href',
          PUBLIC_ORIGIN + '/archive?date=' + selected.date + (before ? '&before=' + before : ''),
        );
    }
    if (!selected || selected.specials) return;
    let alive = true;
    api<{ categories: Category[] }>('/archive?id=' + encodeURIComponent(selected.id))
      .then((data) => {
        if (alive) setSelected(data.categories.find((c) => c.id === selected.id) || selected);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [selected?.id]);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">Archive</span>
        <h1>
          Yesterday
          <br />
          belongs here.
        </h1>
        <p>A record of who called what. No revisions to history.</p>
      </div>
      <div className="archive-layout">
        <aside>
          <span className="eyebrow">Select a day</span>
          {categories.length ? (
            <select
              aria-label="Archive date"
              value={selected?.id || ''}
              onChange={(e) => {
                const c = categories.find((x) => x.id === e.target.value)!;
                setSelected(c);
                history.replaceState({}, '', '/archive?date=' + c.date);
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.date} / {c.name}
                </option>
              ))}
            </select>
          ) : (
            <p>{error || 'Volume I is waiting for its first page.'}</p>
          )}
          <div className="archive-spine" aria-hidden="true">
            <Wordmark /> VOL. I / PUBLIC RECORD
          </div>
        </aside>
        <div>
          {selected && (
            <div className="archive-date">
              <span className="eyebrow">REG. {selected.date}</span>
              <h2>{selected.name}</h2>
            </div>
          )}
          {selected ? (
            <>
              <Leaderboard category={selected.id} final />
              <Ledger
                category={selected}
                goldenFound={selected.specials?.goldenFound}
                goldenTotal={selected.specials?.goldenTotal}
              />
              {selected.specials && (
                <section className="archive-specials">
                  <span className="house-stamp">RESERVED</span>
                  <h2>The obvious answers are reserved.</h2>
                  <p>These entries never counted as player claims.</p>
                  <ul className="reserved-list">
                    {selected.specials.houseWords.map((w) => (
                      <li key={w.display}>{w.display.toUpperCase()}</li>
                    ))}
                  </ul>
                  <h2>Golden tickets.</h2>
                  {!selected.specials.commitment && (
                    <p>No commitment was filed before this register closed.</p>
                  )}
                  <p className="gold-summary">
                    Golden tickets: {selected.specials.goldenFound} of{' '}
                    {selected.specials.goldenTotal} found
                  </p>
                  {selected.specials.reveal && (
                    <>
                      <p className="gold-summary">
                        {selected.specials.verified ? (
                          <>
                            <Icon name="check" /> Verified
                          </>
                        ) : (
                          'Verification unavailable'
                        )}
                      </p>
                      <ul>
                        {selected.specials.reveal.answers.map((a) => (
                          <li key={a.id}>
                            {a.display}
                            {a.clued ? ' · clued' : ''}
                          </li>
                        ))}
                      </ul>
                      <details>
                        <summary>Verify the commitment</summary>
                        <p>
                          SHA-256 of the exact UTF-8 payload below must equal the commitment
                          published at the drop.
                        </p>
                        <code>{selected.specials.commitment}</code>
                        <pre>{selected.specials.reveal.payload}</pre>
                      </details>
                    </>
                  )}
                </section>
              )}
            </>
          ) : (
            !error && (
              <section className="archive-specimen">
                <h2>No past days yet.</h2>
                <p>The first results appear after a day closes.</p>
              </section>
            )
          )}
        </div>
      </div>
    </>
  );
}
function About({ nextDrop }: { nextDrop: string }) {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">PLEASE READ BEFORE FILING / NOTICE 001</span>
        <h1>
          Dibs. A small claim.
          <br />A public record.
        </h1>
        <p>Welcome to the least consequential office in town.</p>
      </div>
      <div className="about-layout">
        <section>
          <h2>How to play</h2>
          <p>{GAME_EXPLANATION}</p>
          <p>{LIMIT_EXPLANATION}</p>
          <Rules />
          <details>
            <summary>
              More rules <Icon name="chevron" />
            </summary>
            <ol className="rules">
              <li>
                <span>
                  Next drop: <DropTime at={nextDrop} />. First come, first served.
                </span>
              </li>

              <li>
                The golden list is published when the day ends, so you can check it wasn't changed.
              </li>
              <li>Ties go to whoever reached that score first.</li>
            </ol>
          </details>
          <h2 className="faq-heading">Frequently asked questions</h2>
          <h3>When does the category drop?</h3>
          <p>
            Next drop: <DropTime at={nextDrop} />. Same moment for everyone.
          </p>
          <h3>Are golden tickets fair?</h3>
          <p>
            Yes. They’re picked and locked before the category opens. When it closes, we publish
            them so anyone can check they never changed.
          </p>
          <h3>How do points work?</h3>
          <p>Rarer answers score more. Golden tickets +100. Strikes −10.</p>
          <h3>What counts toward a streak?</h3>
          <p>Make a claim on consecutive drops. Missing a drop resets your streak.</p>
          <h3>Is it free?</h3>
          <p>Yes. Dibs is free to play.</p>
          <div className="about-stamp">
            NO ACTUAL
            <br />
            PROPERTY RIGHTS
          </div>
        </section>
        <aside className="office-note">
          <span className="eyebrow">A note on the record</span>
          <h2>Privacy</h2>
          <p>Your random name and claims are public; a cookie remembers you for one year.</p>
          <p>
            <strong>Backup code.</strong> {BACKUP_EXPLANATION} Keep it private.
          </p>
          <p>
            We keep claims and strikes, plus a hash of your backup code; we never store raw IP
            addresses or sell data.
          </p>
          <p>
            Abuse-prevention hashes change daily and expire after two days; browser sessions and
            private backups expire after 30 days.
          </p>
          <p>
            Missing-answer submissions and feedback expire after 90 days; anonymous share and
            arrival totals have no names or IP addresses.
          </p>
          <p>
            <a href="/#file-settings">Delete my data</a> removes your name, backup code, streak and
            feedback; past claims stay as “Withdrawn player”, with no link between days.
          </p>
          <p>
            Use <a href="#feedback">Send feedback</a> for privacy questions; we collect no reply
            address.
          </p>
          <p>For players 13 and up.</p>
          <p>The founder plays by the same rules.</p>
        </aside>
        <section className="office-sources">
          <div>
            <h2>Sources and attribution</h2>
            <p>
              Registers use <a href="https://www.geonames.org/">GeoNames</a> (CC BY), Princeton
              WordNet, Wikipedia contributors (CC BY-SA),{' '}
              <a href="https://www.wikidata.org/wiki/Wikidata:Licensing">Wikidata</a> (CC0),{' '}
              <a href="https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c">
                GBIF Backbone Taxonomy
              </a>{' '}
              (CC BY 4.0), <a href="https://plants.usda.gov/">USDA NRCS PLANTS</a> (public plant
              data), <a href="https://www.mammaldiversity.org/">Mammal Diversity Database</a> (CC BY
              4.0), <a href="https://www.worldbirdnames.org/">IOC World Bird List</a> (CC BY 3.0),{' '}
              <a href="https://world.openfoodfacts.org/">Open Food Facts</a> (ODbL), and ISO 3166
              data (MIT), plus <a href="https://ourairports.com/">OurAirports</a> (public domain),
              and <a href="https://ssd.jpl.nasa.gov/">NASA/JPL</a> small-body data. Wikipedia
              pageviews rank measured answers.{' '}
              <a href="/data/licenses.txt">Full licenses and source notes</a>.
            </p>
          </div>
          <div>
            <h2>Golden-ticket commitment</h2>
            <p>
              Before a register opens, the clerk publishes a SHA-256 commitment. Once it closes, the
              archive reveals the seed and answer IDs so anyone can check the draw.{' '}
              <Link to="/archive">Read the archive</Link>.
            </p>
            <p>
              Obscurity uses Wikipedia pageviews, grouped from 1 (familiar) to 5 (less read). It
              describes the article’s readership, not your intelligence.
            </p>
            {SHOW_CREATOR_CREDIT && (
              <p>
                Made by <a href={CREATOR_URL}>Ashwathram</a> · <a href={X_URL}>X</a>
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function Stats() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  async function load(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + token } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setData(d);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">CLERK ACCESS / FORM X-1</span>
        <h1>Office figures.</h1>
        <p>Actual counts from the registry. No decorative numbers.</p>
      </div>
      <form onSubmit={load} className="admin-form">
        <label htmlFor="token">Admin token</label>
        <input
          type="password"
          id="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          required
        />
        <button className="primary">Read the record</button>
      </form>
      <p role="status">{error}</p>
      {data && (
        <>
          <table className="record-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>NEW USERS</th>
                <th>CLAIMERS / CLAIMS</th>
                <th>SHARE TAPS</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d: any) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.new_users}</td>
                  <td>
                    {d.active_claimers} / {d.claims}
                  </td>
                  <td>{d.shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="record-table">
            <caption>Missing answers submitted to the clerk</caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>Category</th>
                <th>Answer</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {(data.missing || []).map((r: any) => (
                <tr key={r.day + r.category_id + r.answer}>
                  <td>{r.day}</td>
                  <td>{r.category_id}</td>
                  <td>{r.answer}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="record-table platform-table">
            <caption>Sharing by platform · all recorded taps and first arrivals</caption>
            <thead>
              <tr>
                <th>PLATFORM</th>
                <th>SHARE TAPS</th>
                <th>ARRIVALS</th>
              </tr>
            </thead>
            <tbody>
              {(data.platforms || []).map((row: any) => (
                <tr key={row.platform}>
                  <td>{row.platform}</td>
                  <td>{row.shares}</td>
                  <td>{row.arrivals}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            D1 retention: {data.d1.retained} / {data.d1.eligible} · D7 retention: {data.d7.retained}{' '}
            / {data.d7.eligible}
          </p>
          <p className="fine-print">
            Daily totals use UTC. Return claimers among mature first-claim cohorts use Toronto
            registry dates. Exact day +1 / +7; not rolling retention.
          </p>
        </>
      )}
    </>
  );
}

function DeleteFile({ sitekey, initialKey = '' }: { sitekey: string; initialKey?: string }) {
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
function Feedback({ sitekey }: { sitekey: string }) {
  const [topic, setTopic] = useState('game');
  const [text, setText] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  return (
    <details id="feedback" className="feedback">
      <summary>Send feedback</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            const turnstileToken = isDemo ? 'demo' : await runTurnstile(sitekey, box.current!);
            const data = await api<{ message: string }>('/feedback', {
              text,
              topic,
              turnstileToken,
            });
            setMessage(data.message);
            setText('');
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="feedback-topic">Topic</label>
        <select id="feedback-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="game">Game question</option>
          <option value="privacy">Privacy question</option>
        </select>
        <label htmlFor="feedback-note">Private note · 500 characters max</label>
        <textarea
          id="feedback-note"
          maxLength={topic === 'privacy' ? 482 : 500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <div ref={box} />
        <button disabled={busy}>{busy ? 'Sending…' : 'Send note'}</button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
function LiveAdmin() {
  const [draft, setDraft] = useState(''),
    [token, setToken] = useState(''),
    [data, setData] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const r = await fetch('/api/admin/live', { headers: { authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        if (active) {
          setData(d);
          setError('');
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  return (
    <section className="admin-live">
      <h1>Live office.</h1>
      <a href="/admin/schedule">Topic calendar</a>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          setToken(draft);
        }}
      >
        <label htmlFor="live-token">Admin token</label>
        <input
          id="live-token"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button>Open Live</button>
      </form>
      <p role="status">{error}</p>
      {data && (
        <>
          <p>Last five minutes · updates every 15 seconds</p>
          <dl className="live-metrics">
            {Object.entries({
              'Active players': data.active,
              'Claims / minute': data.claimsPerMinute,
              'Strikes / minute': data.strikesPerMinute,
              'Files completed': data.filesCompleted,
              Errors: data.errors,
              'Verification failures': (100 * data.turnstileFailureRate).toFixed(1) + '%',
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <h2>Free-tier usage</h2>
          <p>{data.usageNote}</p>
          <ul>
            {Object.entries(data.limits).map(([key, limit]) => (
              <li key={key}>
                {key}: {(data.usage[key] || 0).toLocaleString()} / {Number(limit).toLocaleString()}{' '}
                <meter min={0} max={Number(limit)} value={data.usage[key] || 0} />
              </li>
            ))}
          </ul>
          <h2>Private feedback</h2>
          {data.feedback.length ? (
            data.feedback.map((note: any) => (
              <article key={note.id}>
                <p>{note.text}</p>
                <small>{time(note.created_at)}</small>
              </article>
            ))
          ) : (
            <p>No notes yet.</p>
          )}
        </>
      )}
    </section>
  );
}
