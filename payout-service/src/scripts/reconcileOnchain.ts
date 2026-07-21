/**
 * Offline reconciliation tool for the payout treasury.
 *
 * Detects "phantom" payouts: transactions that were broadcast on-chain by the
 * treasury but never recorded in `nim-payout-sent.jsonl`. These are the fingerprint
 * of the double-payout incident (a broadcast whose confirmation poll failed, so the
 * service treated it as failed and later re-sent the same jobs).
 *
 * Read-only: it never sends or mutates anything.
 *
 * Usage (inside the payout container, after `npm run build`):
 *   node dist/scripts/reconcileOnchain.js [--since-block N] [--since-days D]
 *        [--data-dir PATH] [--logged-file PATH] [--json]
 *
 * If neither --since-block nor --since-days is given, defaults to the last 3 days.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { loadConfig } from "../config.js";
import {
  fetchOutgoingPayoutTransactions,
  getHeadHeight,
  getTreasuryAddress,
} from "../chain/nimiqClient.js";
import type { OnChainOutgoingTx } from "../chain/types.js";

const APPROX_BLOCKS_PER_DAY = 86_400; // ~1s block time

type Args = {
  sinceBlock?: number;
  sinceDays?: number;
  dataDir?: string;
  loggedFile?: string;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      i += 1;
      return v;
    };
    if (a === "--since-block") args.sinceBlock = Number(next());
    else if (a === "--since-days") args.sinceDays = Number(next());
    else if (a === "--data-dir") args.dataDir = next();
    else if (a === "--logged-file") args.loggedFile = next();
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node dist/scripts/reconcileOnchain.js [--since-block N] [--since-days D] [--data-dir PATH] [--logged-file PATH] [--json]"
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

async function loadLoggedTxHashes(
  sentHistoryFile: string,
  loggedFile: string | undefined
): Promise<Set<string>> {
  const set = new Set<string>();
  // Fast path: a pre-extracted one-hash-per-line file (e.g. produced with jq).
  if (loggedFile) {
    const rl = readline.createInterface({
      input: fs.createReadStream(loggedFile, "utf8"),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      const h = line.trim();
      if (h) set.add(h);
    }
    return set;
  }
  if (!fs.existsSync(sentHistoryFile)) return set;
  const rl = readline.createInterface({
    input: fs.createReadStream(sentHistoryFile, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as { txHash?: unknown };
      if (typeof o.txHash === "string" && o.txHash) set.add(o.txHash);
    } catch {
      /* skip malformed line */
    }
  }
  return set;
}

function lunaToNim(luna: bigint): string {
  return (Number(luna) / 100_000).toFixed(5);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  const dataDir = args.dataDir ?? cfg.dataDir;
  const sentHistoryFile = path.join(dataDir, "nim-payout-sent.jsonl");

  const logged = await loadLoggedTxHashes(sentHistoryFile, args.loggedFile);
  console.error(`[reconcile] loaded ${logged.size} recorded txHashes`);

  const treasury = await getTreasuryAddress();
  const head = await getHeadHeight();
  let sinceBlock: number;
  if (typeof args.sinceBlock === "number" && Number.isFinite(args.sinceBlock)) {
    sinceBlock = Math.max(0, Math.floor(args.sinceBlock));
  } else {
    const days = Number.isFinite(args.sinceDays) ? (args.sinceDays as number) : 3;
    sinceBlock = Math.max(0, head - Math.ceil(days * APPROX_BLOCKS_PER_DAY));
  }
  console.error(
    `[reconcile] treasury=${treasury} head=${head} scanning outgoing txs since block ${sinceBlock}`
  );

  const onchain = await fetchOutgoingPayoutTransactions(sinceBlock);
  console.error(`[reconcile] fetched ${onchain.length} on-chain outgoing txs`);

  const phantoms: OnChainOutgoingTx[] = onchain.filter(
    (t) => !logged.has(t.txHash)
  );

  const byRecipient = new Map<string, { count: number; luna: bigint }>();
  let totalLuna = 0n;
  for (const p of phantoms) {
    totalLuna += p.valueLuna;
    const cur = byRecipient.get(p.recipient) ?? { count: 0, luna: 0n };
    cur.count += 1;
    cur.luna += p.valueLuna;
    byRecipient.set(p.recipient, cur);
  }

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          treasury,
          head,
          sinceBlock,
          onchainCount: onchain.length,
          phantomCount: phantoms.length,
          totalPhantomLuna: totalLuna.toString(),
          totalPhantomNim: lunaToNim(totalLuna),
          phantoms: phantoms.map((p) => ({
            ...p,
            valueLuna: p.valueLuna.toString(),
            valueNim: lunaToNim(p.valueLuna),
          })),
          byRecipient: [...byRecipient.entries()].map(([recipient, v]) => ({
            recipient,
            count: v.count,
            luna: v.luna.toString(),
            nim: lunaToNim(v.luna),
          })),
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  console.log("");
  console.log(
    `Phantom payouts (broadcast on-chain, never recorded): ${phantoms.length}`
  );
  console.log("");
  for (const p of phantoms) {
    const when = p.timestamp ? new Date(p.timestamp).toISOString() : "?";
    console.log(
      `  ${when}  ${lunaToNim(p.valueLuna).padStart(14)} NIM  block ${String(p.blockHeight ?? "?").padStart(9)}  ${p.state.padEnd(10)}  ${p.recipient}  ${p.txHash}`
    );
  }
  console.log("");
  console.log("Per-recipient overpayment:");
  const rows = [...byRecipient.entries()].sort((a, b) =>
    Number(b[1].luna - a[1].luna)
  );
  for (const [recipient, v] of rows) {
    console.log(
      `  ${lunaToNim(v.luna).padStart(14)} NIM  (${String(v.count).padStart(4)} tx)  ${recipient}`
    );
  }
  console.log("");
  console.log(
    `TOTAL overpayment: ${lunaToNim(totalLuna)} NIM across ${phantoms.length} transaction(s) to ${byRecipient.size} recipient(s)`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[reconcile] failed:", e);
    process.exit(1);
  });
