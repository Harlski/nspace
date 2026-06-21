#!/usr/bin/env bash
# Run payout data migration on a production host. Containers write under data/ as
# root, so the SSH deploy user often cannot mv legacy nim-payout-* files into
# data/payout-service/. On failure, re-run the same script inside Docker as root.
set -euo pipefail

DEPLOY_ROOT="$(cd "${1:-.}" && pwd)"
SCRIPT="${DEPLOY_ROOT}/scripts/migrate-payout-data-to-sidecar.sh"

if [[ ! -x "$SCRIPT" ]]; then
  echo "ERROR: missing or non-executable $SCRIPT" >&2
  exit 1
fi

run_migration() {
  bash "$SCRIPT" "$DEPLOY_ROOT"
}

if run_migration; then
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: migration failed and docker is unavailable for a root retry." >&2
  echo "Run manually: sudo bash $SCRIPT $DEPLOY_ROOT" >&2
  exit 1
fi

echo "[migrate-payout] host user could not migrate (usually root-owned data/) — retrying via Docker as root…"
docker run --rm \
  -v "${DEPLOY_ROOT}:/work:rw" \
  bash:5-alpine \
  bash /work/scripts/migrate-payout-data-to-sidecar.sh /work
