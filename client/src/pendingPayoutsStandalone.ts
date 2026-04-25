import { apiUrl } from "./net/apiBase.js";

type PendingRow = {
  time?: string;
  identicon?: string;
  walletId?: string;
  amountNim?: string;
};

type HistoryRow = PendingRow & { txHash?: string };

type PendingPayload = {
  allSent?: boolean;
  pendingTotal?: number;
  message?: string | null;
  rows?: PendingRow[];
  historyRows?: HistoryRow[];
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `YYYY-MM-DD HH:mm` in UTC (matches table headers). */
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
  return `<a class="expl" rel="noopener noreferrer" target="_blank" href="https://nimiq.watch/#${hex}">Watch</a> · <a class="expl" rel="noopener noreferrer" target="_blank" href="https://www.nimiqhub.com/tx/${hex}">Hub</a>`;
}

/** First 4 + last 4 of user-friendly address (spaces stripped), e.g. `NQ910RY0`. */
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
    ? `<img class="ident" src="${esc(identicon)}" alt="" width="40" height="40"/>`
    : "";
  const short = esc(walletIdShort(full));
  const titleAttr = full ? ` title="${esc(full)}"` : "";
  return `<td class="mono wallet-cell"><span class="wallet-cell-inner">${img}<span${titleAttr}>${short}</span></span></td>`;
}

function tablePending(rows: PendingRow[]): string {
  let html =
    '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem;color:#8b9cb3">Pending</h2>' +
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
    '<h2 style="font-size:1rem;margin:1.25rem 0 0.5rem;color:#8b9cb3">Completed Transactions</h2>' +
    "<table><thead><tr><th>Sent (UTC)</th><th>Wallet</th><th>Amount (NIM)</th><th>Explorer</th></tr></thead><tbody>";
  for (const row of rows) {
    const t = esc(fmtUtcShort(row.time || ""));
    const a = esc(row.amountNim || "");
    html += `<tr><td class="mono">${t}</td>${walletCell(row.identicon, row.walletId)}<td class="mono amt">${a}</td><td class="mono">${explorerCell(row.txHash || "")}</td></tr>`;
  }
  return `${html}</tbody></table>`;
}

async function load(): Promise<void> {
  const statusEl = document.getElementById("status");
  const countLine = document.getElementById("countLine");
  const bannerEl = document.getElementById("banner");
  const wrap = document.getElementById("wrap");
  if (!statusEl || !countLine || !bannerEl || !wrap) return;

  try {
    const r = await fetch(apiUrl("/api/nim/pending-payouts"), { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as PendingPayload;
    statusEl.textContent = `Last updated (UTC): ${fmtUtcShort(new Date().toISOString())}`;
    const total =
      typeof data.pendingTotal === "number"
        ? data.pendingTotal
        : (data.rows && data.rows.length) || 0;
    const hist = (data.historyRows && data.historyRows.length) || 0;
    let countText =
      total === 1 ? "1 pending transaction" : `${total} pending transactions`;
    if (hist) countText += ` · ${hist} in Completed Transactions`;
    countLine.textContent = countText;
    if (data.allSent) {
      bannerEl.style.display = "block";
      bannerEl.className = "status status--queue-clear";
      bannerEl.textContent =
        data.message || "All pending transactions have been sent.";
    } else {
      bannerEl.style.display = "none";
      bannerEl.className = "status";
    }
    const rows = data.rows || [];
    const historyRows = data.historyRows || [];
    let body = "";
    if (rows.length) body += tablePending(rows);
    if (historyRows.length) body += tableHistory(historyRows);
    if (!body) {
      if (data.allSent) wrap.innerHTML = "";
      else
        wrap.innerHTML = `<p class="err">Unexpected empty response (pendingTotal=${esc(String(total))}).</p>`;
    } else {
      wrap.innerHTML = body;
    }
  } catch (e) {
    statusEl.innerHTML = `<span class="err">Failed to load: ${esc(String(e && (e as Error).message ? (e as Error).message : e))}</span>`;
  }
}

void load();
setInterval(() => void load(), 15_000);
