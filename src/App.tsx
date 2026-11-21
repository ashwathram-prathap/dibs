import { useEffect, useLayoutEffect, useState, useRef, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { api, ApiError, isDemo } from './api';
import { type Category, type Claim, type Me, type Today, schools, serial } from './types';
import { exportCertificate } from './share';

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
export default function App() {
  const path = usePath();
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
      const [t, m] = await Promise.all([api<Today>('/today'), api<Me>('/me')]);
      setToday(t);
      setMe(m);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('dibs-theme', theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    document.title = `Dibs — ${path.startsWith('/certificate') ? 'Certificate of Dibs' : path === '/about' ? 'Office notice' : path === '/schools' ? 'Schools board' : path.startsWith('/archive') ? 'Registry archive' : 'The daily registry'}`;
  }, [path]);
  return (
    <>
      <Filters />
      <a className="skip" href="#main">
        Skip to registry
      </a>
      <div className={"page " + (path === "/" ? "home-page" : "")}>
        <header className="masthead">
          <Link to="/" className="wordmark" aria-label="Dibs home">
            dibs<span className="wordmark-dot">.</span>
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
            ['/schools', 'Schools'],
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
              <span className="eyebrow">SERVICE NOTICE / 503</span>
              <h1>The clerk is away.</h1>
              <p>{error}</p>
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
          ) : path.startsWith('/certificate/') ? (
            <CertificatePage id={decodeURIComponent(path.split('/').pop()!)} />
          ) : path.startsWith('/archive') ? (
            <Archive />
          ) : path === '/schools' ? (
            <Schools category={today.category} />
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
            DIBS /
          </Link>
          <span>A little claim to call your own.</span>
          <span className="footer-right">FILED DAILY. HELD BRIEFLY.</span>
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
  const [claim, setClaim] = useState<Claim | null>(me.claim);
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
        api<{ answers: string[] }>(
          '/answers?category=' + today.category.id + '&q=' + encodeURIComponent(answer),
        )
          .then((d) => {
            if (valid) setSuggestions(d.answers);
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
      await api('/session-check', {}).catch((e) => {
        if (!isDemo) throw e;
      });
      const token = isDemo
        ? 'demo'
        : await runTurnstile(today.turnstileSiteKey, turnstileBox.current!);
      const result = await api<{ claim: Claim }>('/claim', { answer, turnstileToken: token });
      setClaim(result.claim);
      setLanded(true);
      await refresh();
      setTimeout(() => setLanded(false), 1300);
    } catch (e) {
      const err = e as ApiError;
      setTaken(err.status === 409);
      setMessage(
        err.status === 409
          ? `Someone already called dibs on ${answer.toUpperCase()} (${err.data.takenBy}). Try another.`
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
        <span className="eyebrow">{today.category ? "Today's category:" : 'THE DAILY GAME OF FIRST CLAIMS'}</span>
        <CategoryHeading name={today.category?.name || 'DIBS'} />
        {today.category && <p className="game-rule">Name {today.category.slug === 'animals' ? 'an animal' : 'an item in this category'} nobody has claimed yet. First to call it owns it today.</p>}
      </section>
      {!today.category ? (
        <section className="closed-office">
          <span className="section-number">01 /</span>
          <div>
            <h2>The office opens tonight.</h2>
            <p>The next category drops tonight at 9 PM ET. Come back to call dibs.</p>
            <p className="eyebrow">NEXT DROP <Clock target={today.nextDrop} /></p>
            <p className="closed-example">EXAMPLE · If the category is Animals, type “axolotl”. If nobody has it, it’s yours. Share your certificate.</p>
          </div>
          <div className="closed-seal" aria-hidden="true">
            DIBS
            <br />
            <span>NOT YET FILED</span>
          </div>
        </section>
      ) : claim ? (
        <motion.section
          className="filed-section"
          animate={landed && !reduced && innerWidth < 600 ? { x: [0, -6, 6, -3, 0] } : { x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <span className="eyebrow">YOUR DIBS HAS BEEN ENTERED INTO THE PUBLIC RECORD.</span>
          {landed && !reduced && (
            <div className="claim-imprint-stage" aria-hidden="true">
              <motion.div
                className="claim-imprint"
                aria-hidden="true"
                initial={{ scale: 1.4, opacity: 0, rotate: ((claim.claim_no * 7.31) % 7) - 4 }}
                animate={{ scale: [1.4, 1, 1, 1], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.15, times: [0, 0.15, 0.58, 1] }}
              >
                <strong>DIBS</strong>
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
              <p className="live-strip">{today.open.toLocaleString()} still up for grabs · {today.lastClaimAt ? `last claim ${Math.max(0, Math.floor((Date.now() - Date.parse(today.lastClaimAt)) / 60000))} min ago` : 'be the first to claim'}</p>
              <ol className="how-it-works" aria-label="How it works">
                <li>Type {today.category.slug === 'animals' ? 'an animal' : 'a category item'}.</li>
                <li>If nobody has it, it's yours.</li>
                <li>Share your certificate.</li>
              </ol>
              <div ref={turnstileBox} className="turnstile" />
              <p className={'clerk-message ' + (taken ? 'taken' : '')} role="status">
                {message || 'Spell it right. The clerk is particular.'}
              </p>
            </form>

          </div>
        </motion.section>
      )}
      {!claim && me.user && <section className="identity-section">
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
                <label htmlFor="school" className="eyebrow">
                  SCHOOL / OPTIONAL
                </label>
                <select
                  id="school"
                  value={me.user.school}
                  disabled={busy}
                  onChange={(e) => void identity('school', { school: e.target.value })}
                >
                  {schools.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
      </section>}
      <Ledger category={today.category} />
      <div className="bottom-note">
        <span className="eyebrow">A NOTE FROM THE CLERK</span>
        <p>All claims are real. All ownership is entirely ceremonial.</p>
        <Link to="/about">Read the office notice ↗</Link>
      </div>
    </>
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
function Ledger({ category }: { category: Category | null }) {
  const [rows, setRows] = useState<Claim[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const known = useRef(new Set<string>());
  const loaded = useRef(false);
  useEffect(() => {
    if (!category) {
      setRows([]);
      return;
    }
    let alive = true;
    known.current = new Set();
    loaded.current = false;
    const update = async () => {
      try {
        const data = await api<{ rows: Claim[] }>('/ledger?category=' + category.id);
        if (!alive) return;
        setNewIds(
          new Set(
            loaded.current
              ? data.rows.filter((r) => !known.current.has(r.id)).map((r) => r.id)
              : [],
          ),
        );
        known.current = new Set(data.rows.map((r) => r.id));
        loaded.current = true;
        setRows(data.rows);
        setError('');
      } catch {
        if (alive) setError('The ledger could not be refreshed. The last filed copy is shown.');
      }
    };
    void update();
    const id = setInterval(() => void update(), 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [category?.id]);
  const filtered = rows.filter((r) =>
    `${r.display} ${r.handle} ${r.school}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="ledger-section">
      <div className="section-heading">
        <div>
          <span className="section-number">02 / PUBLIC RECORD</span>
          <h2>
            The live ledger
            <span className="live-mark" aria-hidden="true" />
          </h2>
        </div>
        <label className="search">
          <span className="eyebrow">SEARCH THE REGISTER</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Entry, holder or school"
            aria-label="Search the ledger"
          />
        </label>
      </div>
      {error && <p role="status">{error}</p>}
      <table className="ledger">
        <caption className="sr-only">Claims in {category?.name || 'today’s registry'}</caption>
        <thead>
          <tr>
            <th>No.</th>
            <th>ENTRY</th>
            <th>HOLDER</th>
            <th className="school-col">SCHOOL</th>
            <th className="time-col">TIME</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className={newIds.has(r.id) ? 'new-row' : ''}>
              <td>{serial(r.claim_no)}</td>
              <td>
                <Link to={'/certificate/' + r.id}>{r.display}</Link>
              </td>
              <td>
                {r.handle}
                <span className="mobile-meta">
                  {r.school !== 'None' ? r.school : 'Independent claimant'}
                  <br />
                  {time(r.created_at)}
                </span>
              </td>
              <td className="school-col">{r.school}</td>
              <td className="time-col">{time(r.created_at)}</td>
            </tr>
          ))}
          {!filtered.length && (
            <tr className="empty-row">
              <td colSpan={5}>
                {query
                  ? 'No matching entries in this register.'
                  : category
                    ? 'The first line is still blank. A fine place for your name.'
                    : 'No claims filed. The register will open after review.'}
              </td>
            </tr>
          )}
          {Array.from({ length: Math.max(0, 5 - filtered.length) }, (_, i) => (
            <tr className="ruled-row" key={'blank' + i} aria-hidden="true">
              <td>—</td>
              <td />
              <td />
              <td className="school-col" />
              <td className="time-col" />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ledger-foot">
        <span>END OF ENTRIES / {rows.length.toLocaleString()} ON FILE</span>
        <span>UPDATED EVERY 5 SECONDS</span>
      </div>
    </section>
  );
}
export function Certificate({ claim, animated = false }: { claim: Claim; animated?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={'certificate ' + (animated ? 'printing' : '')}
      initial={animated && !reduced ? { y: 80, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.25 }}
      aria-label={'Certificate of Dibs for ' + claim.display}
    >
      <div className="cert-rule">
        <span>DIBS / REGISTRY OF CLAIMS</span>
        <span>FORM D-1</span>
      </div>
      <div className="cert-top">
        <span className="eyebrow">
          CERTIFICATE OF DIBS
          <br />
          No. {serial(claim.claim_no)}
        </span>
        <span className="cert-emblem" aria-hidden="true">
          D.
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
        <span>{claim.school === 'None' ? 'Independent claimant' : claim.school}</span>
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
          className="dibs-stamp"
          style={{ rotate: ((claim.claim_no * 7.31) % 7) - 4 }}
          initial={animated && !reduced ? { scale: 1.4, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.18, delay: 0.65 }}
        >
          <strong>DIBS</strong>
          <span>
            {claim.obscurity && claim.obscurity >= 4
              ? 'DEEP CUT · REGISTERED'
              : 'OFFICIALLY REGISTERED'}
          </span>
        </motion.div>
      </div>
      <div className="cert-footer">
        <span>ONE OF {claim.total_registrable.toLocaleString()}. ONLY ONE YOURS.</span>
        <span>
          {location.host}/c/{claim.id.slice(0, 16)}
        </span>
      </div>
    </motion.article>
  );
}
function ShareButtons({ claim }: { claim: Claim }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const url = location.origin + '/certificate/' + claim.id;
  const text = `I called dibs on ${claim.display.toUpperCase()}. Dibs No. ${claim.claim_no} of ${claim.total_registrable.toLocaleString()} ${claim.category_name.toLowerCase()}. ${url}`;
  async function share(story: boolean) {
    setBusy(true);
    try {
      const result = await exportCertificate(claim, story, text, url);
      setStatus(result);
      void api('/events/share', { claimId: claim.id, format: story ? 'story' : 'feed' }).catch(
        () => {},
      );
    } catch {
      setStatus(
        'The copy could not be printed. Try Copy text, or open this page in your regular browser.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="share-area">
      <div className="share-buttons">
        <button className="primary" onClick={() => void share(false)} disabled={busy}>
          {busy ? 'PRINTING…' : 'SHARE CERTIFICATE'}
          <span>↗</span>
        </button>
        <button onClick={() => void share(true)} disabled={busy}>
          Story PNG
        </button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setStatus('Copied. The record travels with you.');
            } catch {
              setStatus(text);
            }
          }}
        >
          Copy text
        </button>
      </div>
      <p className="share-hint" role="status">
        {status || '1080 × 1350 feed / 1080 × 1920 story. Yours to keep.'}
      </p>
    </div>
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
            DIBS / VOL. I / PUBLIC RECORD
          </div>
        </aside>
        <div>
          {selected && (
            <div className="archive-date">
              <span className="eyebrow">REG. {selected.date}</span>
              <h2>{selected.name}</h2>
            </div>
          )}
          <Ledger category={selected} />
        </div>
      </div>
    </>
  );
}
function Schools({ category }: { category: Category | null }) {
  const [data, setData] = useState<{
    today: { school: string; claims: number }[];
    season: { school: string; claims: number }[];
  }>({ today: [], season: [] });
  const [error, setError] = useState('');
  useEffect(() => {
    api<typeof data>('/schools' + (category ? '?category=' + category.id : ''))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [category?.id]);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">INTERCOLLEGIATE RECORD / FORM S-1</span>
        <h1>
          School
          <br />
          of dibs.
        </h1>
        <p>Institutional pride. Questionable academic credit.</p>
      </div>
      {error && <p role="status">{error}</p>}
      <div className="schools-layout">
        {(['today', 'season'] as const).map((k) => (
          <section key={k}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {k === 'today' ? '01 / DAILY REGISTER' : '02 / SINCE OPENING DAY'}
                </span>
                <h2>{k === 'today' ? 'Today’s roll call' : 'The season record'}</h2>
              </div>
            </div>
            <table className="school-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>SCHOOL</th>
                  <th>CLAIMS</th>
                </tr>
              </thead>
              <tbody>
                {data[k].map((row, i) => (
                  <tr key={row.school}>
                    <td>{String(i + 1).padStart(2, '0')}</td>
                    <td>{row.school}</td>
                    <td>{row.claims}</td>
                  </tr>
                ))}
                {!data[k].length && (
                  <tr>
                    <td colSpan={3}>No claims on the board. Attendance is optional.</td>
                  </tr>
                )}
                {Array.from({ length: Math.max(0, 5 - data[k].length) }, (_, i) => (
                  <tr key={i} aria-hidden="true">
                    <td>—</td>
                    <td />
                    <td>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <p className="fine-print">
        Counts are actual, successful claims. School affiliation is selected by the holder. “Other”
        and “None” are not ranked.
      </p>
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
          <h2>The rules, in five lines.</h2>
          <ol className="rules">
            <li>A new category opens at 9 PM, Toronto time.</li>
            <li>Call dibs on an answer. First come, first served.</li>
            <li>If it’s taken, try another. The clerk has patience.</li>
            <li>One successful claim per person, per day.</li>
            <li>Keep the certificate. Come back tomorrow.</li>
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
            We store a randomly generated handle, your chosen school, and your claims. An anonymous,
            signed cookie keeps your place. No email. No password. No public names to type.
          </p>
          <p>
            For abuse prevention, an IP address becomes a daily rotating hash. We do not store raw
            IPs. We count share-button taps without their content and use cookieless traffic
            analytics when configured. Nothing is sold.
          </p>
          <p>
            Clearing cookies loses access to your anonymous account. Claims stay in the public
            record. School and handle lock after your first claim.
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
          <table className="school-table">
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
