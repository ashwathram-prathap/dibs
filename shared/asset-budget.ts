export const ASSET_MAX_FILES = 15000;
export const ASSET_MAX_BYTES = 10000000;
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
      'R20 asset budget exceeded: at most 15,000 files and 10,000,000 bytes per file. Preserve required historical assets; do not prune them to pass.',
    );
}
