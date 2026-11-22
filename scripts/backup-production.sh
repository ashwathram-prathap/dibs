#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
mkdir -p .backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target=".backups/production-$stamp.sql"
# Full schema + rows also preserves the categories and sparse answer references needed by claims.
./node_modules/.bin/wrangler d1 export dibs-db --remote -c worker/wrangler.jsonc --output "$target.part" > .backups/last-export.log 2>&1
mv "$target.part" "$target"
chmod 600 "$target"
# Keep 30 daily copies; no player data leaves this private directory.
find .backups -name 'production-*.sql' -mtime +30 -delete
printf '%s\n' "$stamp: export complete" > .backups/last-success.txt
