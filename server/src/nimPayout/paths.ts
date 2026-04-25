import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Same tree as world state: `server/data` next to `src/` / `dist/`.
 * Must use two `..` because this module lives under `nimPayout/` (unlike
 * `worldPersistence.ts` at `src/` root, where one `..` is enough).
 */
export const NIM_PAYOUT_DATA_DIR = process.env.NIM_PAYOUT_DATA_DIR
  ? path.resolve(process.env.NIM_PAYOUT_DATA_DIR)
  : path.join(__dirname, "..", "..", "data");

export const NIM_PAYOUT_QUEUE_FILE = path.join(
  NIM_PAYOUT_DATA_DIR,
  "nim-payout-pending.json"
);
