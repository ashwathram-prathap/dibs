import { rarityLabel } from '../shared/rarity';
import { ScoreCurve } from './ScoreCurve';
import { countLabel } from '../shared/text';
import { RarityCurve } from './RarityCurve';
import { useState, useEffect, useCallback } from 'react';
import { m as motion, useReducedMotion, LazyMotion, domAnimation } from 'framer-motion';
import { api } from './api';
import { type Claim, type DayFile, type Today, type Category, serial } from './types';
import { categoryStyle } from '../shared/category-style';
import { MAX_CLAIMS, PUBLIC_HOST, certificateUrl } from '../shared/config';
import { GAME_DESCRIPTION } from '../shared/copy';
import { guesses } from '../shared/guesses';
import { summaryUrl } from '../shared/sharing';
import { ShareSheet } from './ShareSheet';
import { exportCertificate, exportSummary, summaryText } from './share';
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
                      {(event.obscurity || 0) >= 4 ? ' / Deep cut' : ''}
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
          <span>{PUBLIC_HOST}</span>
        </div>
      </article>
      <aside className="day-companions">
        <ShareSheet
          url={summaryUrl(file.summaryId!)}
          text={summaryText(file, today.category!)}
          render={render}
        />
        {showLedger && <ScoreCurve comparison={file.comparison} final={today.revealed} />}
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
          <span className="form-label">Form D-1</span>
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
              </>
            ) : claim.percentile != null ? (
              <>
                <p>
                  {rarityLabel(claim.percentile, claim.category_name)} ·{' '}
                  {countLabel(claim.points || 0, 'point')}
                </p>
                <RarityCurve
                  percentile={claim.percentile}
                  category={claim.category_slug || claim.category_name}
                  answer={claim.display}
                  golden={claim.golden}
                  mini
                />
              </>
            ) : null}
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
              ) : claim.obscurity && claim.obscurity >= 4 ? (
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
            {PUBLIC_HOST}/c/{claim.id.slice(0, 16)}
          </span>
        </div>
      </motion.article>
    </LazyMotion>
  );
}
export function ShareButtons({ claim }: { claim: Claim }) {
  const render = useCallback((story: boolean) => exportCertificate(claim, story), [claim]);
  return <ShareSheet url={certificateUrl(claim.id)} text={GAME_DESCRIPTION} render={render} />;
}
export function SummaryPage({ id }: { id: string }) {
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
export function CertificatePage({ id }: { id: string }) {
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
