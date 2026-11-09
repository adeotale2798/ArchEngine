# Backup & restore

Everything (catalogue, versions, estimates, audit) lives in MongoDB database `$DB_NAME`. Generated documents are re-rendered from stored revisions, so no file storage needs backing up.

## Backup
```bash
MONGO_URL=mongodb://localhost:27017 DB_NAME=archengine ./scripts/backup.sh /var/backups/archengine
```
Creates `archengine-YYYYmmdd-HHMMSS.archive.gz` (mongodump, gzip). Keep 14 daily + 8 weekly copies off-site.

## Restore
```bash
MONGO_URL=mongodb://localhost:27017 DB_NAME=archengine ./scripts/restore.sh /var/backups/archengine/archengine-<stamp>.archive.gz
```
Restore uses `--drop` for the target DB. Restart the backend afterwards; migrations are idempotent and will not re-seed.

## Restore test (do quarterly)
1. Restore into a scratch DB: `DB_NAME=archengine_restore_test ./scripts/restore.sh <file>`.
2. Point a staging backend at it and run `python -m pytest -q tests/test_engine.py`.
3. Open an issued estimate and confirm its PDF/CSV SHA-256 matches the entry in its download history.

## Organisation data export
Admins can export the catalogue as CSV (Templates → Export CSV). A full per-organisation export is `mongodump --query '{"organisation_id":"<org-id>"}'` per collection.
