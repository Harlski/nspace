import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/moderation` (sanction lists; player dossier is `/admin/user/:profile`). */
export function adminModerationPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Moderation - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .mod-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.75rem 0.85rem; margin-bottom: 0.75rem; }
    .mod-panel h2 { margin: 0 0 0.55rem; font-size: 0.92rem; color: #c8d4e4; font-weight: 600; }
    .mod-filters, .mod-lookup { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.65rem; align-items: center; }
    .mod-filters input, .mod-lookup input {
      background: #0a1018; color: #d8e2f0; border: 1px solid #263348; border-radius: 6px;
      padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8rem; min-width: 14rem; flex: 1;
    }
    .mod-filters button, .mod-lookup button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.35rem 0.65rem; cursor: pointer; font: inherit; font-size: 0.8rem;
    }
    .mod-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .mod-table th, .mod-table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: top; }
    .mod-table tr[data-href] { cursor: pointer; }
    .mod-table tr[data-href]:hover { background: #152030; }
    .mod-name { color: #eef6ff; font-weight: 600; }
    .mod-note { color: #9fb0c7; font-size: 0.74rem; max-width: 20rem; word-break: break-word; }
    .mod-status { margin-top: 0.5rem; color: #9fb0c7; font-size: 0.78rem; min-height: 1rem; }
    .hint { color: #6b7d95; font-size: 0.76rem; line-height: 1.45; margin: 0 0 0.65rem; }
    .err { color: #f87171; }
    .ok { color: #86efac; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("moderation")}
  <h1 id="modDocTitle" class="ms-doc-title">Moderation</h1>
  <div id="panel" class="ms-panel mono">Loading…</div>
  <script>
(function () {
  var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
  var token = "";
  var snapshot = { usernameBans: [], channelMutes: [], miningRestrictions: [] };
  var filterText = "";
  var lookupText = "";

  function readQueryLookup() {
    try {
      var p = new URLSearchParams(location.search);
      return String(p.get("wallet") || p.get("q") || "").trim();
    } catch (e) {
      return "";
    }
  }

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

  function authGateHtml(msg) {
    return (
      "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
      "<div class='ms-auth-gate-msg'>" + escHtml(msg || "You must be signed in.") + "</div>" +
      "</div>"
    );
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign(
      { authorization: "Bearer " + token },
      opts.headers || {}
    );
    var fetchOpts = Object.assign({}, opts, { headers: headers, cache: "no-store" });
    var r = await fetch(path, fetchOpts);
    var body = {};
    try { body = await r.json(); } catch (e) { body = {}; }
    return { status: r.status, body: body };
  }

  function fmtTime(at) {
    return new Date(at).toISOString().replace("T", " ").slice(0, 19);
  }

  function normWallet(w) {
    return String(w || "").replace(/\\s+/g, "").toUpperCase();
  }

  function filterQ() {
    return String(filterText || "").trim().toLowerCase();
  }

  function matchesFilter(row) {
    var q = filterQ();
    if (!q) return true;
    var addr = normWallet(row.address).toLowerCase();
    var uname = String(row.username || "").toLowerCase();
    var display = String(row.displayName || "").toLowerCase();
    return addr.indexOf(q.replace(/\\s+/g, "")) >= 0 ||
      uname.indexOf(q) >= 0 ||
      display.indexOf(q) >= 0;
  }

  function profileHref(row) {
    if (row.username) return "/admin/user/" + encodeURIComponent(row.username);
    return "/admin/user/" + encodeURIComponent(normWallet(row.address));
  }

  function rowLabel(row) {
    var name = row.displayName || row.username || row.address;
    return (
      "<span class='mod-name' title='" + escHtml(row.address) + "'>" +
      escHtml(name) +
      "</span>"
    );
  }

  function rowHtml(kind, row) {
    var href = profileHref(row);
    var noteCell = kind === "mining" && row.note
      ? "<td class='mod-note'>" + escHtml(row.note) + "</td>"
      : (kind === "mining" ? "<td class='mod-note'>—</td>" : "");
    var cols = kind === "mining"
      ? "<td>" + rowLabel(row) + "</td><td>" + fmtTime(row.at) + "</td><td>" + escHtml(row.by || "—") + "</td>" + noteCell
      : "<td>" + rowLabel(row) + "</td><td>" + fmtTime(row.at) + "</td><td>" + escHtml(row.by || "—") + "</td>";
    return "<tr data-href='" + escHtml(href) + "'>" + cols + "</tr>";
  }

  function tableSection(title, kind, rows) {
    var filtered = rows.filter(function (r) { return matchesFilter(r); });
    var head = kind === "mining"
      ? "<tr><th>Player</th><th>Since (UTC)</th><th>By</th><th>Note</th></tr>"
      : "<tr><th>Player</th><th>Since (UTC)</th><th>By</th></tr>";
    var body = filtered.map(function (r) { return rowHtml(kind, r); }).join("");
    if (!body) body = "<tr><td colspan='" + (kind === "mining" ? 4 : 3) + "' class='hint'>None</td></tr>";
    return (
      "<section class='mod-panel'>" +
      "<h2>" + escHtml(title) + " (" + filtered.length + ")</h2>" +
      "<table class='mod-table'><thead>" + head + "</thead><tbody>" + body + "</tbody></table>" +
      "</section>"
    );
  }

  function render() {
    var panel = document.getElementById("panel");
    if (!panel) return;
    panel.innerHTML =
      "<p class='hint'>Players show as <strong>username</strong> (or short wallet label). Hover a name for the full NQ address. Click a row to open the player dossier (sanctions, tutorial, chat, rooms).</p>" +
      "<div class='mod-lookup'>" +
      "<input id='playerLookup' type='search' placeholder='Username or full NQ wallet…' autocomplete='off' value='" + escHtml(lookupText) + "' />" +
      "<button type='button' id='modLookupBtn'>Open player</button>" +
      "</div>" +
      "<div id='lookupStatus' class='mod-status'></div>" +
      "<div class='mod-filters'>" +
      "<input id='walletFilter' type='search' placeholder='Filter lists by name or wallet…' autocomplete='off' value='" + escHtml(filterText) + "' />" +
      "<button type='button' id='modRefresh'>Refresh lists</button>" +
      "</div>" +
      tableSection("Mining restrictions", "mining", snapshot.miningRestrictions || []) +
      tableSection("Username-set bans", "username", snapshot.usernameBans || []) +
      tableSection("Channel mutes", "channel", snapshot.channelMutes || []);

    document.getElementById("walletFilter")?.addEventListener("input", function (e) {
      filterText = String(e.target && e.target.value != null ? e.target.value : "");
      render();
    });
    document.getElementById("modRefresh")?.addEventListener("click", function () {
      void loadSnapshot();
    });
    document.getElementById("modLookupBtn")?.addEventListener("click", function () {
      var el = document.getElementById("playerLookup");
      lookupText = el ? String(el.value || "") : "";
      void openPlayer(lookupText);
    });
    document.getElementById("playerLookup")?.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        lookupText = String(e.target.value || "");
        void openPlayer(lookupText);
      }
    });
    panel.querySelectorAll("tr[data-href]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var href = tr.getAttribute("data-href");
        if (href) location.href = href;
      });
    });
  }

  async function openPlayer(q) {
    var query = String(q || "").trim();
    var statusEl = document.getElementById("lookupStatus");
    if (!query) return;
    if (statusEl) statusEl.textContent = "Looking up…";
    var out = await api("/api/admin/player?q=" + encodeURIComponent(query));
    if (out.status === 404) {
      if (statusEl) statusEl.innerHTML = "<span class='err'>No player found.</span>";
      return;
    }
    if (out.status !== 200 || !out.body || !out.body.player) {
      if (statusEl) statusEl.innerHTML = "<span class='err'>Lookup failed (" + out.status + ").</span>";
      return;
    }
    var path = out.body.player.profilePath ||
      ("/admin/user/" + encodeURIComponent(out.body.player.username || out.body.player.wallet));
    location.href = path;
  }

  async function loadSnapshot() {
    var out = await api("/api/admin/moderation");
    if (out.status === 401 || out.status === 403) {
      document.getElementById("panel").innerHTML = authGateHtml("System admin wallet required.");
      return;
    }
    if (out.status !== 200) {
      document.getElementById("panel").innerHTML = "<p class='err'>Failed to load.</p>";
      return;
    }
    snapshot = out.body || snapshot;
    render();
  }

  async function boot() {
    token = readAuthToken();
    if (!token) {
      document.getElementById("panel").innerHTML = authGateHtml();
      return;
    }
    var q = readQueryLookup();
    if (q) {
      // Legacy Connect Notice / deeplinks used ?wallet= — send them to the dossier.
      lookupText = q;
      await openPlayer(q);
      return;
    }
    await loadSnapshot();
  }

  boot();
})();
  </script>
</body>
</html>`;
}
