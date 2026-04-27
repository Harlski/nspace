import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteShellCss } from "./mainSiteShell.js";

export function analyticsAdminPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Admin — Nimiq Space</title>
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84rem; }
    .row { display: flex; gap: 0.45rem; flex-wrap: wrap; align-items: center; margin-top: 0.6rem; }
    input { flex: 1 1 420px; min-width: 220px; background: #0f1622; color: #dbe6f4; border: 1px solid #2c3b52; border-radius: 6px; padding: 0.45rem 0.55rem; }
    #panel button { background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border); border-radius: 6px; padding: 0.4rem 0.7rem; cursor: pointer; }
    .list { margin-top: 0.7rem; display: grid; gap: 0.35rem; }
    .item { background: #0f1622; border: 1px solid #263348; border-radius: 6px; padding: 0.38rem 0.45rem; }
    .item-top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .wallet-main { display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; background: transparent; border: 0; color: #d6e0ef; padding: 0; }
    .wallet-main .ident { width: 18px; height: 18px; border-radius: 4px; }
    .wallet-copy-inline { display: inline-flex; align-items: center; gap: 0.3rem; }
    .wallet-copy { background: transparent; border: 0; color: #9fb0c7; cursor: pointer; padding: 0; font-size: 0.95rem; line-height: 1; }
    .wallet-copy:hover { color: #e6edf3; }
    .status { margin-top: 0.55rem; color: #9fb0c7; }
    .err { color: #f87171; }
    .admin-pv-section { margin-bottom: 1.1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #283244; }
    .admin-pv-head { margin-bottom: 0.45rem; color: #c8d4e4; font-size: 0.92rem; }
    .admin-pv-note { color: #6b7d95; font-weight: 400; font-size: 0.78rem; }
    .chart-block { display: flex; align-items: flex-start; gap: 0.3rem; margin-bottom: 0.35rem; }
    .chart-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .chart-axis { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; flex-shrink: 0; width: auto; min-width: 2.6rem; max-width: 4.2rem; height: 160px; padding: 0.05rem 0.15rem 0.15rem 0; box-sizing: border-box; font-size: 0.64rem; line-height: 1.1; color: #6b7d95; font-variant-numeric: tabular-nums; }
    .chart-axis span { display: block; text-align: right; }
    .chart-cols { display: grid; gap: 0.25rem; align-items: end; height: 160px; margin-bottom: 0.4rem; }
    .chart-cols .col { height: 100%; background: #202a3a; border-radius: 4px 4px 0 0; position: relative; }
    .chart-cols .col .in { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #5aa0ff, #7dd3fc); border-radius: 4px 4px 0 0; min-height: 2px; }
    .ticks.ticks--days { display: grid; gap: 0.08rem; align-items: end; min-height: 2.85rem; padding-top: 0.2rem; font-size: 0.62rem; color: #8092aa; }
    .ticks.ticks--days .tick-day { display: flex; justify-content: center; align-items: flex-end; min-width: 0; writing-mode: vertical-lr; text-orientation: upright; font-variant-numeric: tabular-nums; color: #8092aa; }
    .admin-pv-recent { margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #283244; }
    .admin-pv-recent > strong { display: block; margin-bottom: 0.35rem; color: #c8d4e4; font-size: 0.92rem; }
    .admin-pv-recent-hint { font-size: 0.76rem; color: #6b7d95; font-weight: 400; margin-left: 0.35rem; }
    .admin-pv-tablewrap { margin-top: 0.25rem; max-height: 300px; overflow: auto; border: 1px solid #263348; border-radius: 6px; }
    .admin-pv-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .admin-pv-table th, .admin-pv-table td { text-align: left; padding: 0.32rem 0.45rem; border-bottom: 1px solid #263348; vertical-align: middle; }
    .admin-pv-table th { color: #8b9cb3; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; position: sticky; top: 0; background: #131b27; z-index: 1; }
    .admin-pv-table tr:last-child td { border-bottom: 0; }
    .admin-pv-anon { color: #6b7d95; }
    .admin-pv-anon-hint { color: #5a6578; font-size: 0.74rem; margin-left: 0.35rem; }
    .admin-pv-walletcell { display: flex; flex-direction: column; align-items: flex-start; gap: 0.28rem; max-width: 28rem; }
    .admin-pv-walletline { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.45rem 0.6rem; }
    .admin-pv-identline { line-height: 0; }
    .admin-pv-identline .ident { width: 24px; height: 24px; border-radius: 4px; display: block; }
    .admin-pv-copy { cursor: pointer; color: #8b9cb3; font-size: 0.78rem; text-decoration: underline; text-underline-offset: 2px; user-select: none; }
    .admin-pv-copy:hover { color: #dce4ee; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("admin")}
  <h1 id="adminDocTitle" class="ms-doc-title">Admin</h1>
  <div id="panel" class="ms-panel ms-mono">Loading...</div>
  <script>
    var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
    var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
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
    function writeAuthToken(token) {
      for (var j = 0; j < AUTH_KEYS.length; j++) {
        sessionStorage.setItem(AUTH_KEYS[j], token);
      }
      var addr = sessionStorage.getItem(AUTH_ADDR_KEY) || "";
      if (typeof window.__nsSaveMainSiteAuth === "function") {
        window.__nsSaveMainSiteAuth(token, addr);
      }
    }
    function clearAuthSession() {
      if (typeof window.__nsClearMainSiteAuth === "function") {
        window.__nsClearMainSiteAuth();
      } else {
        for (var k = 0; k < AUTH_KEYS.length; k++) {
          sessionStorage.removeItem(AUTH_KEYS[k]);
        }
        sessionStorage.removeItem(AUTH_ADDR_KEY);
      }
    }
    function esc(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function normalizeWallet(v) {
      return String(v || "").replace(/\\s+/g, " ").trim();
    }
    function walletShort(walletId) {
      var compact = String(walletId || "").replace(/\\s+/g, "").toUpperCase();
      return compact.slice(0, 8);
    }
    function walletGrouped(walletId) {
      var compact = String(walletId || "").replace(/\\s+/g, "").toUpperCase();
      return compact.replace(/(.{4})(?=.)/g, "$1 ");
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
    function toB64(u8) {
      var s = "";
      for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      return btoa(s);
    }
    var adminSigningDotsTimer = null;
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
    function stopAdminSigningDots() {
      if (adminSigningDotsTimer) {
        clearInterval(adminSigningDotsTimer);
        adminSigningDotsTimer = null;
      }
    }
    function startAdminSigningDotsIn(root) {
      stopAdminSigningDots();
      var el = root.querySelector(".ms-signing-dots-live");
      if (!el) return;
      var states = [".", "..", "...", "."];
      var i = 0;
      el.textContent = states[0];
      adminSigningDotsTimer = setInterval(function () {
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
    async function runWalletLogin() {
      var panel = document.getElementById("panel");
      stopAdminSigningDots();
      if (panel) {
        panel.innerHTML = walletSigningMarkup();
        startAdminSigningDotsIn(panel);
      }
      try {
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
        writeAuthToken(token);
        stopAdminSigningDots();
        window.location.reload();
      } catch (e) {
        stopAdminSigningDots();
        if (panel) {
          if (isSigningUserCancelledError(e)) {
            panel.innerHTML =
              "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
              "<div class='ms-auth-gate-msg'>You must be signed in.</div>" +
              "</div>";
          } else {
            panel.innerHTML =
              "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
              "<div class='ms-auth-gate-msg'>Sign-in could not be completed.</div>" +
              "</div>" +
              "<p class='ms-summary' style='text-align:center;margin:0.65rem 0 0'>" +
              "<a class='ms-link-expl' href='/analytics'>Open Analytics</a></p>";
          }
        }
      }
    }
    async function renderSignInTop() {
      var authUserEl = document.getElementById("authUser");
      if (!authUserEl) return;
      authUserEl.style.display = "block";
      authUserEl.innerHTML =
        "<span id='authTopLogin' class='auth-user-signin' role='button' tabindex='0'>Sign In</span>";
      var loginEl = document.getElementById("authTopLogin");
      if (loginEl) {
        loginEl.addEventListener("click", function () {
          void runWalletLogin();
        });
        loginEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void runWalletLogin();
          }
        });
      }
    }
    async function fetchAnalyticsAuthStatus(token) {
      try {
        var r = await fetch("/api/analytics/auth-status", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (!r.ok) throw new Error("auth_status_failed");
        var j = await r.json();
        return {
          analyticsAuthorized: Boolean(j.analyticsAuthorized),
          analyticsManager: Boolean(j.analyticsManager),
        };
      } catch {
        return { analyticsAuthorized: false, analyticsManager: false };
      }
    }
    function walletNormAdmin(a) {
      return String(a || "").replace(/\s+/g, "").toUpperCase();
    }
    var MAX_MAIN_SITE_ACCOUNTS = 5;
    async function populateAdminAuthPicker(activeAddr) {
      var picker = document.getElementById("authAccountPicker");
      if (!picker || typeof window.__nsListMainSiteCachedAccounts !== "function") return;
      var rows = window.__nsListMainSiteCachedAccounts() || [];
      var activeN = walletNormAdmin(activeAddr);
      var html = "";
      for (var ai = 0; ai < rows.length; ai++) {
        var row = rows[ai];
        var ident = await fetchIdenticon(row.address);
        var isAct = walletNormAdmin(row.address) === activeN;
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
          if (!addr || walletNormAdmin(addr) === activeN) {
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
          void runWalletLogin();
        });
      }
    }
    function bindAdminAuthAccountSwitcher(activeAddr) {
      var toggle = document.getElementById("authChangeAccountToggle");
      var picker = document.getElementById("authAccountPicker");
      if (!toggle || !picker) return;
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var opening = picker.style.display !== "block";
        picker.style.display = opening ? "block" : "none";
        if (opening) void populateAdminAuthPicker(activeAddr);
      });
      void populateAdminAuthPicker(activeAddr);
    }
    async function renderAuthUser(address, canViewAnalytics) {
      var authUserEl = document.getElementById("authUser");
      if (!authUserEl || !address) return;
      authUserEl.style.display = "block";
      var ident = await fetchIdenticon(address);
      var tok = readAuthToken();
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
      var menuInner =
        (sessionExpired
          ? "<button type='button' id='authRefreshSession' class='auth-user-menu-row'>Sign in again</button>"
          : "") +
        acctSection +
        "<button type='button' id='authUserLogout' class='auth-user-menu-row'>Logout</button>";
      authUserEl.innerHTML =
        "<button type='button' id='authUserBtn' class='auth-user-btn' title='" +
        btnTitle +
        "'>" +
        identWrap +
        "<span class='mono'>" +
        esc(walletShort(address)) +
        "</span>" +
        "</button>" +
        "<div id='authUserMenu' class='auth-user-menu'>" +
        menuInner +
        "</div>";
      var btn = document.getElementById("authUserBtn");
      var menu = document.getElementById("authUserMenu");
      var refreshSess = document.getElementById("authRefreshSession");
      var logout = document.getElementById("authUserLogout");
      if (refreshSess) {
        refreshSess.addEventListener("click", function () {
          if (menu) menu.style.display = "none";
          void runWalletLogin();
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
      bindAdminAuthAccountSwitcher(address);
      if (logout) {
        logout.addEventListener("click", function () {
          clearAuthSession();
          window.location.reload();
        });
      }
    }
    async function load() {
      var panel = document.getElementById("panel");
      var docTitle = document.getElementById("adminDocTitle");
      if (!panel) return;
      var token = readAuthToken();
      var signed = sessionStorage.getItem(AUTH_ADDR_KEY) || "";
      if (!signed) signed = parseJwtSub(token);
      if (signed) sessionStorage.setItem(AUTH_ADDR_KEY, signed);
      if (!token) {
        if (docTitle) docTitle.hidden = true;
        await renderSignInTop();
        panel.innerHTML =
          "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
          "<div class='ms-auth-gate-msg'>You must be signed in.</div>" +
          "</div>";
        return;
      }
      var jwtExpired =
        typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(token);
      if (jwtExpired) {
        if (docTitle) docTitle.hidden = false;
        await renderAuthUser(signed, false);
        panel.innerHTML =
          "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
          "<div class='ms-auth-gate-msg'>Your session has expired. Use <strong>Sign in again</strong> above.</div>" +
          "</div>";
        if (typeof window.__nsRefreshMainSiteNavFromSession === "function") {
          window.__nsRefreshMainSiteNavFromSession();
        }
        return;
      }
      if (docTitle) docTitle.hidden = false;
      var wallets = [];
      var expandedWallet = "";
      var identByWallet = {};
      var pageViewsByDay = [];
      var pageViewsRecent = [];
      function chartAxisTicksAdmin(maxVal, formatTick) {
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
      function adminDayTicks(rows) {
        var n = Math.max(1, (rows && rows.length) || 1);
        var style = "grid-template-columns:repeat(" + n + ",minmax(0,1fr))";
        var inner = (rows || [])
          .map(function (r) {
            var d = r.dayUtc ? String(r.dayUtc).slice(8) : "";
            return (
              "<span class='tick-day' title='" +
              esc(String(r.dayUtc || "") + " UTC") +
              "'>" +
              esc(d) +
              "</span>"
            );
          })
          .join("");
        return "<div class='ticks ticks--days mono' style='" + style + "'>" + inner + "</div>";
      }
      function adminAnalyticsViewsChart(rows) {
        var list = rows && rows.length ? rows : [];
        if (!list.length) {
          return (
            "<section class='admin-pv-section'>" +
            "<div class='admin-pv-head'><strong>/analytics</strong> visits <span class='admin-pv-note'>(client beacons, UTC days)</span></div>" +
            "<p class='status' style='margin-top:0'>No chart data (request failed or empty window).</p>" +
            "</section>"
          );
        }
        var maxV = 1;
        list.forEach(function (r) {
          maxV = Math.max(maxV, Number(r.views || 0));
        });
        var n = Math.max(1, list.length);
        var gridStyle = "grid-template-columns:repeat(" + n + ",minmax(4px,1fr))";
        var bars = list
          .map(function (r) {
            var v = Number(r.views || 0);
            var pct = Math.max(3, Math.round((v / maxV) * 100));
            return (
              "<div class='col' title='" +
              esc(r.dayUtc + " UTC — " + v + " view" + (v === 1 ? "" : "s")) +
              "'><div class='in' style='height:" +
              pct +
              "%'></div></div>"
            );
          })
          .join("");
        return (
          "<section class='admin-pv-section'>" +
          "<div class='admin-pv-head'><strong>/analytics</strong> visits <span class='admin-pv-note'>(UTC days, last " +
          list.length +
          ")</span></div>" +
          "<div class='chart-block'>" +
          chartAxisTicksAdmin(maxV, function (x) {
            return String(Math.round(Number(x)));
          }) +
          "<div class='chart-main'>" +
          "<div class='chart-cols' style='" +
          gridStyle +
          "'>" +
          bars +
          "</div>" +
          adminDayTicks(list) +
          "</div></div></section>"
        );
      }
      function fmtPageViewUtc(ms) {
        var d = new Date(Number(ms) || 0);
        return esc(d.toISOString().replace("T", " ").slice(0, 19) + " UTC");
      }
      function adminRecentViewsTable(rows) {
        if (!rows || !rows.length) {
          return (
            "<div class='admin-pv-recent'>" +
            "<strong>Recent visits</strong><span class='admin-pv-recent-hint'>newest first</span>" +
            "<p class='status' style='margin-top:0.35rem'>No rows in this window.</p>" +
            "</div>"
          );
        }
        var thead =
          "<thead><tr><th>Time</th><th>Wallet</th></tr></thead>";
        var body = rows
          .map(function (r) {
            var w = r.wallet != null && String(r.wallet) !== "" ? String(r.wallet) : "";
            var ident = r.identicon ? String(r.identicon) : "";
            var identBlock =
              ident !== ""
                ? "<div class='admin-pv-identline'><img class='ident' src='" +
                  esc(ident) +
                  "' alt='' width='24' height='24'/></div>"
                : "";
            var wCell = w
              ? "<div class='admin-pv-walletcell'>" +
                "<div class='admin-pv-walletline'><span class='mono'>" +
                esc(walletGrouped(w)) +
                "</span><span class='admin-pv-copy' role='button' tabindex='0' data-copy='" +
                esc(w) +
                "' title='Copy wallet address' aria-label='Copy wallet address'>Copy</span></div>" +
                identBlock +
                "</div>"
              : "<span class='admin-pv-anon'>—</span><span class='admin-pv-anon-hint'>not signed in, expired session, or wallet not on analytics allowlist</span>";
            return "<tr><td class='mono'>" + fmtPageViewUtc(r.t) + "</td><td>" + wCell + "</td></tr>";
          })
          .join("");
        return (
          "<div class='admin-pv-recent'>" +
          "<strong>Recent visits</strong><span class='admin-pv-recent-hint'>newest first · times UTC</span>" +
          "<div class='admin-pv-tablewrap'><table class='admin-pv-table'>" +
          thead +
          "<tbody>" +
          body +
          "</tbody></table></div></div>"
        );
      }
      async function fetchWallets() {
        var r = await fetch("/api/analytics/authorized-wallets", {
          headers: { authorization: "Bearer " + token },
        });
        if (r.status === 401) throw new Error("Session expired. Please login again.");
        if (r.status === 403) throw new Error("NS_WALLET_ACCESS_DENIED");
        if (!r.ok) throw new Error("Request failed (" + r.status + ").");
        var j = await r.json();
        wallets = Array.isArray(j.wallets) ? j.wallets.slice() : [];
        var pairs = await Promise.all(wallets.map(async function (w) {
          return [w, await fetchIdenticon(w)];
        }));
        identByWallet = {};
        pairs.forEach(function (p) { identByWallet[p[0]] = p[1] || ""; });
      }
      function render(msg, isErr) {
        panel.innerHTML =
          adminAnalyticsViewsChart(pageViewsByDay) +
          adminRecentViewsTable(pageViewsRecent) +
          "<div><strong>Authorized analytics wallets</strong></div>" +
          "<div class='status'>Signed in: <span class='mono'>" + esc(signed || "unknown") + "</span></div>" +
          "<div class='row'>" +
          "<input id='walletInput' placeholder='NQ.. wallet to authorize' />" +
          "<button id='addBtn'>Add wallet</button>" +
          "</div>" +
          "<div class='status" + (isErr ? " err" : "") + "'>" + esc(msg || "") + "</div>" +
          "<div class='list'>" +
          wallets.map(function (w) {
            var expanded = expandedWallet === w;
            return (
              "<div class='item'>" +
              "<div class='item-top'>" +
              "<button class='wallet-main' data-expand='" + esc(String(w)) + "'>" +
              (identByWallet[w] ? "<img class='ident' src='" + esc(String(identByWallet[w])) + "' alt='wallet'/>" : "") +
              "<span class='mono'>" + esc(expanded ? walletGrouped(String(w)) : walletShort(String(w))) + "</span>" +
              (expanded
                ? "<span class='wallet-copy-inline'><button class='wallet-copy' title='Copy wallet' aria-label='Copy wallet' data-copy='" + esc(String(w)) + "'>⧉</button></span>"
                : "") +
              "</button>" +
              "<button data-remove='" + esc(String(w)) + "'>Remove</button>" +
              "</div>" +
              "</div>"
            );
          }).join("") +
          "</div>";
        var input = document.getElementById("walletInput");
        var addBtn = document.getElementById("addBtn");
        if (input && addBtn) {
          addBtn.addEventListener("click", async function () {
            var wallet = normalizeWallet(input.value);
            if (!wallet) return;
            var addResp = await fetch("/api/analytics/authorized-wallets", {
              method: "POST",
              headers: {
                authorization: "Bearer " + token,
                "content-type": "application/json",
              },
              body: JSON.stringify({ wallet: wallet }),
            });
            if (!addResp.ok) {
              render("Failed to add wallet (" + addResp.status + ").", true);
              return;
            }
            var addJson = await addResp.json();
            wallets = Array.isArray(addJson.wallets) ? addJson.wallets.slice() : wallets;
            input.value = "";
            render("Wallet added.", false);
          });
        }
        panel.querySelectorAll("[data-remove]").forEach(function (btn) {
          btn.addEventListener("click", async function () {
            var wallet = String(btn.getAttribute("data-remove") || "");
            if (!wallet) return;
            var delResp = await fetch("/api/analytics/authorized-wallets", {
              method: "DELETE",
              headers: {
                authorization: "Bearer " + token,
                "content-type": "application/json",
              },
              body: JSON.stringify({ wallet: wallet }),
            });
            if (!delResp.ok) {
              render("Failed to remove wallet (" + delResp.status + ").", true);
              return;
            }
            var delJson = await delResp.json();
            wallets = Array.isArray(delJson.wallets) ? delJson.wallets.slice() : wallets;
            render("Wallet removed.", false);
          });
        });
        panel.querySelectorAll("[data-expand]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var wallet = String(btn.getAttribute("data-expand") || "");
            expandedWallet = expandedWallet === wallet ? "" : wallet;
            render(msg, isErr);
          });
        });
        panel.querySelectorAll("[data-copy]").forEach(function (el) {
          function copyWallet() {
            var wallet = String(el.getAttribute("data-copy") || "");
            if (!wallet) return;
            navigator.clipboard.writeText(wallet).catch(function () {});
          }
          el.addEventListener("click", function () {
            copyWallet();
          });
          el.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyWallet();
            }
          });
        });
      }
      var authStatus = await fetchAnalyticsAuthStatus(token);
      try {
        await Promise.all([
          fetchWallets(),
          (async function () {
            try {
              var pv = await fetch("/api/analytics/page-views?days=14&recent=150", {
                headers: { authorization: "Bearer " + token },
                cache: "no-store",
              });
              if (pv.ok) {
                var pvj = await pv.json();
                pageViewsByDay = Array.isArray(pvj.byDay) ? pvj.byDay.slice() : [];
                pageViewsRecent = Array.isArray(pvj.recent) ? pvj.recent.slice() : [];
              }
            } catch (e) {}
          })(),
        ]);
        if (signed) await renderAuthUser(signed, authStatus.analyticsAuthorized);
        render("", false);
      } catch (err) {
        var errMsg = String((err && err.message) || err);
        if (errMsg.indexOf("Session expired") !== -1) {
          if (signed) await renderAuthUser(signed, false);
          if (typeof window.__nsRefreshMainSiteNavFromSession === "function") {
            window.__nsRefreshMainSiteNavFromSession();
          }
          panel.innerHTML =
            "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
            "<div class='ms-auth-gate-msg'>Your session has expired. Use <strong>Sign in again</strong> above.</div>" +
            "</div>";
          return;
        }
        if (signed) await renderAuthUser(signed, authStatus.analyticsAuthorized);
        if (typeof window.__nsRefreshMainSiteNavFromSession === "function") {
          window.__nsRefreshMainSiteNavFromSession();
        }
        if (errMsg === "NS_WALLET_ACCESS_DENIED") {
          if (docTitle) docTitle.hidden = true;
          panel.innerHTML =
            "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
            "<div class='ms-auth-gate-msg'>" +
            esc("Access denied for this wallet.") +
            "</div></div>";
          return;
        }
        panel.innerHTML =
          "<div class='ms-auth-gate'>" +
          "<div class='ms-auth-gate-msg err'>" +
          esc(errMsg) +
          "</div></div>";
      }
    }
    load();
  </script>
</body>
</html>`;
}
