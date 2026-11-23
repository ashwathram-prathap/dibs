import { useState, useEffect, type FormEvent } from 'react';
import { api } from './api';
import {
  GAME_EXPLANATION,
  LIMIT_EXPLANATION,
  BACKUP_EXPLANATION,
  RARITY_EXPLANATION,
  RESERVED_EXPLANATION,
} from '../shared/copy';
import { archiveCsv, validateArchive } from '../shared/feedback-archive';
import { SHOW_CREATOR_CREDIT, CREATOR_URL, X_URL } from '../shared/creator';
import { Rules, DropTime, Link, time } from './ui';
import { Icon } from './Icon';
export function About({ nextDrop }: { nextDrop: string }) {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">Please read before filing / Notice 001</span>
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
          <Rules includeReserved={false} />
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
          <p>
            Each night during launch week we post a clue to one golden ticket. The rest stay secret.
          </p>
          <h3>How do points work?</h3>
          <p>
            Rarer answers score more: from 10 for the most familiar to 110 for the rarest. Golden
            tickets +100; strikes −10.
          </p>
          <p>{RARITY_EXPLANATION}</p>
          <h3>What does reserved mean?</h3>
          <p>{RESERVED_EXPLANATION}</p>
          <h3>What counts toward a streak?</h3>
          <p>Make a claim on consecutive drops. Missing a drop resets your streak.</p>
          <h3>Is it free?</h3>
          <p>Yes. Dibs is free to play.</p>
          <div className="about-stamp">
            NO ACTUAL
            <br />
            Property rights
          </div>
        </section>
        <aside id="privacy" className="office-note">
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
        <section id="sources" className="office-sources">
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
              readership ranks measured answers. Answers without data get the category’s standard
              score. <a href="/data/licenses.txt">Full licenses and source notes</a>.
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
export function Stats() {
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
        <span className="eyebrow">Clerk access / Form X-1</span>
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
                <th>New users</th>
                <th>Claimers / claims</th>
                <th>Share taps</th>
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
                <th>Platform</th>
                <th>Share taps</th>
                <th>Arrivals</th>
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

export function LiveAdmin() {
  const [archiving, setArchiving] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState('');
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
        <button
          type="submit"
          onMouseDown={(e) => {
            // Safari does not focus clicked buttons. Keep the form focused so
            // the fixed navigation cannot reappear between down and up.
            e.preventDefault();
            e.currentTarget.focus();
          }}
        >
          Open Live
        </button>
      </form>
      <p role="status">{error}</p>
      {data && (
        <>
          <p>Last five minutes · updates every 15 seconds</p>
          {data.networkWarning && (
            <p role="alert">A shared network has admitted more than 500 new players today.</p>
          )}
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
                {key}: {data.usage[key] == null ? 'Unavailable' : data.usage[key].toLocaleString()}{' '}
                / {Number(limit).toLocaleString()}{' '}
                {data.usage[key] != null && (
                  <meter min={0} max={Number(limit)} value={data.usage[key]} />
                )}
              </li>
            ))}
          </ul>
          <h2>Private feedback</h2>
          <p>Player-submitted, untrusted</p>
          <button
            disabled={archiving}
            onClick={async () => {
              if (
                !confirm(
                  'Download all feedback as JSON and CSV, then remove exactly those notes from the site?',
                )
              )
                return;
              setArchiving(true);
              setArchiveMessage('');
              try {
                const headers = {
                  authorization: 'Bearer ' + token,
                  'content-type': 'application/json',
                };
                const response = await fetch('/api/admin/feedback-archive', { headers });
                if (!response.ok) throw Error('Feedback could not be archived. Try again.');
                const notes = validateArchive((await response.json()).notes);
                if (!notes.length) {
                  setArchiveMessage('No feedback to archive.');
                  return;
                }
                const name =
                  'feedback-' +
                  new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
                for (const [extension, content, type] of [
                  ['json', JSON.stringify(notes, null, 2), 'application/json'],
                  ['csv', archiveCsv(notes), 'text/csv'],
                ]) {
                  const url = URL.createObjectURL(new Blob([content], { type }));
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = name + '.' + extension;
                  document.body.append(link);
                  link.click();
                  link.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                }
                const deletion = await fetch('/api/admin/feedback-archive', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ ids: notes.map((n) => n.id) }),
                });
                if (!deletion.ok)
                  throw Error(
                    'Downloads started; notes could not be removed. Keep the downloads and try again.',
                  );
                const { removed } = await deletion.json();
                const ids = new Set(notes.map((n) => n.id));
                setData((current: any) => ({
                  ...current,
                  feedback: current.feedback.filter((n: any) => !ids.has(n.id)),
                }));
                setArchiveMessage(
                  `Archived ${notes.length} notes; removed ${removed} from the site.`,
                );
              } catch (e) {
                setArchiveMessage((e as Error).message);
              } finally {
                setArchiving(false);
              }
            }}
          >
            {archiving ? 'Archiving…' : 'Archive all'}
          </button>
          <p role="status">{archiveMessage}</p>
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
