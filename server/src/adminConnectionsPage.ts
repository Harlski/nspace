import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";
import { SIGNED_IN_REQUIRED_MESSAGE } from "./signedInRequired.js";

/** HTML shell for `/admin/connections` (read/write via `GET`/`PUT /api/admin/connections`). */
export function adminConnectionsPageHtml(): string {
  const gateMsg = SIGNED_IN_REQUIRED_MESSAGE.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Connections - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .set-panel { max-width: 36rem; margin: 0.75rem 0 1.25rem; padding: 0.85rem 1rem; border: 1px solid #263348; border-radius: 10px; background: #0f1622; }
    .set-panel h2 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #c8d4e4; font-weight: 600; }
    .set-actions { margin-top: 0.75rem; display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
    .set-actions button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.4rem 0.75rem; cursor: pointer; font: inherit; font-size: 0.82rem;
    }
    .set-hint { font-size: 0.76rem; color: #6b7d95; margin: 0.35rem 0 0; line-height: 1.45; }
    .set-text {
      width: 100%; box-sizing: border-box; min-height: 3.2rem; resize: vertical;
      background: #0a1018; color: #d8e2f0; border: 1px solid #263348; border-radius: 6px;
      padding: 0.45rem 0.55rem; font: inherit; font-size: 0.82rem; line-height: 1.45;
    }
    .set-readonly {
      font-size: 0.82rem; color: #d8e2f0; word-break: break-word;
      padding: 0.45rem 0.55rem; border: 1px solid #263348; border-radius: 6px; background: #0a1018;
    }
    .err { color: #f87171; font-size: 0.82rem; }
    .ok { color: #86efac; font-size: 0.78rem; }
    #panel.ms-panel { max-width: 48rem; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("connections")}
  <h1 class="ms-doc-title">Connections</h1>
  <div id="panel" class="ms-panel mono">Loading…</div>
  <script>
    var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
    var SIGNED_IN_REQUIRED = '${gateMsg}';
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
    function escHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    }
    function authGateHtml() {
      return (
        "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
        "<div class='ms-auth-gate-msg'>" + escHtml(SIGNED_IN_REQUIRED) + "</div>" +
        "</div>" +
        "<p class='set-hint'>Open <a href='/admin'>Admin</a>, sign in, then return here.</p>"
      );
    }
    async function load() {
      var panel = document.getElementById("panel");
      if (!panel) return;
      var token = readAuthToken();
      if (!token) {
        panel.innerHTML = authGateHtml();
        return;
      }
      try {
        var r = await fetch("/api/admin/connections", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (r.status === 401) {
          panel.innerHTML = authGateHtml();
          return;
        }
        if (r.status === 403) {
          panel.innerHTML =
            "<p class='err'>Forbidden</p><p class='set-hint'>Server admin wallet only.</p>";
          return;
        }
        if (!r.ok) {
          panel.innerHTML = "<p class='err'>Failed to load (" + r.status + ").</p>";
          return;
        }
        var j = await r.json();
        render(panel, token, j);
      } catch (e) {
        panel.innerHTML = "<p class='err'>Network error</p>";
      }
    }
    function render(panel, token, j) {
      var addrs = String(j.residentAddresses || "");
      var envResident = Boolean(j.residentEnvConfigured);
      var residentActive = Boolean(j.residentAllowlistConfigured);
      var serverWallet = j.serverWalletAddress ? String(j.serverWalletAddress) : "";
      panel.innerHTML =
        "<div class='set-panel'>" +
        "<h2>Resident wallet</h2>" +
        "<p class='set-hint'>NimiqLIVE Resident wallets that may Invoice and start Return Walk. Comma-separated for more than one. Spaces optional - grouped or compact both work. Takes effect immediately (no restart).</p>" +
        "<textarea class='set-text' id='resident-wallets' rows='2' placeholder='NQXX XXXX XXXX …'>" +
        escHtml(addrs) +
        "</textarea>" +
        (envResident
          ? "<p class='set-hint'>Also configured via <code>RESIDENT_ADDRESSES</code> env (merged with this list).</p>"
          : "") +
        "<p class='set-hint'>" +
        (residentActive
          ? "Resident Invoice access is <strong>enabled</strong> (at least one wallet configured)."
          : "Resident Invoice access is <strong>disabled</strong> until a wallet is set here or in env.") +
        "</p>" +
        "<div class='set-actions'>" +
        "<button type='button' id='save-resident-btn'>Save</button>" +
        "<span id='save-resident-msg' class='ok' hidden></span>" +
        "</div></div>" +
        "<div class='set-panel'>" +
        "<h2>Server Wallet</h2>" +
        (serverWallet
          ? "<p class='set-readonly'>" + escHtml(serverWallet) + "</p>" +
            "<p class='set-hint'>Deposit destination from env <code>RETURN_WALK_SERVER_WALLET_ADDRESS</code>. Not editable here.</p>"
          : "<p class='set-hint'>Not configured. Set <code>RETURN_WALK_SERVER_WALLET_ADDRESS</code> on the game server (must not be the Stream Faucet) and restart.</p>") +
        "</div>";
      var saveBtn = document.getElementById("save-resident-btn");
      var input = document.getElementById("resident-wallets");
      var msg = document.getElementById("save-resident-msg");
      if (saveBtn && input && msg) {
        saveBtn.addEventListener("click", async function () {
          msg.hidden = true;
          try {
            var pr = await fetch("/api/admin/connections", {
              method: "PUT",
              headers: {
                authorization: "Bearer " + token,
                "content-type": "application/json",
              },
              body: JSON.stringify({ residentAddresses: input.value }),
            });
            if (pr.status === 400) {
              msg.textContent = "Invalid Nimiq address - check format (with or without spaces).";
              msg.className = "err";
              msg.hidden = false;
              return;
            }
            if (!pr.ok) {
              msg.textContent = "Save failed (" + pr.status + ").";
              msg.className = "err";
              msg.hidden = false;
              return;
            }
            var jj = await pr.json();
            render(panel, token, jj);
            var savedMsg = document.getElementById("save-resident-msg");
            if (savedMsg) {
              savedMsg.textContent = "Saved.";
              savedMsg.className = "ok";
              savedMsg.hidden = false;
            }
          } catch {
            msg.textContent = "Network error.";
            msg.className = "err";
            msg.hidden = false;
          }
        });
      }
    }
    load();
  </script>
</body>
</html>`;
}
