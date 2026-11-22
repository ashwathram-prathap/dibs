import { Calendar } from './Calendar';
import { categoryStyle, paperStocks } from '../shared/category-style';
import { clerkLine } from '../shared/clerk-lines';
import { BrandProof } from './BrandProof';
import { prepareSound, stampSound, soundEnabled } from './sound';
import { submittedSpelling } from './spelling';
import { HOME_TITLE, archiveTitle } from '../shared/seo';
import { Icon } from './Icon';
import { SHOW_CREATOR_CREDIT, CREATOR_URL, X_URL } from '../shared/creator';
import { categoryPlural } from '../shared/category-copy';
import { dropTime, localTime, countdown, edition, viewerZone } from '../shared/time';
import { guesses } from '../shared/guesses';
import { useServerNow, serverNow } from './clock';
import {
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
import { WORDMARK_WIDTH, WORDMARK_PATH, WORDMARK_BLOCK_X } from '../shared/brand';
function Seal({ className = '' }: { className?: string }) {
  return (
    <img
      className={'official-seal ' + className}
      src="/art/seal.svg"
      alt="Registry of Dibs · First come, first served · Est. 2026"
    />
  );
}
function Plate({ slug }: { slug: string }) {
  if (slug !== 'animals') return null;
  return (
    <figure className="engraving-plate stock-sage">
      <img
        src="/art/animals-plate.jpg"
        alt="Rhinoceros woodcut by Albrecht Dürer"
        width="1127"
        height="893"
      />
      <figcaption>
        <span>Plate I. Animals</span>
        <span>Dürer, 1515</span>
      </figcaption>
    </figure>
  );
}

function Handle({ name, founder }: { name: string; founder?: boolean | number }) {
  return (
    <span className={founder ? 'founder-handle' : undefined}>
      {name}
      {!!founder && <small className="founder-stamp">FOUNDER</small>}
    </span>
  );
}
function Wordmark() {
  return (
    <svg className="brand-mark" role="img" aria-label="dibs." viewBox={`0 0 ${WORDMARK_WIDTH} 100`}>
      <path fill="currentColor" d={WORDMARK_PATH} />
      <path fill="#E1462B" d={`M${WORDMARK_BLOCK_X} 67h18v18h-18z`} />
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
      <span className="eyebrow">{slim ? 'Round closes in' : 'NEXT DROP'}</span>
      <span className="clock" aria-hidden="true">
        {remaining ? countdown(target, now) : 'Opening…'}
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
function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  return (
    <button
      className="sound-toggle"
      aria-label={on ? 'Turn stamp sound off' : 'Turn stamp sound on'}
      aria-pressed={on}
      onClick={() => {
        try {
          localStorage.setItem('dibs-sound', on ? 'off' : 'on');
        } catch {}
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
  const zones: string[] = (Intl as any).supportedValuesOf?.('timeZone') || [
    zone,
    'America/Toronto',
    'America/Vancouver',
    'Europe/London',
    'Asia/Kolkata',
  ];
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
        {[...new Set([zone, ...zones])].map((z) => (
          <option key={z} value={z}>
            {z.replaceAll('_', ' ')}
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
  const [today, setToday] = useState<Today | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
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
                file: previous.file?.category_id === s.today.category?.id ? previous.file : null,
              }
            : null),
      );
    });
    void refresh();
    const stop =
      path === '/'
        ? watchRegistry((message) => {
            const snapshot = getSnapshot();
            // At the boundary, retain Opening… and its retry loop through transient server failures.
            if (snapshot && serverNow() >= Date.parse(snapshot.today.nextDrop)) return;
            setError(message);
          })
        : () => {};
    return () => {
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
        Skip to registry
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
          <div className="header-controls">
            <SoundToggle />
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? 'Use carbon copy dark mode' : 'Use paper light mode'}
            >
              <span className="theme-swatch" />
              {theme === 'light' ? 'CARBON COPY' : 'PAPER COPY'}
            </button>
          </div>
        </header>
        <nav aria-label="Main navigation">
          {[
            ['/', 'Today'],
            ['/archive', 'Archive'],
            ['/about', 'Office notice'],
          ].map(([url, label]) => (
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
              {label}
            </Link>
          ))}
          <TimezonePicker />
        </nav>
        {isDemo && (
          <div className="demo-label">
            DESIGN PROOF · DEVELOPMENT FIXTURES · NOT THE PUBLIC RECORD
          </div>
        )}
        <main id="main">
          {error ? (
            <div className="notice" role="alert">
              <span className="eyebrow">OFFICE NOTICE</span>
              <h1>
                {error.includes('Registry closed')
                  ? 'Registry closed for the day.'
                  : 'The clerk is away.'}
              </h1>
              <p>{error.replace(/^Registry closed for the day\.\s*/, '')}</p>
              <button onClick={() => void refresh()}>Try the office again</button>
            </div>
          ) : !today || !me ? (
            <div className="loading" role="status">
              OPENING THE REGISTER<span className="loading-dots"> . . .</span>
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
          ) : path === '/about' ? (
            <About nextDrop={today.nextDrop} />
          ) : path === '/brand-proof' && (isDemo || today.practice) ? (
            <BrandProof />
          ) : path === '/admin/schedule' ? (
            <Calendar />
          ) : path === '/admin/live' ? (
            <LiveAdmin />
          ) : path === '/stats' ? (
            <Stats />
          ) : (
            <div className="notice">
              <h1>File not found.</h1>
              <Link to="/">Return to today’s registry</Link>
            </div>
          )}
        </main>
        <footer>
          <Link to="/" className="footer-logo">
            <Wordmark />
          </Link>
          <span>A little claim to call your own.</span>
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
      const size = parseFloat(getComputedStyle(heading).fontSize);
      const range = document.createRange();
      range.selectNodeContents(heading);
      const width = range.getBoundingClientRect().width;
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
  const pendingRequest = useRef<{ answer: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
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
    if (file?.closed) void refresh();
  }, [file?.closed]);

  const reduced = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
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
      if (document.activeElement !== input.current || !viewport) return;
      const row = input.current?.closest('.input-row')?.getBoundingClientRect();
      if (row && row.bottom > viewport.height + viewport.offsetTop - 16) {
        window.scrollBy(0, row.bottom - viewport.height - viewport.offsetTop + 16);
      }
    };
    viewport?.addEventListener('resize', keepFormVisible);
    return () => viewport?.removeEventListener('resize', keepFormVisible);
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
    if (location.hash.startsWith('#file-key=')) history.replaceState(null, '', location.pathname);
  }, []);
  async function restore(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/recover', { key: restoreKey });
      setRestoreKey('');
      await refresh();
      setMessage('Your file is restored.');
      setOutcome('FILE RESTORED');
    } catch (e) {
      setMessage((e as Error).message);
      setOutcome('FILE KEY');
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
      const data = await api<{ user: Me['user'] }>('/me/' + action, body);
      setMe({ ...me, user: data.user });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function submit(e: FormEvent, confirmed?: string) {
    e.preventDefault();
    if (busy || !answer.trim()) return;
    void prepareSound();
    setBusy(true);
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
        api<{ claim: Claim; me?: Me; recoveryKey?: string; sessionNotice?: string }>('/claim', {
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
      pendingRequest.current = null;
      stampSound(true);
      setOutcome(result.claim.golden ? 'GOLD' : 'DIBS');
      setMessage(result.claim.display.toUpperCase());
      if (result.recoveryKey) setRecoveryKey(result.recoveryKey);
      setAnswer('');
      setTaken(false);
      setHouseStrike(false);
      setClaim(result.claim);
      setLanded(true);
      if (result.me) setMe(result.me);
      publishClaim(result.claim, result.me);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) stampSound(false);
      if (err.data?.me) setMe(err.data.me);
      else if (err.data?.file) setMe({ ...me, file: err.data.file });
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
            ? 'HOUSE'
            : 'TAKEN'
          : err.data?.code === 'NOT_REGISTERED'
            ? 'NOT ON THE LIST'
            : err.status === 403
              ? 'FILE CLOSED'
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
            ? `Taken: ${value.toUpperCase()} is held by the house.`
            : `Taken: ${value.toUpperCase()} is ${err.data.takenBy}'s.`
          : err.data?.code === 'NOT_REGISTERED'
            ? "Not on today's list. Check spelling."
            : err.message,
      );
      input.current?.focus();
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        input.current?.focus({ preventScroll: true });
      });
    }
  }
  const playing = !!today.category && !file?.closed;
  return (
    <div className={playing ? 'focused-play' : 'completed-play'}>
      {!today.category ? (
        <section className="closed-office">
          <div className="closed-copy">
            <Clock target={today.nextDrop} />
            <h1>
              Animals drops <DropTime at={today.nextDrop} />.
            </h1>
            <p>Same moment for everyone.</p>
            <Rules />
            <Reminder at={today.nextDrop} />
          </div>
          <Plate slug="animals" />
        </section>
      ) : file?.closed ? (
        <>
          <span className="file-closed-stamp">FILE CLOSED</span>
          <p className="clerk-aside">{clerkLine('closed', file.dibs + file.strikes)}</p>
          <DaySummary file={file} today={today} />
        </>
      ) : (
        <section className="claim-section" aria-label="Play today's category">
          <div className="play-heading register-arrival">
            <CategoryHeading name={today.category.name} />
          </div>
          <div className={'claim-paper stock-' + categoryStyle(today.category.slug).stock}>
            <Progress dibs={file?.dibs || 0} strikes={file?.strikes || 0} />
            {landed && claim ? (
              <div
                className={'result-panel win-beat ' + (claim.golden ? 'gold-result' : '')}
                role="status"
              >
                <strong className="win-stamp">DIBS · {claim.display.toUpperCase()}</strong>
                <p>
                  {file?.dibs || 1} of 3 dibs{claim.golden && ' · Golden ticket!'}
                </p>
                <p className="clerk-aside">
                  {clerkLine(claim.golden ? 'gold' : 'win', claim.claim_no)}
                </p>
                <div className="win-actions">
                  <button
                    className="primary"
                    onClick={() => {
                      setLanded(false);
                      setMessage('');
                      setOutcome('');
                      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
                    }}
                  >
                    Next dibs <Icon />
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
                    {busy ? 'Filing…' : 'CALL DIBS'}
                    <Icon />
                  </button>
                </div>
                {message && (
                  <div
                    className={'result-panel ' + (taken ? 'taken' : '')}
                    role="status"
                    aria-atomic="true"
                  >
                    <p>
                      {taken && <Icon name="cross" />}
                      {taken && takenHolder?.founder ? (
                        <>
                          Taken: {takenHolder.answer} is <Handle name={takenHolder.name} founder />
                          ’s.
                        </>
                      ) : (
                        message
                      )}
                    </p>
                    {taken && (
                      <strong className="strike-count">Strike {file?.strikes || 0} of 5</strong>
                    )}
                    {suggestion && (
                      <button type="button" onClick={(e) => void submit(e, suggestion)}>
                        Did you mean {suggestion.toUpperCase()}?
                      </button>
                    )}
                    {missing && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void sendMissing()}
                      >
                        Tell the clerk
                      </button>
                    )}
                  </div>
                )}
              </form>
            )}
            {taken && <p className="clerk-aside">{clerkLine('strike', file?.strikes || 0)}</p>}
            <div ref={turnstileBox} className="turnstile" />
            {sessionNotice && (
              <p className="session-notice" role="status">
                {sessionNotice}
              </p>
            )}
            <details className="play-rules">
              <summary>How it works</summary>
              <Rules />
            </details>
          </div>
          <Plate slug={today.category.slug} />
        </section>
      )}
      {playing && (
        <section className="locked-ledger" aria-label="Locked ledger">
          <p>
            {today.claimed.toLocaleString()} claimed · {today.open.toLocaleString()} open
          </p>
          <span>Ledger opens when your file closes</span>
        </section>
      )}
      {(!playing || sessionNotice || restoreKey) && (
        <details className="file-key-panel" open={restoreKey ? true : undefined}>
          <summary>Have a file key? Restore it.</summary>
          <form onSubmit={restore}>
            <label htmlFor="restore-key">File key</label>
            <input
              id="restore-key"
              value={restoreKey}
              onChange={(e) => setRestoreKey(e.target.value)}
              autoComplete="off"
              maxLength={60}
            />
            <button>Restore file</button>
          </form>
        </details>
      )}
      {file?.closed && (
        <>
          {recoveryKey && (
            <section className="file-key-panel">
              <h2>Your file key</h2>
              <strong>{recoveryKey}</strong>
              <p>Keep it private. It restores your file.</p>
            </section>
          )}
          <Ledger
            category={today.category!}
            open={today.open}
            goldenFound={today.specials?.goldenFound}
            goldenTotal={today.specials?.goldenTotal}
          />
          <section className="cleanest">
            <h2>Today's cleanest files</h2>
            {today.board?.length ? (
              <ol>
                {today.board.map((r, i) => (
                  <li key={i}>
                    <strong>
                      <Handle name={r.handle} founder={r.founder} />
                    </strong>
                    <span>
                      {r.dibs}/3 · {r.strikes} strikes · {time(r.completedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Results post as files close.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
function Reminder({ at }: { at: string }) {
  return (
    <a className="reminder-button" href="/reminder.ics" download="dibs-reminder.ics">
      Remind me at {dropTime(at).full}
    </a>
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
function Rules() {
  return (
    <ol className="quick-rules" aria-label="How it works">
      <li>
        <Icon name="arrow" />
        <span>
          <b>Type</b> an answer.
        </span>
      </li>
      <li>
        <Icon name="check" />
        <span>
          <b>Free?</b> It's yours.
        </span>
      </li>
      <li>
        <Icon name="cross" />
        <span>
          <b>Taken?</b> Strike. Five and you're out.
        </span>
      </li>
    </ol>
  );
}

function Progress({ dibs, strikes }: { dibs: number; strikes: number }) {
  return (
    <div className="file-progress">
      <strong>DIBS {dibs}/3</strong>
      <span className="strike-row" role="img" aria-label={`${strikes} of 5 strikes`}>
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < strikes ? 'used' : ''} />
        ))}
      </span>
    </div>
  );
}
function DaySummary({ file, today }: { file: DayFile; today: Today }) {
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
          <span className="eyebrow">DAY CERTIFICATE</span>
          <Wordmark />
        </div>
        <div className="day-category">
          <h2>{today.category!.name}</h2>
        </div>
        <p className="postmark-date">{dateLabel(today.category!.date)}</p>
        <p className="file-tally">
          {file.dibs}/3 dibs · {file.strikes} {file.strikes === 1 ? 'strike' : 'strikes'} · filed{' '}
          {time(file.completedAt!)}
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
                      <Link to={'/certificate/' + event.claimId}>{event.display}</Link>
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
                        'Held by the Registry'
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
          <Seal />
          <span className="eyebrow">FILED UNDER</span>
          <strong>
            <Handle
              name={file.handle || file.claims[0]?.handle || 'Anonymous filer'}
              founder={file.founder || file.claims.some((c) => c.founder)}
            />
          </strong>
          <span>{file.streak || 0} day streak</span>
        </div>
        <div className="cert-footer">
          <span>ALL CLAIMS ENTIRELY CEREMONIAL.</span>
          <span>{PUBLIC_HOST}</span>
        </div>
      </article>
      <ShareSheet
        url={summaryUrl(file.summaryId!)}
        text={summaryText(file, today.category!)}
        render={render}
      />
      <Reminder at={today.nextDrop} />
      <InstallHint />
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
          if (alive) setError('The ledger could not be refreshed. Please try again shortly.');
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
            {rows.length < 10 ? 'First filings' : 'The live ledger'}
            <span className="live-mark" aria-hidden="true" />
          </h2>
        </div>
        <label className="search">
          <span className="eyebrow">SEARCH THESE FILINGS</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Entry or holder"
            aria-label="Search the ledger"
          />
        </label>
      </div>
      {error && <p role="status">{error}</p>}
      {goldenFound !== undefined && (
        <p className="gold-announcement" role="status">
          Golden tickets: {goldenFound} of {goldenTotal || 3} found today
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
            <th>ENTRY</th>
            <th>HOLDER</th>
            <th className="time-col">TIME</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className={newIds.has(r.id) ? 'new-row' : ''}>
              <td>{serial(r.claim_no)}</td>
              <td>
                <Link to={'/certificate/' + r.id}>
                  {r.golden && <Icon name="star" />}
                  {r.display}
                </Link>
              </td>
              <td>
                <Handle name={r.handle} founder={r.founder} />
                <span className="mobile-meta">{time(r.created_at)}</span>
              </td>
              <td className="time-col">{time(r.created_at)}</td>
            </tr>
          ))}
          {!filtered.length && (query || !category) && (
            <tr className="empty-row">
              <td colSpan={4}>
                {query
                  ? 'No matching entries in this register.'
                  : category
                    ? 'The first line is still blank. A fine place for your name.'
                    : 'No claims filed. The register will open after review.'}
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
      <div className="cert-holder">
        <span className="eyebrow">HELD BY</span>
        <strong>
          <Handle name={claim.handle} founder={claim.founder} />
        </strong>
      </div>
      <div className="cert-bottom">
        <div>
          <span className="eyebrow">OBSCURITY</span>
          <div
            className="obscurity"
            role="img"
            aria-label={claim.obscurity ? `${claim.obscurity} out of 5` : 'Unrated'}
          >
            {claim.obscurity
              ? Array.from({ length: 5 }, (_, i) => (
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
      <div className="certificate-registration">
        <Seal className="certificate-seal" />
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
  return (
    <ShareSheet url={certificateUrl(claim.id)} text="Dibs · one more on file." render={render} />
  );
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
        <span className="eyebrow">DAY CERTIFICATE</span>
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
        <span className="eyebrow">CERTIFICATE</span>
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
        <span className="eyebrow">ARCHIVE</span>
        <h1>
          Yesterday
          <br />
          belongs here.
        </h1>
        <p>A record of who called what. No revisions to history.</p>
      </div>
      <div className="archive-layout">
        <aside>
          <span className="eyebrow">SELECT A REGISTER</span>
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
              <Ledger
                category={selected}
                goldenFound={selected.specials?.goldenFound}
                goldenTotal={selected.specials?.goldenTotal}
              />
              {selected.specials && (
                <section className="archive-specials">
                  <span className="house-stamp">THE REGISTRY · HOUSE</span>
                  <h2>Reserved by the house.</h2>
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
                          <li key={a.id}>{a.display}</li>
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
              <section
                className="archive-specimen"
                aria-label="Specimen example, not a real record"
              >
                <span className="eyebrow">SPECIMEN — how a filed day looks</span>
                <h2>A day of first claims.</h2>
                <p>This sample shows the layout. These are examples, not player records.</p>
                <div className="specimen-watermark" aria-hidden="true">
                  SPECIMEN
                </div>
                <div className="specimen-line">EXAMPLE ENTRY / AXOLOTL</div>
                <div className="specimen-line">HELD BY / Example holder</div>
                <div className="specimen-line">DATE / A completed day</div>
                <p className="eyebrow">The first real page arrives after a claimed day closes.</p>
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
          <Rules />
          <details>
            <summary>More about the game</summary>
            <ol className="rules">
              <li>
                <span>
                  A new category opens daily. Next drop: <DropTime at={nextDrop} />.
                </span>
              </li>
              <li>Call dibs on an answer. First come, first served.</li>
              <li>Taken guesses cost a strike. Five strikes close your file.</li>
              <li>Up to three dibs per person, per category.</li>
              <li>The 10 most obvious answers are held by the house.</li>
              <li>
                Ten secret golden tickets per drop November 23–29, then three. The commitment is
                revealed at close.
              </li>
              <li>Most dibs, fewest strikes, earliest completed file wins.</li>
            </ol>
          </details>
          <h2>Frequently asked questions</h2>
          <h3>When does the category drop?</h3>
          <p>
            Next drop: <DropTime at={nextDrop} />. Same moment for everyone.
          </p>
          <h3>What's a golden ticket?</h3>
          <p>A secret randomly selected answer. Claim it to earn a gold stamp.</p>
          <h3>Is it free?</h3>
          <p>Yes. Dibs is free to play.</p>
          <div className="about-stamp">
            NO ACTUAL
            <br />
            PROPERTY RIGHTS
          </div>
        </section>
        <aside className="office-note">
          <span className="eyebrow">A NOTE ON THE RECORD</span>
          <h2>Privacy</h2>
          <p>
            We store a randomly generated handle and your claims. An anonymous, signed cookie keeps
            your place. No email. No password. No public names to type.
          </p>
          <p>
            For abuse prevention, an IP address becomes a daily rotating hash. We do not store raw
            IPs. We count share-button taps and first arrivals by platform only and use cookieless
            traffic analytics when configured. Nothing is sold.
          </p>
          <p>
            Your file key restores access after switching browsers or clearing cookies. Keep it
            private: anyone with it can use your file. Your handle locks after your first claim.
          </p>
          <p>
            We keep your random ID cookie for one year, claims and strikes as the public game
            record, and a hashed recovery key so you can restore your identity. Network abuse hashes
            rotate daily and are cleared after two days. Anonymous share and arrival counts have no
            names or IP addresses. Missing-answer submissions contain only the normalized answer,
            category, date and count, and are kept for 90 days. Private feedback is kept for 90
            days. Transient browser sessions expire after 30 days. Backups are kept privately for 30
            days. Nothing is sold or used for ads.
          </p>
          <p>
            For privacy questions or deletion requests:{' '}
            <a href="mailto:privacy@dibs.here">privacy@dibs.here</a> (contact mailbox awaiting owner
            setup). Dibs is for players 13 and up.
          </p>
          <p>The founder plays by the same rules.</p>
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
            <a href="https://world.openfoodfacts.org/">Open Food Facts</a> (ODbL), and ISO 3166 data
            (MIT), plus <a href="https://ourairports.com/">OurAirports</a> (public domain), and{' '}
            <a href="https://ssd.jpl.nasa.gov/">NASA/JPL</a> small-body data. Wikipedia pageviews
            rank measured answers. <a href="/data/licenses.txt">Full licenses and source notes</a>.
          </p>
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
        </aside>
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

function Feedback({ sitekey }: { sitekey: string }) {
  const [text, setText] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  return (
    <details className="feedback">
      <summary>Tell the clerk</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            const turnstileToken = isDemo ? 'demo' : await runTurnstile(sitekey, box.current!);
            const data = await api<{ message: string }>('/feedback', { text, turnstileToken });
            setMessage(data.message);
            setText('');
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="feedback-note">Private note · 500 characters max</label>
        <textarea
          id="feedback-note"
          maxLength={500}
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
