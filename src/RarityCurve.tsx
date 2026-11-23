import { useEffect, useId, useState } from 'react';
import { rarityPath, rarityPosition } from '../shared/rarity';
type Density = { measured: number; density: number[] };
const cache = new Map<string, Promise<Density>>();
export function loadDensity(slug: string) {
  if (!cache.has(slug))
    cache.set(
      slug,
      fetch('/rarity/' + encodeURIComponent(slug) + '.json')
        .then((r) => {
          if (!r.ok) throw Error('Curve unavailable');
          return r.json();
        })
        .catch((e) => {
          cache.delete(slug);
          throw e;
        }),
    );
  return cache.get(slug)!;
}
export function RarityCurve({
  percentile,
  category,
  answer,
  golden,
  mini = false,
}: {
  percentile: number | null | undefined;
  category: string;
  answer?: string;
  golden?: boolean | number;
  mini?: boolean;
}) {
  const [data, setData] = useState<Density>();
  const id = useId().replace(/:/g, '');
  const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  useEffect(() => {
    let alive = true;
    setData(undefined);
    loadDensity(slug)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);
  if (percentile == null || !data?.measured) return null;
  const p = rarityPosition(percentile),
    path = rarityPath(data.density),
    x = p * 400;
  const h = data.density[Math.round(p * (data.density.length - 1))];
  const percent = Math.round(p * 100);
  return (
    <div
      className={'rarity-curve' + (golden ? ' rarity-gold' : '') + (mini ? ' rarity-mini' : '')}
      role="img"
      aria-label={`${answer || 'This claim'} is rarer than ${percent}% of ${category.toLowerCase()}`}
    >
      <div
        className="rarity-marker-label"
        style={{
          left: `${p * 100}%`,
          transform: p < 0.1 ? 'none' : p > 0.9 ? 'translateX(-100%)' : 'translateX(-50%)',
        }}
      >
        you · rarer than {percent}%
      </div>
      <svg viewBox="0 0 400 48" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <rect x={x} y="0" width={400 - x} height="48" />
          </clipPath>
        </defs>
        <path className="rarity-fill" d={path + ' L400,46 L0,46 Z'} />
        <path className="rarity-tail" clipPath={`url(#${id})`} d={path + ' L400,46 L0,46 Z'} />
        <path className="rarity-line" pathLength="1" d={path} />
        <g className="rarity-marker" style={{ transformOrigin: `${x}px 46px` }}>
          <path d={`M${x},3 V46`} />
          <circle cx={x} cy={44 - h * 40} r="3" />
        </g>
      </svg>
      <div className="rarity-axis">
        <span>Familiar</span>
        <span>Obscure</span>
      </div>
    </div>
  );
}
