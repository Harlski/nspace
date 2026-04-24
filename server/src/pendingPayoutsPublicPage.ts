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
  <title>NIM payouts — pending</title>
  <style>
    :root { font-family: system-ui, sans-serif; background: #0f1419; color: #e6edf3; }
    body { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; font-weight: 600; }
    .status { margin: 1rem 0; padding: 1rem; border-radius: 8px; background: #1a2332; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid #263041; vertical-align: middle; }
    th { color: #8b9cb3; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; word-break: break-all; }
    .amt { font-variant-numeric: tabular-nums; }
    img.ident { width: 40px; height: 40px; border-radius: 6px; display: block; }
    .err { color: #f85149; }
  </style>
</head>
<body>
  <h1>Pending NIM payouts</h1>
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
    async function load() {
      const statusEl = document.getElementById("status");
      const countLine = document.getElementById("countLine");
      const bannerEl = document.getElementById("banner");
      const wrap = document.getElementById("wrap");
      try {
        const r = await fetch("/api/nim/pending-payouts", { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        statusEl.textContent = "Last updated: " + new Date().toISOString();
        const total =
          typeof data.pendingTotal === "number"
            ? data.pendingTotal
            : (data.rows && data.rows.length) || 0;
        countLine.textContent =
          total === 1 ? "1 pending transaction" : total + " pending transactions";
        if (data.allSent) {
          bannerEl.style.display = "block";
          bannerEl.textContent = data.message || "All transactions sent :)";
          wrap.innerHTML = "";
          return;
        }
        bannerEl.style.display = "none";
        const rows = data.rows || [];
        if (!rows.length) {
          wrap.innerHTML =
            '<p class="err">Unexpected empty response (pendingTotal=' + esc(String(total)) + ").</p>";
          return;
        }
        let html = '<table><thead><tr><th>Time (UTC)</th><th>Identicon</th><th>Wallet</th><th>Amount (NIM)</th></tr></thead><tbody>';
        for (const row of rows) {
          const t = esc(row.time || "");
          const img = row.identicon
            ? "<img class='ident' src='" + esc(row.identicon) + "' alt='' width='40' height='40'/>"
            : "—";
          const w = esc(row.walletId || "");
          const a = esc(row.amountNim || "");
          html += "<tr><td class='mono'>" + t + "</td><td>" + img + "</td><td class='mono'>" + w + "</td><td class='mono amt'>" + a + "</td></tr>";
        }
        html += "</tbody></table>";
        wrap.innerHTML = html;
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
