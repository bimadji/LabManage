#!/usr/bin/env bash
# Jalankan skrip verifikasi SQL terhadap DB uji lokal (Postgres di Docker).
# Keluar non-zero bila ada skenario gagal.
#
#   ./scripts/run-db-checks.sh
#   SUPABASE_DB_CONTAINER=... ./scripts/run-db-checks.sh   # container lain
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Temukan container DB milik project ini (label compose = id project).
if [[ -z "${SUPABASE_DB_CONTAINER:-}" ]]; then
  project_id="$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$ROOT/supabase/config.toml" 2>/dev/null || true)"
  project_id="${project_id:-$(basename "$ROOT")}"
  SUPABASE_DB_CONTAINER="$(docker ps --filter "label=com.supabase.cli.project=${project_id}" --format '{{.Names}}' | grep -E "^supabase_db_" | head -1)"
fi

if [[ -z "$SUPABASE_DB_CONTAINER" ]] || ! docker ps --format '{{.Names}}' | grep -qx "$SUPABASE_DB_CONTAINER"; then
  echo "SKIP: container DB Supabase tidak jalan." >&2
  echo "Jalankan 'npx supabase start --exclude studio,analytics,vector,edge-runtime,imgproxy' lebih dulu." >&2
  exit 2
fi

status=0
for sql in verify-loan-lifecycle.sql verify-security-definer.sql; do
  echo "=== $sql ==="
  if docker exec -i "$SUPABASE_DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$ROOT/scripts/$sql"; then
    echo "OK: $sql"
  else
    echo "GAGAL: $sql" >&2
    status=1
  fi
done

exit "$status"
