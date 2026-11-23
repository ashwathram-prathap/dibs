import { RarityCurve } from './RarityCurve';
import type { FinishedComparison } from '../shared/finished-scores';
export function ScoreCurve({
  comparison,
  final = false,
}: {
  comparison?: FinishedComparison;
  final?: boolean;
}) {
  if (!comparison) return null;
  const { finished, rank, percentile, points } = comparison;
  return (
    <section
      className="day-score-curve"
      aria-label={final ? 'Final score comparison' : "Your score versus today's players"}
    >
      {finished < 10 ? (
        <p>
          {rank ? `Your rank: #${rank} of ${finished} so far.` : `${finished} finished so far.`}{' '}
          {final
            ? 'Fewer than 10 players finished this day.'
            : 'The curve appears once 10 players finish.'}
        </p>
      ) : percentile == null ? (
        <p>
          {finished} players finished{final ? ' this day' : ' so far'}.
        </p>
      ) : (
        <>
          <p className="score-comparison">
            Better than {Math.round(percentile * 100)}% of {final ? "that day's" : "today's"}{' '}
            players
          </p>
          <p className="score-comparison-detail">
            {points} points · #{rank} · ({finished} finished{final ? '' : ' so far'})
          </p>
          <RarityCurve percentile={percentile} category="players" score />
        </>
      )}
    </section>
  );
}
