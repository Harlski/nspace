#!/usr/bin/env bash
# Idempotent cutover helper: move legacy in-process payout files from host data/
# into data/payout-service/ (unchanged format). Safe to run on every deploy — no-op
# once migration is complete. See docs/payout-cutover-runbook.md.
set -euo pipefail

DEPLOY_ROOT="${1:-.}"
DATA_DIR="${DEPLOY_ROOT}/data"
DEST="${DATA_DIR}/payout-service"

PAYOUT_FILES=(
  nim-payout-pending.json
  nim-payout-sent.jsonl
  nim-payout-manual-bulk.jsonl
  nim-payout-dead-letter.jsonl
  accepted-claim-ids.json
)

moved=0
skipped=0

mkdir -p "$DEST"

for f in "${PAYOUT_FILES[@]}"; do
  src="${DATA_DIR}/${f}"
  dst="${DEST}/${f}"
  if [[ ! -f "$src" ]]; then
    continue
  fi
  if [[ -e "$dst" ]]; then
    echo "[migrate-payout] skip $f — already at payout-service/"
    skipped=$((skipped + 1))
    continue
  fi
  mv "$src" "$dst"
  echo "[migrate-payout] moved $f → payout-service/"
  moved=$((moved + 1))
done

src_dir="${DATA_DIR}/nim-payout-recipient-sent"
dst_dir="${DEST}/nim-payout-recipient-sent"
if [[ -d "$src_dir" ]]; then
  if [[ -e "$dst_dir" ]]; then
    echo "[migrate-payout] skip nim-payout-recipient-sent/ — already at payout-service/"
    skipped=$((skipped + 1))
  else
    mv "$src_dir" "$dst_dir"
    echo "[migrate-payout] moved nim-payout-recipient-sent/ → payout-service/"
    moved=$((moved + 1))
  fi
fi

if [[ "$moved" -eq 0 && "$skipped" -eq 0 ]]; then
  echo "[migrate-payout] nothing to migrate (no legacy payout files under data/)"
else
  echo "[migrate-payout] done: moved=${moved} skipped=${skipped}"
fi
