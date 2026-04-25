import { analyticsTopbarCss, analyticsTopbarHtml } from "./analyticsTopbar.js";

export function analyticsPublicPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Game analytics</title>
  <style>
    :root { font-family: system-ui, sans-serif; background: #0f1419; color: #e6edf3; }
    body { max-width: 1120px; margin: 2rem auto; padding: 0; }
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
    .chart-cols { display: grid; grid-template-columns: repeat(24, minmax(10px, 1fr)); gap: 0.25rem; align-items: end; height: 160px; margin-bottom: 0.4rem; }
    .col { height: 100%; background: #202a3a; border-radius: 4px 4px 0 0; position: relative; cursor: pointer; }
    .col .in { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #5aa0ff, #7dd3fc); border-radius: 4px 4px 0 0; transition: height 260ms ease; }
    .col .out { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #a855f7, #f472b6); opacity: 0.92; border-radius: 4px 4px 0 0; transition: height 260ms ease; }
    .ticks { display: grid; grid-template-columns: repeat(12, 1fr); gap: 0.3rem; color: #8092aa; font-size: 0.72rem; }
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
    .auth-gate button { background: #2b5ea7; color: #eef6ff; border: 1px solid #4d83d0; border-radius: 6px; padding: 0.42rem 0.72rem; cursor: pointer; }
    @media (max-width: 720px) {
      body { padding: 0 0.7rem; margin-top: 1.1rem; margin-bottom: 1.1rem; }
      .grid { grid-template-columns: 1fr; gap: 0.8rem; }
      .panel { padding: 0.7rem; }
    }
  </style>
</head>
<body>
  ${analyticsTopbarHtml()}
  <p id="status" class="status mono">Loading...</p>
  <div id="authGate" class="auth-gate mono" style="display:none"></div>
  <div id="focusUser" class="focus-user"></div>
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
      <div id="visitorsHover" class="hover-card mono">Hover a bar to inspect unique visitors for that hour.</div>
      <div id="visitorsPinned" class="mono users-list" style="margin-top:0.6rem"></div>
    </section>
    <section class="panel">
      <h2>Recent NIM payouts sent</h2>
      <div id="payoutsRecentChart"></div>
      <div id="payoutsRecentHover" class="hover-card mono">Hover a bar to inspect recent payouts in that hour.</div>
      <div id="payoutsRecentPinned" class="mono" style="margin-top:0.6rem"></div>
    </section>
    <section class="panel">
      <h2>Daily totals</h2>
      <div id="daily" class="mono"></div>
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
    function tweenChartBars(root) {
      if (!root) return;
      requestAnimationFrame(function () {
        root.querySelectorAll(".in, .out").forEach(function (el) {
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
    async function load() {
      var AUTH_KEY = "nspace_analytics_auth_token";
      var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
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
      async function renderAuthUser(address, canManageWallets) {
        if (!authUserEl || !address) return;
        authUserEl.style.display = "block";
        var ident = await fetchIdenticon(address);
        authUserEl.innerHTML =
          "<button id='authUserBtn' class='auth-user-btn' title='Signed in as " + esc(address) + "'>" +
          (ident ? "<img class='ident' src='" + esc(ident) + "' alt='wallet'/>" : "") +
          "<span class='mono'>" + esc(walletShort(address)) + "</span>" +
          "</button>" +
          "<div id='authUserMenu' class='auth-user-menu'>" +
          (canManageWallets ? "<button id='authUserAdmin'>Admin</button>" : "") +
          "<button id='authUserLogout'>Logout</button>" +
          "</div>";
        var btn = document.getElementById("authUserBtn");
        var menu = document.getElementById("authUserMenu");
        var admin = document.getElementById("authUserAdmin");
        var logout = document.getElementById("authUserLogout");
        if (btn && menu) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            menu.style.display = menu.style.display === "block" ? "none" : "block";
          });
          if (!authMenuDocBound) {
            document.addEventListener("click", function () {
              var m = document.getElementById("authUserMenu");
              if (m) m.style.display = "none";
            });
            authMenuDocBound = true;
          }
        }
        if (admin) {
          admin.addEventListener("click", function () {
            if (menu) menu.style.display = "none";
            window.location.href = "/admin";
          });
        }
        if (logout) {
          logout.addEventListener("click", function () {
            sessionStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(AUTH_ADDR_KEY);
            window.location.reload();
          });
        }
      }
      function showAuthGate(msg, withButton) {
        if (!authGateEl) return;
        authGateEl.style.display = "block";
        setAuthedVisible(false);
        authGateEl.innerHTML =
          "<div>" + esc(msg) + "</div>" +
          (withButton
            ? "<div style='margin-top:0.55rem'><button id='btnAnalyticsLogin'>Click to login</button></div>"
            : "");
        if (withButton) {
          var btn = document.getElementById("btnAnalyticsLogin");
          if (btn) {
            btn.addEventListener("click", function () {
              void runAnalyticsLogin();
            });
          }
        }
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
          if (authGateEl) authGateEl.innerHTML = "<div>Waiting for wallet signature...</div>";
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
          sessionStorage.setItem(AUTH_KEY, token);
          if (address) sessionStorage.setItem(AUTH_ADDR_KEY, address);
          window.location.reload();
        } catch (e) {
          showAuthGate(
            "Login failed: " + String(e && e.message ? e.message : e),
            true
          );
        }
      }

      var token = sessionStorage.getItem(AUTH_KEY) || "";
      var params = new URLSearchParams(location.search);
      var signedAddress = sessionStorage.getItem(AUTH_ADDR_KEY) || parseJwtSub(token);
      if (signedAddress) {
        sessionStorage.setItem(AUTH_ADDR_KEY, signedAddress);
        await renderAuthUser(signedAddress, false);
      } else if (authUserEl) {
        authUserEl.style.display = "none";
      }
      if (!token) {
        showAuthGate("Login required to view analytics.", true);
        document.getElementById("status").textContent =
          "Please sign in with the authorized wallet.";
        return;
      }
      var canManage = await canManageWallets(token);
      if (signedAddress) await renderAuthUser(signedAddress, canManage);

      var days = Number(params.get("days") || "7");
      var sessions = Number(params.get("sessions") || "300");
      var payouts = Number(params.get("payouts") || "300");
      var url = "/api/analytics/overview?days=" + encodeURIComponent(String(days)) +
        "&sessions=" + encodeURIComponent(String(sessions)) +
        "&payouts=" + encodeURIComponent(String(payouts));
      var resp = await fetch(url, {
        headers: { authorization: "Bearer " + token },
      });
      if (!resp.ok) {
        if (resp.status === 403) {
          showAuthGate("Access denied for this wallet.", false);
          document.getElementById("status").innerHTML = "";
          return;
        }
        if (resp.status === 401) {
          sessionStorage.removeItem(AUTH_KEY);
          showAuthGate("Session expired. Click to login again.", true);
          document.getElementById("status").innerHTML =
            "<span class='err'>Session expired.</span>";
          return;
        }
        document.getElementById("status").innerHTML = "<span class='err'>Request failed (" + resp.status + ").</span>";
        return;
      }
      if (authGateEl) authGateEl.style.display = "none";
      setAuthedVisible(true);
      var data = await resp.json();
      document.getElementById("status").textContent =
        "Generated " + fmtUtc(data.generatedAt) + " · last " + data.maxDays + " days";

      var maxStarts = 1;
      var maxEnds = 1;
      for (var i = 0; i < data.loginByHourUtc.length; i++) {
        maxStarts = Math.max(maxStarts, Number(data.loginByHourUtc[i].starts || 0));
        maxEnds = Math.max(maxEnds, Number(data.loginByHourUtc[i].ends || 0));
      }
      var maxPayout = 1;
      for (var j = 0; j < (data.payoutByHourUtc || []).length; j++) {
        maxPayout = Math.max(maxPayout, Number(String(data.payoutByHourUtc[j].totalNim || "0").replace(/,/g, "")));
      }
      var selectedPayoutHour = null;
      var selectedLoginHour = null;
      var selectedRecentPayoutHour = null;
      var selectedSessionHour = null;
      var selectedVisitorHour = null;
      var focusedWallet = null;
      var expandedUserByHour = {};
      var identByWallet = {};
      (data.visitors || []).forEach(function (v) { identByWallet[v.walletId] = v.identicon; });
      (data.payoutByHourUtc || []).forEach(function (h) {
        (h.users || []).forEach(function (u) {
          if (!identByWallet[u.walletId]) identByWallet[u.walletId] = u.identicon;
        });
      });
      (data.loginByHourUtc || []).forEach(function (h) {
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

      function loginRowForHour(hour) {
        var row = (data.loginByHourUtc || [])[hour];
        if (!row) return { starts: 0, ends: 0, firstStarts: 0, uniquePlayers: 0, startUsers: [], endUsers: [], firstStartUsers: [] };
        if (!focusedWallet) return row;
        var su = (row.startUsers || []).filter(function (u) { return u.walletId === focusedWallet; });
        var eu = (row.endUsers || []).filter(function (u) { return u.walletId === focusedWallet; });
        var fu = (row.firstStartUsers || []).filter(function (u) { return u.walletId === focusedWallet; });
        var starts = su.reduce(function (a, b) { return a + Number(b.count || 0); }, 0);
        var ends = eu.reduce(function (a, b) { return a + Number(b.count || 0); }, 0);
        var firstStarts = fu.reduce(function (a, b) { return a + Number(b.count || 0); }, 0);
        return {
          hourUtc: row.hourUtc,
          starts: starts,
          ends: ends,
          firstStarts: firstStarts,
          uniquePlayers: starts + ends > 0 ? 1 : 0,
          startUsers: su,
          endUsers: eu,
          firstStartUsers: fu,
        };
      }

      function renderLogin() {
        var loginsEl = document.getElementById("logins");
        var loginHoverEl = document.getElementById("loginHover");
        if (!loginsEl || !loginHoverEl) return;
        var loginRows = (data.loginByHourUtc || []).map(function (_r, hour) { return loginRowForHour(hour); });
        var localMaxStarts = 1;
        var localMaxEnds = 1;
        loginRows.forEach(function (r) {
          localMaxStarts = Math.max(localMaxStarts, Number(r.starts || 0));
          localMaxEnds = Math.max(localMaxEnds, Number(r.ends || 0));
        });
        loginsEl.innerHTML = "<div class='chart-cols'>" + loginRows.map(function (row) {
          var inH = Math.max(3, Math.round((Number(row.starts || 0) / Math.max(localMaxStarts, localMaxEnds)) * 100));
          var outH = Math.max(3, Math.round((Number(row.ends || 0) / Math.max(localMaxStarts, localMaxEnds)) * 100));
          return "<div class='col" + (selectedLoginHour === row.hourUtc ? " sel-row" : "") + "' data-hour='" + row.hourUtc + "' title='" + String(row.hourUtc).padStart(2, "0") + " UTC'><div class='in' style='height:3%' data-target='" + inH + "%'></div><div class='out' style='height:3%' data-target='" + outH + "%'></div></div>";
        }).join("") + "</div><div class='ticks'>" + ["00","02","04","06","08","10","12","14","16","18","20","22"].map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div>";
        loginsEl.innerHTML += "<div class='hintline'>Click an hour to pin it. " + (selectedLoginHour === null ? "" : "Pinned " + String(selectedLoginHour).padStart(2, "0") + ":00 UTC.") + " First-time logins in range: " + (focusedWallet ? "0" : (data.firstTimeLogins || 0)) + ".</div>";
        tweenChartBars(loginsEl);
        loginsEl.querySelectorAll("[data-hour]").forEach(function (el) {
          function showHour() {
            var hour = Number(el.getAttribute("data-hour") || "-1");
            var row = loginRowForHour(hour);
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
              .sort(function (a, b) { return (b.inCount + b.outCount) - (a.inCount + a.outCount); })
              .slice(0, 10)
              .map(function (u) {
                return "<div class='user-row'>" + walletChip(u.identicon, u.walletId) + "<span>" + esc(walletShort(u.walletId)) + "</span><span>" + u.inCount + "/" + u.outCount + "</span></div>";
              })
              .join("");
            var firsts = (row.firstStartUsers || []).slice(0, 20).map(function (u) {
              return walletChip(u.identicon, u.walletId);
            }).join("");
            loginHoverEl.innerHTML = "<div><strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong> · " + row.starts + " in " + row.ends + " out · " + row.uniquePlayers + " unique · " + (row.firstStarts || 0) + " first-time</div><div style='margin-top:0.35rem'>" + (grouped || "<div>No login/logout events</div>") + (firsts ? "<div class='hintline'>First-time logins this hour</div><div style='display:flex;flex-wrap:wrap;gap:0.35rem'>" + firsts + "</div>" : "") + "</div>";
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
          el.innerHTML = "<div class='hintline'>Click an hour above to pin it and inspect users.</div>";
          return;
        }
        var row = (data.payoutByHourUtc || [])[selectedPayoutHour];
        if (!row) {
          el.innerHTML = "<div class='hintline'>No payout data for selected hour.</div>";
          return;
        }
        var users = (row.users || []).filter(function (u) { return walletMatch(u.walletId); });
        var html = "<div style='margin-bottom:0.4rem'><strong>" + String(selectedPayoutHour).padStart(2, "0") + ":00 UTC</strong> · " + esc(row.totalNim) + " NIM · " + row.payouts + " payouts</div>";
        html += "<table><thead><tr><th>User</th><th class='right'>Payouts</th><th class='right'>Total NIM</th></tr></thead><tbody>";
        users.forEach(function (u) {
          html += "<tr><td>" + walletChip(u.identicon, u.walletId) + "</td><td class='right'>" + u.payouts + "</td><td class='right clickable-nim' data-hour-expand='" + selectedPayoutHour + "' data-wallet-expand='" + esc(u.walletId) + "'>" + esc(u.totalNim) + "</td></tr>";
          var key = selectedPayoutHour + "::" + u.walletId;
          if (expandedUserByHour[key]) {
            var rows = (data.nimPayouts || []).filter(function (p) {
              return Number(new Date(p.sentAt).getUTCHours()) === selectedPayoutHour && p.recipient === u.walletId && walletMatch(p.recipient);
            });
            html += "<tr><td colspan='3'><table><thead><tr><th>When</th><th class='right'>NIM</th></tr></thead><tbody>";
            rows.forEach(function (p) {
              html += "<tr><td>" + esc(fmtMdHm(p.sentAt)) + "</td><td class='right'>" + esc(p.amountNim || "—") + "</td></tr>";
            });
            html += "</tbody></table></td></tr>";
          }
        });
        html += "</tbody></table><div class='hintline'>Click a NIM total to expand/collapse that user's history for this hour.</div>";
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
        var payoutRows = (data.payoutByHourUtc || []).map(function (row) {
          if (!focusedWallet) return row;
          var u = (row.users || []).find(function (x) { return x.walletId === focusedWallet; });
          return {
            hourUtc: row.hourUtc,
            payouts: u ? u.payouts : 0,
            totalNim: u ? u.totalNim : "0.00000",
            users: u ? [u] : [],
          };
        });
        var localMaxPayout = 1;
        payoutRows.forEach(function (r) {
          localMaxPayout = Math.max(localMaxPayout, Number(String(r.totalNim || "0").replace(/,/g, "")));
        });
        payoutHoursEl.innerHTML = "<div class='chart-cols'>" + payoutRows.map(function (row) {
          var n = Number(String(row.totalNim || "0").replace(/,/g, ""));
          var h = Math.max(3, Math.round((n / localMaxPayout) * 100));
          return "<div class='col" + (selectedPayoutHour === row.hourUtc ? " sel-row" : "") + "' data-hour='" + row.hourUtc + "' title='" + String(row.hourUtc).padStart(2, "0") + " UTC'><div class='in' style='height:3%' data-target='" + h + "%'></div></div>";
        }).join("") + "</div><div class='ticks'>" + ["00","02","04","06","08","10","12","14","16","18","20","22"].map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div>";
        tweenChartBars(payoutHoursEl);
        payoutHoursEl.querySelectorAll("[data-hour]").forEach(function (el) {
          el.addEventListener("mouseenter", function () {
            var hour = Number(el.getAttribute("data-hour") || "-1");
            var row = payoutRows[hour];
            if (!row) return;
            var users = (row.users || []).slice(0, 10).map(function (u) {
              return "<div class='user-row'>" + walletChip(u.identicon, u.walletId) + "<span>" + esc(walletShort(u.walletId)) + "</span><span>" + esc(u.totalNim) + " NIM</span></div>";
            }).join("");
            payoutHoverEl.innerHTML = "<div><strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong> · " + esc(row.totalNim) + " NIM · " + row.payouts + " payouts</div><div style='margin-top:0.35rem'>" + (users || "<div>No payouts</div>") + "</div>";
            attachCopyHandlers(payoutHoverEl);
          });
          el.addEventListener("click", function () {
            var hour = Number(el.getAttribute("data-hour") || "-1");
            selectedPayoutHour = hour;
            payoutHoursEl.querySelectorAll("[data-hour]").forEach(function (x) { x.classList.remove("sel-row"); });
            el.classList.add("sel-row");
            renderPayoutHourUsers();
          });
        });
        attachCopyHandlers(payoutHoursEl);
      }

      var recentPayoutByHour = Array.from({ length: 24 }, function () {
        return { count: 0, totalNim: 0, rows: [], users: {} };
      });
      (data.nimPayouts || []).filter(function (p) { return walletMatch(p.recipient); }).forEach(function (p) {
        var h = Number(new Date(p.sentAt).getUTCHours());
        if (!(h >= 0 && h < 24)) return;
        var n = Number(p.amountNim || 0);
        var b = recentPayoutByHour[h];
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
          el.innerHTML = "<div class='hintline'>Click an hour to pin recent payouts for that hour.</div>";
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
        var html = "<div style='margin-bottom:0.4rem'><strong>" + String(selectedRecentPayoutHour).padStart(2, "0") + ":00 UTC</strong> · " + b.totalNim.toFixed(5) + " NIM · " + b.count + " payouts</div>";
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
        chartEl.innerHTML = "<div class='chart-cols'>" + recentPayoutByHour.map(function (b, hour) {
          var h = Math.max(3, Math.round((b.totalNim / maxRecentPayoutNim) * 100));
          return "<div class='col" + (selectedRecentPayoutHour === hour ? " sel-row" : "") + "' data-rphour='" + hour + "' title='" + String(hour).padStart(2, "0") + " UTC'><div class='in' style='height:3%' data-target='" + h + "%'></div></div>";
        }).join("") + "</div><div class='ticks'>" + ["00","02","04","06","08","10","12","14","16","18","20","22"].map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div>";
        tweenChartBars(chartEl);
        chartEl.querySelectorAll("[data-rphour]").forEach(function (el) {
          function show() {
            var hour = Number(el.getAttribute("data-rphour") || "-1");
            var b = recentPayoutByHour[hour];
            if (!b) return;
            hoverEl.innerHTML = "<div><strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong> · " + b.totalNim.toFixed(5) + " NIM · " + b.count + " payouts</div>";
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

      var sessionByHour = Array.from({ length: 24 }, function () {
        return { totalMs: 0, rows: [], users: {} };
      });
      (data.sessions || []).filter(function (s) { return walletMatch(s.address); }).forEach(function (s) {
        var h = Number(new Date(s.startedAt).getUTCHours());
        if (!(h >= 0 && h < 24)) return;
        var d = Number(s.durationMs || 0);
        var b = sessionByHour[h];
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
          el.innerHTML = "<div class='hintline'>Click an hour to pin session duration details.</div>";
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
        var html = "<div style='margin-bottom:0.4rem'><strong>" + String(selectedSessionHour).padStart(2, "0") + ":00 UTC</strong> · " + fmtMs(b.totalMs) + " total · " + b.rows.length + " sessions</div>";
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
        chartEl.innerHTML = "<div class='chart-cols'>" + sessionByHour.map(function (b, hour) {
          var h = Math.max(3, Math.round((b.totalMs / maxSessionMs) * 100));
          return "<div class='col" + (selectedSessionHour === hour ? " sel-row" : "") + "' data-shour='" + hour + "' title='" + String(hour).padStart(2, "0") + " UTC'><div class='in' style='height:3%' data-target='" + h + "%'></div></div>";
        }).join("") + "</div><div class='ticks'>" + ["00","02","04","06","08","10","12","14","16","18","20","22"].map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div>";
        tweenChartBars(chartEl);
        chartEl.querySelectorAll("[data-shour]").forEach(function (el) {
          function show() {
            var hour = Number(el.getAttribute("data-shour") || "-1");
            var b = sessionByHour[hour];
            if (!b) return;
            hoverEl.innerHTML = "<div><strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong> · " + fmtMs(b.totalMs) + " total duration · " + b.rows.length + " sessions</div>";
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

      var visitorsByHour = Array.from({ length: 24 }, function () {
        return { unique: 0, inCount: 0, outCount: 0, users: {} };
      });
      (data.loginByHourUtc || []).forEach(function (row) {
        var h = Number(row.hourUtc);
        if (!(h >= 0 && h < 24)) return;
        var b = visitorsByHour[h];
        b.inCount = Number(row.starts || 0);
        b.outCount = Number(row.ends || 0);
        var startMap = {};
        (row.startUsers || []).forEach(function (u) {
          startMap[u.walletId] = Number(u.count || 0);
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
      });
      var maxVisitorUnique = 1;
      visitorsByHour.forEach(function (b) {
        maxVisitorUnique = Math.max(maxVisitorUnique, b.unique);
      });

      function renderVisitorsPinned() {
        var el = document.getElementById("visitorsPinned");
        if (!el) return;
        if (selectedVisitorHour === null) {
          el.innerHTML = "<div class='hintline'>Click an hour to pin unique visitors for that hour.</div>";
          return;
        }
        var b = visitorsByHour[selectedVisitorHour];
        if (!b) {
          el.innerHTML = "<div class='hintline'>No visitor data for selected hour.</div>";
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
        var firstStarts = Number(((data.loginByHourUtc || [])[selectedVisitorHour] || {}).firstStarts || 0);
        var html = "<div style='margin-bottom:0.4rem'><strong>" + String(selectedVisitorHour).padStart(2, "0") + ":00 UTC</strong> · " + b.unique + " unique · " + b.inCount + "/" + b.outCount + " · " + firstStarts + " first-time</div>";
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
        chartEl.innerHTML = "<div class='chart-cols'>" + visitorsByHour.map(function (b, hour) {
          var h = Math.max(3, Math.round((b.unique / maxVisitorUnique) * 100));
          return "<div class='col" + (selectedVisitorHour === hour ? " sel-row" : "") + "' data-vhour='" + hour + "' title='" + String(hour).padStart(2, "0") + " UTC'><div class='in' style='height:3%' data-target='" + h + "%'></div></div>";
        }).join("") + "</div><div class='ticks'>" + ["00","02","04","06","08","10","12","14","16","18","20","22"].map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div>";
        tweenChartBars(chartEl);
        chartEl.querySelectorAll("[data-vhour]").forEach(function (el) {
          function show() {
            var hour = Number(el.getAttribute("data-vhour") || "-1");
            var b = visitorsByHour[hour];
            if (!b) return;
            var row = (data.loginByHourUtc || [])[hour] || {};
            hoverEl.innerHTML = "<div><strong>" + String(hour).padStart(2, "0") + ":00 UTC</strong> · " + b.unique + " unique visitors · " + b.inCount + "/" + b.outCount + " · " + Number(row.firstStarts || 0) + " first-time</div>";
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

      var dailyHtml = "<table><thead><tr><th>Day</th><th class='right'>Players</th><th class='right'>Logins</th><th class='right'>Claims</th><th class='right'>Payouts</th><th class='right'>NIM sent</th></tr></thead><tbody>" +
        data.daily.slice(0, 30).map(function (d) {
          var nim = Number(d.payoutLunaTotal || 0) / 100000;
          return "<tr><td>" + esc(d.dayUtc) + "</td><td class='right'>" + d.activePlayers + "</td><td class='right'>" + d.sessionStarts + "</td><td class='right'>" + d.claimBlocks + "</td><td class='right'>" + d.payoutsSent + "</td><td class='right'>" + nim.toFixed(5) + "</td></tr>";
        }).join("") +
        "</tbody></table>";
      document.getElementById("daily").innerHTML = dailyHtml;

    }
    load().catch(function (err) {
      document.getElementById("status").innerHTML = "<span class='err'>" + esc(err && err.message ? err.message : String(err)) + "</span>";
    });
  </script>
</body>
</html>`;
}
