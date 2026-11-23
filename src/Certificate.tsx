import { useHideAnswers } from './share-preference';
import { claimScore } from '../shared/claim-copy';
import { rarityLabel } from '../shared/rarity';
import { ScoreCurve } from './ScoreCurve';
import { countLabel } from '../shared/text';
import { RarityCurve } from './RarityCurve';
import { useState, useEffect, useCallback, useRef } from 'react';
import { m as motion, useReducedMotion, LazyMotion, domAnimation } from 'framer-motion';
import { api } from './api';
import { type Claim, type DayFile, type Today, type Category, serial } from './types';
import { categoryStyle } from '../shared/category-style';
import { MAX_CLAIMS, MAX_STRIKES, PUBLIC_HOST, certificateUrl } from '../shared/config';
import { GAME_DESCRIPTION } from '../shared/copy';
import { guesses } from '../shared/guesses';
import { editionLabel, summaryUrl } from '../shared/sharing';
import { ShareSheet } from './ShareSheet';
import { exportCertificate, exportSummary, summaryText, certificateText } from './share';
import { Handle } from './Handle';
import { Icon } from './Icon';
import {
  Wordmark,
  Signature,
  dateLabel,
  time,
  Progress,
  Link,
  Introduction,
  Reminder,
  Clock,
  InstallHint,
} from './ui';
import { Ledger } from './Ledger';
export function DaySummary({
  file,
  today,
  showLedger = false,
  owned = true,
}: {
  file: DayFile;
  today: Today;
  showLedger?: boolean;
  owned?: boolean;
}) {
  const [hideAnswers, setHideAnswers] = useHideAnswers();
  const render = useCallback(
    (story: boolean) => exportSummary(file, today.category!, story, hideAnswers),
    [file, today.category, hideAnswers],
  );
  return (
    <section className="day-summary">
      <article
        className={
          'summary-paper day-certificate stock-' +
          categoryStyle(today.category!.slug).stock +
          (file.claims.some((c) => c.golden) ? ' gold-certificate' : '')
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
        {file.claims.some((c) => c.golden) && <p className="golden-notice">Golden ticket found</p>}
        <p className="certificate-score">
          {countLabel(file.points ?? 0, 'point')}
          {file.rank ? ` · #${file.rank} of ${file.players} players today` : ''} · Streak{' '}
          {file.streak || 0}
        </p>
        <p className="file-tally">
          {file.dibs}/{MAX_CLAIMS} claims · {file.strikes}{' '}
          {file.strikes === 1 ? 'strike' : 'strikes'} · filed {time(file.completedAt!)}
        </p>
        <Progress dibs={file.dibs} strikes={file.strikes} />

        <ol className="summary-answers">
          {guesses(file).map((event, i) => (
            <li
              key={i}
              className={
                event.kind === 'strike'
                  ? 'rejected-filing'
                  : 'accepted-filing' + (event.golden ? ' golden-row' : '')
              }
            >
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
                      {event.golden ? 'Golden ticket · +100' : 'DIBS'}
                    </span>
                    {file.claims.find((c) => c.id === event.claimId) && (
                      <small className="row-score">
                        {claimScore(file.claims.find((c) => c.id === event.claimId)!)}
                      </small>
                    )}
                  </>
                ) : (
                  <>
                    <s>{owned ? event.display : 'Strike · −10'}</s>
                    <small>
                      {event.house ? (
                        'Reserved by the house'
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
          <span className="form-label">Filed under</span>
          <strong>
            <Handle
              name={file.handle || file.claims[0]?.handle || 'Anonymous filer'}
              founder={file.founder || file.claims.some((c) => c.founder)}
            />
          </strong>
        </div>
        <div className="cert-footer">
          <span>All claims entirely ceremonial.</span>
          <span>{file.summaryId ? `${PUBLIC_HOST}/summary/${file.summaryId}` : PUBLIC_HOST}</span>
        </div>
      </article>
      <aside className="day-companions">
        {file.claims.some((c) => c.golden) && (
          <p className="golden-notice">You found a golden ticket. Show it off.</p>
        )}
        <ShareSheet
          url={summaryUrl(file.summaryId!)}
          text={summaryText(file, today.category!, hideAnswers)}
          hideAnswers={hideAnswers}
          onHideAnswers={owned ? setHideAnswers : undefined}
          beforeShare={
            owned
              ? () =>
                  api('/summary/' + encodeURIComponent(file.summaryId!), {
                    showAnswers: !hideAnswers,
                  }).then(() => {})
              : undefined
          }
          render={render}
        />
        {showLedger && <ScoreCurve comparison={file.comparison} final={today.revealed} />}
        <Reminder at={today.nextDrop} />
        <Clock target={today.nextDrop} />
        <InstallHint />
        {showLedger && <Introduction />}
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
export function Certificate({ claim, animated = false }: { claim: Claim; animated?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation}>
      <motion.article
        className={
          'certificate stock-' +
          categoryStyle(claim.category_name.toLowerCase()).stock +
          ' ' +
          (animated ? 'printing ' : '') +
          (claim.golden ? 'gold-certificate' : '') +
          (claim.concealed ? ' sealed-certificate' : '')
        }
        initial={animated && !reduced ? { y: 80, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.25 }}
        aria-label={'Certificate of Dibs for ' + claim.display}
      >
        <div className="cert-rule">
          <span>
            {claim.category_id === 'practice'
              ? 'Practice — not the public record'
              : 'Registry of claims'}
          </span>
          <span className="form-label">Form D-1{claim.golden ? ' · Golden ticket' : ''}</span>
        </div>
        <div className="cert-top">
          <span className="eyebrow">
            Certificate of Dibs
            <br />
            <span className="form-value">No. {serial(claim.claim_no)}</span>
          </span>
          <span className="cert-emblem" aria-hidden="true">
            <Wordmark />
          </span>
        </div>
        <p className="cert-intro">
          {claim.concealed ? (
            <>
              A claim is held here.
              <br />
              The answer opens when the day closes.
            </>
          ) : (
            <>
              Let the record show.
              <br />I called dibs on
            </>
          )}
        </p>
        <h2 className={'cert-answer ' + (claim.display.length > 15 ? 'long-answer' : '')}>
          {claim.concealed ? 'SEALED' : claim.display}
        </h2>
        <div className="cert-category">
          <span>{claim.category_name}</span>
          <time dateTime={claim.category_date}>{dateLabel(claim.category_date)}</time>
        </div>
        <Signature />
        <div className="cert-holder">
          <span className="form-label">Held by</span>
          <strong>
            <Handle name={claim.handle} founder={claim.founder} />
          </strong>
        </div>
        {!!claim.streak && (
          <p className="form-label certificate-streak">{claim.streak}-day streak</p>
        )}
        <div className="cert-bottom">
          <div>
            {claim.concealed ? (
              <>
                <div className="sealed-wax" aria-hidden="true">
                  DIBS
                </div>
                <p className="sealed-note">Sealed until the day closes.</p>
                <p>{countLabel(claim.points ?? 0, 'point')}</p>
              </>
            ) : (
              <>
                <p>{claimScore(claim)}</p>
                <RarityCurve
                  percentile={claim.percentile}
                  category={claim.category_slug || claim.category_name}
                  answer={claim.display}
                  golden={claim.golden}
                  mini
                />
              </>
            )}
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
                  <Icon name="star" /> Golden ticket
                </>
              ) : claim.percentile != null && claim.obscurity && claim.obscurity >= 4 ? (
                'Deep cut'
              ) : (
                'Registered'
              )}
            </span>
          </motion.div>
        </div>

        <div className="cert-footer">
          <span>One of {claim.total_registrable.toLocaleString()}. Only one yours.</span>
          <span>
            {PUBLIC_HOST}/c/{claim.id}
          </span>
        </div>
      </motion.article>
    </LazyMotion>
  );
}
export function ShareButtons({
  claim,
  score,
}: {
  claim: Claim;
  score?: Pick<DayFile, 'points' | 'rank' | 'players'>;
}) {
  const [hideAnswers, setHideAnswers] = useHideAnswers();
  const owner = claim.owned !== false && !claim.concealed;
  const render = useCallback(
    (story: boolean) => exportCertificate(claim, story, hideAnswers),
    [claim, hideAnswers],
  );
  return (
    <ShareSheet
      url={certificateUrl(claim.id)}
      text={certificateText(claim, score, hideAnswers)}
      hideAnswers={hideAnswers}
      onHideAnswers={owner ? setHideAnswers : undefined}
      beforeShare={
        owner
          ? () =>
              api('/certificate/' + encodeURIComponent(claim.id), {
                showAnswers: !hideAnswers,
              }).then(() => {})
          : undefined
      }
      render={render}
    />
  );
}
export function SharedInvitation({
  handle,
  file,
  today,
  revealed,
  date,
}: {
  handle: string;
  file: Partial<DayFile>;
  today: Today;
  revealed?: boolean;
  date?: string;
}) {
  const invitation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!matchMedia('(min-width: 768px) and (max-width: 950px) and (max-height: 500px)').matches)
      return;
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) invitation.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => {
      active = false;
    };
  }, []);
  const claims = file.dibs ?? file.claims?.length ?? 1;
  const state =
    (file.strikes ?? 0) >= MAX_STRIKES
      ? ' and struck out'
      : file.closed
        ? ' and finished the day'
        : '';
  return (
    <section ref={invitation} className="shared-invitation" aria-label="An invitation to Dibs">
      <span className="eyebrow">Dibs · a daily claim</span>
      <h1>
        {handle} claimed {countLabel(claims, 'answer')} in {date ? editionLabel(date) : 'Dibs'}
        {state}. What can you claim?
      </h1>
      <div className="invitation-scorecard" aria-label="Spoiler-safe scorecard">
        <p>
          {countLabel(file.points ?? 0, 'point')}
          {file.rank
            ? ` · #${file.rank}${file.players ? ` of ${file.players} players today` : ''}`
            : ''}
        </p>
        <Progress dibs={claims} strikes={file.strikes ?? 0} />
      </div>
      <div className="invitation-action">
        <Link to="/?play=1" className="primary">
          Play today's Dibs <Icon />
        </Link>
        <p>One category a day. {MAX_CLAIMS} claims. Your name stays on it.</p>
      </div>
      {revealed &&
        (today.category && !today.revealed ? (
          <p>
            Today's category is open: <Link to="/?play=1">Play now</Link>
          </p>
        ) : (
          <Clock target={today.nextDrop} />
        ))}
    </section>
  );
}
export function SummaryPage({ id, today }: { id: string; today: Today }) {
  const [data, setData] = useState<{
    file: DayFile;
    category: Category;
    nextDrop: string;
    specials?: Today['specials'];
    owned?: boolean;
  }>();
  const [error, setError] = useState('');
  useEffect(() => {
    api<{
      file: DayFile;
      category: Category;
      nextDrop: string;
      specials?: Today['specials'];
      owned?: boolean;
    }>('/summary/' + encodeURIComponent(id))
      .then(async (summary) => {
        // The public summary stays sealed until an explicit share. The holder
        // can prepare their own image from the existing private /me endpoint.
        if (summary.owned && summary.file.claims.some((claim) => claim.concealed)) {
          const me = await api<{ file: DayFile | null }>('/me');
          if (me.file?.summaryId === id) summary.file = me.file;
        }
        return summary;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <section className="summary-page">
      {data && !data.owned ? (
        <SharedInvitation
          handle={data.file.handle || 'A player'}
          file={data.file}
          today={today}
          revealed={data.file.revealed}
          date={data.category.date}
        />
      ) : (
        <div className="page-heading">
          <span className="eyebrow">Day certificate</span>
          <h1>A day on file.</h1>
          <Link to="/">
            Play today’s Dibs <Icon />
          </Link>
        </div>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : data ? (
        <DaySummary
          file={data.file}
          owned={!!data.owned}
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
export function CertificatePage({ id, today }: { id: string; today: Today }) {
  const [score, setScore] = useState<Partial<DayFile>>();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ claim: Claim; score?: Partial<DayFile> }>('/certificate/' + id)
      .then((d) => {
        setScore(d.score);
        setClaim(
          d.claim.concealed
            ? { ...d.claim, display: 'Revealed when the day closes', obscurity: null }
            : d.claim,
        );
      })
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <section className="certificate-page">
      {claim && !claim.owned ? (
        <SharedInvitation
          handle={claim.handle}
          file={score || { points: claim.points, dibs: 1 }}
          today={today}
          revealed={claim.revealed}
          date={claim.category_date}
        />
      ) : (
        <div className="page-heading">
          <span className="eyebrow">Certificate</span>
          <h1>On the record.</h1>
          <p>Temporary ownership. Permanent bragging rights.</p>
        </div>
      )}
      {claim ? (
        <>
          <Certificate claim={claim} />
          <ShareButtons claim={claim} score={score} />
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
