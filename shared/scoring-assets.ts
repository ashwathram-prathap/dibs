// Bump this version whenever the pool configuration, ranking, or score scale changes.
// Catalog version remains part of the key so answer ordinals cannot drift.
export const SCORING_VERSION = 'r19e-pool-v1';
export const scoreAssetPath = (slug: string, catalogVersion: string) =>
  `/catalog/${slug}/${catalogVersion}/${SCORING_VERSION}/scores-v2.bin`;
export const rarityAssetPath = (slug: string, catalogVersion: string) =>
  `/rarity/${slug}/${catalogVersion}/${SCORING_VERSION}.json`;
