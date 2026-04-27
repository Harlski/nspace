import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteShellCss } from "./mainSiteShell.js";

export function analyticsPublicPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Game analytics</title>
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    :root { background: var(--ms-bg, #0f1419); color: var(--ms-text, #e6edf3); }
    body.ms-site { margin-top: 0; margin-bottom: 0; padding-left: 1rem; padding-right: 1rem; }
    ${analyticsTopbarCss()}
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1rem; }
    .panel { background: #161d2a; border: 1px solid #283244; border-radius: 10px; padding: 0.8rem; }
    .panel h2 { margin: 0 0 0.5rem 0; font-size: 1rem; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82rem; }
    .row { display: grid; grid-template-columns: 2.2rem 1fr auto; gap: 0.6rem; align-items: center; margin: 0.2rem 0; }
    .barWrap { height: 0.8rem; background: #202a3a; border-radius: 999px; overflow: hidden; }
    .bar { height: 100%; background: linear-gradient(90deg, #5aa0ff, #7dd3fc); }
    .bar.bar--logout { background: linear-gradient(90deg, #a855f7, #f472b6); }
    table { width: 100%; border-collapse: collapse; margin-top: 0.2rem; font-size: 0.86rem; }
    th, td { text-align: left; padding: 0.42rem 0.3rem; border-bottom: 1px solid #263041; }
    th { color: #8b9cb3; font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .right { text-align: right; }
    .status { margin: 0.6rem 0 1rem 0; color: #9fb0c7; }
    .err { color: #f87171; }
    .chart-block { display: flex; align-items: flex-start; gap: 0.3rem; margin-bottom: 0.35rem; }
    .chart-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .chart-axis { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; flex-shrink: 0; width: auto; min-width: 2.6rem; max-width: 4.2rem; height: 160px; padding: 0.05rem 0.15rem 0.15rem 0; box-sizing: border-box; font-size: 0.64rem; line-height: 1.1; color: #6b7d95; font-variant-numeric: tabular-nums; }
    .chart-axis span { display: block; text-align: right; }
    .chart-cols { display: grid; grid-template-columns: repeat(24, minmax(10px, 1fr)); gap: 0.25rem; align-items: end; height: 160px; margin-bottom: 0.4rem; }
    .col { height: 100%; background: #202a3a; border-radius: 4px 4px 0 0; position: relative; cursor: pointer; }
    .col .in { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #5aa0ff, #7dd3fc); border-radius: 4px 4px 0 0; transition: height 260ms ease; }
    .col .out { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #a855f7, #f472b6); opacity: 0.92; border-radius: 4px 4px 0 0; transition: height 260ms ease; }
    .col .col-bar { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; display: flex; flex-direction: column-reverse; align-items: stretch; border-radius: 4px 4px 0 0; overflow: hidden; background: #202a3a; transition: height 260ms ease; }
    .col .stack-seg { width: 100%; flex-shrink: 0; box-sizing: border-box; border-top: 1px solid rgba(15, 20, 25, 0.4); transition: height 260ms ease; }
    .daily-chart-wrap { margin-bottom: 0.75rem; }
    .daily-chart-wrap svg { display: block; width: 100%; max-width: 100%; height: auto; }
    .daily-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 0.65rem; margin-top: 0.4rem; font-size: 0.72rem; color: #91a2b9; }
    .daily-leg-item { display: inline-flex; align-items: center; gap: 0.28rem; }
    .daily-leg-swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .time-filter-panel { margin-bottom: 0.85rem; padding: 0.55rem 0.65rem; background: transparent; border: none; border-bottom: 1px solid #283244; border-radius: 0; }
    .time-filter-panel h2 { font-size: 0.88rem; font-weight: 600; margin: 0 0 0.45rem 0; letter-spacing: 0.02em; color: #c8d4e4; }
    .tf-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin-bottom: 0.35rem; }
    .tf-utc { font-size: 0.68rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7d95; border: 1px solid #2f3d52; padding: 0.12rem 0.35rem; border-radius: 4px; }
    .time-view-tabs { display: inline-flex; gap: 0; border-radius: 6px; border: 1px solid #2c3b52; overflow: hidden; }
    .time-tab { background: transparent; color: #9fb0c7; border: none; border-right: 1px solid #2c3b52; padding: 0.28rem 0.65rem; cursor: pointer; font: inherit; font-size: 0.78rem; margin: 0; }
    .time-tab:last-child { border-right: none; }
    .time-tab.sel { background: rgba(90, 160, 255, 0.12); color: #e8f0fc; }
    .time-nav-row { display: flex; align-items: center; justify-content: center; gap: 0.35rem; margin: 0.2rem 0 0.4rem; min-height: 2rem; }
    .time-nav-btn { min-width: 2rem; padding: 0.22rem 0.4rem; background: transparent; color: #9fb0c7; border: none; border-radius: 4px; cursor: pointer; font: inherit; font-size: 1.05rem; line-height: 1; }
    .time-nav-btn:hover:not(:disabled) { color: #e6edf3; background: rgba(255,255,255,0.04); }
    .time-nav-btn:disabled { opacity: 0.28; cursor: not-allowed; }
    .time-nav-label-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 8rem; max-width: min(100%, 18rem); flex: 1; min-height: 2.1rem; cursor: pointer; border-radius: 4px; }
    .time-nav-label-wrap:focus { outline: 1px solid #5aa0ff; outline-offset: 2px; }
    .time-nav-file { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; opacity: 0; pointer-events: none; }
    .time-nav-label { text-align: center; font-size: 0.84rem; color: #dce4ee; padding: 0.28rem 0.5rem; border-radius: 4px; border-bottom: 1px solid #3d5169; display: block; width: 100%; }
    .time-nav-label-wrap:hover .time-nav-label { border-bottom-color: #5aa0ff; color: #fff; }
    .time-nav-muted { font-size: 0.88rem; color: #9fb0c7; text-align: center; padding: 0.35rem 0.5rem; }
    .tf-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.45rem; margin-top: 0.15rem; padding-top: 0.35rem; border-top: 1px solid rgba(40, 50, 68, 0.65); }
    .tf-tools select { background: #131b27; color: #cfd8e3; border: 1px solid #2c3b52; border-radius: 4px; padding: 0.22rem 0.35rem; font: inherit; font-size: 0.76rem; }
    .tf-tools-gap { flex: 1; min-width: 0.25rem; }
    .tf-preset { font-size: 0.72rem; padding: 0.18rem 0.42rem; background: transparent; border: 1px solid transparent; color: #8b9cb3; border-radius: 4px; cursor: pointer; font: inherit; }
    .tf-preset:hover { color: #dce4ee; border-color: #324258; background: rgba(255,255,255,0.03); }
    .ticks { display: grid; grid-template-columns: repeat(12, 1fr); gap: 0.3rem; color: #8092aa; font-size: 0.72rem; }
    .ticks.ticks--days { gap: 0.08rem; align-items: end; min-height: 2.85rem; padding-top: 0.2rem; font-size: 0.62rem; }
    .ticks.ticks--days .tick-day { display: flex; justify-content: center; align-items: flex-end; min-width: 0; writing-mode: vertical-lr; text-orientation: upright; font-variant-numeric: tabular-nums; color: #8092aa; }
    .hover-card { margin-top: 0.55rem; border: 1px solid #2a394f; border-radius: 8px; background: #131b27; padding: 0.5rem; min-height: 78px; height: 210px; overflow-y: auto; }
    .user-row { display: grid; grid-template-columns: 24px 1fr auto; gap: 0.45rem; align-items: center; margin-bottom: 0.28rem; }
    .ident { width: 24px; height: 24px; border-radius: 4px; }
    .users-list { max-height: 280px; overflow: auto; }
    .wallet-chip { display: inline-flex; align-items: center; cursor: pointer; }
    .wallet-chip .ident { width: 22px; height: 22px; border-radius: 4px; }
    .hintline { color: #91a2b9; font-size: 0.78rem; margin-top: 0.4rem; }
    .sel-row { background: rgba(90, 160, 255, 0.08); }
    .clickable-nim { cursor: pointer; text-decoration: underline; text-decoration-style: dotted; }
    .focus-user { margin: -0.5rem 0 0.8rem 0; font-size: 0.82rem; color: #9fb0c7; display: flex; align-items: center; gap: 0.45rem; }
    .focus-user button { background: #202a3a; color: #cfd8e3; border: 1px solid #324258; border-radius: 5px; padding: 0.12rem 0.4rem; cursor: pointer; }
    .auth-gate { margin: 0.6rem 0 1rem 0; padding: 0.8rem; border-radius: 8px; border: 1px solid #2a394f; background: #131b27; }
    @media (max-width: 720px) {
      body.ms-site { padding-left: 0.7rem; padding-right: 0.7rem; margin-top: 1.1rem; margin-bottom: 1.1rem; }
      .grid { grid-template-columns: 1fr; gap: 0.8rem; }
      .panel { padding: 0.7rem; }
    }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("analytics")}
  <p id="status" class="status mono">Loading...</p>
  <div id="authGate" class="auth-gate mono" style="display:none"></div>
  <div id="focusUser" class="focus-user"></div>
  <section id="timeFilterPanel" class="time-filter-panel" style="display:none" title="Pick a UTC day or month, or a rolling window without a fixed date.">
    <h2>Time range</h2>
    <div class="tf-head mono">
      <span class="tf-utc" aria-hidden="true">UTC</span>
      <div class="time-view-tabs" role="tablist" aria-label="Calendar mode">
        <button type="button" id="tfTabDaily" class="time-tab sel" role="tab">Day</button>
        <button type="button" id="tfTabMonth" class="time-tab" role="tab">Month</button>
      </div>
    </div>
    <div id="tfDailyNav" class="time-nav-row mono">
      <button type="button" id="tfDayPrev" class="time-nav-btn" aria-label="Previous day">&lt;</button>
      <div class="time-nav-label-wrap" id="tfDayPickWrap" style="flex:1;max-width:20rem;min-width:0" role="button" tabindex="0" aria-label="Pick UTC day">
        <span id="tfDayDisplay" class="time-nav-label"></span>
        <input type="date" id="tfDayPicker" class="time-nav-file" aria-hidden="true" tabindex="-1"/>
      </div>
      <button type="button" id="tfDayNext" class="time-nav-btn" aria-label="Next day">&gt;</button>
    </div>
    <div id="tfMonthNav" class="time-nav-row mono" style="display:none">
      <button type="button" id="tfMonthPrev" class="time-nav-btn" aria-label="Previous month">&lt;</button>
      <div class="time-nav-label-wrap" id="tfMonthPickWrap" style="flex:1;max-width:16rem" role="button" tabindex="0" aria-label="Pick UTC month">
        <span id="tfMonthDisplay" class="time-nav-label"></span>
        <input type="month" id="tfMonthPicker" class="time-nav-file" aria-hidden="true" tabindex="-1"/>
      </div>
      <button type="button" id="tfMonthNext" class="time-nav-btn" aria-label="Next month">&gt;</button>
    </div>
    <div class="tf-tools mono">
      <select id="tfDays" aria-label="Rolling log window in days"></select>
      <span class="tf-tools-gap" aria-hidden="true"></span>
      <button type="button" class="tf-preset" data-tfp="7d" title="Rolling 7 days">7d</button>
      <button type="button" class="tf-preset" data-tfp="14d" title="Rolling 14 days">14d</button>
      <button type="button" class="tf-preset" data-tfp="30d" title="Rolling 30 days">30d</button>
      <button type="button" class="tf-preset" data-tfp="today" title="This UTC day">Today</button>
      <button type="button" class="tf-preset" data-tfp="yesterday" title="Previous UTC day">Yesterday</button>
    </div>
  </section>
  <div id="analyticsGrid" class="grid" style="display:none">
    <section class="panel">
      <h2>Login / Logout by UTC hour</h2>
      <div id="logins"></div>
      <div id="loginHover" class="hover-card mono">Hover a bar to see unique-user breakdown.</div>
    </section>
    <section class="panel">
      <h2>NIM paid out by UTC hour</h2>
      <div id="payoutHours"></div>
      <div id="payoutHover" class="hover-card mono">Hover a bar to see users and amounts.</div>
      <div id="payoutHourUsers" class="mono" style="margin-top:0.6rem"></div>
    </section>
    <section class="panel">
      <h2>Unique visitors</h2>
      <div id="visitorsChart"></div>
      <div id="visitorsHover" class="hover-card mono">Hover a bar: each color is a user; bar height is total login/logout events that hour.</div>
      <div id="visitorsPinned" class="mono users-list" style="margin-top:0.6rem"></div>
    </section>
    <section class="panel">
      <h2>Recent NIM payouts sent</h2>
      <div id="payoutsRecentChart"></div>
      <div id="payoutsRecentHover" class="hover-card mono">Hover a bar: stacked colors are NIM per user; bar height is total NIM that hour.</div>
      <div id="payoutsRecentPinned" class="mono" style="margin-top:0.6rem"></div>
    </section>
    <section class="panel">
      <h2>Daily totals</h2>
      <div id="dailyChart" class="daily-chart-wrap mono"></div>
      <div id="daily" class="mono"></div>
      <p class="hintline">Oldest day left · each line scaled to its own max.</p>
    </section>
    <section class="panel">
      <h2>Recent sessions</h2>
      <div id="sessionsHourChart"></div>
      <div id="sessionsHourHover" class="hover-card mono">Hover a bar to inspect total session duration for that hour.</div>
      <div id="sessionsHourPinned" class="mono" style="margin-top:0.6rem"></div>
    </section>
  </div>
  <script>
    function esc(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function fmtUtc(ts) {
      if (!Number.isFinite(ts)) return "—";
      var d = new Date(ts);
      var y = d.getUTCFullYear();
      var m = String(d.getUTCMonth() + 1).padStart(2, "0");
      var day = String(d.getUTCDate()).padStart(2, "0");
      var h = String(d.getUTCHours()).padStart(2, "0");
      var min = String(d.getUTCMinutes()).padStart(2, "0");
      return y + "-" + m + "-" + day + " " + h + ":" + min + " UTC";
    }
    function fmtMdHm(ts) {
      if (!Number.isFinite(ts)) return "—";
      var d = new Date(ts);
      var m = String(d.getUTCMonth() + 1).padStart(2, "0");
      var day = String(d.getUTCDate()).padStart(2, "0");
      var h = String(d.getUTCHours()).padStart(2, "0");
      var min = String(d.getUTCMinutes()).padStart(2, "0");
      return m + "-" + day + " " + h + ":" + min;
    }
    function fmtMs(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return "—";
      var s = Math.floor(ms / 1000);
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      return h + "h " + m + "m";
    }
    function formatNimAxisValue(n) {
      if (!Number.isFinite(n) || n < 0) return "0";
      var v = Number(n);
      if (v >= 10000) return Math.round(v).toLocaleString("en-US");
      if (v >= 1000) return Math.round(v).toLocaleString("en-US");
      if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
      return String(Number(v.toFixed(4)));
    }
    function fmtMsAxis(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return "0";
      var s = Math.round(ms / 1000);
      if (s < 120) return s + "s";
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      return h > 0 ? h + "h" + (m ? " " + m + "m" : "") : m + "m";
    }
    function chartAxisTicks(maxVal, formatTick) {
      var maxN = Math.max(1, Number(maxVal) || 1);
      var mid = maxN / 2;
      return (
        "<div class='chart-axis mono' aria-hidden='true'>" +
        "<span>" +
        esc(formatTick(maxN)) +
        "</span><span>" +
        esc(formatTick(mid)) +
        "</span><span>0</span></div>"
      );
    }
    /** Month view: one label per UTC day column, DD only, upright vertical digits. */
    function dayTicksHtml(rows) {
      var n = Math.max(1, (rows && rows.length) || 1);
      var style = "grid-template-columns:repeat(" + n + ",minmax(0,1fr))";
      var inner = (rows || [])
        .map(function (r) {
          var d = r.dayUtc ? String(r.dayUtc).slice(8) : "";
          return "<span class='tick-day' title='" + esc(r.dayUtc || "") + " UTC'>" + esc(d) + "</span>";
        })
        .join("");
      return "<div class='ticks ticks--days mono' style='" + style + "'>" + inner + "</div>";
    }
    function hourTicksHtml() {
      return (
        "<div class='ticks'>" +
        ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"]
          .map(function (t) {
            return "<span>" + t + "</span>";
          })
          .join("") +
        "</div>"
      );
    }
    function utcDayKeyFromTs(ts) {
      if (!Number.isFinite(ts)) return "";
      var d = new Date(ts);
      return (
        d.getUTCFullYear() +
        "-" +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getUTCDate()).padStart(2, "0")
      );
    }
    function walletShort(walletId) {
      var compact = String(walletId || "").replace(/\s+/g, "").toUpperCase();
      if (compact.length <= 8) return compact;
      return compact.slice(0, 4) + compact.slice(-4);
    }
    function copyWallet(walletId) {
      var full = String(walletId || "");
      if (!full) return;
      navigator.clipboard.writeText(full).then(function () {
        var st = document.getElementById("status");
        if (st) st.textContent = "Copied wallet: " + walletShort(full);
      }).catch(function () {});
    }
    function walletChip(identicon, walletId) {
      var abbr = walletShort(walletId);
      return "<span class='wallet-chip' title='" + esc(abbr) + "' data-wallet='" + esc(walletId) + "'><img class='ident' src='" + esc(identicon || "") + "' alt='wallet'/></span>";
    }
    function attachCopyHandlers(root) {
      if (!root) return;
      root.querySelectorAll("[data-wallet]").forEach(function (el) {
        if (el.dataset.walletBound === "1") return;
        el.dataset.walletBound = "1";
        el.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          copyWallet(el.getAttribute("data-wallet") || "");
        });
        el.addEventListener("dblclick", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var wallet = el.getAttribute("data-wallet") || "";
          if (typeof window.__analyticsFocusWallet === "function") {
            window.__analyticsFocusWallet(wallet);
          }
        });
      });
    }
    var USER_STACK_COLORS = ["#5aa0ff", "#a855f7", "#34d399", "#fbbf24", "#f472b6", "#38bdf8", "#fb923c", "#c084fc", "#4ade80", "#f87171"];
    function tweenChartBars(root) {
      if (!root) return;
      requestAnimationFrame(function () {
        root.querySelectorAll(".in, .out, .stack-seg, .col-bar").forEach(function (el) {
          var target = el.getAttribute("data-target");
          if (!target) return;
          el.style.height = target;
        });
      });
    }
    function toB64(u8) {
      var s = "";
      for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      return btoa(s);
    }
    var signingDotsTimer = null;
    function walletSigningMarkup() {
      return (
        "<div class='ms-wallet-signing ms-wallet-signing--column' role='status' aria-live='polite'>" +
        "<span class='ms-spinner' aria-hidden='true'></span>" +
        "<p class='ms-signing-in-line'>" +
        "<span class='ms-signing-static'>Signing in</span>" +
        "<span class='ms-signing-dots-live' aria-hidden='true'>.</span>" +
        "</p>" +
        "<span class='ms-sr-only'>Signing in</span>" +
        "</div>"
      );
    }
    function stopSigningDots() {
      if (signingDotsTimer) {
        clearInterval(signingDotsTimer);
        signingDotsTimer = null;
      }
    }
    function startSigningDotsIn(root) {
      stopSigningDots();
      var el = root.querySelector(".ms-signing-dots-live");
      if (!el) return;
      var states = [".", "..", "...", "."];
      var i = 0;
      el.textContent = states[0];
      signingDotsTimer = setInterval(function () {
        i = (i + 1) % states.length;
        el.textContent = states[i];
      }, 400);
    }
    function isSigningUserCancelledError(e) {
      var m = String((e && e.message) || e || "").toLowerCase();
      return (
        m.indexOf("connection was closed") !== -1 ||
        m.indexOf("user closed") !== -1 ||
        m.indexOf("user denied") !== -1 ||
        m.indexOf("rejected") !== -1 ||
        m.indexOf("aborted") !== -1 ||
        m.indexOf("cancelled") !== -1 ||
        m.indexOf("canceled") !== -1
      );
    }
    async function load() {
      var AUTH_KEY = "nspace_analytics_auth_token";
      var AUTH_PENDING = "nspace_pending_payouts_token";
      var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
      function readSiteToken() {
        if (typeof window.__nsHydrateMainSiteAuth === "function") {
          window.__nsHydrateMainSiteAuth();
        }
        return sessionStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_PENDING) || "";
      }
      function writeSiteToken(t) {
        sessionStorage.setItem(AUTH_KEY, t);
        sessionStorage.setItem(AUTH_PENDING, t);
        var addr = sessionStorage.getItem(AUTH_ADDR_KEY) || "";
        if (typeof window.__nsSaveMainSiteAuth === "function") {
          window.__nsSaveMainSiteAuth(t, addr);
        }
      }
      function clearSiteSession() {
        if (typeof window.__nsClearMainSiteAuth === "function") {
          window.__nsClearMainSiteAuth();
        } else {
          sessionStorage.removeItem(AUTH_KEY);
          sessionStorage.removeItem(AUTH_PENDING);
          sessionStorage.removeItem(AUTH_ADDR_KEY);
        }
      }
      function beaconAnalyticsPageView() {
        var tok = readSiteToken();
        var hdr = {};
        if (tok) hdr.authorization = "Bearer " + tok;
        fetch("/api/analytics/page-view", { method: "POST", headers: hdr, keepalive: true }).catch(
          function () {}
        );
      }
      beaconAnalyticsPageView();
      var authGateEl = document.getElementById("authGate");
      var gridEl = document.getElementById("analyticsGrid");
      var authUserEl = document.getElementById("authUser");
      function setAuthedVisible(visible) {
        if (gridEl) gridEl.style.display = visible ? "grid" : "none";
      }
      function parseJwtSub(token) {
        try {
          var p = String(token || "").split(".")[1] || "";
          if (!p) return "";
          var json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
          var obj = JSON.parse(json);
          return String(obj.sub || "");
        } catch {
          return "";
        }
      }
      async function fetchIdenticon(wallet) {
        try {
          var r = await fetch("/api/identicon/" + encodeURIComponent(wallet));
          if (!r.ok) return "";
          var j = await r.json();
          return String(j.identicon || "");
        } catch {
          return "";
        }
      }
      var authMenuDocBound = false;
      async function renderTopLoginButton() {
        if (!authUserEl) return;
        authUserEl.style.display = "block";
        authUserEl.innerHTML =
          "<span id='authTopLogin' class='auth-user-signin' role='button' tabindex='0'>Sign In</span>";
        var loginEl = document.getElementById("authTopLogin");
        if (loginEl) {
          loginEl.addEventListener("click", function () {
            void runAnalyticsLogin();
          });
          loginEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void runAnalyticsLogin();
            }
          });
        }
      }
      function walletNormTop(a) {
        return String(a || "").replace(/\s+/g, "").toUpperCase();
      }
      var MAX_MAIN_SITE_ACCOUNTS = 5;
      async function populateAuthAccountPicker(activeAddr) {
        var picker = document.getElementById("authAccountPicker");
        if (!picker || typeof window.__nsListMainSiteCachedAccounts !== "function") return;
        var rows = window.__nsListMainSiteCachedAccounts() || [];
        var activeN = walletNormTop(activeAddr);
        var html = "";
        for (var ai = 0; ai < rows.length; ai++) {
          var row = rows[ai];
          var ident = await fetchIdenticon(row.address);
          var isAct = walletNormTop(row.address) === activeN;
          var exp = row.expired;
          var img = ident
            ? "<img class='auth-user-account-ident' src='" + esc(ident) + "' alt='' width='22' height='22'/>"
            : "<span class='auth-user-account-ident auth-user-account-ident--ph' aria-hidden='true'></span>";
          var dis = exp ? " disabled" : "";
          var rowCls =
            "auth-user-account-row" +
            (exp ? " auth-user-account-row--expired" : "") +
            (isAct ? " auth-user-account-row--active" : "");
          var check = isAct ? "<span class='auth-user-account-check' aria-label='Active'>✓</span>" : "";
          html +=
            "<button type='button' class='" +
            rowCls +
            "' data-switch-account='" +
            esc(row.address) +
            "'" +
            dis +
            ">" +
            img +
            "<span class='mono'>" +
            esc(walletShort(row.address)) +
            "</span>" +
            check +
            "</button>";
        }
        if (rows.length >= MAX_MAIN_SITE_ACCOUNTS) {
          html +=
            "<p class='auth-user-account-cap mono'>Maximum " +
            MAX_MAIN_SITE_ACCOUNTS +
            " accounts saved.</p>";
        } else {
          html +=
            "<button type='button' class='auth-user-account-row auth-user-account-row--add' id='authAddAccount'>Add account</button>";
        }
        picker.innerHTML = html;
        picker.querySelectorAll("[data-switch-account]").forEach(function (b) {
          b.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var addr = String(b.getAttribute("data-switch-account") || "");
            if (!addr || walletNormTop(addr) === activeN) {
              picker.style.display = "none";
              return;
            }
            if (typeof window.__nsActivateMainSiteCachedAccount === "function") {
              window.__nsActivateMainSiteCachedAccount(addr);
            }
          });
        });
        var addBtn = document.getElementById("authAddAccount");
        if (addBtn) {
          addBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            picker.style.display = "none";
            var m = document.getElementById("authUserMenu");
            if (m) m.style.display = "none";
            void runAnalyticsLogin();
          });
        }
      }
      function bindAuthAccountSwitcher(activeAddr) {
        var toggle = document.getElementById("authChangeAccountToggle");
        var picker = document.getElementById("authAccountPicker");
        if (!toggle || !picker) return;
        toggle.addEventListener("click", function (e) {
          e.stopPropagation();
          var opening = picker.style.display !== "block";
          picker.style.display = opening ? "block" : "none";
          if (opening) void populateAuthAccountPicker(activeAddr);
        });
        void populateAuthAccountPicker(activeAddr);
      }
      async function renderAuthUser(address, canManageWallets) {
        if (!authUserEl || !address) return;
        authUserEl.style.display = "block";
        var ident = await fetchIdenticon(address);
        var tok = readSiteToken();
        var sessionExpired =
          !!tok && typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(tok);
        var alertSvg =
          "<svg class='nq-icon auth-user-session-alert' width='14' height='14' aria-hidden='true' focusable='false'><use href='/nimiq-style.icons.svg#nq-alert-circle'/></svg>";
        var identWrap = "";
        if (ident || sessionExpired) {
          identWrap =
            "<span class='auth-user-ident-wrap" +
            (ident ? "" : " auth-user-ident-wrap--solo") +
            "'>" +
            (ident ? "<img class='ident' src='" + esc(ident) + "' alt='wallet'/>" : "") +
            (sessionExpired ? alertSvg : "") +
            "</span>";
        }
        var btnTitle = sessionExpired
          ? "Session expired — sign in again (" + esc(address) + ")"
          : "Signed in as " + esc(address);
        var acctSection =
          "<div class='auth-user-menu-section'><button type='button' id='authChangeAccountToggle' class='auth-user-menu-row'>Change account</button><div id='authAccountPicker' class='auth-user-submenu' style='display:none' role='group' aria-label='Choose wallet'></div></div>";
        var menuTop =
          (sessionExpired
            ? "<button type='button' id='authRefreshSession' class='auth-user-menu-row'>Sign in again</button>"
            : "") +
          acctSection +
          "<button type='button' id='authUserLogout' class='auth-user-menu-row'>Logout</button>";
        authUserEl.innerHTML =
          "<button id='authUserBtn' class='auth-user-btn' title='" +
          btnTitle +
          "'>" +
          identWrap +
          "<span class='mono'>" +
          esc(walletShort(address)) +
          "</span>" +
          "</button>" +
          "<div id='authUserMenu' class='auth-user-menu'>" +
          menuTop +
          "</div>";
        var btn = document.getElementById("authUserBtn");
        var menu = document.getElementById("authUserMenu");
        var refreshSess = document.getElementById("authRefreshSession");
        var logout = document.getElementById("authUserLogout");
        if (refreshSess) {
          refreshSess.addEventListener("click", function () {
            if (menu) menu.style.display = "none";
            void runAnalyticsLogin();
          });
        }
        if (btn && menu) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var open = menu.style.display !== "block";
            menu.style.display = open ? "block" : "none";
            var sub = document.getElementById("authAccountPicker");
            if (!open && sub) sub.style.display = "none";
          });
          if (!authMenuDocBound) {
            document.addEventListener("click", function (ev) {
              if (ev.target && ev.target.closest && ev.target.closest("#authUser")) return;
              var m = document.getElementById("authUserMenu");
              if (m) m.style.display = "none";
              var sub2 = document.getElementById("authAccountPicker");
              if (sub2) sub2.style.display = "none";
            });
            authMenuDocBound = true;
          }
        }
        bindAuthAccountSwitcher(address);
        if (logout) {
          logout.addEventListener("click", function () {
            clearSiteSession();
            window.location.reload();
          });
        }
      }
      function showAuthGateMessage(msg, layout) {
        if (!authGateEl) return;
        authGateEl.style.display = "block";
        setAuthedVisible(false);
        var standalone = layout === "standalone";
        var extra = standalone ? " ms-auth-gate--standalone" : "";
        authGateEl.className = standalone ? "ms-panel ms-mono" : "auth-gate mono";
        authGateEl.innerHTML =
          "<div class='ms-auth-gate" + extra + "'><div class='ms-auth-gate-msg'>" + esc(msg) + "</div></div>";
      }
      async function canManageWallets(token) {
        try {
          var r = await fetch("/api/analytics/authorized-wallets", {
            headers: { authorization: "Bearer " + token },
          });
          return r.ok;
        } catch {
          return false;
        }
      }
      async function runAnalyticsLogin() {
        try {
          if (authGateEl) {
            authGateEl.style.display = "block";
            authGateEl.className = "auth-gate mono";
            authGateEl.innerHTML = walletSigningMarkup();
            startSigningDotsIn(authGateEl);
          }
          var nonceResp = await fetch("/api/auth/nonce");
          if (!nonceResp.ok) throw new Error("nonce_failed");
          var nonceJson = await nonceResp.json();
          var nonce = String(nonceJson.nonce || "");
          var HubMod = await import("https://esm.sh/@nimiq/hub-api");
          var HubApi = HubMod.default;
          var hub = new HubApi("https://hub.nimiq.com");
          var message = "Login:v1:" + nonce;
          var signed = await hub.signMessage({
            appName: "nspace analytics",
            message: message,
          });
          var verifyResp = await fetch("/api/auth/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              nonce: nonce,
              message: message,
              signer: signed.signer,
              signerPublicKey: toB64(signed.signerPublicKey),
              signature: toB64(signed.signature),
            }),
          });
          if (!verifyResp.ok) {
            var errBody = await verifyResp.json().catch(function () { return {}; });
            throw new Error(String(errBody.error || "verify_failed"));
          }
          var verified = await verifyResp.json();
          var token = String(verified.token || "");
          var address = String(verified.address || signed.signer || "");
          if (!token) throw new Error("missing_token");
          if (address) sessionStorage.setItem(AUTH_ADDR_KEY, address);
          writeSiteToken(token);
          stopSigningDots();
          window.location.reload();
        } catch (e) {
          stopSigningDots();
          if (isSigningUserCancelledError(e)) {
            showAuthGateMessage("You must be signed in.", "standalone");
          } else {
            showAuthGateMessage("Sign-in could not be completed.");
          }
        }
      }

      var token = readSiteToken();
      var params = new URLSearchParams(location.search);
      (function normalizeAnalyticsUrlParams() {
        var dirty = false;
        var hadLegacy =
          params.has("fromDay") ||
          params.has("toDay") ||
          params.has("fromHour") ||
          params.has("toHour");
        if (hadLegacy) {
          var lf = params.get("fromDay");
          var lt = params.get("toDay");
          if (lf && lt === lf && !params.get("day")) params.set("day", lf);
          ["fromDay", "toDay", "fromHour", "toHour"].forEach(function (k) {
            params.delete(k);
          });
          dirty = true;
        }
        if (params.get("view") === "month" && !params.get("month")) {
          var d = new Date();
          params.set(
            "month",
            d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0")
          );
          dirty = true;
        }
        if (dirty) {
          history.replaceState({}, "", location.pathname + "?" + params.toString());
        }
      })();
      var signedAddress = sessionStorage.getItem(AUTH_ADDR_KEY) || parseJwtSub(token);
      if (signedAddress) {
        sessionStorage.setItem(AUTH_ADDR_KEY, signedAddress);
        await renderAuthUser(signedAddress, false);
      }
      if (!token) {
        setAuthedVisible(false);
        var stNoTok = document.getElementById("status");
        if (stNoTok) {
          stNoTok.textContent = "";
          stNoTok.style.display = "none";
        }
        showAuthGateMessage("You must be signed in.", "standalone");
        await renderTopLoginButton();
        return;
      }
      var jwtExpired =
        typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(token);
      if (jwtExpired) {
        setAuthedVisible(false);
        var stExp = document.getElementById("status");
        if (stExp) {
          stExp.innerHTML = "<span class='err'>Session expired.</span>";
          stExp.style.display = "";
        }
        showAuthGateMessage("Your session has expired.", "standalone");
        if (signedAddress) await renderAuthUser(signedAddress, false);
        else await renderTopLoginButton();
        if (typeof window.__nsRefreshMainSiteNavFromSession === "function") {
          window.__nsRefreshMainSiteNavFromSession();
        }
        return;
      }
      var stTok = document.getElementById("status");
      if (stTok) stTok.style.display = "";
      var canManage = await canManageWallets(token);
      if (signedAddress) await renderAuthUser(signedAddress, canManage);

      if (!params.get("days")) params.set("days", "7");
      if (!params.get("sessions")) params.set("sessions", "300");
      if (!params.get("payouts")) params.set("payouts", "300");
      var days = Number(params.get("days"));
      var sessions = Number(params.get("sessions"));
      var payouts = Number(params.get("payouts"));
      (function setupTimeFilterUi() {
        var panel = document.getElementById("timeFilterPanel");
        if (panel) panel.style.display = "block";

        function utcYmd(d) {
          return (
            d.getUTCFullYear() +
            "-" +
            String(d.getUTCMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getUTCDate()).padStart(2, "0")
          );
        }
        function parseYmdToUtcMs(ymd) {
          var a = String(ymd).split("-");
          if (a.length !== 3) return NaN;
          return Date.UTC(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
        }
        function addUtcDaysYmd(ymd, delta) {
          return utcYmd(new Date(parseYmdToUtcMs(ymd) + delta * 86400000));
        }
        function currentUtcYmd() {
          return utcYmd(new Date());
        }
        function currentUtcYm() {
          var d = new Date();
          return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
        }
        function addUtcMonthsYm(ym, delta) {
          var a = String(ym).split("-");
          var y = Number(a[0]);
          var m1 = Number(a[1]);
          var d = new Date(Date.UTC(y, m1 - 1 + delta, 1));
          return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
        }
        var SHORT_WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var SHORT_MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        function daysInUtcMonthYm(ym) {
          var a = String(ym).split("-");
          var y = Number(a[0]);
          var m = Number(a[1]);
          return new Date(Date.UTC(y, m, 0)).getUTCDate();
        }
        function formatShortYmd(ymd) {
          var dt = new Date(parseYmdToUtcMs(ymd));
          if (!Number.isFinite(dt.getTime())) return String(ymd);
          var wd = SHORT_WD[dt.getUTCDay()];
          var d = dt.getUTCDate();
          var mo = SHORT_MO[dt.getUTCMonth()];
          var yy = String(dt.getUTCFullYear()).slice(-2);
          return wd + " " + d + " " + mo + ", " + yy;
        }
        function formatDayNavLabel(ymd) {
          return formatShortYmd(ymd);
        }
        function formatRollingRangeLabel(nRaw) {
          var n = Math.min(30, Math.max(1, Number(nRaw) || 7));
          var end = currentUtcYmd();
          var start = addUtcDaysYmd(end, -(n - 1));
          var startDt = new Date(parseYmdToUtcMs(start));
          var endDt = new Date(parseYmdToUtcMs(end));
          var sy = startDt.getUTCFullYear();
          var ey = endDt.getUTCFullYear();
          var yyEnd = String(ey).slice(-2);
          if (startDt.getUTCMonth() === endDt.getUTCMonth() && sy === ey) {
            return startDt.getUTCDate() + "–" + endDt.getUTCDate() + " " + SHORT_MO[endDt.getUTCMonth()] + ", " + yyEnd;
          }
          if (sy === ey) {
            return (
              startDt.getUTCDate() +
              " " +
              SHORT_MO[startDt.getUTCMonth()] +
              " – " +
              endDt.getUTCDate() +
              " " +
              SHORT_MO[endDt.getUTCMonth()] +
              ", " +
              yyEnd
            );
          }
          return (
            startDt.getUTCDate() +
            " " +
            SHORT_MO[startDt.getUTCMonth()] +
            " " +
            String(sy).slice(-2) +
            " – " +
            endDt.getUTCDate() +
            " " +
            SHORT_MO[endDt.getUTCMonth()] +
            ", " +
            yyEnd
          );
        }
        function formatMonthNavLabel(ym) {
          var a = String(ym).split("-");
          var y = Number(a[0]);
          var m0 = Number(a[1]) - 1;
          var last = daysInUtcMonthYm(ym);
          var yy = String(y).slice(-2);
          return "1–" + last + " " + SHORT_MO[m0] + ", " + yy;
        }

        function buildBaseQuery() {
          var q = new URLSearchParams();
          q.set("days", daysSel ? daysSel.value : String(days));
          q.set("sessions", String(sessions));
          q.set("payouts", String(payouts));
          return q;
        }
        function assignUrl(q) {
          window.location.assign(location.pathname + "?" + q.toString());
        }

        var daysSel = document.getElementById("tfDays");
        if (daysSel && daysSel.dataset.filled !== "1") {
          daysSel.dataset.filled = "1";
          for (var d = 1; d <= 30; d++) {
            var o2 = document.createElement("option");
            o2.value = String(d);
            o2.textContent = String(d);
            daysSel.appendChild(o2);
          }
        }
        if (daysSel) daysSel.value = String(Math.min(30, Math.max(1, days)));

        var tabDaily = document.getElementById("tfTabDaily");
        var tabMonth = document.getElementById("tfTabMonth");
        var dailyNav = document.getElementById("tfDailyNav");
        var monthNav = document.getElementById("tfMonthNav");
        var tfDayPrev = document.getElementById("tfDayPrev");
        var tfDayNext = document.getElementById("tfDayNext");
        var tfDayPicker = document.getElementById("tfDayPicker");
        var tfDayDisplay = document.getElementById("tfDayDisplay");
        var tfMonthPrev = document.getElementById("tfMonthPrev");
        var tfMonthNext = document.getElementById("tfMonthNext");
        var tfMonthPicker = document.getElementById("tfMonthPicker");
        var tfMonthDisplay = document.getElementById("tfMonthDisplay");
        var tfDayPickWrap = document.getElementById("tfDayPickWrap");
        var tfMonthPickWrap = document.getElementById("tfMonthPickWrap");

        function openDayPicker() {
          if (!tfDayPicker) return;
          if (typeof tfDayPicker.showPicker === "function") {
            try {
              tfDayPicker.showPicker();
            } catch (_) {
              tfDayPicker.focus();
            }
          } else {
            tfDayPicker.focus();
          }
        }
        function openMonthPicker() {
          if (!tfMonthPicker) return;
          if (typeof tfMonthPicker.showPicker === "function") {
            try {
              tfMonthPicker.showPicker();
            } catch (_) {
              tfMonthPicker.focus();
            }
          } else {
            tfMonthPicker.focus();
          }
        }
        if (tfDayPickWrap && tfDayPickWrap.dataset.pickBound !== "1") {
          tfDayPickWrap.dataset.pickBound = "1";
          tfDayPickWrap.addEventListener("click", function () {
            openDayPicker();
          });
          tfDayPickWrap.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDayPicker();
            }
          });
        }
        if (tfMonthPickWrap && tfMonthPickWrap.dataset.pickBound !== "1") {
          tfMonthPickWrap.dataset.pickBound = "1";
          tfMonthPickWrap.addEventListener("click", function () {
            openMonthPicker();
          });
          tfMonthPickWrap.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openMonthPicker();
            }
          });
        }

        function monthModeFromParams() {
          return !!params.get("month");
        }

        function syncChromeFromParams() {
          var monthMode = monthModeFromParams();
          var dayVal = params.get("day");
          if (tabDaily) tabDaily.classList.toggle("sel", !monthMode);
          if (tabMonth) tabMonth.classList.toggle("sel", monthMode);
          if (dailyNav) dailyNav.style.display = monthMode ? "none" : "";
          if (monthNav) monthNav.style.display = monthMode ? "" : "none";
          if (!monthMode) {
            var hasDay = !!dayVal;
            if (tfDayPicker) {
              tfDayPicker.max = currentUtcYmd();
              tfDayPicker.min = addUtcDaysYmd(currentUtcYmd(), -730);
              if (hasDay) tfDayPicker.value = dayVal || "";
              else tfDayPicker.value = currentUtcYmd();
            }
            if (tfDayDisplay) {
              if (hasDay) tfDayDisplay.textContent = formatDayNavLabel(dayVal || "");
              else tfDayDisplay.textContent = formatRollingRangeLabel(daysSel ? daysSel.value : String(days));
            }
            if (tfDayPrev) tfDayPrev.disabled = !hasDay;
            if (tfDayNext) {
              if (!hasDay) {
                tfDayNext.disabled = true;
              } else {
                var nx = addUtcDaysYmd(dayVal || "", 1);
                tfDayNext.disabled = parseYmdToUtcMs(nx) > parseYmdToUtcMs(currentUtcYmd());
              }
            }
          }
          if (monthMode && tfMonthPicker) {
            var ym = params.get("month") || currentUtcYm();
            tfMonthPicker.value = ym;
            if (tfMonthDisplay) tfMonthDisplay.textContent = formatMonthNavLabel(ym);
            if (tfMonthPrev) tfMonthPrev.disabled = false;
            if (tfMonthNext) {
              var nextYm = addUtcMonthsYm(ym, 1);
              tfMonthNext.disabled = nextYm > currentUtcYm();
            }
          }
        }
        syncChromeFromParams();

        if (tabDaily) {
          tabDaily.addEventListener("click", function () {
            if (!monthModeFromParams()) return;
            var q = buildBaseQuery();
            q.set("view", "daily");
            q.delete("month");
            q.delete("day");
            assignUrl(q);
          });
        }
        if (tabMonth) {
          tabMonth.addEventListener("click", function () {
            if (monthModeFromParams()) return;
            var q = buildBaseQuery();
            q.set("view", "month");
            q.set("month", params.get("month") || currentUtcYm());
            q.delete("day");
            assignUrl(q);
          });
        }
        if (tfDayPrev) {
          tfDayPrev.addEventListener("click", function () {
            var dv = params.get("day");
            if (!dv) return;
            var q = buildBaseQuery();
            q.set("view", "daily");
            q.set("day", addUtcDaysYmd(dv, -1));
            q.delete("month");
            assignUrl(q);
          });
        }
        if (tfDayNext) {
          tfDayNext.addEventListener("click", function () {
            var dv = params.get("day");
            if (!dv) return;
            var nx = addUtcDaysYmd(dv, 1);
            if (parseYmdToUtcMs(nx) > parseYmdToUtcMs(currentUtcYmd())) return;
            var q = buildBaseQuery();
            q.set("view", "daily");
            q.set("day", nx);
            q.delete("month");
            assignUrl(q);
          });
        }
        if (tfDayPicker) {
          tfDayPicker.addEventListener("change", function () {
            if (!tfDayPicker.value) return;
            var q = buildBaseQuery();
            q.set("view", "daily");
            q.set("day", tfDayPicker.value);
            q.delete("month");
            assignUrl(q);
          });
        }
        if (tfMonthPrev) {
          tfMonthPrev.addEventListener("click", function () {
            var ym = params.get("month") || currentUtcYm();
            var q = buildBaseQuery();
            q.set("view", "month");
            q.set("month", addUtcMonthsYm(ym, -1));
            q.delete("day");
            assignUrl(q);
          });
        }
        if (tfMonthNext) {
          tfMonthNext.addEventListener("click", function () {
            var ym = params.get("month") || currentUtcYm();
            var nx = addUtcMonthsYm(ym, 1);
            if (nx > currentUtcYm()) return;
            var q = buildBaseQuery();
            q.set("view", "month");
            q.set("month", nx);
            q.delete("day");
            assignUrl(q);
          });
        }
        if (tfMonthPicker) {
          tfMonthPicker.addEventListener("change", function () {
            if (!tfMonthPicker.value) return;
            var q = buildBaseQuery();
            q.set("view", "month");
            q.set("month", tfMonthPicker.value);
            q.delete("day");
            assignUrl(q);
          });
        }
        if (daysSel) {
          daysSel.addEventListener("change", function () {
            var q = buildBaseQuery();
            var v = params.get("view");
            if (v) q.set("view", v);
            if (params.get("month")) q.set("month", params.get("month") || "");
            if (params.get("day")) q.set("day", params.get("day") || "");
            assignUrl(q);
          });
        }
        document.querySelectorAll("[data-tfp]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            if (!daysSel) return;
            var k = btn.getAttribute("data-tfp");
            var q = buildBaseQuery();
            q.set("view", "daily");
            q.delete("month");
            q.delete("day");
            if (k === "7d" || k === "14d" || k === "30d") {
              daysSel.value = k === "7d" ? "7" : k === "14d" ? "14" : "30";
              q.set("days", daysSel.value);
              assignUrl(q);
              return;
            }
            var t0 = new Date();
            if (k === "today") {
              q.set("day", utcYmd(t0));
              assignUrl(q);
              return;
            }
            if (k === "yesterday") {
              q.set("day", utcYmd(new Date(t0.getTime() - 86400000)));
              assignUrl(q);
            }
          });
        });
      })();
      var url = "/api/analytics/overview?" + params.toString();
      var resp = await fetch(url, {
        headers: { authorization: "Bearer " + token },
      });
      if (!resp.ok) {
        if (resp.status === 403) {
          var tf403 = document.getElementById("timeFilterPanel");
          if (tf403) tf403.style.display = "none";
          var fu403 = document.getElementById("focusUser");
          if (fu403) fu403.innerHTML = "";
          showAuthGateMessage("Access denied for this wallet.", "standalone");
          var st403 = document.getElementById("status");
          if (st403) st403.innerHTML = "";
          if (typeof window.__nsRefreshMainSiteNavFromSession === "function") {
            window.__nsRefreshMainSiteNavFromSession();
          }
          return;
        }
        if (resp.status === 401) {
          if (typeof window.__nsApplyMainSiteNav === "function") {
            window.__nsApplyMainSiteNav({ analyticsAuthorized: false, analyticsManager: false });
          }
          showAuthGateMessage("Your session has expired.");
          document.getElementById("status").innerHTML =
            "<span class='err'>Session expired.</span>";
          if (signedAddress) await renderAuthUser(signedAddress, false);
          else await renderTopLoginButton();
          if (typeof window.__nsRefreshMainSiteNavFromSession === "function") {
            window.__nsRefreshMainSiteNavFromSession();
          }
          return;
        }
        document.getElementById("status").innerHTML = "<span class='err'>Request failed (" + resp.status + ").</span>";
        return;
      }
      if (authGateEl) {
        authGateEl.style.display = "none";
        authGateEl.className = "auth-gate mono";
      }
      setAuthedVisible(true);
      var data = await resp.json();
      var statusParts =
        "Generated " + fmtUtc(data.generatedAt) + " · log window " + data.maxDays + "d";
      if (data.fileDaysScanned && data.fileDaysScanned !== data.maxDays) {
        statusParts += " (files " + data.fileDaysScanned + "d)";
      }
      if (data.timeRange && (data.timeRange.fromTs != null || data.timeRange.toTs != null)) {
        statusParts += " · UTC filter ";
        statusParts += data.timeRange.fromTs != null ? fmtUtc(data.timeRange.fromTs) : "…";
        statusParts += " → ";
        statusParts += data.timeRange.toTs != null ? fmtUtc(data.timeRange.toTs) : "now";
      }
      document.getElementById("status").textContent = statusParts;

      var chartDayMode = data.chartGranularity === "day";
      var chartSlotCount = chartDayMode ? (data.loginByDayUtc || []).length : 24;
      var loginChartRows = chartDayMode ? (data.loginByDayUtc || []) : (data.loginByHourUtc || []);
      var payoutChartRows = chartDayMode ? (data.payoutByDayUtc || []) : (data.payoutByHourUtc || []);

      var maxStarts = 1;
      var maxEnds = 1;
      for (var i = 0; i < loginChartRows.length; i++) {
        maxStarts = Math.max(maxStarts, Number(loginChartRows[i].starts || 0));
        maxEnds = Math.max(maxEnds, Number(loginChartRows[i].ends || 0));
      }
      var maxPayout = 1;
      for (var j = 0; j < payoutChartRows.length; j++) {
        maxPayout = Math.max(maxPayout, Number(String(payoutChartRows[j].totalNim || "0").replace(/,/g, "")));
      }
      var selectedPayoutHour = null;
      var selectedLoginHour = null;
      var selectedRecentPayoutHour = null;
      var selectedSessionHour = null;
      var selectedVisitorHour = null;
      var visitorsByHour = [];
      var focusedWallet = null;
      var expandedUserByHour = {};
      var identByWallet = {};
      (data.visitors || []).forEach(function (v) { identByWallet[v.walletId] = v.identicon; });
      payoutChartRows.forEach(function (h) {
        (h.users || []).forEach(function (u) {
          if (!identByWallet[u.walletId]) identByWallet[u.walletId] = u.identicon;
        });
      });
      loginChartRows.forEach(function (h) {
        (h.startUsers || []).forEach(function (u) {
          if (!identByWallet[u.walletId]) identByWallet[u.walletId] = u.identicon;
        });
        (h.endUsers || []).forEach(function (u) {
          if (!identByWallet[u.walletId]) identByWallet[u.walletId] = u.identicon;
        });
      });

      function walletMatch(wallet) {
        return !focusedWallet || wallet === focusedWallet;
      }

      function renderFocusUserBanner() {
        var el = document.getElementById("focusUser");
        if (!el) return;
        if (!focusedWallet) {
          el.innerHTML = "";
          return;
        }
        var ident = identByWallet[focusedWallet] || "";
        el.innerHTML =
          "<span>Focused user:</span>" +
          walletChip(ident, focusedWallet) +
          "<span class='mono'>" + esc(focusedWallet) + "</span>" +
          "<button id='focusUserBack' title='Back to all users'>&larr; Back</button>";
        attachCopyHandlers(el);
        var back = document.getElementById("focusUserBack");
        if (back) {
          back.addEventListener("click", function () {
            focusedWallet = null;
            renderAll();
          });
        }
      }

      function loginRowForSlot(slot) {
        var row = loginChartRows[slot];
        if (!row) return { starts: 0, ends: 0, firstStarts: 0, uniquePlayers: 0, startUsers: [], endUsers: [], firstStartUsers: [], dayUtc: "" };
        if (!focusedWallet) {
          if (chartDayMode) {
            return {
              hourUtc: slot,
              dayUtc: row.dayUtc,
              starts: row.starts,
              ends: row.ends,
              firstStarts: row.firstStarts,
              uniquePlayers: row.uniquePlayers,
              startUsers: row.startUsers,
              endUsers: row.endUsers,
              firstStartUsers: row.firstStartUsers,
            };
          }
          return row;
        }
        var su = (row.startUsers || []).filter(function (u) { return u.walletId === focusedWallet; });
        var eu = (row.endUsers || []).filter(function (u) { return u.walletId === focusedWallet; });
        var fu = (row.firstStartUsers || []).filter(function (u) { return u.walletId === focusedWallet; });
        var starts = su.reduce(function (a, b) { return a + Number(b.count || 0); }, 0);
        var ends = eu.reduce(function (a, b) { return a + Number(b.count || 0); }, 0);
        var firstStarts = fu.reduce(function (a, b) { return a + Number(b.count || 0); }, 0);
        return {
          hourUtc: chartDayMode ? slot : row.hourUtc,
          dayUtc: chartDayMode ? row.dayUtc : "",
          starts: starts,
          ends: ends,
          firstStarts: firstStarts,
          uniquePlayers: starts + ends > 0 ? 1 : 0,
          startUsers: su,
          endUsers: eu,
          firstStartUsers: fu,
        };
      }

      function refreshVisitorsByHour() {
        visitorsByHour = Array.from({ length: chartSlotCount }, function () {
          return { unique: 0, inCount: 0, outCount: 0, users: {} };
        });
        for (var h = 0; h < chartSlotCount; h++) {
          var row = loginRowForSlot(h);
          var b = visitorsByHour[h];
          b.inCount = Number(row.starts || 0);
          b.outCount = Number(row.ends || 0);
          (row.startUsers || []).forEach(function (u) {
            b.users[u.walletId] = b.users[u.walletId] || {
              identicon: u.identicon || identByWallet[u.walletId] || "",
              inCount: 0,
              outCount: 0,
            };
            b.users[u.walletId].inCount += Number(u.count || 0);
          });
          (row.endUsers || []).forEach(function (u) {
            b.users[u.walletId] = b.users[u.walletId] || {
              identicon: u.identicon || identByWallet[u.walletId] || "",
              inCount: 0,
              outCount: 0,
            };
            b.users[u.walletId].outCount += Number(u.count || 0);
          });
          b.unique = Object.keys(b.users).length;
        }
      }

      function renderLogin() {
        var loginsEl = document.getElementById("logins");
        var loginHoverEl = document.getElementById("loginHover");
        if (!loginsEl || !loginHoverEl) return;
        var loginRows = loginChartRows.map(function (_r, slot) {
          return loginRowForSlot(slot);
        });
        var localMaxStarts = 1;
        var localMaxEnds = 1;
        loginRows.forEach(function (r) {
          localMaxStarts = Math.max(localMaxStarts, Number(r.starts || 0));
          localMaxEnds = Math.max(localMaxEnds, Number(r.ends || 0));
        });
        var gridStyle = "grid-template-columns:repeat(" + chartSlotCount + ",minmax(4px,1fr))";
        var ticksRow = chartDayMode ? dayTicksHtml(loginChartRows) : hourTicksHtml();
        var loginMaxScale = Math.max(1, localMaxStarts, localMaxEnds);
        loginsEl.innerHTML =
          "<div class='chart-block'>" +
          chartAxisTicks(loginMaxScale, function (x) {
            return String(Math.round(Number(x)));
          }) +
          "<div class='chart-main'>" +
          "<div class='chart-cols' style='" +
          gridStyle +
          "'>" +
          loginRows
            .map(function (row, slot) {
              var inH = Math.max(3, Math.round((Number(row.starts || 0) / Math.max(localMaxStarts, localMaxEnds)) * 100));
              var outH = Math.max(3, Math.round((Number(row.ends || 0) / Math.max(localMaxStarts, localMaxEnds)) * 100));
              var title = chartDayMode ? row.dayUtc + " UTC" : String(slot).padStart(2, "0") + ":00 UTC";
              return (
                "<div class='col" +
                (selectedLoginHour === slot ? " sel-row" : "") +
                "' data-hour='" +
                slot +
                "' title='" +
                esc(title) +
                "'><div class='in' style='height:3%' data-target='" +
                inH +
                "%'></div><div class='out' style='height:3%' data-target='" +
                outH +
                "%'></div></div>"
              );
            })
            .join("") +
          "</div>" +
          ticksRow +
          "</div></div>";
        var pinLabel = "";
        if (selectedLoginHour !== null) {
          pinLabel = chartDayMode
            ? "Pinned " + esc((loginChartRows[selectedLoginHour] || {}).dayUtc || "") + " UTC."
            : "Pinned " + String(selectedLoginHour).padStart(2, "0") + ":00 UTC.";
        }
        loginsEl.innerHTML +=
          "<div class='hintline'>Click a " +
          (chartDayMode ? "day" : "hour") +
          " to pin it. " +
          pinLabel +
          " First-ever sign-ins in this report: " +
          (focusedWallet ? "0" : data.firstTimeLogins || 0) +
          ".</div>";
        tweenChartBars(loginsEl);
        loginsEl.querySelectorAll("[data-hour]").forEach(function (el) {
          function showHour() {
            var hour = Number(el.getAttribute("data-hour") || "-1");
            var row = loginRowForSlot(hour);
            if (!row) return;
            var byWallet = {};
            (row.startUsers || []).forEach(function (u) {
              byWallet[u.walletId] = byWallet[u.walletId] || { identicon: u.identicon, inCount: 0, outCount: 0 };
              byWallet[u.walletId].inCount += Number(u.count || 0);
            });
            (row.endUsers || []).forEach(function (u) {
              byWallet[u.walletId] = byWallet[u.walletId] || { identicon: u.identicon, inCount: 0, outCount: 0 };
              byWallet[u.walletId].outCount += Number(u.count || 0);
            });
            var grouped = Object.keys(byWallet)
              .map(function (walletId) {
                var v = byWallet[walletId];
                return { walletId: walletId, identicon: v.identicon, inCount: v.inCount, outCount: v.outCount };
              })
              .sort(function (a, b) {
                return b.inCount + b.outCount - (a.inCount + a.outCount);
              })
              .slice(0, 10)
              .map(function (u) {
                return (
                  "<div class='user-row'>" +
                  walletChip(u.identicon, u.walletId) +
                  "<span>" +
                  esc(walletShort(u.walletId)) +
                  "</span><span>" +
                  u.inCount +
                  "/" +
                  u.outCount +
                  "</span></div>"
                );
              })
              .join("");
            var firsts = (row.firstStartUsers || [])
              .slice(0, 20)
              .map(function (u) {
                return walletChip(u.identicon, u.walletId);
              })
              .join("");
            var head = chartDayMode
              ? "<strong>" + esc(row.dayUtc || "") + " UTC</strong>"
              : "<strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong>";
            var firstLabel =
              "First-ever sign-ins (this report) · started in this " + (chartDayMode ? "UTC day" : "UTC hour");
            loginHoverEl.innerHTML =
              "<div>" +
              head +
              " · " +
              row.starts +
              " in " +
              row.ends +
              " out · " +
              row.uniquePlayers +
              " unique · " +
              (row.firstStarts || 0) +
              " first-ever sign-in" +
              ((row.firstStarts || 0) === 1 ? "" : "s") +
              "</div><div style='margin-top:0.35rem'>" +
              (grouped || "<div>No login/logout events</div>") +
              (firsts ? "<div class='hintline'>" + firstLabel + "</div><div style='display:flex;flex-wrap:wrap;gap:0.35rem'>" + firsts + "</div>" : "") +
              "</div>";
            attachCopyHandlers(loginHoverEl);
          }
          el.addEventListener("mouseenter", showHour);
          el.addEventListener("click", function () {
            selectedLoginHour = Number(el.getAttribute("data-hour") || "-1");
            renderLogin();
            showHour();
          });
        });
        attachCopyHandlers(loginsEl);
      }

      function renderPayoutHourUsers() {
        var el = document.getElementById("payoutHourUsers");
        if (!el) return;
        if (selectedPayoutHour === null) {
          el.innerHTML =
            "<div class='hintline'>Click a " + (chartDayMode ? "day" : "hour") + " above to pin it and inspect users.</div>";
          return;
        }
        var row = payoutChartRows[selectedPayoutHour];
        if (!row) {
          el.innerHTML = "<div class='hintline'>No payout data for selected " + (chartDayMode ? "day" : "hour") + ".</div>";
          return;
        }
        var users = (row.users || []).filter(function (u) {
          return walletMatch(u.walletId);
        });
        var head =
          "<strong>" +
          (chartDayMode ? esc(row.dayUtc || "") + " UTC" : String(selectedPayoutHour).padStart(2, "0") + ":00 UTC") +
          "</strong>";
        var html = "<div style='margin-bottom:0.4rem'>" + head + " · " + esc(row.totalNim) + " NIM · " + row.payouts + " payouts</div>";
        html += "<table><thead><tr><th>User</th><th class='right'>Payouts</th><th class='right'>Total NIM</th></tr></thead><tbody>";
        users.forEach(function (u) {
          html += "<tr><td>" + walletChip(u.identicon, u.walletId) + "</td><td class='right'>" + u.payouts + "</td><td class='right clickable-nim' data-hour-expand='" + selectedPayoutHour + "' data-wallet-expand='" + esc(u.walletId) + "'>" + esc(u.totalNim) + "</td></tr>";
          var key = selectedPayoutHour + "::" + u.walletId;
          if (expandedUserByHour[key]) {
            var rows = (data.nimPayouts || []).filter(function (p) {
              if (!walletMatch(p.recipient) || p.recipient !== u.walletId) return false;
              if (chartDayMode) return utcDayKeyFromTs(p.sentAt) === row.dayUtc;
              return Number(new Date(p.sentAt).getUTCHours()) === selectedPayoutHour;
            });
            html += "<tr><td colspan='3'><table><thead><tr><th>When</th><th class='right'>NIM</th></tr></thead><tbody>";
            rows.forEach(function (p) {
              html += "<tr><td>" + esc(fmtMdHm(p.sentAt)) + "</td><td class='right'>" + esc(p.amountNim || "—") + "</td></tr>";
            });
            html += "</tbody></table></td></tr>";
          }
        });
        html +=
          "</tbody></table><div class='hintline'>Click a NIM total to expand/collapse that user's history for this " +
          (chartDayMode ? "day" : "hour") +
          ".</div>";
        el.innerHTML = html;
        attachCopyHandlers(el);
        el.querySelectorAll("[data-wallet-expand]").forEach(function (n) {
          n.addEventListener("click", function () {
            var k = n.getAttribute("data-hour-expand") + "::" + (n.getAttribute("data-wallet-expand") || "");
            expandedUserByHour[k] = !expandedUserByHour[k];
            renderPayoutHourUsers();
          });
        });
      }

      function renderPayoutHours() {
        var payoutHoursEl = document.getElementById("payoutHours");
        var payoutHoverEl = document.getElementById("payoutHover");
        if (!payoutHoursEl || !payoutHoverEl) return;
        var payoutRows = payoutChartRows.map(function (row, slot) {
          if (!focusedWallet) {
            if (chartDayMode) {
              return {
                hourUtc: slot,
                dayUtc: row.dayUtc,
                payouts: row.payouts,
                totalNim: row.totalNim,
                totalLuna: row.totalLuna,
                users: row.users || [],
              };
            }
            return row;
          }
          var u = (row.users || []).find(function (x) {
            return x.walletId === focusedWallet;
          });
          return {
            hourUtc: chartDayMode ? slot : row.hourUtc,
            dayUtc: chartDayMode ? row.dayUtc : "",
            payouts: u ? u.payouts : 0,
            totalNim: u ? u.totalNim : "0.00000",
            users: u ? [u] : [],
          };
        });
        var localMaxPayout = 1;
        payoutRows.forEach(function (r) {
          localMaxPayout = Math.max(localMaxPayout, Number(String(r.totalNim || "0").replace(/,/g, "")));
        });
        var gridStylePay = "grid-template-columns:repeat(" + chartSlotCount + ",minmax(4px,1fr))";
        var ticksRowPay = chartDayMode ? dayTicksHtml(payoutChartRows) : hourTicksHtml();
        payoutHoursEl.innerHTML =
          "<div class='chart-block'>" +
          chartAxisTicks(localMaxPayout, formatNimAxisValue) +
          "<div class='chart-main'>" +
          "<div class='chart-cols' style='" +
          gridStylePay +
          "'>" +
          payoutRows
            .map(function (row, slot) {
              var n = Number(String(row.totalNim || "0").replace(/,/g, ""));
              var h = Math.max(3, Math.round((n / localMaxPayout) * 100));
              var title = chartDayMode ? row.dayUtc + " UTC" : String(slot).padStart(2, "0") + ":00 UTC";
              return (
                "<div class='col" +
                (selectedPayoutHour === slot ? " sel-row" : "") +
                "' data-hour='" +
                slot +
                "' title='" +
                esc(title) +
                "'><div class='in' style='height:3%' data-target='" +
                h +
                "%'></div></div>"
              );
            })
            .join("") +
          "</div>" +
          ticksRowPay +
          "</div></div>";
        tweenChartBars(payoutHoursEl);
        payoutHoursEl.querySelectorAll("[data-hour]").forEach(function (el) {
          el.addEventListener("mouseenter", function () {
            var hour = Number(el.getAttribute("data-hour") || "-1");
            var row = payoutRows[hour];
            if (!row) return;
            var users = (row.users || [])
              .slice(0, 10)
              .map(function (u) {
                return (
                  "<div class='user-row'>" +
                  walletChip(u.identicon, u.walletId) +
                  "<span>" +
                  esc(walletShort(u.walletId)) +
                  "</span><span>" +
                  esc(u.totalNim) +
                  " NIM</span></div>"
                );
              })
              .join("");
            var head = chartDayMode
              ? "<strong>" + esc(row.dayUtc || "") + " UTC</strong>"
              : "<strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong>";
            payoutHoverEl.innerHTML =
              "<div>" +
              head +
              " · " +
              esc(row.totalNim) +
              " NIM · " +
              row.payouts +
              " payouts</div><div style='margin-top:0.35rem'>" +
              (users || "<div>No payouts</div>") +
              "</div>";
            attachCopyHandlers(payoutHoverEl);
          });
          el.addEventListener("click", function () {
            var hour = Number(el.getAttribute("data-hour") || "-1");
            selectedPayoutHour = hour;
            payoutHoursEl.querySelectorAll("[data-hour]").forEach(function (x) {
              x.classList.remove("sel-row");
            });
            el.classList.add("sel-row");
            renderPayoutHourUsers();
          });
        });
        attachCopyHandlers(payoutHoursEl);
      }

      var recentPayoutByHour = Array.from({ length: chartSlotCount }, function () {
        return { count: 0, totalNim: 0, rows: [], users: {} };
      });
      (data.nimPayouts || [])
        .filter(function (p) {
          return walletMatch(p.recipient);
        })
        .forEach(function (p) {
          var slot;
          if (chartDayMode) {
            var dk = utcDayKeyFromTs(p.sentAt);
            slot = -1;
            for (var di = 0; di < loginChartRows.length; di++) {
              if (loginChartRows[di].dayUtc === dk) {
                slot = di;
                break;
              }
            }
          } else {
            slot = Number(new Date(p.sentAt).getUTCHours());
          }
          if (!(slot >= 0 && slot < recentPayoutByHour.length)) return;
          var n = Number(p.amountNim || 0);
          var b = recentPayoutByHour[slot];
          b.count += 1;
          if (Number.isFinite(n)) b.totalNim += n;
          b.rows.push(p);
          var u = p.recipient || "";
          b.users[u] = b.users[u] || { count: 0, nim: 0 };
          b.users[u].count += 1;
          if (Number.isFinite(n)) b.users[u].nim += n;
        });
      var maxRecentPayoutNim = 1;
      recentPayoutByHour.forEach(function (b) {
        maxRecentPayoutNim = Math.max(maxRecentPayoutNim, b.totalNim);
      });

      function renderRecentPayoutPinned() {
        var el = document.getElementById("payoutsRecentPinned");
        if (!el) return;
        if (selectedRecentPayoutHour === null) {
          el.innerHTML =
            "<div class='hintline'>Click a " + (chartDayMode ? "day" : "hour") + " to pin recent payouts for that " + (chartDayMode ? "day" : "hour") + ".</div>";
          return;
        }
        var b = recentPayoutByHour[selectedRecentPayoutHour];
        if (!b) return;
        var users = Object.keys(b.users)
          .map(function (w) {
            return {
              walletId: w,
              count: b.users[w].count,
              nim: b.users[w].nim,
              identicon: identByWallet[w] || "",
            };
          })
          .sort(function (a, c) { return c.nim - a.nim; });
        var rpHead =
          "<strong>" +
          (chartDayMode
            ? esc((loginChartRows[selectedRecentPayoutHour] || {}).dayUtc || "") + " UTC"
            : String(selectedRecentPayoutHour).padStart(2, "0") + ":00 UTC") +
          "</strong>";
        var html = "<div style='margin-bottom:0.4rem'>" + rpHead + " · " + b.totalNim.toFixed(5) + " NIM · " + b.count + " payouts</div>";
        html += "<table><thead><tr><th>User</th><th class='right'>Payouts</th><th class='right'>NIM</th></tr></thead><tbody>";
        users.forEach(function (u) {
          html += "<tr><td>" + walletChip(u.identicon, u.walletId) + "</td><td class='right'>" + u.count + "</td><td class='right'>" + u.nim.toFixed(5) + "</td></tr>";
        });
        html += "</tbody></table>";
        html += "<table><thead><tr><th>When</th><th>User</th><th class='right'>NIM</th></tr></thead><tbody>";
        b.rows
          .slice()
          .sort(function (a, c) { return c.sentAt - a.sentAt; })
          .forEach(function (p) {
            html += "<tr><td>" + esc(fmtMdHm(p.sentAt)) + "</td><td>" + walletChip(identByWallet[p.recipient] || "", p.recipient) + "</td><td class='right'>" + esc(p.amountNim || "—") + "</td></tr>";
          });
        html += "</tbody></table>";
        el.innerHTML = html;
        attachCopyHandlers(el);
      }

      function renderRecentPayoutChart() {
        var chartEl = document.getElementById("payoutsRecentChart");
        var hoverEl = document.getElementById("payoutsRecentHover");
        if (!chartEl || !hoverEl) return;
        var maxSegs = 10;
        var rpGrid = "grid-template-columns:repeat(" + chartSlotCount + ",minmax(4px,1fr))";
        var rpTicksRow = chartDayMode ? dayTicksHtml(loginChartRows) : hourTicksHtml();
        chartEl.innerHTML =
          "<div class='chart-block'>" +
          chartAxisTicks(maxRecentPayoutNim, formatNimAxisValue) +
          "<div class='chart-main'>" +
          "<div class='chart-cols' style='" +
          rpGrid +
          "'>" +
          recentPayoutByHour
            .map(function (b, hour) {
              var total = b.totalNim;
              var usersArr = Object.keys(b.users)
                .map(function (w) {
                  var u = b.users[w];
                  return {
                    walletId: w,
                    nim: u.nim,
                    count: u.count,
                    identicon: identByWallet[w] || "",
                  };
                })
                .filter(function (x) {
                  return x.nim > 0;
                })
                .sort(function (a, c) {
                  return c.nim - a.nim;
                });
              var segs = [];
              var otherNim = 0;
              var otherCount = 0;
              usersArr.forEach(function (u, idx) {
                if (idx < maxSegs) segs.push(u);
                else {
                  otherNim += u.nim;
                  otherCount += u.count;
                }
              });
              if (otherNim > 0) {
                segs.push({ walletId: "", nim: otherNim, count: otherCount, identicon: "", isOther: true });
              }
              var outerPct = total <= 0 ? 3 : Math.max(3, Math.round((total / maxRecentPayoutNim) * 100));
              var inner = "";
              if (total <= 0) {
                inner = "<div class='stack-seg' style='height:100%;background:#283244' title='No payouts'></div>";
              } else {
                segs.forEach(function (u, i) {
                  var pct = Math.max(0.35, (u.nim / total) * 100);
                  var label = u.isOther
                    ? String(usersArr.length - maxSegs) + " others · " + u.nim.toFixed(5) + " NIM"
                    : walletShort(u.walletId) + " · " + u.nim.toFixed(5) + " NIM (" + u.count + ")";
                  var c = u.isOther ? "#5c6575" : USER_STACK_COLORS[i % USER_STACK_COLORS.length];
                  inner +=
                    "<div class='stack-seg' style='height:3%;background:" +
                    c +
                    "' data-target='" +
                    pct.toFixed(2) +
                    "%' title='" +
                    esc(label) +
                    "'></div>";
                });
              }
              var rpTitle = chartDayMode
                ? esc((loginChartRows[hour] || {}).dayUtc || "") + " UTC"
                : String(hour).padStart(2, "0") + " UTC";
              return (
                "<div class='col" +
                (selectedRecentPayoutHour === hour ? " sel-row" : "") +
                "' data-rphour='" +
                hour +
                "' title='" +
                rpTitle +
                "'><div class='col-bar' style='height:3%' data-target='" +
                outerPct +
                "%'>" +
                inner +
                "</div></div>"
              );
            })
            .join("") +
          "</div>" +
          rpTicksRow +
          "</div></div>";
        tweenChartBars(chartEl);
        chartEl.querySelectorAll("[data-rphour]").forEach(function (el) {
          function show() {
            var hour = Number(el.getAttribute("data-rphour") || "-1");
            var b = recentPayoutByHour[hour];
            if (!b) return;
            var top = Object.keys(b.users)
              .map(function (w) {
                var u = b.users[w];
                return { walletId: w, nim: u.nim, count: u.count, identicon: identByWallet[w] || "" };
              })
              .sort(function (a, c) {
                return c.nim - a.nim;
              })
              .slice(0, 10)
              .map(function (u) {
                return (
                  "<div class='user-row'>" +
                  walletChip(u.identicon, u.walletId) +
                  "<span>" +
                  esc(walletShort(u.walletId)) +
                  "</span><span>" +
                  u.nim.toFixed(5) +
                  " NIM · " +
                  u.count +
                  "</span></div>"
                );
              })
              .join("");
            var hStrong = chartDayMode
              ? "<strong>" + esc((loginChartRows[hour] || {}).dayUtc || "") + " UTC</strong>"
              : "<strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong>";
            hoverEl.innerHTML =
              "<div>" +
              hStrong +
              " · " +
              b.totalNim.toFixed(5) +
              " NIM · " +
              b.count +
              " payouts</div><div style='margin-top:0.35rem'>" +
              (top || "<div>No payouts</div>") +
              "</div>";
            attachCopyHandlers(hoverEl);
          }
          el.addEventListener("mouseenter", show);
          el.addEventListener("click", function () {
            selectedRecentPayoutHour = Number(el.getAttribute("data-rphour") || "-1");
            renderRecentPayoutChart();
            renderRecentPayoutPinned();
            show();
          });
        });
      }

      var sessionByHour = Array.from({ length: chartSlotCount }, function () {
        return { totalMs: 0, rows: [], users: {} };
      });
      (data.sessions || [])
        .filter(function (s) {
          return walletMatch(s.address);
        })
        .forEach(function (s) {
          var slot;
          if (chartDayMode) {
            var dk3 = utcDayKeyFromTs(s.startedAt);
            slot = -1;
            for (var si = 0; si < loginChartRows.length; si++) {
              if (loginChartRows[si].dayUtc === dk3) {
                slot = si;
                break;
              }
            }
          } else {
            slot = Number(new Date(s.startedAt).getUTCHours());
          }
          if (!(slot >= 0 && slot < sessionByHour.length)) return;
          var d = Number(s.durationMs || 0);
          var b = sessionByHour[slot];
          b.totalMs += d;
          b.rows.push(s);
          var w = s.address || "";
          b.users[w] = b.users[w] || { totalMs: 0, sessions: 0 };
          b.users[w].totalMs += d;
          b.users[w].sessions += 1;
        });
      var maxSessionMs = 1;
      sessionByHour.forEach(function (b) {
        maxSessionMs = Math.max(maxSessionMs, b.totalMs);
      });

      function renderSessionPinned() {
        var el = document.getElementById("sessionsHourPinned");
        if (!el) return;
        if (selectedSessionHour === null) {
          el.innerHTML =
            "<div class='hintline'>Click a " + (chartDayMode ? "day" : "hour") + " to pin session duration details.</div>";
          return;
        }
        var b = sessionByHour[selectedSessionHour];
        if (!b) return;
        var users = Object.keys(b.users)
          .map(function (w) {
            return {
              walletId: w,
              sessions: b.users[w].sessions,
              totalMs: b.users[w].totalMs,
              identicon: identByWallet[w] || "",
            };
          })
          .sort(function (a, c) { return c.totalMs - a.totalMs; });
        var sessHead =
          "<strong>" +
          (chartDayMode
            ? esc((loginChartRows[selectedSessionHour] || {}).dayUtc || "") + " UTC"
            : String(selectedSessionHour).padStart(2, "0") + ":00 UTC") +
          "</strong>";
        var html = "<div style='margin-bottom:0.4rem'>" + sessHead + " · " + fmtMs(b.totalMs) + " total · " + b.rows.length + " sessions</div>";
        html += "<table><thead><tr><th>User</th><th class='right'>Sessions</th><th class='right'>Duration</th></tr></thead><tbody>";
        users.forEach(function (u) {
          html += "<tr><td>" + walletChip(u.identicon, u.walletId) + "</td><td class='right'>" + u.sessions + "</td><td class='right'>" + fmtMs(u.totalMs) + "</td></tr>";
        });
        html += "</tbody></table>";
        html += "<table><thead><tr><th>Start</th><th>User</th><th>Room</th><th class='right'>Duration</th></tr></thead><tbody>";
        b.rows
          .slice()
          .sort(function (a, c) { return c.startedAt - a.startedAt; })
          .forEach(function (s) {
            html += "<tr><td>" + esc(fmtMdHm(s.startedAt)) + "</td><td>" + walletChip(identByWallet[s.address] || "", s.address) + "</td><td>" + esc(s.roomId) + "</td><td class='right'>" + esc(fmtMs(s.durationMs)) + "</td></tr>";
          });
        html += "</tbody></table>";
        el.innerHTML = html;
        attachCopyHandlers(el);
      }

      function renderSessionChart() {
        var chartEl = document.getElementById("sessionsHourChart");
        var hoverEl = document.getElementById("sessionsHourHover");
        if (!chartEl || !hoverEl) return;
        var sg = "grid-template-columns:repeat(" + chartSlotCount + ",minmax(4px,1fr))";
        var sessTicksRow = chartDayMode ? dayTicksHtml(loginChartRows) : hourTicksHtml();
        chartEl.innerHTML =
          "<div class='chart-block'>" +
          chartAxisTicks(maxSessionMs, fmtMsAxis) +
          "<div class='chart-main'>" +
          "<div class='chart-cols' style='" +
          sg +
          "'>" +
          sessionByHour
            .map(function (b, hour) {
              var h = Math.max(3, Math.round((b.totalMs / maxSessionMs) * 100));
              var tit = chartDayMode
                ? esc((loginChartRows[hour] || {}).dayUtc || "") + " UTC"
                : String(hour).padStart(2, "0") + " UTC";
              return (
                "<div class='col" +
                (selectedSessionHour === hour ? " sel-row" : "") +
                "' data-shour='" +
                hour +
                "' title='" +
                tit +
                "'><div class='in' style='height:3%' data-target='" +
                h +
                "%'></div></div>"
              );
            })
            .join("") +
          "</div>" +
          sessTicksRow +
          "</div></div>";
        tweenChartBars(chartEl);
        chartEl.querySelectorAll("[data-shour]").forEach(function (el) {
          function show() {
            var hour = Number(el.getAttribute("data-shour") || "-1");
            var b = sessionByHour[hour];
            if (!b) return;
            var hStr = chartDayMode
              ? "<strong>" + esc((loginChartRows[hour] || {}).dayUtc || "") + " UTC</strong>"
              : "<strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong>";
            hoverEl.innerHTML =
              "<div>" + hStr + " · " + fmtMs(b.totalMs) + " total duration · " + b.rows.length + " sessions</div>";
          }
          el.addEventListener("mouseenter", show);
          el.addEventListener("click", function () {
            selectedSessionHour = Number(el.getAttribute("data-shour") || "-1");
            renderSessionChart();
            renderSessionPinned();
            show();
          });
        });
      }

      function renderVisitorsPinned() {
        var el = document.getElementById("visitorsPinned");
        if (!el) return;
        if (selectedVisitorHour === null) {
          el.innerHTML =
            "<div class='hintline'>Click a " + (chartDayMode ? "day" : "hour") + " to pin unique visitors for that " + (chartDayMode ? "day" : "hour") + ".</div>";
          return;
        }
        var b = visitorsByHour[selectedVisitorHour];
        if (!b) {
          el.innerHTML = "<div class='hintline'>No visitor data for selected " + (chartDayMode ? "day" : "hour") + ".</div>";
          return;
        }
        var users = Object.keys(b.users)
          .map(function (walletId) {
            var u = b.users[walletId];
            return {
              walletId: walletId,
              identicon: u.identicon || identByWallet[walletId] || "",
              inCount: u.inCount,
              outCount: u.outCount,
              total: Number(u.inCount || 0) + Number(u.outCount || 0),
            };
          })
          .sort(function (a, c) { return c.total - a.total; });
        var pinRow = loginRowForSlot(selectedVisitorHour);
        var firstStarts = Number((pinRow || {}).firstStarts || 0);
        var vHead =
          "<strong>" +
          (chartDayMode
            ? esc((loginChartRows[selectedVisitorHour] || {}).dayUtc || "") + " UTC"
            : String(selectedVisitorHour).padStart(2, "0") + ":00 UTC") +
          "</strong>";
        var html =
          "<div style='margin-bottom:0.4rem'>" +
          vHead +
          " · " +
          b.unique +
          " unique · " +
          b.inCount +
          "/" +
          b.outCount +
          " · " +
          firstStarts +
          " first-ever sign-in" +
          (firstStarts === 1 ? "" : "s") +
          "</div>";
        html += "<table><thead><tr><th>User</th><th class='right'>In/Out</th></tr></thead><tbody>";
        users.forEach(function (u) {
          html += "<tr><td>" + walletChip(u.identicon, u.walletId) + "</td><td class='right'>" + u.inCount + "/" + u.outCount + "</td></tr>";
        });
        html += "</tbody></table>";
        el.innerHTML = html;
        attachCopyHandlers(el);
      }

      function renderVisitorsChart() {
        var chartEl = document.getElementById("visitorsChart");
        var hoverEl = document.getElementById("visitorsHover");
        if (!chartEl || !hoverEl) return;
        var maxVisitorStack = 1;
        visitorsByHour.forEach(function (b) {
          var t = 0;
          Object.keys(b.users).forEach(function (w) {
            var u = b.users[w];
            t += Number(u.inCount || 0) + Number(u.outCount || 0);
          });
          maxVisitorStack = Math.max(maxVisitorStack, t);
        });
        var maxSegs = 10;
        var vg = "grid-template-columns:repeat(" + chartSlotCount + ",minmax(4px,1fr))";
        var visTicksRow = chartDayMode ? dayTicksHtml(loginChartRows) : hourTicksHtml();
        chartEl.innerHTML =
          "<div class='chart-block'>" +
          chartAxisTicks(maxVisitorStack, function (x) {
            return String(Math.round(Number(x)));
          }) +
          "<div class='chart-main'>" +
          "<div class='chart-cols' style='" +
          vg +
          "'>" +
          visitorsByHour
            .map(function (b, hour) {
              var hourTotal = 0;
              Object.keys(b.users).forEach(function (w) {
                var u = b.users[w];
                hourTotal += Number(u.inCount || 0) + Number(u.outCount || 0);
              });
              var outerPct = hourTotal === 0 ? 3 : Math.max(3, Math.round((hourTotal / maxVisitorStack) * 100));
              var usersArr = Object.keys(b.users)
                .map(function (walletId) {
                  var u = b.users[walletId];
                  var t = Number(u.inCount || 0) + Number(u.outCount || 0);
                  return { walletId: walletId, identicon: u.identicon, inCount: u.inCount, outCount: u.outCount, t: t };
                })
                .filter(function (x) {
                  return x.t > 0;
                })
                .sort(function (a, c) {
                  return c.t - a.t;
                });
              var segs = [];
              var otherT = 0;
              usersArr.forEach(function (u, idx) {
                if (idx < maxSegs) segs.push(u);
                else otherT += u.t;
              });
              if (otherT > 0) {
                segs.push({ walletId: "", identicon: "", inCount: 0, outCount: 0, t: otherT, isOther: true });
              }
              var inner = "";
              if (hourTotal === 0) {
                inner = "<div class='stack-seg' style='height:100%;background:#283244' title='No activity'></div>";
              } else {
                segs.forEach(function (u, i) {
                  var pct = Math.max(0.35, (u.t / hourTotal) * 100);
                  var label = u.isOther
                    ? String(usersArr.length - maxSegs) + " others"
                    : walletShort(u.walletId) + " · " + u.inCount + " in / " + u.outCount + " out";
                  var c = u.isOther ? "#5c6575" : USER_STACK_COLORS[i % USER_STACK_COLORS.length];
                  inner +=
                    "<div class='stack-seg' style='height:3%;background:" +
                    c +
                    "' data-target='" +
                    pct.toFixed(2) +
                    "%' title='" +
                    esc(label) +
                    "'></div>";
                });
              }
              var vTit = chartDayMode
                ? esc((loginChartRows[hour] || {}).dayUtc || "") + " UTC"
                : String(hour).padStart(2, "0") + " UTC";
              return (
                "<div class='col" +
                (selectedVisitorHour === hour ? " sel-row" : "") +
                "' data-vhour='" +
                hour +
                "' title='" +
                vTit +
                "'><div class='col-bar' style='height:3%' data-target='" +
                outerPct +
                "%'>" +
                inner +
                "</div></div>"
              );
            })
            .join("") +
          "</div>" +
          visTicksRow +
          "</div></div>";
        tweenChartBars(chartEl);
        chartEl.querySelectorAll("[data-vhour]").forEach(function (el) {
          function show() {
            var hour = Number(el.getAttribute("data-vhour") || "-1");
            var b = visitorsByHour[hour];
            if (!b) return;
            var row = loginRowForSlot(hour);
            var top = Object.keys(b.users)
              .map(function (walletId) {
                var u = b.users[walletId];
                return { walletId: walletId, identicon: u.identicon, inCount: u.inCount, outCount: u.outCount };
              })
              .sort(function (a, c) {
                return c.inCount + c.outCount - (a.inCount + a.outCount);
              })
              .slice(0, 10)
              .map(function (u) {
                return (
                  "<div class='user-row'>" +
                  walletChip(u.identicon || identByWallet[u.walletId] || "", u.walletId) +
                  "<span>" +
                  esc(walletShort(u.walletId)) +
                  "</span><span>" +
                  u.inCount +
                  "/" +
                  u.outCount +
                  "</span></div>"
                );
              })
              .join("");
            var vHov = chartDayMode
              ? "<strong>" + esc((loginChartRows[hour] || {}).dayUtc || "") + " UTC</strong>"
              : "<strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong>";
            hoverEl.innerHTML =
              "<div>" +
              vHov +
              " · " +
              b.unique +
              " unique · " +
              b.inCount +
              "/" +
              b.outCount +
              " in/out · " +
              Number(row.firstStarts || 0) +
              " first-ever sign-in" +
              (Number(row.firstStarts || 0) === 1 ? "" : "s") +
              "</div><div style='margin-top:0.35rem'>" +
              (top || "<div>No activity</div>") +
              "</div>";
            attachCopyHandlers(hoverEl);
          }
          el.addEventListener("mouseenter", show);
          el.addEventListener("click", function () {
            selectedVisitorHour = Number(el.getAttribute("data-vhour") || "-1");
            renderVisitorsChart();
            renderVisitorsPinned();
            show();
          });
        });
      }

      function renderAll() {
        refreshVisitorsByHour();
        renderFocusUserBanner();
        renderLogin();
        renderPayoutHours();
        renderPayoutHourUsers();
        renderRecentPayoutChart();
        renderRecentPayoutPinned();
        renderSessionChart();
        renderSessionPinned();
        renderVisitorsChart();
        renderVisitorsPinned();
      }

      window.__analyticsFocusWallet = function (wallet) {
        focusedWallet = wallet || null;
        renderAll();
      };

      renderAll();

      var dailyHtml =
        "<table><thead><tr><th>Day</th><th class='right'>Players</th><th class='right'>Payouts</th><th class='right'>Place blocks</th><th class='right'>Chats</th></tr></thead><tbody>" +
        data.daily.slice(0, 30).map(function (d) {
          return (
            "<tr><td>" +
            esc(d.dayUtc) +
            "</td><td class='right'>" +
            d.activePlayers +
            "</td><td class='right'>" +
            d.payoutsSent +
            "</td><td class='right'>" +
            d.placeBlocks +
            "</td><td class='right'>" +
            d.chats +
            "</td></tr>"
          );
        }).join("") +
        "</tbody></table>";
      document.getElementById("daily").innerHTML = dailyHtml;

      (function renderDailyChart() {
        var chartRoot = document.getElementById("dailyChart");
        if (!chartRoot || !data.daily || !data.daily.length) {
          if (chartRoot) chartRoot.innerHTML = "";
          return;
        }
        var rows = data.daily
          .slice(0, 30)
          .slice()
          .reverse();
        var n = rows.length;
        var W = 720;
        var H = 220;
        var padL = 36;
        var padR = 12;
        var padT = 12;
        var padB = 28;
        var cw = W - padL - padR;
        var ch = H - padT - padB;
        function xAt(i) {
          return padL + (n <= 1 ? cw / 2 : (i / (n - 1)) * cw);
        }
        function yNorm(v, mx) {
          var m = Math.max(mx, 1e-9);
          return padT + ch - (v / m) * ch;
        }
        var specs = [
          { label: "Players", color: "#5aa0ff", pick: function (d) { return Number(d.activePlayers) || 0; } },
          { label: "Payouts", color: "#fbbf24", pick: function (d) { return Number(d.payoutsSent) || 0; } },
          { label: "Place blocks", color: "#38bdf8", pick: function (d) { return Number(d.placeBlocks) || 0; } },
          { label: "Chats", color: "#fb923c", pick: function (d) { return Number(d.chats) || 0; } },
        ];
        var lines = specs.map(function (sp) {
          var vals = rows.map(sp.pick);
          var mx = Math.max.apply(null, vals.concat([1]));
          var pts = vals
            .map(function (v, i) {
              return xAt(i) + "," + yNorm(v, mx);
            })
            .join(" ");
          return { pts: pts, color: sp.color, label: sp.label };
        });
        var grid = "";
        for (var g = 0; g <= 4; g++) {
          var gy = padT + (ch * g) / 4;
          grid += "<line x1='" + padL + "' y1='" + gy + "' x2='" + (W - padR) + "' y2='" + gy + "' stroke='#283244' stroke-width='1'/>";
        }
        var polys = lines
          .map(function (L) {
            return "<polyline fill='none' stroke='" + L.color + "' stroke-width='2' stroke-opacity='0.9' points='" + L.pts + "'/>";
          })
          .join("");
        var xlabels = "";
        var step = Math.max(1, Math.ceil(n / 8));
        for (var xi = 0; xi < n; xi += step) {
          var d = rows[xi];
          if (!d) continue;
          xlabels +=
            "<text x='" +
            xAt(xi) +
            "' y='" +
            (H - 6) +
            "' fill='#8092aa' font-size='9' text-anchor='middle'>" +
            esc(String(d.dayUtc).slice(5)) +
            "</text>";
        }
        var legend = specs
          .map(function (sp) {
            return (
              "<span class='daily-leg-item'><span class='daily-leg-swatch' style='background:" +
              sp.color +
              "'></span>" +
              esc(sp.label) +
              "</span>"
            );
          })
          .join("");
        chartRoot.innerHTML =
          "<svg viewBox='0 0 " +
          W +
          " " +
          H +
          "' xmlns='http://www.w3.org/2000/svg' aria-label='Daily metrics trend'>" +
          grid +
          polys +
          xlabels +
          "</svg><div class='daily-legend'>" +
          legend +
          "</div>";
      })();

    }
    load().catch(function (err) {
      document.getElementById("status").innerHTML = "<span class='err'>" + esc(err && err.message ? err.message : String(err)) + "</span>";
    });
  </script>
</body>
</html>`;
}
