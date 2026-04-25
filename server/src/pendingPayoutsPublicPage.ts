/**
 * Self-contained HTML for `GET /pending-payouts` (public, same host as the game API).
 * Fetches JSON from `/api/nim/pending-payouts` on the same origin.
 *
 * When the SPA is hosted separately (e.g. Vercel), use the Vite page `pending-payouts.html`
 * (`VITE_API_BASE_URL` → game API) instead; see `client/src/pendingPayoutsStandalone.ts`.
 */
export function pendingPayoutsPublicPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>NIM payouts — pending &amp; recent</title>
  <style>
    :root { font-family: system-ui, sans-serif; background: #0f1419; color: #e6edf3; }
    body { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; font-weight: 600; }
    .status { margin: 1rem 0; padding: 1rem; border-radius: 8px; background: #1a2332; }
    .status.status--queue-clear {
      text-align: center;
      font-size: 1.05rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      color: #c9d1d9;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid #263041; vertical-align: middle; }
    th { color: #8b9cb3; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; word-break: break-all; }
    .amt { font-variant-numeric: tabular-nums; }
    img.ident { width: 40px; height: 40px; border-radius: 6px; display: block; flex-shrink: 0; }
    .wallet-cell-inner { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .wallet-cell { min-width: 6rem; }
    .wallet-cell-inner span[title] { cursor: help; }
    a.expl { color: #79b8ff; text-decoration: none; }
    a.expl:hover { text-decoration: underline; }
    .err { color: #f85149; }
  </style>
</head>
<body>
  <h1>NIM payouts</h1>
  <p class="mono" id="status">Loading…</p>
  <p class="mono" id="countLine" style="margin-top:0.35rem;color:#8b9cb3"></p>
  <div id="banner" class="status" style="display:none"></div>
  <div id="wrap"></div>
  <script>
    function esc(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function fmtUtcShort(iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (isNaN(d.getTime())) return esc(String(iso));
      var y = d.getUTCFullYear();
      var m = String(d.getUTCMonth() + 1).padStart(2, "0");
      var day = String(d.getUTCDate()).padStart(2, "0");
      var h = String(d.getUTCHours()).padStart(2, "0");
      var min = String(d.getUTCMinutes()).padStart(2, "0");
      return y + "-" + m + "-" + day + " " + h + ":" + min;
    }
    function nimTxHexForUrl(txHash) {
      var h = String(txHash || "").trim().toLowerCase();
      return /^[0-9a-f]{64}$/.test(h) ? h : "";
    }
    function explorerCell(txHash) {
      var hex = nimTxHexForUrl(txHash);
      if (!hex) return esc(String(txHash || "—"));
      return (
        "<a class='expl' rel='noopener noreferrer' target='_blank' href='https://nimiq.watch/#" +
        hex +
        "'>Watch</a> · <a class='expl' rel='noopener noreferrer' target='_blank' href='https://www.nimiqhub.com/tx/" +
        hex +
        "'>Hub</a>"
      );
    }
    function walletIdShort(walletId) {
      var c = String(walletId || "")
        .replace(/\s+/g, "")
        .toUpperCase();
      if (c.length <= 8) return c;
      return c.slice(0, 4) + c.slice(-4);
    }
    function walletCell(identicon, walletId) {
      var full = String(walletId || "");
      var img = identicon
        ? "<img class='ident' src='" + esc(identicon) + "' alt='' width='40' height='40'/>"
        : "";
      var short = esc(walletIdShort(full));
      var titleAttr = full ? " title='" + esc(full) + "'" : "";
      return (
        "<td class='mono wallet-cell'><span class='wallet-cell-inner'>" +
        img +
        "<span" +
        titleAttr +
        ">" +
        short +
        "</span></span></td>"
      );
    }
    function tablePending(rows) {
      let html =
        "<h2 style='font-size:1rem;margin:1.25rem 0 0.5rem;color:#8b9cb3'>Pending</h2>" +
        "<table><thead><tr><th>Time (UTC)</th><th>Wallet</th><th>Amount (NIM)</th></tr></thead><tbody>";
      for (const row of rows) {
        const t = esc(fmtUtcShort(row.time || ""));
        const a = esc(row.amountNim || "");
        html += "<tr><td class='mono'>" + t + "</td>" + walletCell(row.identicon, row.walletId) + "<td class='mono amt'>" + a + "</td></tr>";
      }
      return html + "</tbody></table>";
    }
    function tableHistory(rows) {
      let html =
        "<h2 style='font-size:1rem;margin:1.25rem 0 0.5rem;color:#8b9cb3'>Completed Transactions</h2>" +
        "<table><thead><tr><th>Sent (UTC)</th><th>Wallet</th><th>Amount (NIM)</th><th>Explorer</th></tr></thead><tbody>";
      for (const row of rows) {
        const t = esc(fmtUtcShort(row.time || ""));
        const a = esc(row.amountNim || "");
        html +=
          "<tr><td class='mono'>" +
          t +
          "</td>" +
          walletCell(row.identicon, row.walletId) +
          "<td class='mono amt'>" +
          a +
          "</td><td class='mono'>" +
          explorerCell(row.txHash || "") +
          "</td></tr>";
      }
      return html + "</tbody></table>";
    }
    async function load() {
      const statusEl = document.getElementById("status");
      const countLine = document.getElementById("countLine");
      const bannerEl = document.getElementById("banner");
      const wrap = document.getElementById("wrap");
      try {
        const r = await fetch("/api/nim/pending-payouts", { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        statusEl.textContent = "Last updated (UTC): " + fmtUtcShort(new Date().toISOString());
        const total =
          typeof data.pendingTotal === "number"
            ? data.pendingTotal
            : (data.rows && data.rows.length) || 0;
        const hist = (data.historyRows && data.historyRows.length) || 0;
        let countText =
          total === 1 ? "1 pending transaction" : total + " pending transactions";
        if (hist) countText += " · " + hist + " in Completed Transactions";
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
            wrap.innerHTML =
              '<p class="err">Unexpected empty response (pendingTotal=' + esc(String(total)) + ").</p>";
        } else {
          wrap.innerHTML = body;
        }
      } catch (e) {
        statusEl.innerHTML =
          '<span class="err">Failed to load: ' + esc(String((e && e.message) || e)) + "</span>";
      }
    }
    load();
    setInterval(load, 15_000);
  </script>
</body>
</html>`;
}
