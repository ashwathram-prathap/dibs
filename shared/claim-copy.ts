import { rarityLabel, standardScoreLabel } from './rarity';
export function claimScore(c: {
  points?: number;
  bonus?: number;
  golden?: boolean | number;
  percentile?: number | null;
  category_name: string;
  category_slug?: string;
}) {
  const points = c.points ?? 0;
  const bonus = c.bonus ?? (c.golden ? 100 : 0);
  const rarity =
    c.percentile == null
      ? standardScoreLabel(points)
      : `${points} points · ${rarityLabel(c.percentile, c.category_slug || c.category_name)}`;
  return rarity + (bonus ? ` · ${points - bonus} + ${bonus} golden bonus` : '');
}
