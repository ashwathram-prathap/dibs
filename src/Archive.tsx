import { useState, useEffect } from 'react';
import { api } from './api';
import { type Category } from './types';
import { archiveDescription, archiveTitle } from '../shared/seo';
import { PUBLIC_ORIGIN } from '../shared/config';
import { Wordmark } from './ui';
import { Icon } from './Icon';
import { Leaderboard } from './Leaderboard';
import { Ledger } from './Ledger';
export function Archive() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ];
    const originals = selectors.map((selector) => [
      selector,
      document.querySelector(selector)?.getAttribute('content') || '',
    ]);
    return () => {
      for (const [selector, value] of originals)
        document.querySelector(selector)?.setAttribute('content', value);
    };
  }, []);
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
      for (const selector of [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
      ])
        document.querySelector(selector)?.setAttribute('content', archiveDescription(selected));
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
        <span className="eyebrow">Archive</span>
        <h1>
          Yesterday
          <br />
          belongs here.
        </h1>
        <p>A record of who called what. No revisions to history.</p>
      </div>
      <div className="archive-layout">
        <aside>
          <span className="eyebrow">Select a day</span>
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
              <Leaderboard category={selected.id} final />
              <Ledger
                category={selected}
                goldenFound={selected.specials?.goldenFound}
                goldenTotal={selected.specials?.goldenTotal}
              />
              {selected.specials && (
                <section className="archive-specials">
                  <span className="house-stamp">RESERVED</span>
                  <h2>The obvious answers are reserved.</h2>
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
                          <li key={a.id}>
                            {a.display}
                            {a.clued ? ' · clued' : ''}
                          </li>
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
              <section className="archive-specimen">
                <h2>No past days yet.</h2>
                <p>The first results appear after a day closes.</p>
              </section>
            )
          )}
        </div>
      </div>
    </>
  );
}
