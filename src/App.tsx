import { DROP_TIME_LABEL } from '../shared/config';
import { useEffect, useLayoutEffect, useState, useRef, useCallback, type FormEvent } from 'react';
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
import { suggestions as catalogSuggestions } from './suggestions';
import { PUBLIC_HOST, PUBLIC_ORIGIN, certificateUrl } from '../shared/config';
import { ShareSheet } from './ShareSheet';
import { summaryUrl, isPlatform } from '../shared/sharing';
import { exportCertificate, exportSummary, summaryText } from './share';
import { WORDMARK_WIDTH, WORDMARK_PATH, WORDMARK_BLOCK_X } from '../shared/brand';
function Wordmark() {
  return (
    <svg className="brand-mark" role="img" aria-label="dibs." viewBox={`0 0 ${WORDMARK_WIDTH} 100`}>
      <path fill="currentColor" d={WORDMARK_PATH} />
      <path fill="#E1462B" d={`M${WORDMARK_BLOCK_X} 67h18v18h-18z`} />
    </svg>
  );
}

const time = (s: string) =>
  new Date(s).toLocaleTimeString('en-CA', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    minute: '2-digit',
  });
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
function Clock({ target }: { target: string }) {
  const [now, set] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => set(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  return (
    <span className="clock">
      {[Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
        .map((n) => String(n).padStart(2, '0'))
        .join(':')}
    </span>
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
      return 'light';
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
    const stop = path === '/' ? watchRegistry(setError) : () => {};
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
    document.title = `Dibs — ${path.startsWith('/certificate') ? 'Certificate of Dibs' : path === '/about' ? 'Office notice' : path.startsWith('/archive') ? 'Registry archive' : 'The daily registry'}`;
  }, [path]);
  return (
    <LazyMotion features={domAnimation}>
      <Filters />
      <a className="skip" href="#main">
        Skip to registry
      </a>
      <div className={'page ' + (path === '/' ? 'home-page' : '')}>
        {today?.practice && <div className="practice-banner">PRACTICE — NOT THE PUBLIC RECORD</div>}
        <header className="masthead">
          <Link to="/" className="wordmark" aria-label="Dibs home">
            <Wordmark />
          </Link>
          <p className="mast-note">
            DEPARTMENT OF
            <br />
            FIRST COME, FIRST SERVED.
          </p>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? 'Use carbon copy dark mode' : 'Use paper light mode'}
          >
            <span className="theme-swatch" />
            {theme === 'light' ? 'CARBON COPY' : 'PAPER COPY'}
          </button>
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
          <span className="nav-edition">EST. 2026</span>
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
            <About />
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
          <span className="footer-right">FILED DAILY. HELD BRIEFLY.</span>
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [taken, setTaken] = useState(false);
  const [houseStrike, setHouseStrike] = useState(false);
  const [claim, setClaim] = useState<Claim | null>(me.claim);
  const file = me.file;
  const [landed, setLanded] = useState(false);
  const [active, setActive] = useState(-1);
  const reduced = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const turnstileBox = useRef<HTMLDivElement>(null);
  useEffect(() => setClaim(me.claim), [me.claim]);
  useEffect(() => {
    if (!landed) return;
    const frame = requestAnimationFrame(() =>
      document
        .querySelector('.filed-section')
        ?.scrollIntoView({ block: 'start', behavior: 'auto' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [landed]);
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

  useEffect(() => {
    const timer = setTimeout(
      () => void refresh(),
      Math.max(100, Date.parse(today.nextDrop) - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [today.nextDrop]);
  useEffect(() => {
    let valid = true;
    const id = setTimeout(() => {
      if (answer.trim().length >= 3 && today.category)
        (isDemo
          ? api<{ answers: string[] }>(
              '/answers?category=' + today.category.id + '&q=' + encodeURIComponent(answer),
            ).then((d) => d.answers)
          : catalogSuggestions(today.category.slug, answer)
        )
          .then((answers) => {
            if (valid) setSuggestions(answers);
          })
          .catch(() => setSuggestions([]));
      else setSuggestions([]);
    }, 180);
    return () => {
      valid = false;
      clearTimeout(id);
    };
  }, [answer, today.category]);
  async function identity(action: string, body: unknown) {
    try {
      const data = await api<{ user: Me['user'] }>('/me/' + action, body);
      setMe({ ...me, user: data.user });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !answer.trim()) return;
    setBusy(true);
    setMessage('');
    setSuggestions([]);
    try {
      const token = isDemo
        ? 'demo'
        : await runTurnstile(today.turnstileSiteKey, turnstileBox.current!);
      const result = await api<{ claim: Claim; me?: Me }>('/claim', {
        answer,
        turnstileToken: token,
      });
      setAnswer('');
      setTaken(false);
      setHouseStrike(false);
      setClaim(result.claim);
      setLanded(true);
      if (result.me) setMe(result.me);
      publishClaim(result.claim, result.me);
      setTimeout(() => setLanded(false), (result.me?.file?.dibs || 1) === 1 ? 1300 : 1050);
    } catch (e) {
      const err = e as ApiError;
      if (err.data?.me) setMe(err.data.me);
      else if (err.data?.file) setMe({ ...me, file: err.data.file });
      setTaken(err.status === 409);
      setHouseStrike(!!err.data?.house);
      setMessage(
        err.status === 409
          ? err.data.house
            ? err.data.message
            : `Someone already called dibs on ${answer.toUpperCase()} (${err.data.takenBy}). Try another.`
          : err.message,
      );
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="daily-heading">
        <span className="eyebrow">
          {today.category ? "Today's category:" : 'THE DAILY GAME OF FIRST CLAIMS'}
        </span>
        <CategoryHeading name={today.category?.name || 'DIBS'} />
        {today.category && (
          <p className="game-rule">
            Name {today.category.slug === 'animals' ? 'an animal' : 'an item in this category'}{' '}
            nobody has claimed yet. First to call it owns it today.
          </p>
        )}
      </section>
      {!today.category ? (
        <section className="closed-office">
          <span className="section-number">01 /</span>
          <div>
            <h2>The office is closed.</h2>
            <p>
              The first register opens Monday November 23 at {DROP_TIME_LABEL}, Toronto time. Come
              back to call dibs.
            </p>
            <p className="eyebrow">
              NEXT DROP <Clock target={today.nextDrop} />
            </p>
            <p className="closed-example">
              EXAMPLE · If the category is Animals, type “axolotl”. If nobody has it, it’s yours.
              Share your certificate.
            </p>
          </div>
          <div className="closed-seal" aria-hidden="true">
            DIBS
            <br />
            <span>NOT YET FILED</span>
          </div>
        </section>
      ) : file?.closed && !landed ? (
        <DaySummary file={file} today={today} />
      ) : claim && landed ? (
        <motion.section
          className="filed-section"
          animate={landed && !reduced && innerWidth < 600 ? { x: [0, -6, 6, -3, 0] } : { x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <span className="eyebrow">YOUR DIBS HAS BEEN ENTERED INTO THE PUBLIC RECORD.</span>
          {landed && !reduced && (
            <div className="claim-imprint-stage" aria-hidden="true">
              <motion.div
                className={'claim-imprint ' + (claim.golden ? 'gold-imprint' : '')}
                aria-hidden="true"
                initial={{ scale: 1.4, opacity: 0, rotate: ((claim.claim_no * 7.31) % 7) - 4 }}
                animate={{ scale: [1.4, 1, 1, 1], opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: (file?.dibs || 1) === 1 ? 1.15 : 0.95,
                  times: [0, 0.15, 0.58, 1],
                }}
              >
                <strong>{claim.golden ? '★ DIBS' : 'DIBS'}</strong>
                <span>{claim.display}</span>
                <small>No. {serial(claim.claim_no)} · ENTERED INTO THE RECORD</small>
              </motion.div>
            </div>
          )}
          <Certificate claim={claim} animated={landed} />
          <ShareButtons claim={claim} />
          <Streak me={me} />
        </motion.section>
      ) : !me.user ? (
        <section className="notice">
          <h2>The clerk is preparing your file.</h2>
          <p>Please open your filing identity before calling dibs.</p>
          <button onClick={() => void refresh()}>Open my file</button>
        </section>
      ) : (
        <motion.section
          className="claim-section"
          animate={landed && !reduced ? { x: [0, -6, 6, -3, 0] } : {}}
          transition={{ duration: 0.25 }}
        >
          <div className="claim-paper">
            <Progress dibs={file?.dibs || 0} strikes={file?.strikes || 0} />
            <form onSubmit={submit}>
              <label className="eyebrow" htmlFor="answer">
                ENTRY:
              </label>
              <div className="input-row">
                <input
                  ref={input}
                  id="answer"
                  name="answer"
                  value={answer}
                  placeholder={today.category.slug === 'animals' ? 'try: axolotl' : 'Name an item…'}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setActive(-1);
                  }}
                  onFocus={() => input.current?.scrollIntoView({ block: 'nearest' })}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="go"
                  maxLength={120}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="suggestions"
                  aria-expanded={suggestions.length > 0}
                  aria-activedescendant={
                    active >= 0 && active < suggestions.length ? 'suggestion-' + active : undefined
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActive((v) => Math.min(v + 1, suggestions.length - 1));
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActive((v) => Math.max(0, v - 1));
                    }
                    if (e.key === 'Escape') setSuggestions([]);
                    if (e.key === 'Enter' && active >= 0 && suggestions[active]) {
                      e.preventDefault();
                      setAnswer(suggestions[active]);
                      setSuggestions([]);
                      setActive(-1);
                    }
                  }}
                />
                <button className="primary" disabled={busy}>
                  {busy ? 'FILING…' : 'CALL DIBS'}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
              <ul
                id="suggestions"
                className="suggestions"
                role="listbox"
                aria-label="Canonical entries"
              >
                {suggestions.map((s, i) => (
                  <li key={s} id={'suggestion-' + i} role="option" aria-selected={active === i}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAnswer(s);
                        setSuggestions([]);
                        input.current?.focus();
                      }}
                    >
                      {s}
                      <span>↖</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="live-strip">
                {today.open.toLocaleString()} still up for grabs ·{' '}
                {today.lastClaimAt
                  ? Date.now() - Date.parse(today.lastClaimAt) < 60000
                    ? 'last claim just now'
                    : `last claim ${Math.floor((Date.now() - Date.parse(today.lastClaimAt)) / 60000)} min ago`
                  : 'be the first to claim'}
              </p>
              <ol className="how-it-works" aria-label="How it works">
                <li>Call dibs on up to 3 {today.category.name.toLowerCase()}.</li>
                <li>Taken guesses cost a strike. 5 strikes and you’re out.</li>
                <li>Fastest clean file wins the day.</li>
                <li>The 10 most obvious answers are held by the house.</li>
              </ol>
              <div ref={turnstileBox} className="turnstile" />
              <p
                className={'clerk-message ' + (houseStrike ? 'house-strike' : taken ? 'taken' : '')}
                role="status"
              >
                {message || 'Spell it right. The clerk is particular.'}
              </p>
            </form>
          </div>
        </motion.section>
      )}
      {file && !file.closed && !landed && file.claims.length > 0 && (
        <section className="file-copies">
          <span className="eyebrow">YOUR DIBS / CERTIFIED COPIES</span>
          {file.claims.map((c) => (
            <Link key={c.id} to={'/certificate/' + c.id}>
              {c.display} ↗
            </Link>
          ))}
        </section>
      )}
      {!claim && !file?.closed && me.user && (
        <section className="identity-section">
          <span className="eyebrow">YOUR HANDLE · FORM C-1</span>
          <div className="identity">
            <div>
              <span className="eyebrow">FILED UNDER</span>
              <strong>{me.user.handle}</strong>
            </div>
            <button
              type="button"
              className="text-button"
              disabled={me.user.rerolls_used >= 3 || busy}
              onClick={() => void identity('reroll', {})}
            >
              Re-roll ({3 - me.user.rerolls_used} left)
            </button>
          </div>
        </section>
      )}
      {today.category && (
        <>
          <Ledger
            category={today.category}
            open={today.open}
            goldenFound={today.specials?.goldenFound}
          />
          {today.specials && (
            <section className="daily-specials">
              <p>Golden tickets found: {today.specials.goldenFound} / 3</p>
              {today.specials.houseWords.length > 0 && (
                <div className="house-record">
                  <span className="house-stamp">THE REGISTRY · HOUSE</span>
                  <p>{today.specials.houseWords.map((w) => w.display.toUpperCase()).join(' · ')}</p>
                </div>
              )}
              <details>
                <summary>Golden-ticket commitment</summary>
                <code>{today.specials.commitment}</code>
                <p>
                  Filed at {time(today.specials.committedAt)}. The answers and verification open
                  when this day closes.
                </p>
              </details>
            </section>
          )}
          <section className="cleanest">
            <span className="section-number">03 / COMPLETED FILES</span>
            <h2>Today's cleanest files</h2>
            {(today.board?.length || 0) < 3 ? (
              <p>Results post as players file.</p>
            ) : (
              <ol>
                {today.board!.map((r, i) => (
                  <li key={i}>
                    <strong>{r.handle}</strong>
                    <span>
                      {r.dibs}/3 · {r.strikes} {r.strikes === 1 ? 'strike' : 'strikes'} ·{' '}
                      {time(r.completedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
      <div className="bottom-note">
        <span className="eyebrow">A NOTE FROM THE CLERK</span>
        <p>All claims are real. All ownership is entirely ceremonial.</p>
        <Link to="/about">Read the office notice ↗</Link>
      </div>
    </>
  );
}
function Progress({ dibs, strikes }: { dibs: number; strikes: number }) {
  return (
    <div className="file-progress">
      <strong>DIBS {dibs} / 3</strong>
      <span className="strike-row" role="img" aria-label={`${strikes} of 5 strikes`}>
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < strikes ? 'used' : ''} />
        ))}
      </span>
      <span className="eyebrow">{strikes} / 5 STRIKES</span>
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
      <article className="summary-paper" aria-label="Day summary">
        <div className="cert-rule">
          <span>REGISTRY OF CLAIMS</span>
          <span>FORM D-3</span>
        </div>
        <span className="eyebrow">
          {dateLabel(today.category!.date)} / {today.category!.name}
        </span>
        <h2>File closed.</h2>
        <Progress dibs={file.dibs} strikes={file.strikes} />
        <p className="gold-summary">
          Golden tickets found:{' '}
          {today.specials?.goldenFound ?? file.claims.filter((c) => c.golden).length} / 3
        </p>
        <ol className="summary-answers">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              {file.claims[i] ? (
                <Link to={'/certificate/' + file.claims[i].id}>{file.claims[i].display} ↗</Link>
              ) : (
                <span>— Unclaimed</span>
              )}
            </li>
          ))}
        </ol>
        <p className="eyebrow">FILED {time(file.completedAt!)} · TORONTO</p>
        <p className="next-drop">
          Next drop <Clock target={today.nextDrop} />
        </p>
      </article>
      <ShareSheet
        url={summaryUrl(file.summaryId!)}
        text={summaryText(file, today.category!)}
        render={render}
      />
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
}: {
  category: Category | null;
  open?: number;
  goldenFound?: number;
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
      api<{ rows: Claim[] }>('/ledger?category=' + category.id)
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
          <span className="section-number">02 / PUBLIC RECORD</span>
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
      {!!goldenFound && (
        <p className="gold-announcement" role="status">
          Golden ticket found: {goldenFound} of 3
        </p>
      )}
      {category && open !== undefined && rows.length < 10 && (
        <p className="open-pool">
          {open.toLocaleString()} {category.name.toLowerCase()} still unclaimed. Be early.
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
                  {r.golden ? '★ ' : ''}
                  {r.display}
                </Link>
              </td>
              <td>
                {r.handle}
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
        <span>END OF ENTRIES / {rows.length.toLocaleString()} ON FILE</span>
        <span>LIVE / 15s, THEN 60s · PAUSED IN BACKGROUND</span>
      </div>
    </section>
  );
}
export function Certificate({ claim, animated = false }: { claim: Claim; animated?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={
        'certificate ' + (animated ? 'printing ' : '') + (claim.golden ? 'gold-certificate' : '')
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
        <strong>{claim.handle}</strong>
      </div>
      <div className="cert-bottom">
        <div>
          <span className="eyebrow">OBSCURITY</span>
          <div
            className="obscurity"
            aria-label={claim.obscurity ? `${claim.obscurity} out of 5` : 'Unrated'}
          >
            {claim.obscurity
              ? '●'.repeat(claim.obscurity) + '○'.repeat(5 - claim.obscurity)
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
            {claim.golden
              ? '★ GOLDEN TICKET'
              : claim.obscurity && claim.obscurity >= 4
                ? 'DEEP CUT'
                : 'REGISTERED'}
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
        <span className="eyebrow">REGISTRY OF CLAIMS / FORM D-3</span>
        <h1>A day on file.</h1>
        <Link to="/">Play today’s Dibs ↗</Link>
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
        <span className="eyebrow">OFFICIAL COPY / FORM D-1</span>
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
      <Link to="/">← Back to the register</Link>
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
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">BOUND VOLUMES / FORM A-1</span>
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
              <Ledger category={selected} goldenFound={selected.specials?.goldenFound} />
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
                    Golden tickets found: {selected.specials.goldenFound} / 3
                  </p>
                  {selected.specials.reveal && (
                    <>
                      <p className="gold-summary">
                        {selected.specials.verified ? '✓ Verified' : 'Verification unavailable'}
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
function About() {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">PLEASE READ BEFORE FILING / NOTICE 001</span>
        <h1>
          A small claim.
          <br />A public record.
        </h1>
        <p>Welcome to the least consequential office in town.</p>
      </div>
      <div className="about-layout">
        <section>
          <h2>The filing rules.</h2>
          <ol className="rules">
            <li>A new category opens at {DROP_TIME_LABEL}, Toronto time.</li>
            <li>Call dibs on an answer. First come, first served.</li>
            <li>Taken guesses cost a strike. Five strikes close your file.</li>
            <li>Up to three dibs per person, per category.</li>
            <li>The 10 most obvious answers are held by the house.</li>
            <li>
              Three secret golden tickets are picked at each drop. The commitment is revealed at
              close.
            </li>
            <li>Most dibs, fewest strikes, earliest completed file wins.</li>
          </ol>
          <div className="about-stamp">
            NO ACTUAL
            <br />
            PROPERTY RIGHTS
          </div>
        </section>
        <aside className="office-note">
          <span className="eyebrow">A NOTE ON THE RECORD</span>
          <h2>
            Your data
            <br />
            stays modest.
          </h2>
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
            Clearing cookies loses access to your anonymous account. Claims stay in the public
            record. Your handle locks after your first claim.
          </p>
          <p>
            Obscurity uses Wikipedia pageviews, grouped from 1 (familiar) to 5 (less read). It
            describes the article’s readership, not your intelligence.
          </p>
          <p>
            Built by{' '}
            <a href="https://www.ashwathram.ca" target="_blank" rel="noreferrer">
              Ashwathram Prathap ↗
            </a>
            <br />
            <a href="https://github.com/ashwathram-prathap/dibs" target="_blank" rel="noreferrer">
              Project on GitHub ↗
            </a>{' '}
            <span className="fine-print">(private preview)</span>
          </p>
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
