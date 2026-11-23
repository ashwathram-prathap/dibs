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
  if (percentile == null) return null;
  const x = bellX(percentile),
    y = bellY(bellSigma(percentile));
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
        score
          ? `Better than ${Math.round(percentile * 100)}% of today's players`
          : `${answer || 'This claim'}: ${rarityLabel(percentile, category)}`
      }
      data-percentile={percentile}
      data-marker-x={x}
    >
      <svg viewBox="0 0 520 150" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <rect x={x} y="0" width={520 - x} height="108" />
          </clipPath>
        </defs>
        <path className="rarity-fill" d={bellArea()} />
        <path className="rarity-tail" clipPath={`url(#${id})`} d={bellArea()} />
        <path className="rarity-baseline" d="M28,108 H492" />
        <path className="rarity-line" pathLength="1" d={bellPath()} />
        <g className="rarity-marker" style={{ transform: `translateX(${x}px)` }}>
          <path d={`M0,${y} V112`} />
          <circle cy={y} cx="0" r="3" />
          <text className="rarity-you" y="128" textAnchor="middle">
            You
          </text>
        </g>
        <text className="rarity-end" x="28" y="146">
          {score ? 'Lower scores' : 'Familiar'}
        </text>
        <text className="rarity-end" x="492" y="146" textAnchor="end">
          {score ? 'Higher scores' : 'Obscure'}
        </text>
      </svg>
    </div>
  );
}
