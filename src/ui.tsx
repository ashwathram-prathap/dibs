import { Fragment, useEffect, useRef, useState } from 'react';
import { REGISTRAR_STROKE } from '../shared/moments';
import {
  WORDMARK_WIDTH,
  WORDMARK_PATH,
  WORDMARK_BLOCK_X,
  WORDMARK_OFFSET_X,
  WORDMARK_OFFSET_Y,
} from '../shared/brand';
import { localTime, dropTime, countdown, viewerZone } from '../shared/time';
import { useServerNow } from './clock';
import { reminder } from '../shared/reminder';
import { Icon } from './Icon';
import { MAX_CLAIMS, MAX_STRIKES } from '../shared/config';
import {
  GAME_EXPLANATION,
  LIMIT_EXPLANATION,
  FINISH_EXPLANATION,
  SCHEDULE_EXPLANATION,
  GOLDEN_EXPLANATION,
  RESERVED_EXPLANATION,
  NIGHTLY_CLAIMS,
  REPEAT_GUESS_EXPLANATION,
} from '../shared/copy';
export function Signature() {
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
export function Wordmark() {
  return (
    <svg className="brand-mark" role="img" aria-label="dibs." viewBox={`0 0 ${WORDMARK_WIDTH} 100`}>
      <g transform={`translate(${WORDMARK_OFFSET_X} ${WORDMARK_OFFSET_Y})`}>
        <path fill="currentColor" d={WORDMARK_PATH} />
        <path fill="#E1462B" d={`M${WORDMARK_BLOCK_X} 67h18v18h-18z`} />
      </g>
    </svg>
  );
}

export function time(at: string) {
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
export function RelativeTime({ at }: { at: string }) {
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
export function DropTime({ at }: { at: string }) {
  const value = localTime(at, viewerZone(), true);
  return (
    <span className="local-drop">
      {value.label} {value.zone}
    </span>
  );
}
export const dateLabel = (s: string) =>
  new Date(s + 'T12:00:00Z').toLocaleDateString('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
export function navigate(path: string) {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
export function Link({
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
export function Clock({ target, slim = false }: { target: string; slim?: boolean }) {
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
      <span className={slim ? 'eyebrow' : 'eyebrow form-label'}>
        {slim ? 'Round closes in' : 'Next drop'}
      </span>
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
          <span>{localTime(target).full}</span> · change in{' '}
          <button
            className="text-link"
            onClick={() => {
              const panel = document.querySelector<HTMLDetailsElement>('.header-settings');
              if (panel) panel.open = true;
              window.dispatchEvent(new Event('dibs-settings-zone'));
            }}
          >
            Settings
          </button>
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
export function Reminder({ at }: { at: string }) {
  const links = reminder(at);
  const appleFirst = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const apple = (
    <a key="apple" aria-label="Apple Calendar" href={'/reminder.ics?at=' + encodeURIComponent(at)}>
      <span>Apple Calendar</span>
      <small>Downloads a file. Open it to add</small>
    </a>
  );
  const google = (
    <a
      key="google"
      aria-label="Google Calendar"
      href={links.google}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>Google Calendar</span>
      <small>Opens in a new tab</small>
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
        <a aria-label="Outlook" href={links.outlook} target="_blank" rel="noopener noreferrer">
          <span>Outlook</span>
          <small>Adds one event. Set it to repeat daily</small>
        </a>
        <button
          className="reminder-close"
          onClick={(e) => {
            const menu = e.currentTarget.closest('details')!;
            menu.open = false;
            menu.querySelector('summary')?.focus();
          }}
        >
          Close reminder
        </button>
      </div>
    </details>
  );
}

export function InstallHint() {
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
export function Introduction({ lead = false }: { lead?: boolean }) {
  return (
    <section className="game-intro" aria-label="How to play Dibs">
      {lead && (
        <p className="nightly-lead">
          <strong>{NIGHTLY_CLAIMS}</strong>
        </p>
      )}
      <div className="game-explanation">
        <p>{GAME_EXPLANATION}</p>
        <p>{LIMIT_EXPLANATION}</p>
      </div>
      <div className="worked-example" aria-label="Example">
        <p>
          <strong>Example:</strong> Today's category is <strong>Animals</strong>.
        </p>
        <p className="example-row">
          <span className="example-stamp yours">YOURS</span>
          <span>
            You type <strong>Okapi</strong>. Nobody has it yet, so <strong>it's yours</strong>.
          </span>
        </p>
        <p className="example-row">
          <span className="example-stamp taken">TAKEN</span>
          <span>
            You type <strong>Lion</strong>. Someone already has it, so{' '}
            <strong>you get a strike</strong>.
          </span>
        </p>
      </div>
      {lead && <p className="repeat-guess-note">{REPEAT_GUESS_EXPLANATION}</p>}
    </section>
  );
}
export function Rules({
  includeReserved = true,
  specials,
}: {
  includeReserved?: boolean;
  specials?: import('./types').Specials;
}) {
  return (
    <div className="plain-rules">
      <p>{FINISH_EXPLANATION}</p>
      <p>{SCHEDULE_EXPLANATION}</p>
      <p>
        {specials
          ? `${specials.goldenTotal} golden tickets hide in tonight's category. Each adds ${specials.goldenBonus ?? 100} points.`
          : GOLDEN_EXPLANATION}
      </p>
      {includeReserved && <p>{RESERVED_EXPLANATION}</p>}
    </div>
  );
}
export function Progress({
  dibs,
  strikes,
  answers,
  tiers,
}: {
  dibs: number;
  strikes: number;
  /** Accepted answers from the server file. When present, play shows the three claim slots. */
  answers?: (string | undefined)[];
  tiers?: (import('../shared/flow-rules').Tier | undefined)[];
}) {
  const strikeRow = (
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
  );
  if (answers)
    return (
      <div className="file-progress claim-slots-progress">
        <h2 className="slots-heading" id="claim-slots-heading">
          Your {MAX_CLAIMS} claims tonight
        </h2>
        <ol className="claim-slots" aria-labelledby="claim-slots-heading">
          {Array.from({ length: MAX_CLAIMS }, (_, i) => {
            const filled = i < dibs;
            return (
              <li key={i} className={filled ? 'filled' : 'open'}>
                <span className="slot-number" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="sr-only">Claim {i + 1}: </span>
                {filled ? (
                  <span
                    className={
                      'slot-stamp' + (tiers?.[i] === 'Off the register' ? ' off-slot' : '')
                    }
                  >
                    {answers[i] || 'Claimed'}
                    {tiers?.[i] && <small className="slot-tier">{tiers[i]}</small>}
                  </span>
                ) : (
                  <span className="slot-open">Open</span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="sr-only">
          {dibs} of {MAX_CLAIMS} claims used.
        </p>
        {strikeRow}
      </div>
    );
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
      {strikeRow}
    </div>
  );
}
