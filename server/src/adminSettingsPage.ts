import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/settings` (read/write via `GET`/`PUT /api/admin/settings`). */
export function adminSettingsPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Settings - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .set-panel { max-width: 36rem; margin: 0.75rem 0 1.25rem; padding: 0.85rem 1rem; border: 1px solid #263348; border-radius: 10px; background: #0f1622; }
    .set-panel h2 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #c8d4e4; font-weight: 600; }
    .set-row { display: flex; align-items: flex-start; gap: 0.65rem; flex-wrap: wrap; }
    .set-row label { font-size: 0.82rem; color: #b8c5d9; line-height: 1.45; cursor: pointer; flex: 1 1 12rem; min-width: 0; }
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
    .err { color: #f87171; font-size: 0.82rem; }
    .ok { color: #86efac; font-size: 0.78rem; }
    #panel.ms-panel { max-width: 48rem; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("settings")}
  <h1 class="ms-doc-title">Settings</h1>
  <div id="panel" class="ms-panel mono">Loading…</div>
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
    function escHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    }
    async function saveSettings(token, body, msgEl) {
      if (!msgEl) return false;
      msgEl.hidden = true;
      try {
        var pr = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: {
            authorization: "Bearer " + token,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (pr.status === 400) {
          msgEl.textContent = "Invalid Nimiq address - check format (with or without spaces).";
          msgEl.className = "err";
          msgEl.hidden = false;
          return false;
        }
        if (!pr.ok) {
          msgEl.textContent = "Save failed (" + pr.status + ").";
          msgEl.className = "err";
          msgEl.hidden = false;
          return false;
        }
        msgEl.textContent = "Saved.";
        msgEl.className = "ok";
        msgEl.hidden = false;
        return true;
      } catch {
        msgEl.textContent = "Network error.";
        msgEl.className = "err";
        msgEl.hidden = false;
        return false;
      }
    }
    async function load() {
      var panel = document.getElementById("panel");
      if (!panel) return;
      var token = readAuthToken();
      if (!token) {
        panel.innerHTML =
          "<p class='err'>Not signed in.</p><p class='set-hint'>Open <a href='/admin'>Admin</a>, sign in, then return here.</p>";
        return;
      }
      try {
        var r = await fetch("/api/admin/settings", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        });
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
        var on = Boolean(j.playerUsernameSelfServiceEnabled);
        var streamAddrs = String(j.streamObserverAddresses || "");
        var envStream = Boolean(j.streamObserverEnvConfigured);
        var streamActive = Boolean(j.streamObserverAllowlistConfigured);
        panel.innerHTML =
          "<div class='set-panel'>" +
          "<h2>Usernames</h2>" +
          "<div class='set-row'>" +
          "<input type='checkbox' id='self-username' " +
          (on ? "checked " : "") +
          "/>" +
          "<label for='self-username'>Allow players to set their own username (alphanumeric, max 12). When off, only admins can assign names.</label>" +
          "</div>" +
          "<p class='set-hint'>In-game admins can still set names via profile moderation while this is off.</p>" +
          "<div class='set-actions'>" +
          "<button type='button' id='save-username-btn'>Save</button>" +
          "<span id='save-username-msg' class='ok' hidden></span>" +
          "</div></div>" +
          "<div class='set-panel'>" +
          "<h2>Stream cinema wallet</h2>" +
          "<p class='set-hint'>Wallets allowed to connect with <code>?stream=1</code> (OBS / broadcast observer). Comma-separated for multiple bots. Spaces optional - grouped or compact both work.</p>" +
          "<textarea class='set-text' id='stream-wallets' rows='2' placeholder='NQXX XXXX XXXX …'>" +
          escHtml(streamAddrs) +
          "</textarea>" +
          (envStream
            ? "<p class='set-hint'>Also configured via <code>STREAM_OBSERVER_ADDRESSES</code> env (merged with this list).</p>"
            : "") +
          "<p class='set-hint'>" +
          (streamActive
            ? "Stream observer mode is <strong>enabled</strong> (at least one wallet configured)."
            : "Stream observer mode is <strong>disabled</strong> until a wallet is set here or in env.") +
          "</p>" +
          "<div class='set-actions'>" +
          "<button type='button' id='save-stream-btn'>Save</button>" +
          "<span id='save-stream-msg' class='ok' hidden></span>" +
          "</div></div>";
        var saveUsernameBtn = document.getElementById("save-username-btn");
        var cb = document.getElementById("self-username");
        var usernameMsg = document.getElementById("save-username-msg");
        if (saveUsernameBtn && cb && usernameMsg) {
          saveUsernameBtn.addEventListener("click", function () {
            saveSettings(
              token,
              { playerUsernameSelfServiceEnabled: cb.checked },
              usernameMsg
            );
          });
        }
        var saveStreamBtn = document.getElementById("save-stream-btn");
        var streamInput = document.getElementById("stream-wallets");
        var streamMsg = document.getElementById("save-stream-msg");
        if (saveStreamBtn && streamInput && streamMsg) {
          saveStreamBtn.addEventListener("click", async function () {
            var ok = await saveSettings(
              token,
              { streamObserverAddresses: streamInput.value },
              streamMsg
            );
            if (ok) {
              var rr = await fetch("/api/admin/settings", {
                headers: { authorization: "Bearer " + token },
                cache: "no-store",
              });
              if (rr.ok) {
                var jj = await rr.json();
                streamInput.value = String(jj.streamObserverAddresses || "");
              }
            }
          });
        }
      } catch (e) {
        panel.innerHTML = "<p class='err'>Network error</p>";
      }
    }
    load();
  </script>
</body>
</html>`;
}
