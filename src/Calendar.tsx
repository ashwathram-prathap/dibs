import { useEffect, useState } from 'react';
import { localTime, viewerZone } from '../shared/time';
import type { CalendarDay, Topic } from '../shared/calendar';
type Data = { days: CalendarDay[]; library: Topic[]; storage: any; log: any[]; runs: any[] };
export function Calendar() {
  const [draft, setDraft] = useState(''),
    [token, setToken] = useState(''),
    [data, setData] = useState<Data>(),
    [selected, setSelected] = useState<CalendarDay>(),
    [search, setSearch] = useState(''),
    [slug, setSlug] = useState(''),
    [request, setRequest] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async (key = token) => {
    const r = await fetch('/api/admin/schedule', { headers: { authorization: 'Bearer ' + key } });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || 'Calendar unavailable.');
    setData(d);
  };
  useEffect(() => {
    if (!token) return;
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => void load().catch((e) => setError(e.message)), 15000);
    return () => clearInterval(timer);
  }, [token]);
  const change = async (action: string) => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const target = data?.days.find((d) => d.date === to);
      const r = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          date: selected.date,
          revision: selected.revision,
          slug,
          request,
          to,
          targetRevision: target?.revision || 0,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message);
      await load();
      setSelected(undefined);
      setNotice(
        'Calendar updated. Builds run automatically; this page refreshes every 15 seconds.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const topics =
    data?.library.filter((t) =>
      (t.name + ' ' + t.kind).toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const locked =
    selected && (selected.readOnly || Date.parse(selected.dropAt!) - Date.now() < 24 * 3600000);
  const bytes = (n: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n / 1024 / 1024) + ' MB';
  return (
    <section className="schedule-page">
      <div className="schedule-title">
        <div>
          <p className="eyebrow">The registrar’s desk</p>
          <h1>Topic calendar.</h1>
        </div>
        <a href="/admin/live">Live office</a>
      </div>
      {!data && (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            setToken(draft);
          }}
        >
          <label htmlFor="schedule-token">Admin token</label>
          <input
            id="schedule-token"
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            required
          />
          <button>Open calendar</button>
        </form>
      )}
      <p className="calendar-error" role="alert">
        {error}
      </p>
      <p role="status">{notice}</p>
      {data && (
        <>
          <div className="calendar-rules">
            <p>
              <strong>24 hours</strong> for library picks and moves.
            </p>
            <p>
              <strong>72 hours</strong> for new requests.
            </p>
            <p>
              <strong>48 hours</strong> before an empty or failed day, we pick a ready topic.
            </p>
          </div>
          <p className="calendar-subline">
            Next 60 days · times shown locally · live and past days are locked.
          </p>
          {selected && (
            <section className="calendar-editor" aria-label="Edit selected day">
              <div className="editor-title">
                <h2>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(
                    new Date(selected.date + 'T12:00:00'),
                  )}
                </h2>
                <button onClick={() => setSelected(undefined)} aria-label="Close day editor">
                  Close
                </button>
              </div>
              <p>
                Drop: {localTime(selected.dropAt!, viewerZone(), true).label}{' '}
                {localTime(selected.dropAt!, viewerZone(), true).zone} ·{' '}
                <strong>{selected.status}</strong>
              </p>
              <p>{selected.reason}</p>
              {selected.build_result && <p>{selected.build_result}</p>}
              {locked ? (
                <p>This day is locked. Library changes close 24 hours before the drop.</p>
              ) : (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void change('library');
                    }}
                  >
                    <label htmlFor="topic-search">Topic library</label>
                    <input
                      id="topic-search"
                      type="search"
                      placeholder="Search topics or types"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <label className="sr-only" htmlFor="topic-choice">
                      Choose a topic
                    </label>
                    <select
                      id="topic-choice"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    >
                      <option value="">Choose a ready topic</option>
                      {topics.map((t) => (
                        <option key={t.slug} value={t.slug} disabled={!t.ready}>
                          {t.name} · {Math.round((t.score || 0) * 1000) / 10}%
                          {!t.ready ? ' · unavailable' : ''}
                        </option>
                      ))}
                    </select>
                    {data.library
                      .filter((t) => t.slug === slug)
                      .map((t) => (
                        <p className="recipe-detail" key={t.slug}>
                          {t.kind} · coverage checked{' '}
                          {t.checkedAt ? new Date(t.checkedAt).toLocaleDateString() : '—'} · last
                          used {t.lastUsed || 'not yet'}
                          <br />
                          {t.recipe?.scope}
                        </p>
                      ))}
                    <button className="primary" disabled={busy || !slug}>
                      Set topic
                    </button>
                  </form>
                  <div className="calendar-actions">
                    <button disabled={busy} onClick={() => void change('pick')}>
                      Pick for me
                    </button>
                    <button disabled={busy} onClick={() => void change('clear')}>
                      Clear day
                    </button>
                  </div>
                  <details>
                    <summary>Request a new topic</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void change('request');
                      }}
                    >
                      <label htmlFor="new-topic">Topic name</label>
                      <input
                        id="new-topic"
                        maxLength={80}
                        value={request}
                        onChange={(e) => setRequest(e.target.value)}
                        placeholder="For example, Car brands"
                        required
                      />
                      <p>
                        A complete source and 98% obvious-answer coverage are required. If it cannot
                        pass in time, a library topic takes its place.
                      </p>
                      <button
                        disabled={busy || Date.parse(selected.dropAt!) - Date.now() < 72 * 3600000}
                      >
                        Request topic
                      </button>
                    </form>
                  </details>
                  <details>
                    <summary>Move or swap</summary>
                    <label htmlFor="move-day">Move to…</label>
                    <select id="move-day" value={to} onChange={(e) => setTo(e.target.value)}>
                      <option value="">Choose a date</option>
                      {data.days
                        .filter(
                          (d) =>
                            d.date !== selected.date &&
                            !d.readOnly &&
                            Date.parse(d.dropAt!) - Date.now() >= 24 * 3600000,
                        )
                        .map((d) => (
                          <option key={d.date} value={d.date}>
                            {d.date} ·{' '}
                            {data.library.find((t) => t.slug === d.slug)?.name ||
                              d.request ||
                              'Empty'}
                          </option>
                        ))}
                    </select>
                    <div className="calendar-actions">
                      <button disabled={busy || !to} onClick={() => void change('move')}>
                        Move to empty day
                      </button>
                      <button disabled={busy || !to} onClick={() => void change('swap')}>
                        Swap days
                      </button>
                    </div>
                  </details>
                </>
              )}
            </section>
          )}
          <div className="calendar-months" aria-label="Jump to month">
            {[...new Set(data.days.map((d) => d.date.slice(0, 7)))].map((month) => (
              <button
                key={month}
                onClick={() =>
                  document
                    .querySelector(`[data-month="${month}"]`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
                  new Date(month + '-15T12:00:00'),
                )}
              </button>
            ))}
          </div>
          <div className="calendar-grid" aria-label="Next 60 days">
            {data.days.map((d) => {
              const t = data.library.find((t) => t.slug === d.slug);
              return (
                <button
                  data-month={d.date.slice(0, 7)}
                  className={
                    'calendar-day state-' +
                    d.status.replaceAll(' ', '-') +
                    (selected?.date === d.date ? ' selected' : '')
                  }
                  key={d.date}
                  onClick={() => {
                    setSelected({ ...d });
                    setSlug(d.slug || '');
                    setRequest('');
                    setTo('');
                    setSearch('');
                    setError('');
                    requestAnimationFrame(() =>
                      document
                        .querySelector('.calendar-editor')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                    );
                  }}
                  aria-label={`${d.date}: ${t?.name || d.request || 'Empty'}, ${d.status}`}
                >
                  <span className="calendar-date">
                    {new Intl.DateTimeFormat(undefined, {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short',
                    }).format(new Date(d.date + 'T12:00:00'))}
                  </span>
                  <strong>{t?.name || d.request || 'Open day'}</strong>
                  <span className="calendar-status">
                    {d.readOnly ? 'Locked · ' : ''}
                    {d.status}
                  </span>
                  {!!d.auto_picked && <span className="auto-label">auto-picked</span>}
                  <small>
                    {d.build_result ||
                      (d.status === 'requested'
                        ? 'Queued for build'
                        : d.status === 'needs recipe'
                          ? 'Source and coverage needed'
                          : 'Choose a topic')}
                  </small>
                </button>
              );
            })}
          </div>
          <section className="calendar-storage">
            <h2>Storage & rollout</h2>
            <p>
              D1: {bytes(data.storage.d1Bytes)} / {bytes(data.storage.d1Limit)}
            </p>
            <meter
              aria-label="D1 storage"
              min={0}
              max={data.storage.d1Limit}
              value={data.storage.d1Bytes}
            />
            {data.storage.d1Bytes / data.storage.d1Limit >= 0.7 && (
              <p role="alert">D1 storage is above 70%.</p>
            )}
            {data.storage.assets ? (
              <>
                <p>
                  Static assets: {data.storage.assets.files.toLocaleString()} /{' '}
                  {data.storage.assetFileLimit.toLocaleString()} files ·{' '}
                  {bytes(data.storage.assets.bytes)} total
                </p>
                <meter
                  aria-label="Static asset file budget"
                  min={0}
                  max={data.storage.assetFileLimit}
                  value={data.storage.assets.files}
                />
                <p>
                  Largest file: {bytes(data.storage.assets.maxBytes)} /{' '}
                  {bytes(data.storage.assetMaxFileBytes)}. Pages has a per-file and file-count
                  limit; no total-byte allowance is implied.
                </p>
                {data.storage.assets.maxBytes / data.storage.assetMaxFileBytes >= 0.7 && (
                  <p role="alert">The largest static file is above 70% of the per-file limit.</p>
                )}
                {data.storage.assets.files / data.storage.assetFileLimit >= 0.7 && (
                  <p role="alert">Static file count is above 70%.</p>
                )}
              </>
            ) : (
              <p>Asset inventory will appear after the first rollout.</p>
            )}
            {data.runs.map((r) => (
              <div key={r.key}>
                <strong>{r.key}</strong>
                <p>
                  {JSON.parse(r.value_json).message || JSON.parse(r.value_json).status} ·{' '}
                  {new Date(r.updated_at).toLocaleString()}
                </p>
              </div>
            ))}
          </section>
          <details className="calendar-history">
            <summary>Clerk’s log</summary>
            {data.log.map((l) => (
              <article key={l.id}>
                <strong>
                  {l.date} · {l.action}
                </strong>
                <p>{l.detail}</p>
                <small>{new Date(l.at).toLocaleString()}</small>
              </article>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
