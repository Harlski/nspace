import { fetchNonce, signLoginChallenge, verifyWithServer } from "./auth/nimiq.js";
import { apiUrl } from "./net/apiBase.js";
import { refreshMainSiteNavFromSession, renderMainSiteTopbar } from "./ui/analyticsTopbar.js";
import { readMainSiteAuthToken, writeMainSiteAuthToken } from "./ui/mainSiteAuthKeys.js";
import {
  animateSigningDots,
  isSigningUserCancelledError,
  walletSigningMarkup,
} from "./ui/walletSigningUi.js";
import "./mainSiteClient.css";

type PendingRow = {
  time?: string;
  identicon?: string;
  walletId?: string;
  amountNim?: string;
};

type HistoryRow = PendingRow & { txHash?: string };

type SummaryPayload = {
  mode: "summary";
  pendingTotal: number;
  processedToday: number;
  allSent: boolean;
  message: string | null;
};

type WalletPayload = {
  mode: "wallet";
  allSent: boolean;
  pendingTotal: number;
  message: string | null;
  rows?: PendingRow[];
  historyRows?: HistoryRow[];
  processedToday: number;
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtUtcShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(String(iso));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function nimTxHexForUrl(txHash: string): string {
  const h = String(txHash || "").trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(h) ? h : "";
}

function explorerCell(txHash: string): string {
  const hex = nimTxHexForUrl(txHash);
  if (!hex) return esc(String(txHash || "—"));
  return `<a class="ms-link-expl" rel="noopener noreferrer" target="_blank" href="https://nimiq.watch/#${hex}">Watch</a> · <a class="ms-link-expl" rel="noopener noreferrer" target="_blank" href="https://www.nimiqhub.com/tx/${hex}">Hub</a>`;
}

function fmtTransactionCounts(pending: number, today: number): string {
  const p = Number(pending) || 0;
  const t = Number(today) || 0;
  return (
    `<strong>${p}</strong> pending transaction${p === 1 ? "" : "s"}. ` +
    `<strong>${t}</strong> transaction${t === 1 ? "" : "s"} today.`
  );
}

function payoutIntroHtml(countsHtml: string, notePlain: string | null): string {
  const noteBlock = notePlain
    ? `<p class="payout-queue-intro__note ms-mono">${esc(notePlain)}</p>`
    : "";
  return `<div class="payout-queue-intro"><p class="payout-queue-intro__counts ms-mono">${countsHtml}</p>${noteBlock}</div>`;
}

function wrapPayoutSheet(introHtml: string, tablesHtml: string): string {
  return `<div class="payout-queue-sheet">${introHtml}${tablesHtml}</div>`;
}

function walletIdShort(walletId: string): string {
  const c = String(walletId || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (c.length <= 8) return c;
  return c.slice(0, 4) + c.slice(-4);
}

function walletCell(identicon: string | undefined, walletId: string | undefined): string {
  const full = String(walletId || "");
  const img = identicon
    ? `<img class="ident" src="${esc(identicon)}" alt="" width="32" height="32"/>`
    : "";
  const short = esc(walletIdShort(full));
  const titleAttr = full ? ` title="${esc(full)}"` : "";
  return `<td class="mono wallet-cell"><span class="wallet-cell-inner ms-mono">${img}<span${titleAttr}>${short}</span></span></td>`;
}

function tablePending(rows: PendingRow[]): string {
  let html =
    "<h2 class='ms-section-title'>Pending</h2>" +
    "<table><thead><tr><th>Time (UTC)</th><th>Wallet</th><th>Amount (NIM)</th></tr></thead><tbody>";
  for (const row of rows) {
    const t = esc(fmtUtcShort(row.time || ""));
    const a = esc(row.amountNim || "");
    html += `<tr><td class="mono">${t}</td>${walletCell(row.identicon, row.walletId)}<td class="mono amt">${a}</td></tr>`;
  }
  return `${html}</tbody></table>`;
}

function tableHistory(rows: HistoryRow[]): string {
  let html =
    "<h2 class='ms-section-title'>Recent sent (last 5)</h2>" +
    "<table><thead><tr><th>Sent (UTC)</th><th>Wallet</th><th>Amount (NIM)</th><th>Explorer</th></tr></thead><tbody>";
  for (const row of rows) {
    const t = esc(fmtUtcShort(row.time || ""));
    const a = esc(row.amountNim || "");
    html += `<tr><td class="mono">${t}</td>${walletCell(row.identicon, row.walletId)}<td class="mono amt">${a}</td><td class="mono">${explorerCell(row.txHash || "")}</td></tr>`;
  }
  return `${html}</tbody></table>`;
}

const mustSignInBodyHtml =
  '<div class="ms-auth-gate ms-auth-gate--standalone"><div class="ms-auth-gate-msg">You must be signed in.</div></div>';

async function runLogin(): Promise<void> {
  const statusEl = document.getElementById("status");
  const wrap = document.getElementById("wrap");
  let stopDots = (): void => {};
  if (statusEl) statusEl.textContent = "";
  if (wrap) {
    wrap.innerHTML = wrapPayoutSheet("", walletSigningMarkup());
    stopDots = animateSigningDots(wrap);
  }
  try {
    const { nonce } = await fetchNonce();
    const signed = await signLoginChallenge(nonce, "Nimiq Space payouts");
    const { token, address } = await verifyWithServer(signed);
    if (!token) throw new Error("missing_token");
    writeMainSiteAuthToken(token, address);
    stopDots();
    location.reload();
  } catch (e) {
    stopDots();
    if (isSigningUserCancelledError(e)) {
      if (wrap) wrap.innerHTML = wrapPayoutSheet("", mustSignInBodyHtml);
      if (statusEl) statusEl.textContent = "";
    } else {
      if (wrap) wrap.innerHTML = "";
      if (statusEl) {
        statusEl.innerHTML = `<span class="ms-err">${esc(String(e && (e as Error).message ? (e as Error).message : e))}</span>`;
      }
    }
  }
}

async function load(): Promise<void> {
  const statusEl = document.getElementById("status");
  const titleUpdatedEl = document.getElementById("payoutTitleUpdated");
  const wrap = document.getElementById("wrap");
  if (!statusEl || !wrap) return;

  const token = readMainSiteAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const r = await fetch(apiUrl("/api/nim/pending-payouts"), { cache: "no-store", headers });
    if (r.status === 401) {
      await renderMainSiteTopbar("pending-payouts", { onLoginClick: () => void runLogin() });
      await refreshMainSiteNavFromSession();
      statusEl.textContent = "Session expired — sign in again from the menu.";
      return;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as SummaryPayload | WalletPayload;

    if (titleUpdatedEl) {
      titleUpdatedEl.textContent = `${fmtUtcShort(new Date().toISOString())} UTC`;
    }
    statusEl.textContent = "";

    if (data.mode === "summary") {
      const s = data as SummaryPayload;
      const pend = Number(s.pendingTotal) || 0;
      const done = Number(s.processedToday) || 0;
      const counts = fmtTransactionCounts(pend, done);
      let note: string | null = null;
      if (s.allSent) note = s.message || "No pending transactions.";
      else if (pend === 0) note = "No pending transactions.";
      wrap.innerHTML = wrapPayoutSheet(payoutIntroHtml(counts, note), "");
      return;
    }

    const w = data as WalletPayload;
    const p2 = Number(w.pendingTotal) || 0;
    const d2 = Number(w.processedToday) || 0;
    const countsW = fmtTransactionCounts(p2, d2);
    const rows = w.rows || [];
    const historyRows = w.historyRows || [];
    let body = "";
    if (rows.length) body += tablePending(rows);
    if (historyRows.length) body += tableHistory(historyRows);
    let noteW: string | null = null;
    if (!body) {
      noteW =
        w.allSent && !historyRows.length
          ? "Nothing queued · no recent sends in log."
          : "No pending or recent sends for this wallet.";
    }
    wrap.innerHTML = wrapPayoutSheet(payoutIntroHtml(countsW, noteW), body);
  } catch (e) {
    statusEl.innerHTML = `<span class="ms-err">Failed: ${esc(String(e && (e as Error).message ? (e as Error).message : e))}</span>`;
  }
}

void (async () => {
  await renderMainSiteTopbar("pending-payouts", {
    onLoginClick: () => void runLogin(),
  });
  await load();
  setInterval(() => void load(), 15_000);
})();
