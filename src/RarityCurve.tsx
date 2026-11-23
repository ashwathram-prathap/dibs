import { useId } from 'react';
import { bellArea, bellPath, bellSigma, bellX, bellY, rarityLabel } from '../shared/rarity';
export function RarityCurve({
  percentile,
  category,
  answer,
  golden,
  mini = false,
  score = false,
}: {
  percentile: number | null | undefined;
  category: string;
  answer?: string;
  golden?: boolean | number;
  mini?: boolean;
  score?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const measured = percentile != null;
  const x = bellX(percentile ?? 0.5),
    y = bellY(bellSigma(percentile ?? 0.5));
  return (
    <div
      className={
        'rarity-curve' +
        (golden ? ' rarity-gold' : '') +
        (mini ? ' rarity-mini' : '') +
        (score ? ' score-curve' : '')
      }
      role="img"
      aria-label={
        !measured
          ? 'Rarity not measured for this answer'
          : score
            ? `Better than ${Math.round(percentile! * 100)}% of today's players`
            : `${answer || 'This claim'}: ${rarityLabel(percentile!, category)}`
      }
      data-percentile={percentile}
      data-marker-x={measured ? x : undefined}
    >
      <svg viewBox="0 0 520 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <rect x={x} y="0" width={520 - x} height="108" />
          </clipPath>
        </defs>
        <path className="rarity-fill" d={bellArea()} />
        {measured && <path className="rarity-tail" clipPath={`url(#${id})`} d={bellArea()} />}
        <path className="rarity-baseline" d="M28,108 H492" />
        <path className="rarity-line" pathLength="1" d={bellPath()} />
        {measured && (
          <g className="rarity-marker" style={{ transform: `translateX(${x}px)` }}>
            <path d={`M0,${y} V112`} />
            <circle cy={y} cx="0" r="3" />
          </g>
        )}
      </svg>
      {measured && (
        <span
          className="rarity-you"
          aria-hidden="true"
          style={{ left: `${Math.max(8, Math.min(92, (x / 520) * 100))}%` }}
        >
          You
        </span>
      )}
      <div className="rarity-axis" aria-hidden="true">
        <span className="rarity-end">{score ? 'Lower scores' : 'Familiar'}</span>
        <span className="rarity-end">{score ? 'Higher scores' : 'Obscure'}</span>
      </div>
    </div>
  );
}
