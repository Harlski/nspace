import { apiUrl } from "./net/apiBase.js";

type PendingRow = {
  time?: string;
  identicon?: string;
  walletId?: string;
  amountNim?: string;
};

type PendingPayload = {
  allSent?: boolean;
  pendingTotal?: number;
  message?: string | null;
  rows?: PendingRow[];
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    statusEl.textContent = `Last updated: ${new Date().toISOString()}`;
    const total =
      typeof data.pendingTotal === "number"
        ? data.pendingTotal
        : (data.rows && data.rows.length) || 0;
    countLine.textContent =
      total === 1 ? "1 pending transaction" : `${total} pending transactions`;
    if (data.allSent) {
      bannerEl.style.display = "block";
      bannerEl.textContent = data.message || "All transactions sent :)";
      wrap.innerHTML = "";
      return;
    }
    bannerEl.style.display = "none";
    const rows = data.rows || [];
    if (!rows.length) {
      wrap.innerHTML = `<p class="err">Unexpected empty response (pendingTotal=${esc(String(total))}).</p>`;
      return;
    }
    let html =
      "<table><thead><tr><th>Time (UTC)</th><th>Identicon</th><th>Wallet</th><th>Amount (NIM)</th></tr></thead><tbody>";
    for (const row of rows) {
      const t = esc(row.time || "");
      const img = row.identicon
        ? `<img class="ident" src="${esc(row.identicon)}" alt="" width="40" height="40"/>`
        : "—";
      const w = esc(row.walletId || "");
      const a = esc(row.amountNim || "");
      html += `<tr><td class="mono">${t}</td><td>${img}</td><td class="mono">${w}</td><td class="mono amt">${a}</td></tr>`;
    }
    html += "</tbody></table>";
    wrap.innerHTML = html;
  } catch (e) {
    statusEl.innerHTML = `<span class="err">Failed to load: ${esc(String(e && (e as Error).message ? (e as Error).message : e))}</span>`;
  }
}

void load();
setInterval(() => void load(), 15_000);
