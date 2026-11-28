export const ASSET_MAX_FILES = 20000;
export const ASSET_MAX_BYTES = 25 * 1024 * 1024;
// Owner amendment: a warning target for new catalogs, never a historical-asset blocker.
export const NEW_CATALOG_TARGET_BYTES = 10000000;
export function assertAssetBudget(files: number, maxFileBytes: number) {
  if (
    !Number.isSafeInteger(files) ||
    !Number.isSafeInteger(maxFileBytes) ||
    files < 0 ||
    maxFileBytes < 0 ||
    files > ASSET_MAX_FILES ||
    maxFileBytes > ASSET_MAX_BYTES
  )
    throw Error(
      'R20 asset budget exceeded: at most 20,000 files and 25 MiB per file. Preserve required historical assets; do not prune them to pass.',
    );
}
