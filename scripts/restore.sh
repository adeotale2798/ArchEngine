#!/usr/bin/env bash
set -euo pipefail
: "${MONGO_URL:?MONGO_URL required}" "${DB_NAME:?DB_NAME required}"
FILE="${1:?usage: restore.sh <archive.gz>}"
mongorestore --uri="$MONGO_URL" --archive="$FILE" --gzip --drop --nsFrom="*.*" --nsTo="${DB_NAME}.*"
echo "Restored $FILE into $DB_NAME"
