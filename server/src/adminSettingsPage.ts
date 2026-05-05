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
  <title>Settings — Admin — Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84rem; }
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
          "<button type='button' id='save-btn'>Save</button>" +
          "<span id='save-msg' class='ok' hidden></span>" +
          "</div></div>";
        var saveBtn = document.getElementById("save-btn");
        var cb = document.getElementById("self-username");
        var msg = document.getElementById("save-msg");
        if (saveBtn && cb && msg) {
          saveBtn.addEventListener("click", async function () {
            msg.hidden = true;
            try {
              var pr = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: {
                  authorization: "Bearer " + token,
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  playerUsernameSelfServiceEnabled: cb.checked,
                }),
              });
              if (!pr.ok) {
                msg.textContent = "Save failed (" + pr.status + ").";
                msg.className = "err";
                msg.hidden = false;
                return;
              }
              msg.textContent = "Saved.";
              msg.className = "ok";
              msg.hidden = false;
            } catch {
              msg.textContent = "Network error.";
              msg.className = "err";
              msg.hidden = false;
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
