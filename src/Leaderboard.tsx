import { Icon } from './Icon';
import { Handle } from './Handle';
import { useEffect, useState } from 'react';
import { api } from './api';
import { getSnapshot, subscribe } from './live';
import type { Standings } from './types';
export function Leaderboard({
  category,
  final = false,
  practice = false,
  compact = false,
}: {
  category?: string;
  final?: boolean;
  practice?: boolean;
  compact?: boolean;
}) {
  const [board, setBoard] = useState<Standings | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stopped = false;

    let updatedAt = 0;
    const accept = (data: Standings) => {
      if (!stopped) {
        setBoard(data);
        setError(false);
        updatedAt = Date.now();
      }
    };
    const snapshot = getSnapshot();
    const initial =
      !final && snapshot?.today.category?.id === category ? snapshot?.leaderboard : undefined;
    setBoard(initial || null);
    if (initial) updatedAt = Date.now();
    const read = async () => {
      if (!document.hidden && (final || !getSnapshot()?.leaderboard)) {
        try {
          accept(
            await api<Standings>(
              '/leaderboard' +
                (category
                  ? '?category=' + encodeURIComponent(category) + (final ? '&limit=10' : '')
                  : ''),
            ),
          );
        } catch {
          if (!stopped) setError(true);
        }
      }
    };
    void read();
    const off = subscribe((s) => {
      if (!final && s.leaderboard && s.today.category?.id === category) accept(s.leaderboard);
    });
    return () => {
      stopped = true;

      off();
    };
  }, [category, final]);
  const rows = [
    ...(compact ? board?.rows.slice(0, 3) || [] : board?.rows || []),
    ...(board?.own &&
    !(compact ? board.rows.slice(0, 3) : board.rows).some((r) => r.rank === board.own!.rank)
      ? [board.own]
      : []),
  ];
  return (
    <section
      id={final || compact ? undefined : 'leaderboard'}
      className={'leaderboard-section' + (compact ? ' leaderboard-compact' : '')}
      aria-label={final ? 'Final leaderboard' : "Today's leaderboard"}
    >
      <div className="leaderboard-heading">
        <h2>{final ? 'Final leaderboard' : "Today's leaderboard"}</h2>
        <span>{practice ? 'Practice' : final ? 'Final' : 'Live'}</span>
      </div>
      {error && <p role="status">Scores could not refresh. Trying again shortly.</p>}
      {!board ? (
        <p>Loading scores…</p>
      ) : !rows.length ? (
        <p>No scores yet. Be first.</p>
      ) : (
        <table className="leaderboard">
          <caption>
            {board.total} players {final ? 'that day' : 'today'} · everyone who claimed
          </caption>
          <thead>
            <tr>
              <th scope="col">
                Rank{' '}
                <span className="sr-only">
                  of {board.total} players {final ? 'that day' : 'today'}
                </span>
              </th>
              <th scope="col">Player</th>
              <th scope="col">Points</th>
              <th scope="col">Claims</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank} className={r.own ? 'own-score' : ''}>
                <td>#{r.rank}</td>
                <th scope="row">
                  <Handle name={r.handle} founder={r.founder} />
                  {r.own && <span className="leaderboard-badge">You</span>}
                  {r.golden && (
                    <span
                      className="gold-marker"
                      aria-label="found a golden ticket"
                      title="Golden ticket"
                    >
                      <Icon name="star" />
                    </span>
                  )}
                </th>
                <td>{r.points}</td>
                <td>{r.claims}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!final && <p className="leaderboard-note">Answers stay hidden until the day closes.</p>}
    </section>
  );
}
