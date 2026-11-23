import { Wordmark, Link, Clock, Reminder, Introduction, Rules, Progress } from './ui';
import { runTurnstile } from './turnstile';
const Settings = lazy(() => import('./Settings').then((m) => ({ default: m.Settings })));
const Archive = lazy(() => import('./Archive').then((m) => ({ default: m.Archive })));
const DaySummary = lazy(() => import('./Certificate').then((m) => ({ default: m.DaySummary })));
const SummaryPage = lazy(() => import('./Certificate').then((m) => ({ default: m.SummaryPage })));
const CertificatePage = lazy(() =>
  import('./Certificate').then((m) => ({ default: m.CertificatePage })),
);
const About = lazy(() => import('./Content').then((m) => ({ default: m.About })));
const Stats = lazy(() => import('./Content').then((m) => ({ default: m.Stats })));
const LiveAdmin = lazy(() => import('./Content').then((m) => ({ default: m.LiveAdmin })));

import { Clue } from './Clue';
import { watchVersion } from './version';
import { Handle } from './Handle';
const LeaderboardView = lazy(() =>
  import('./Leaderboard').then((m) => ({ default: m.Leaderboard })),
);
function Leaderboard(props: import('react').ComponentProps<typeof LeaderboardView>) {
  return (
    <Suspense
      fallback={
        <section className="leaderboard-section" aria-label="Loading scores">
          <h2>Today's leaderboard</h2>
          <p>Loading scores…</p>
        </section>
      }
    >
      <LeaderboardView {...props} />
    </Suspense>
  );
}
import { BACKUP_EXPLANATION } from '../shared/copy';
import { MAX_CLAIMS, MAX_STRIKES, LAUNCH_DATE, DROP_TIME_ZONE } from '../shared/config';
import { categoryNote } from '../shared/moments';

const Calendar = lazy(() => import('./Calendar').then((m) => ({ default: m.Calendar })));
import { categoryStyle } from '../shared/category-style';
import { clerkLine } from '../shared/clerk-lines';

import { claimSound } from './sound-synthesis';
import { prepareSound, playClaimSound } from './sound';
import { submittedSpelling } from './spelling';
import { HOME_TITLE } from '../shared/seo';
import { Icon } from './Icon';

import { dropTime, localTime, viewerZone } from '../shared/time';

import { useServerNow, serverNow } from './clock';
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  type FormEvent,
} from 'react';

import { api, ApiError, isDemo } from './api';
import { type Claim, type DayFile, type Me, type Today } from './types';
import {
  getSnapshot,
  publish,
  publishClaim,
  subscribe,
  watchRegistry,
  type Snapshot,
} from './live';

import { isPlatform } from '../shared/sharing';

function usePath() {
  const [path, set] = useState(location.pathname);
  useEffect(() => {
    const on = () => set(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return path;
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
  const [settingsOpen, setSettingsOpen] = useState(
    () => location.hash === '#file-settings' || location.hash.startsWith('#file-key='),
  );
  const [settingsLoaded, setSettingsLoaded] = useState(settingsOpen);
  useEffect(() => {
    if (settingsOpen) setSettingsLoaded(true);
  }, [settingsOpen]);
  const [focusZone, setFocusZone] = useState(false);
  useEffect(() => {
    const open = () => {
      setSettingsOpen(true);
      setFocusZone(true);
      // A second click must focus the selector even when Settings is already open.
      document.querySelector<HTMLSelectElement>('.timezone-control select')?.focus();
    };
    window.addEventListener('dibs-settings-zone', open);
    return () => window.removeEventListener('dibs-settings-zone', open);
  }, []);
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
  const [retryTick, setRetryTick] = useState(0);
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
  }, [error, retryTick]);
  const refresh = async () => {
    try {
      const data = await api<Snapshot>('/bootstrap');
      publish({ ...data, reset: true });
      setToday(data.today);
      setMe(data.me!);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setRetryTick((n) => n + 1);
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
    <>
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
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={
                theme === 'light'
                  ? 'Carbon copy · Switch to dark mode'
                  : 'Paper copy · Switch to light mode'
              }
            >
              {theme === 'light' ? 'Carbon copy' : 'Paper copy'}
            </button>
            <details
              className="header-settings"
              open={settingsOpen}
              onToggle={(e) => {
                setSettingsOpen(e.currentTarget.open);
                if (!e.currentTarget.open) setFocusZone(false);
              }}
            >
              <summary>Settings</summary>
              <div className="header-controls">
                {(settingsOpen || settingsLoaded) && (
                  <Suspense fallback={<p role="status">Opening settings…</p>}>
                    <Settings
                      sitekey={today?.turnstileSiteKey || ''}
                      refresh={refresh}
                      focusZone={focusZone}
                    />
                  </Suspense>
                )}
              </div>
            </details>
          </div>
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
          {me?.user ? (
            <span className="header-player">
              <Handle
                name={me.file?.handle || me.claim?.handle || me.user.handle}
                founder={me.file?.founder || me.claim?.founder}
              />
              <span>Streak {me.streak}</span>
            </span>
          ) : (
            <span className="header-player header-player-placeholder" aria-hidden="true">
              <span>Loading</span>
              <span>Streak</span>
            </span>
          )}
        </header>
        {isDemo && (
          <div className="demo-label">
            DESIGN PROOF · DEVELOPMENT FIXTURES · NOT THE PUBLIC RECORD
          </div>
        )}
        <main id="main">
          <Suspense fallback={<p role="status">Loading the page…</p>}>
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
                Loading the game<span className="loading-dots"> . . .</span>
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
          </Suspense>
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
    </>
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
  const spellingVersion = useRef(0);
  const submitting = useRef(false);
  const pendingRequest = useRef<{ answer: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [guessNumber, setGuessNumber] = useState(0);
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
    setGuessNumber((n) => n + 1);
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
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      if (e.target.value.trim()) void verifySession().catch(() => {});
                    }}
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
              key={guessNumber}
              open={guessNumber === 0 && !file?.dibs && !file?.strikes}
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
