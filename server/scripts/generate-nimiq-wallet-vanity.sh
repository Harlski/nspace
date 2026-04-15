#!/usr/bin/env bash
# Generate random Nimiq wallets until the user-friendly address matches:
#   - first 4 characters (no spaces): NQ05
#   - last 4 characters (no spaces): PACE
# Example shape: NQ05 XXXX XXXX XXXX XXXX XXXX XXXX XXXX PACE (groups are illustrative)
#
# Standalone; uses @nimiq/core from the repo workspace. Can take a long time (random search).
#
# Optional environment overrides:
#   VANITY_PREFIX   default NQ05
#   VANITY_SUFFIX   default PACE
#   VANITY_PROGRESS_EVERY  log wallet count to stderr every N wallets (default 250000)
#
# Usage:
#   bash server/scripts/generate-nimiq-wallet-vanity.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d "$REPO_ROOT/node_modules/@nimiq/core" ]]; then
  echo "error: @nimiq/core not found under $REPO_ROOT/node_modules" >&2
  echo "Run: npm install (from the repository root)" >&2
  exit 1
fi

export NODE_PATH="${REPO_ROOT}/node_modules${NODE_PATH:+:${NODE_PATH}}"

export VANITY_PREFIX="${VANITY_PREFIX:-NQ05}"
export VANITY_SUFFIX="${VANITY_SUFFIX:-PACE}"
export VANITY_PROGRESS_EVERY="${VANITY_PROGRESS_EVERY:-250000}"

exec node --input-type=module -e "
import { PrivateKey, KeyPair } from '@nimiq/core';

const PREFIX = (process.env.VANITY_PREFIX ?? 'NQ05').toUpperCase();
const SUFFIX = (process.env.VANITY_SUFFIX ?? 'PACE').toUpperCase();
const PROGRESS_EVERY = Math.max(1, parseInt(process.env.VANITY_PROGRESS_EVERY ?? '250000', 10) || 250000);

if (PREFIX.length !== 4 || SUFFIX.length !== 4) {
  console.error('error: VANITY_PREFIX and VANITY_SUFFIX must be exactly 4 characters each.');
  process.exit(1);
}

console.error(
  '[vanity] Searching for user-friendly address: …' +
    PREFIX +
    ' … … … ' +
    SUFFIX +
    ' (counting each wallet generated; progress every ' +
    PROGRESS_EVERY.toLocaleString() +
    ' wallets)'
);

let walletsGenerated = 0;
for (;;) {
  walletsGenerated++;
  const privateKey = PrivateKey.generate();
  const keyPair = KeyPair.derive(privateKey);
  const uf = keyPair.toAddress().toUserFriendlyAddress();
  const compact = uf.replace(/\s/g, '').toUpperCase();

  if (compact.startsWith(PREFIX) && compact.endsWith(SUFFIX)) {
    console.log('');
    console.log(
      'Match! Total wallets generated: ' + walletsGenerated.toLocaleString()
    );
    console.log('----------------');
    console.log('Address (user-friendly):  ' + uf);
    console.log('');
    console.log('Private key (hex, 32 bytes — keep secret, never commit):');
    console.log(privateKey.toHex());
    console.log('');
    console.log('For server payouts, set: NIM_PAYOUT_PRIVATE_KEY=<hex above>');
    console.log('');
    break;
  }

  if (walletsGenerated % PROGRESS_EVERY === 0) {
    console.error(
      '[vanity] Wallets generated: ' +
        walletsGenerated.toLocaleString() +
        ' — still searching…'
    );
  }
}
"
