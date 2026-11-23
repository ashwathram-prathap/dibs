import { useState, useEffect } from 'react';
import { api } from './api';
import { type Claim, type Category, serial } from './types';
import { getSnapshot, subscribe, type Snapshot } from './live';
import { goldenPerDay, LAUNCH_DATE } from '../shared/config';
import { categoryPlural } from '../shared/category-copy';
import { Handle } from './Handle';
import { Icon } from './Icon';
import { Link, time, RelativeTime } from './ui';
export function Ledger({
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
            <th className="form-label">No.</th>
            <th className="form-label">ANSWER</th>
            <th className="form-label">PLAYER</th>
            <th className="time-col form-label">TIME</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className={newIds.has(r.id) ? 'new-row' : ''}>
              <td className="entry-number">{serial(r.claim_no)}</td>
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
