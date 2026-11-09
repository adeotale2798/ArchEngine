#!/usr/bin/env bash
set -euo pipefail
: "${MONGO_URL:?MONGO_URL required}" "${DB_NAME:?DB_NAME required}"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/${DB_NAME}-$(date +%Y%m%d-%H%M%S).archive.gz"
mongodump --uri="$MONGO_URL" --db="$DB_NAME" --archive="$FILE" --gzip
echo "Backup written: $FILE"
