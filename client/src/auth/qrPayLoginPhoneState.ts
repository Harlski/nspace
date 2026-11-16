import type { QrPayLoginChallenge } from "./qrPayLoginApi.js";

/** Account the phone authorized for the other computer. No session token. */
export type QrPhoneReceipt = {
  address: string;
  nimiqPay: boolean;
};

export type QrPhoneBootView =
  | { view: "authorized"; receipt: QrPhoneReceipt }
  | { view: "pending" }
  | { view: "expired" };

const STORAGE_KEY = "nspace.qrPayLogin.phoneReceipt";
/** Longer than the server ticket TTL so a reload still shows the account. */
const MAX_AGE_MS = 15 * 60 * 1000;

type StoredReceipt = QrPhoneReceipt & { at: number };

function readAll(storage: Storage): Record<string, StoredReceipt> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, StoredReceipt>;
  } catch {
    return {};
  }
}

export function readQrPhoneReceipt(
  storage: Storage,
  ticketId: string
): QrPhoneReceipt | null {
  const row = readAll(storage)[ticketId];
  if (!row || typeof row.address !== "string" || !row.address.trim()) return null;
  if (typeof row.at === "number" && Date.now() - row.at > MAX_AGE_MS) return null;
  return { address: row.address.trim(), nimiqPay: row.nimiqPay === true };
}

export function writeQrPhoneReceipt(
  storage: Storage,
  ticketId: string,
  receipt: QrPhoneReceipt
): void {
  const address = receipt.address.trim();
  if (!ticketId || !address) return;
  const all = readAll(storage);
  const now = Date.now();
  for (const [id, row] of Object.entries(all)) {
    if (!row || typeof row.at !== "number" || now - row.at > MAX_AGE_MS) {
      delete all[id];
    }
  }
  all[ticketId] = { address, nimiqPay: receipt.nimiqPay === true, at: now };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* Private mode and some in-app browsers reject storage writes. */
  }
}

/**
 * Group a Nimiq user-friendly address into fours so the phone can show the
 * account that authorized the other computer.
 */
export function formatQrLoginAccountAddress(address: string): string {
  const compact = address.replace(/\s+/g, "").trim().toUpperCase();
  if (!compact) return "";
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Decide the phone screen from the public challenge.
 * A fulfilled challenge (including the post-claim address receipt) wins.
 * An expired ticket still shows a locally remembered account so a Pay or
 * browser reload does not return to the sign-in form.
 */
export function phoneViewFromChallenge(
  challenge: QrPayLoginChallenge,
  stored: QrPhoneReceipt | null
): QrPhoneBootView {
  if (challenge.status === "fulfilled") {
    const address = (challenge.address ?? "").trim() || stored?.address || "";
    const nimiqPay =
      typeof challenge.nimiqPay === "boolean"
        ? challenge.nimiqPay
        : stored?.nimiqPay === true;
    return { view: "authorized", receipt: { address, nimiqPay } };
  }
  if (challenge.status === "expired" && stored?.address) {
    return { view: "authorized", receipt: stored };
  }
  if (challenge.status === "expired") return { view: "expired" };
  return { view: "pending" };
}
