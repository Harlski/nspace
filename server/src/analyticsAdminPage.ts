import { analyticsTopbarCss, analyticsTopbarHtml } from "./analyticsTopbar.js";

export function analyticsAdminPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Admin</title>
  <style>
    :root { font-family: system-ui, sans-serif; background: #0f1419; color: #e6edf3; }
    body { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    ${analyticsTopbarCss()}
    h1 { margin: 0 0 0.6rem 0; font-size: clamp(24px, 5vw, 34px); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84rem; }
    .panel { margin-top: 0.75rem; padding: 0.85rem; border-radius: 8px; border: 1px solid #2a394f; background: #131b27; }
    .row { display: flex; gap: 0.45rem; flex-wrap: wrap; align-items: center; margin-top: 0.6rem; }
    input { flex: 1 1 420px; min-width: 220px; background: #0f1622; color: #dbe6f4; border: 1px solid #2c3b52; border-radius: 6px; padding: 0.45rem 0.55rem; }
    button { background: #2b5ea7; color: #eef6ff; border: 1px solid #4d83d0; border-radius: 6px; padding: 0.4rem 0.7rem; cursor: pointer; }
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
  </style>
</head>
<body>
  ${analyticsTopbarHtml()}
  <h1>Admin</h1>
  <div id="panel" class="panel mono">Loading...</div>
  <script>
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
    async function renderAuthUser(address, canManageWallets) {
      var authUserEl = document.getElementById("authUser");
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
        "<button id='authUserAnalytics'>Analytics</button>" +
        "<button id='authUserLogout'>Logout</button>" +
        "</div>";
      var btn = document.getElementById("authUserBtn");
      var menu = document.getElementById("authUserMenu");
      var admin = document.getElementById("authUserAdmin");
      var analytics = document.getElementById("authUserAnalytics");
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
      if (analytics) {
        analytics.addEventListener("click", function () {
          if (menu) menu.style.display = "none";
          window.location.href = "/analytics";
        });
      }
      if (logout) {
        logout.addEventListener("click", function () {
          sessionStorage.removeItem("nspace_analytics_auth_token");
          sessionStorage.removeItem("nspace_analytics_auth_addr");
          window.location.href = "/analytics";
        });
      }
    }
    async function load() {
      var panel = document.getElementById("panel");
      if (!panel) return;
      var token = sessionStorage.getItem("nspace_analytics_auth_token") || "";
      var signed = sessionStorage.getItem("nspace_analytics_auth_addr") || "";
      if (!signed) signed = parseJwtSub(token);
      if (signed) sessionStorage.setItem("nspace_analytics_auth_addr", signed);
      if (!token) {
        var authUserEl = document.getElementById("authUser");
        if (authUserEl) authUserEl.style.display = "none";
        panel.innerHTML = "<span class='err'>Login required. Open <a href='/analytics'>/analytics</a> and sign in first.</span>";
        return;
      }
      var wallets = [];
      var expandedWallet = "";
      var identByWallet = {};
      async function fetchWallets() {
        var r = await fetch("/api/analytics/authorized-wallets", {
          headers: { authorization: "Bearer " + token },
        });
        if (r.status === 401) throw new Error("Session expired. Please login again.");
        if (r.status === 403) throw new Error("This wallet does not have admin permissions.");
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
        panel.querySelectorAll("[data-copy]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var wallet = String(btn.getAttribute("data-copy") || "");
            if (!wallet) return;
            navigator.clipboard.writeText(wallet).catch(function () {});
          });
        });
      }
      try {
        await fetchWallets();
        if (signed) await renderAuthUser(signed, true);
        render("", false);
      } catch (err) {
        if (signed) await renderAuthUser(signed, false);
        panel.innerHTML = "<span class='err'>" + esc(err && err.message ? err.message : String(err)) + "</span>";
      }
    }
    load();
  </script>
</body>
</html>`;
}
