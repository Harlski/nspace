import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/moderation` (sanctions via admin moderation APIs). */
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
    .mod-filters { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.65rem; align-items: center; }
    .mod-filters input {
      background: #0a1018; color: #d8e2f0; border: 1px solid #263348; border-radius: 6px;
      padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8rem; min-width: 14rem;
    }
    .mod-filters button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.35rem 0.65rem; cursor: pointer; font: inherit; font-size: 0.8rem;
    }
    .mod-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .mod-table th, .mod-table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: top; }
    .mod-table tr[data-addr] { cursor: pointer; }
    .mod-table tr[data-addr]:hover, .mod-table tr.is-selected { background: #152030; }
    .mod-note { color: #9fb0c7; font-size: 0.74rem; max-width: 20rem; word-break: break-word; }
    .mod-detail { margin-top: 0.65rem; padding: 0.65rem; border: 1px solid #263348; border-radius: 8px; background: #0a1018; }
    .mod-detail[hidden] { display: none; }
    .mod-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
    .mod-actions button {
      background: #1a2738; color: #d8e2f0; border: 1px solid #334155; border-radius: 6px;
      padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.78rem;
    }
    .mod-actions button.danger { color: #f87171; border-color: #5a2a2a; }
    .mod-actions button.primary { background: var(--ms-accent); color: #eef6ff; border-color: var(--ms-accent-hover-border); }
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
  var selected = null;
  var filterText = "";

  function readFilterInput() {
    var el = document.getElementById("walletFilter");
    if (el) filterText = String(el.value || "");
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
    return String(filterText || "").replace(/\\s+/g, "").toUpperCase();
  }

  function matchesFilter(addr) {
    var q = filterQ();
    if (!q) return true;
    return normWallet(addr).indexOf(q) >= 0;
  }

  function rowHtml(kind, row) {
    var addr = row.address;
    var noteCell = kind === "mining" && row.note
      ? "<td class='mod-note'>" + escHtml(row.note) + "</td>"
      : (kind === "mining" ? "<td class='mod-note'>—</td>" : "");
    var cols = kind === "mining"
      ? "<td>" + escHtml(addr) + "</td><td>" + fmtTime(row.at) + "</td><td>" + escHtml(row.by || "—") + "</td>" + noteCell
      : "<td>" + escHtml(addr) + "</td><td>" + fmtTime(row.at) + "</td><td>" + escHtml(row.by || "—") + "</td>";
    return "<tr data-addr='" + escHtml(normWallet(addr)) + "' data-kind='" + kind + "'>" + cols + "</tr>";
  }

  function tableSection(title, kind, rows, noteHeader) {
    var filtered = rows.filter(function (r) { return matchesFilter(r.address); });
    var head = kind === "mining"
      ? "<tr><th>Wallet</th><th>Since (UTC)</th><th>By</th><th>Note</th></tr>"
      : "<tr><th>Wallet</th><th>Since (UTC)</th><th>By</th></tr>";
    var body = filtered.map(function (r) { return rowHtml(kind, r); }).join("");
    if (!body) body = "<tr><td colspan='" + (kind === "mining" ? 4 : 3) + "' class='hint'>None</td></tr>";
    return (
      "<section class='mod-panel'>" +
      "<h2>" + escHtml(title) + " (" + filtered.length + ")</h2>" +
      "<table class='mod-table'><thead>" + head + "</thead><tbody>" + body + "</tbody></table>" +
      "</section>"
    );
  }

  function isBanned(addr, kind) {
    var w = normWallet(addr);
    if (kind === "username") {
      return snapshot.usernameBans.some(function (r) { return normWallet(r.address) === w; });
    }
    if (kind === "channel") {
      return snapshot.channelMutes.some(function (r) { return normWallet(r.address) === w; });
    }
    return snapshot.miningRestrictions.some(function (r) { return normWallet(r.address) === w; });
  }

  function miningNote(addr) {
    var w = normWallet(addr);
    var row = snapshot.miningRestrictions.find(function (r) { return normWallet(r.address) === w; });
    return row && row.note ? row.note : "";
  }

  function renderDetail() {
    var el = document.getElementById("modDetail");
    if (!el) return;
    if (!selected) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    var addr = selected;
    el.innerHTML =
      "<h3>" + escHtml(addr) + "</h3>" +
      "<div class='mod-actions'>" +
      "<button type='button' data-act='clear_username'>Clear username</button>" +
      (isBanned(addr, "username")
        ? "<button type='button' data-act='allow_name'>Allow name</button>"
        : "<button type='button' class='danger' data-act='ban_name'>Ban name</button>") +
      (isBanned(addr, "channel")
        ? "<button type='button' data-act='unmute'>Unmute chat</button>"
        : "<button type='button' class='danger' data-act='mute'>Mute chat</button>") +
      (isBanned(addr, "mining")
        ? "<button type='button' data-act='allow_mining'>Allow mining</button>"
        : "<button type='button' class='danger' data-act='ban_mining'>Ban mining</button>") +
      "</div>" +
      "<div class='mod-status' id='modStatus'></div>";
    el.querySelectorAll("button[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        void runAction(btn.getAttribute("data-act"), addr);
      });
    });
  }

  async function runAction(act, target) {
    var status = document.getElementById("modStatus");
    if (status) status.textContent = "…";
    var body = { action: "", target: target };
    if (act === "clear_username") body.action = "clear_username";
    else if (act === "ban_name") { body.action = "username_ban"; body.banned = true; }
    else if (act === "allow_name") { body.action = "username_ban"; body.banned = false; }
    else if (act === "mute") { body.action = "channel_mute"; body.muted = true; }
    else if (act === "unmute") { body.action = "channel_mute"; body.muted = false; }
    else if (act === "ban_mining") {
      body.action = "mining_ban";
      body.banned = true;
      var note = window.prompt("Optional note (why this wallet is restricted):", "");
      if (note === null) {
        if (status) status.textContent = "Cancelled.";
        return;
      }
      if (String(note).trim()) body.note = String(note).trim();
    } else if (act === "allow_mining") {
      body.action = "mining_ban";
      body.banned = false;
    } else return;

    var out = await api("/api/admin/moderation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (out.status !== 200) {
      if (status) status.textContent = "Error " + out.status;
      return;
    }
    if (status) status.textContent = "Saved.";
    await loadSnapshot();
    renderDetail();
  }

  function render() {
    var panel = document.getElementById("panel");
    if (!panel) return;
    panel.innerHTML =
      "<p class='hint'>Sanctions stored in moderation.json on the game server. Mining restrictions block NIM block claims; guests cannot earn NIM from mining regardless.</p>" +
      "<div class='mod-filters'>" +
      "<input id='walletFilter' type='search' placeholder='Filter by wallet…' autocomplete='off' value='" + escHtml(filterText) + "' />" +
      "<button type='button' id='modRefresh'>Refresh</button>" +
      "</div>" +
      tableSection("Mining restrictions", "mining", snapshot.miningRestrictions || []) +
      tableSection("Username-set bans", "username", snapshot.usernameBans || []) +
      tableSection("Channel mutes", "channel", snapshot.channelMutes || []) +
      "<div id='modDetail' class='mod-detail' hidden></div>";

    document.getElementById("walletFilter")?.addEventListener("input", function (e) {
      filterText = String(e.target && e.target.value != null ? e.target.value : "");
      render();
      renderDetail();
    });
    document.getElementById("modRefresh")?.addEventListener("click", function () {
      void loadSnapshot();
    });
    panel.querySelectorAll("tr[data-addr]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        panel.querySelectorAll("tr.is-selected").forEach(function (x) {
          x.classList.remove("is-selected");
        });
        tr.classList.add("is-selected");
        selected = tr.getAttribute("data-addr");
        renderDetail();
      });
    });
    renderDetail();
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
    await loadSnapshot();
  }

  boot();
})();
  </script>
</body>
</html>`;
}
