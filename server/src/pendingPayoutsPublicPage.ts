import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/**
 * `GET /payouts` — queue overview (main-site shell).
 * Data from `GET /api/nim/payouts` (summary without auth; wallet-scoped with JWT).
 */
export function pendingPayoutsPublicPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Payout queue — Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("payouts")}
  <h1 class="ms-doc-title">Payout queue <i class="ms-doc-title__updated ms-mono" id="payoutTitleUpdated" aria-live="polite"></i></h1>
  <p class="ms-status ms-mono ms-payout-queue-status" id="statusLine"></p>
  <div id="wrap"></div>
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
    function fmtTransactionCountsHtml(pending, today) {
      var p = Number(pending) || 0;
      var t = Number(today) || 0;
      return (
        "<strong>" +
        p +
        "</strong> pending transaction" +
        (p === 1 ? "" : "s") +
        ". <strong>" +
        t +
        "</strong> transaction" +
        (t === 1 ? "" : "s") +
        " today."
      );
    }
    function payoutIntroHtml(countsHtml, notePlain) {
      var noteBlock = notePlain
        ? "<p class='payout-queue-intro__note ms-mono'>" + esc(notePlain) + "</p>"
        : "";
      return (
        "<div class='payout-queue-intro'>" +
        "<p class='payout-queue-intro__counts ms-mono'>" +
        countsHtml +
        "</p>" +
        noteBlock +
        "</div>"
      );
    }
    function wrapPayoutSheet(introHtml, tablesHtml) {
      return "<div class='payout-queue-sheet'>" + introHtml + (tablesHtml || "") + "</div>";
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
        "<a class='ms-link-expl' rel='noopener noreferrer' target='_blank' href='https://nimiq.watch/#" +
        hex +
        "'>Watch</a> · <a class='ms-link-expl' rel='noopener noreferrer' target='_blank' href='https://www.nimiqhub.com/tx/" +
        hex +
        "'>Hub</a>"
      );
    }
    function walletIdShort(walletId) {
      var c = String(walletId || "")
        .replace(/\\s+/g, "")
        .toUpperCase();
      if (c.length <= 8) return c;
      return c.slice(0, 4) + c.slice(-4);
    }
    function walletCell(identicon, walletId) {
      var full = String(walletId || "");
      var img = identicon
        ? "<img class='ident' src='" + esc(identicon) + "' alt='' width='28' height='28'/>"
        : "";
      var short = esc(walletIdShort(full));
      var titleAttr = full ? " title='" + esc(full) + "'" : "";
      return (
        "<td class='mono'><span class='ms-wallet-row'>" +
        img +
        "<span" +
        titleAttr +
        ">" +
        short +
        "</span></span></td>"
      );
    }
    function tablePending(rows) {
      var html =
        "<h2 class='ms-section-title'>Pending</h2>" +
        "<table><thead><tr><th>Time (UTC)</th><th>Wallet</th><th class='amt'>NIM</th></tr></thead><tbody>";
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var t = esc(fmtUtcShort(row.time || ""));
        var a = esc(row.amountNim || "");
        html += "<tr><td class='mono'>" + t + "</td>" + walletCell(row.identicon, row.walletId) + "<td class='mono amt'>" + a + "</td></tr>";
      }
      return html + "</tbody></table>";
    }
    function tableHistory(rows) {
      var html =
        "<h2 class='ms-section-title'>Recent sent (last 5)</h2>" +
        "<table><thead><tr><th>Sent (UTC)</th><th>Wallet</th><th class='amt'>NIM</th><th>Tx</th></tr></thead><tbody>";
      for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var t = esc(fmtUtcShort(row.time || ""));
        var a = esc(row.amountNim || "");
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
    function toB64(u8) {
      var s = "";
      for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      return btoa(s);
    }
    var payoutSigningDotsTimer = null;
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
    function stopPayoutSigningDots() {
      if (payoutSigningDotsTimer) {
        clearInterval(payoutSigningDotsTimer);
        payoutSigningDotsTimer = null;
      }
    }
    function startPayoutSigningDotsIn(root) {
      stopPayoutSigningDots();
      var el = root.querySelector(".ms-signing-dots-live");
      if (!el) return;
      var states = [".", "..", "...", "."];
      var i = 0;
      el.textContent = states[0];
      payoutSigningDotsTimer = setInterval(function () {
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
    var mustSignInBodyHtml =
      "<div class='ms-auth-gate ms-auth-gate--standalone'><div class='ms-auth-gate-msg'>You must be signed in.</div></div>";
    function parseJwtSub(token) {
      try {
        var p = String(token || "").split(".")[1] || "";
        var json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
        var obj = JSON.parse(json);
        return String(obj.sub || "");
      } catch {
        return "";
      }
    }
    var authMenuDocBound = false;
    function walletNormPayout(a) {
      return String(a || "").replace(/\s+/g, "").toUpperCase();
    }
    var MAX_MAIN_SITE_ACCOUNTS = 5;
    async function populatePayoutAuthPicker(activeAddr) {
      var picker = document.getElementById("authAccountPicker");
      if (!picker || typeof window.__nsListMainSiteCachedAccounts !== "function") return;
      var rows = window.__nsListMainSiteCachedAccounts() || [];
      var activeN = walletNormPayout(activeAddr);
      var html = "";
      for (var ai = 0; ai < rows.length; ai++) {
        var row = rows[ai];
        var ident = await fetchIdenticon(row.address);
        var isAct = walletNormPayout(row.address) === activeN;
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
          esc(walletIdShort(row.address)) +
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
          if (!addr || walletNormPayout(addr) === activeN) {
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
          void runLogin();
        });
      }
    }
    function bindPayoutAuthAccountSwitcher(activeAddr) {
      var toggle = document.getElementById("authChangeAccountToggle");
      var picker = document.getElementById("authAccountPicker");
      if (!toggle || !picker) return;
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var opening = picker.style.display !== "block";
        picker.style.display = opening ? "block" : "none";
        if (opening) void populatePayoutAuthPicker(activeAddr);
      });
      void populatePayoutAuthPicker(activeAddr);
    }
    function bindAuthMenu() {
      var btn = document.getElementById("authUserBtn");
      var menu = document.getElementById("authUserMenu");
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
      var lo = document.getElementById("authUserLogout");
      if (lo) {
        lo.addEventListener("click", function () {
          clearAuthSession();
          location.reload();
        });
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
    async function renderAuthHeader() {
      var authUserEl = document.getElementById("authUser");
      if (!authUserEl) return;
      var token = readAuthToken();
      var signed = sessionStorage.getItem(AUTH_ADDR_KEY) || parseJwtSub(token);
      if (signed) sessionStorage.setItem(AUTH_ADDR_KEY, signed);
      if (!token || !signed) {
        authUserEl.style.display = "block";
        authUserEl.innerHTML =
          "<span id='authTopLogin' class='auth-user-signin' role='button' tabindex='0'>Sign In</span>";
        var loginEl = document.getElementById("authTopLogin");
        if (loginEl) {
          loginEl.addEventListener("click", function () {
            void runLogin();
          });
          loginEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void runLogin();
            }
          });
        }
        return;
      }
      var ident = await fetchIdenticon(signed);
      var sessionExpired =
        typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(token);
      authUserEl.style.display = "block";
      var alertSvg =
        "<svg class='nq-icon auth-user-session-alert' width='14' height='14' aria-hidden='true' focusable='false'><use href='/nimiq-style.icons.svg#nq-alert-circle'/></svg>";
      var identWrap = "";
      if (ident || sessionExpired) {
        identWrap =
          "<span class='auth-user-ident-wrap" +
          (ident ? "" : " auth-user-ident-wrap--solo") +
          "'>" +
          (ident ? "<img class='ident' src='" + esc(ident) + "' alt=''/>" : "") +
          (sessionExpired ? alertSvg : "") +
          "</span>";
      }
      var btnTitle = sessionExpired
        ? "Session expired — sign in again (" + esc(signed) + ")"
        : "Signed in as " + esc(signed);
      var acctSection =
        "<div class='auth-user-menu-section'><button type='button' id='authChangeAccountToggle' class='auth-user-menu-row'>Change account</button><div id='authAccountPicker' class='auth-user-submenu' style='display:none' role='group' aria-label='Choose wallet'></div></div>";
      var nav =
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
        esc(walletIdShort(signed)) +
        "</span></button>" +
        "<div id='authUserMenu' class='auth-user-menu'>" +
        nav +
        "</div>";
      var rs = document.getElementById("authRefreshSession");
      if (rs) {
        rs.addEventListener("click", function () {
          var menuEl = document.getElementById("authUserMenu");
          if (menuEl) menuEl.style.display = "none";
          void runLogin();
        });
      }
      bindPayoutAuthAccountSwitcher(signed);
      bindAuthMenu();
    }
    async function runLogin() {
      var statusLine = document.getElementById("statusLine");
      var wrap = document.getElementById("wrap");
      if (statusLine) statusLine.textContent = "";
      if (wrap) {
        wrap.innerHTML = wrapPayoutSheet("", walletSigningMarkup());
        startPayoutSigningDotsIn(wrap);
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
        var signed = await hub.signMessage({ appName: "Nimiq Space payouts", message: message });
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
        if (!token) throw new Error("missing_token");
        var addr = String(verified.address || signed.signer || "");
        if (addr) sessionStorage.setItem(AUTH_ADDR_KEY, addr);
        writeAuthToken(token);
        stopPayoutSigningDots();
        location.reload();
      } catch (e) {
        stopPayoutSigningDots();
        if (isSigningUserCancelledError(e)) {
          if (wrap) wrap.innerHTML = wrapPayoutSheet("", mustSignInBodyHtml);
          if (statusLine) statusLine.textContent = "";
        } else {
          if (wrap) wrap.innerHTML = "";
          if (statusLine) {
            statusLine.innerHTML =
              "<span class='ms-err'>" + esc(String((e && e.message) || e)) + "</span>";
          }
        }
      }
    }
    async function load() {
      var statusLine = document.getElementById("statusLine");
      var wrap = document.getElementById("wrap");
      var token = readAuthToken();
      var headers = {};
      if (token) headers["authorization"] = "Bearer " + token;
      try {
        var r = await fetch("/api/nim/payouts", { cache: "no-store", headers: headers });
        if (r.status === 401) {
          clearAuthSession();
          location.reload();
          return;
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        var data = await r.json();
        var titleUpd = document.getElementById("payoutTitleUpdated");
        if (titleUpd) titleUpd.textContent = fmtUtcShort(new Date().toISOString()) + " UTC";
        if (statusLine) statusLine.textContent = "";
        if (data.mode === "summary") {
          var pend = Number(data.pendingTotal || 0);
          var done = Number(data.processedToday || 0);
          var countsPub = fmtTransactionCountsHtml(pend, done);
          var notePub = "";
          if (data.allSent) notePub = data.message || "No pending transactions.";
          else if (pend === 0) notePub = "No pending transactions.";
          if (wrap) {
            wrap.innerHTML = wrapPayoutSheet(payoutIntroHtml(countsPub, notePub), "");
          }
          return;
        }
        var p2 = Number(data.pendingTotal || 0);
        var d2 = Number(data.processedToday || 0);
        var countsWallet = fmtTransactionCountsHtml(p2, d2);
        var rows = data.rows || [];
        var historyRows = data.historyRows || [];
        var body = "";
        if (rows.length) body += tablePending(rows);
        if (historyRows.length) body += tableHistory(historyRows);
        var noteWallet = "";
        if (!body) {
          if (data.allSent && !historyRows.length) {
            noteWallet = "Nothing queued · no recent sends in log.";
          } else {
            noteWallet = "No pending or recent sends for this wallet.";
          }
        }
        if (wrap) {
          wrap.innerHTML = wrapPayoutSheet(payoutIntroHtml(countsWallet, noteWallet), body);
        }
      } catch (e) {
        if (statusLine) {
          statusLine.innerHTML =
            '<span class="ms-err">Failed: ' + esc(String((e && e.message) || e)) + "</span>";
        }
      }
    }
    void renderAuthHeader();
    load();
    setInterval(load, 15000);
  </script>
</body>
</html>`;
}
