import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/system` (data loaded via `GET /api/admin/system/snapshot`). */
export function adminSystemPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>System — Admin — Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84rem; }
    .sys-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.55rem; margin: 0.75rem 0 1rem; }
    .sys-card {
      background: #0f1622;
      border: 1px solid #263348;
      border-radius: 8px;
      padding: 0.55rem 0.65rem;
    }
    .sys-card label { display: block; font-size: 0.68rem; color: #6b7d95; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem; }
    .sys-card .val { font-size: 1.05rem; font-weight: 600; color: #e6edf3; font-variant-numeric: tabular-nums; }
    .sys-section { margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid #283244; }
    .sys-section h2 { margin: 0 0 0.45rem; font-size: 0.95rem; color: #c8d4e4; font-weight: 600; }
    .sys-hint { font-size: 0.76rem; color: #6b7d95; margin: 0 0 0.5rem; max-width: 52rem; line-height: 1.45; }
    .chart-block { display: flex; align-items: flex-start; gap: 0.35rem; margin-bottom: 0.5rem; }
    .chart-axis {
      display: flex; flex-direction: column; justify-content: space-between;
      align-items: flex-end; flex-shrink: 0; min-width: 2.8rem; max-width: 4rem;
      height: 140px; padding: 0.05rem 0.15rem 0.15rem 0; box-sizing: border-box;
      font-size: 0.64rem; line-height: 1.1; color: #6b7d95; font-variant-numeric: tabular-nums;
    }
    .chart-axis span { display: block; text-align: right; }
    .chart-cols {
      display: grid; gap: 2px; align-items: end; height: 140px; flex: 1; min-width: 0;
      margin-bottom: 0.15rem;
    }
    .chart-cols .col {
      height: 100%; background: #202a3a; border-radius: 3px 3px 0 0; position: relative; min-width: 0;
    }
    .chart-cols .col .in {
      position: absolute; left: 0; right: 0; bottom: 0;
      background: linear-gradient(180deg, #5aa0ff, #7dd3fc); border-radius: 3px 3px 0 0; min-height: 2px;
    }
    .chart-cols.chart-cols--mem .col .in {
      background: linear-gradient(180deg, #a78bfa, #c4b5fd);
    }
    .sys-log-wrap {
      max-height: min(50vh, 420px); overflow: auto; border: 1px solid #263348; border-radius: 6px;
      background: #0a0f18; padding: 0.4rem 0.5rem;
    }
    .sys-log-line { font-size: 0.78rem; line-height: 1.45; color: #b8c5d9; border-bottom: 1px solid #1c2636; padding: 0.22rem 0; word-break: break-word; }
    .sys-log-line:last-child { border-bottom: 0; }
    .sys-log-line time { color: #5a6d88; margin-right: 0.45rem; font-variant-numeric: tabular-nums; }
    .sys-log-line.sys-log--warn { color: #fcd34d; }
    .sys-log-line.sys-log--error { color: #f87171; }
    .err { color: #f87171; }
    .sys-actions { margin: 0.5rem 0 0.75rem; display: flex; gap: 0.45rem; flex-wrap: wrap; align-items: center; }
    .sys-actions button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.35rem 0.65rem; cursor: pointer; font: inherit; font-size: 0.82rem;
    }
    .sys-actions label { font-size: 0.78rem; color: #8b9cb3; display: inline-flex; align-items: center; gap: 0.35rem; }
    #panel.sys-panel { max-width: 56rem; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("system")}
  <h1 class="ms-doc-title">System</h1>
  <div id="panel" class="ms-panel mono sys-panel">Loading…</div>
  <script>
    var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
    function readAuthToken() {
      if (typeof window.__nsHydrateMainSiteAuth === "function") {
        window.__nsHydrateMainSiteAuth();
      }
      for (var i = 0; i < AUTH_KEYS.length; i++) {
        var t = sessionStorage.getItem(AUTH_KEYS[i]);
        if (t) return t;
      }
      return "";
    }
    function esc(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    }
    function num(v, d) {
      var n = Number(v);
      if (!Number.isFinite(n)) return "—";
      return n.toFixed(d);
    }
    function utcTime(t) {
      try {
        return new Date(t).toISOString().slice(11, 19) + "Z";
      } catch {
        return "—";
      }
    }
    function barChartHtml(points, key, colorClass) {
      if (!points || !points.length) {
        return "<p class='sys-hint'>No samples yet — charts fill every 5s while this page is open.</p>";
      }
      var vals = points.map(function (p) { return Number(p[key]) || 0; });
      var vmax = Math.max.apply(null, vals.concat([1]));
      var hi = vmax;
      var lo = 0;
      var cols = points
        .map(function (p) {
          var v = Number(p[key]) || 0;
          var pct = Math.max(2, Math.round((v / hi) * 100));
          return "<div class='col'><div class='in' style='height:" + pct + "%'></div></div>";
        })
        .join("");
      var axis =
        "<div class='chart-axis'><span>" +
        num(hi, 1) +
        "</span><span>" +
        num((hi + lo) / 2, 1) +
        "</span><span>0</span></div>";
      var colClass = "chart-cols" + (colorClass ? " " + colorClass : "");
      return (
        "<div class='chart-block'>" +
        axis +
        "<div class='" +
        esc(colClass) +
        "' style='grid-template-columns:repeat(" +
        points.length +
        ",1fr)'>" +
        cols +
        "</div></div>"
      );
    }
    function renderLog(logs) {
      if (!logs || !logs.length) {
        return "<p class='sys-hint'>No diagnostic lines yet (enable <code class='mono'>WS_METRICS_INTERVAL_MS</code> for WebSocket summaries).</p>";
      }
      return (
        "<div class='sys-log-wrap'>" +
        logs
          .slice()
          .reverse()
          .map(function (row) {
            var lv = String(row.level || "info");
            var cls = lv === "warn" ? " sys-log--warn" : lv === "error" ? " sys-log--error" : "";
            return (
              "<div class='sys-log-line" +
              cls +
              "'><time>" +
              esc(utcTime(row.t)) +
              "</time><span class='mono'>" +
              esc(lv) +
              "</span> — " +
              esc(String(row.msg || "")) +
              "</div>"
            );
          })
          .join("") +
        "</div>"
      );
    }
    var pollTimer = null;
    function setPolling(on) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (on) pollTimer = setInterval(load, 10000);
    }
    async function load() {
      var panel = document.getElementById("panel");
      if (!panel) return;
      var token = readAuthToken();
      if (!token) {
        setPolling(false);
        panel.innerHTML =
          "<p class='err'>Not signed in.</p><p class='sys-hint'>Open <a href='/admin'>Admin</a>, sign in with your wallet, then return here.</p>";
        return;
      }
      try {
        var r = await fetch("/api/admin/system/snapshot", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (r.status === 403) {
          setPolling(false);
          panel.innerHTML =
            "<p class='err'>Forbidden</p><p class='sys-hint'>This page is only available to server admin wallets (<code class='mono'>ADMIN_ADDRESSES</code> in server config).</p>";
          return;
        }
        if (!r.ok) {
          setPolling(false);
          panel.innerHTML = "<p class='err'>Failed to load (" + r.status + ").</p>";
          return;
        }
        var j = await r.json();
        setPolling(true);
        var p = j.process || {};
        var uptimeStr = "—";
        if (j.uptimeSec != null && Number.isFinite(Number(j.uptimeSec))) {
          var sec = Math.floor(Number(j.uptimeSec));
          uptimeStr = Math.floor(sec / 60) + "m " + (sec % 60) + "s";
        }
        panel.innerHTML =
          "<div class='sys-actions'>" +
          "<button type='button' id='sys-refresh'>Refresh now</button>" +
          "<label><input type='checkbox' id='sys-poll' checked/> Auto-refresh every 10s</label></div>" +
          "<div class='sys-grid'>" +
          "<div class='sys-card'><label>Uptime</label><div class='val'>" +
          esc(uptimeStr) +
          "</div></div>" +
          "<div class='sys-card'><label>RSS</label><div class='val'>" +
          num(p.rssMiB, 1) +
          " MiB</div></div>" +
          "<div class='sys-card'><label>Heap used</label><div class='val'>" +
          num(p.heapUsedMiB, 1) +
          " MiB</div></div>" +
          "<div class='sys-card'><label>Node</label><div class='val' style='font-size:0.82rem'>" +
          esc(String(p.node || "—")) +
          "</div></div>" +
          "<div class='sys-card'><label>PID</label><div class='val'>" +
          esc(String(p.pid != null ? p.pid : "—")) +
          "</div></div>" +
          "</div>" +
          "<div class='sys-section'><h2>Event loop delay (max per " +
          esc(String((j.sampling && j.sampling.intervalMs) || 5000)) +
          " ms sample)</h2>" +
          "<p class='sys-hint'>Higher bars mean the Node thread was busy (GC, sync work, large JSON). Correlates with occasional client ping spikes.</p>" +
          barChartHtml(j.lagSeries, "maxMs", "") +
          "</div>" +
          "<div class='sys-section'><h2>Resident set (RSS), MiB</h2>" +
          "<p class='sys-hint'>Memory trend from the same sampling interval.</p>" +
          barChartHtml(j.memSeries, "rssMiB", "chart-cols--mem") +
          "</div>" +
          "<div class='sys-section'><h2>Diagnostic log (recent)</h2>" +
          "<p class='sys-hint'>Structured lines captured in-process (not full OS logs). Enable <code class='mono'>WS_METRICS_INTERVAL_MS=10000</code> on the server for WebSocket volume summaries.</p>" +
          renderLog(j.logs) +
          "</div>";
        var btn = document.getElementById("sys-refresh");
        if (btn) btn.addEventListener("click", load);
        var pollCb = document.getElementById("sys-poll");
        if (pollCb) {
          pollCb.addEventListener("change", function () {
            setPolling(pollCb.checked);
          });
        }
      } catch (e) {
        setPolling(false);
        panel.innerHTML = "<p class='err'>Network error</p>";
      }
    }
    load();
  </script>
</body>
</html>`;
}
