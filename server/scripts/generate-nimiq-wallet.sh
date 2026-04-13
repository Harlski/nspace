#!/usr/bin/env bash
# Standalone helper: generate a new random Nimiq wallet (private key + user-friendly address).
# Not wired into the app; uses @nimiq/core from the repo workspace (run from any cwd).
#
# Usage:
#   bash server/scripts/generate-nimiq-wallet.sh
#   chmod +x server/scripts/generate-nimiq-wallet.sh && ./server/scripts/generate-nimiq-wallet.sh
#
# Requires: Node.js 18+ with npm install already run at the repository root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# server/scripts -> repository root (parent of server/)
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d "$REPO_ROOT/node_modules/@nimiq/core" ]]; then
  echo "error: @nimiq/core not found under $REPO_ROOT/node_modules" >&2
  echo "Run: npm install (from the repository root)" >&2
  exit 1
fi

export NODE_PATH="${REPO_ROOT}/node_modules${NODE_PATH:+:${NODE_PATH}}"

exec node --input-type=module -e "
import { PrivateKey, KeyPair } from '@nimiq/core';

const privateKey = PrivateKey.generate();
const keyPair = KeyPair.derive(privateKey);
const address = keyPair.toAddress();

console.log('');
console.log('New Nimiq wallet');
console.log('----------------');
console.log('Address (user-friendly):  ' + address.toUserFriendlyAddress());
console.log('');
console.log('Private key (hex, 32 bytes — keep secret, never commit):');
console.log(privateKey.toHex());
console.log('');
console.log('For server payouts, set: NIM_PAYOUT_PRIVATE_KEY=<hex above>');
console.log('');
"
