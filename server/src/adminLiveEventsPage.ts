import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/live-events` (operator mapping of Live Event types). */
export function adminLiveEventsPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Live Events - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .le-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.85rem 1rem; margin: 0.75rem 0 1.1rem; }
    .le-panel h2 { margin: 0 0 0.45rem; font-size: 0.95rem; color: #c8d4e4; font-weight: 600; }
    .le-hint { font-size: 0.76rem; color: #6b7d95; margin: 0 0 0.75rem; line-height: 1.45; }
    .le-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.55rem 0.75rem; }
    .le-field label { display: block; font-size: 0.72rem; color: #8b9cb3; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem; }
    .le-field input, .le-field select {
      width: 100%; box-sizing: border-box; background: #0a1018; color: #d8e2f0;
      border: 1px solid #263348; border-radius: 6px; padding: 0.4rem 0.5rem; font: inherit; font-size: 0.82rem;
    }
    .le-actions { margin-top: 0.75rem; display: flex; gap: 0.45rem; flex-wrap: wrap; align-items: center; }
    .le-actions button, .le-table button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.35rem 0.7rem; cursor: pointer; font: inherit; font-size: 0.8rem;
    }
    .le-actions button.ghost, .le-table button.ghost { background: #1a2738; color: #d8e2f0; border-color: #334155; }
    .le-table button.danger { background: #1a2738; color: #f87171; border-color: #5a2a2a; }
    .le-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .le-table th, .le-table td { text-align: left; padding: 0.4rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: middle; }
    .le-soon { color: #fcd34d; font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase; }
    .le-on { color: #86efac; }
    .le-off { color: #8b9cb3; }
    .err { color: #f87171; font-size: 0.82rem; }
    .ok { color: #86efac; font-size: 0.78rem; }
    #panel.ms-panel { max-width: 56rem; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("live-events")}
  <h1 class="ms-doc-title" id="leDocTitle">Live Events</h1>
  <div id="panel" class="ms-panel">Loading…</div>
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
    function esc(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    }
    function authGate(msg) {
      return "<div class='ms-auth-gate ms-auth-gate--standalone'><div class='ms-auth-gate-msg'>" +
        esc(msg) + "</div></div>";
    }
    function interactionLabel(kind, interactions) {
      for (var i = 0; i < interactions.length; i++) {
        if (interactions[i].kind === kind) return interactions[i].label;
      }
      return kind;
    }
    function isAvailable(kind, interactions) {
      for (var i = 0; i < interactions.length; i++) {
        if (interactions[i].kind === kind) return interactions[i].available;
      }
      return false;
    }
    function roomLabel(m, rooms, currentRoomId) {
      if (m.roomTarget === "hub") return "Hub";
      if (m.roomTarget === "current") {
        return currentRoomId ? "Current (" + currentRoomId + ")" : "Current";
      }
      var id = m.roomId || "";
      for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].id === id) return rooms[i].displayName + " (" + id + ")";
      }
      return id || "Other";
    }
    async function api(path, opts) {
      var token = readAuthToken();
      var headers = { authorization: "Bearer " + token };
      if (opts && opts.body) headers["content-type"] = "application/json";
      var r = await fetch(path, Object.assign({ headers: headers, cache: "no-store" }, opts || {}));
      var j = {};
      try { j = await r.json(); } catch (e) {}
      return { status: r.status, json: j };
    }
    function formBody() {
      return {
        eventType: document.getElementById("le-type").value.trim(),
        interactionKind: document.getElementById("le-interaction").value,
        roomTarget: document.getElementById("le-room-target").value,
        roomId: document.getElementById("le-room-id").value,
        enabled: document.getElementById("le-enabled").checked
      };
    }
    function syncRoomPicker() {
      var other = document.getElementById("le-room-target").value === "other";
      document.getElementById("le-room-id-wrap").hidden = !other;
    }
    function fillForm(m, interactions) {
      document.getElementById("le-id").value = m && m.id ? m.id : "";
      document.getElementById("le-type").value = m && m.eventType ? m.eventType : "";
      document.getElementById("le-interaction").value = m && m.interactionKind ? m.interactionKind : (interactions[0] && interactions[0].kind) || "live_boost";
      document.getElementById("le-room-target").value = m && m.roomTarget ? m.roomTarget : "current";
      document.getElementById("le-room-id").value = m && m.roomId ? m.roomId : "";
      document.getElementById("le-enabled").checked = !m || m.enabled !== false;
      document.getElementById("le-save").textContent = m && m.id ? "Save rule" : "Add rule";
      document.getElementById("le-cancel").hidden = !(m && m.id);
      syncRoomPicker();
    }
    async function load() {
      var panel = document.getElementById("panel");
      var title = document.getElementById("leDocTitle");
      if (!panel) return;
      var token = readAuthToken();
      if (!token) {
        if (title) title.hidden = true;
        panel.innerHTML = authGate("You must be signed in to perform this action.");
        return;
      }
      var res = await api("/api/admin/live-events");
      if (res.status === 401) {
        if (title) title.hidden = true;
        panel.innerHTML = authGate("You must be signed in to perform this action.");
        return;
      }
      if (res.status === 403) {
        if (title) title.hidden = true;
        panel.innerHTML = authGate("Access denied for this wallet.");
        return;
      }
      if (res.status !== 200) {
        panel.innerHTML = "<p class='err'>Failed to load (" + res.status + ").</p>";
        return;
      }
      if (title) title.hidden = false;
      var data = res.json;
      var interactions = data.interactions || [];
      var rooms = data.rooms || [];
      var mappings = data.mappings || [];
      var seen = data.seenTypes || [];
      var currentRoomId = data.currentRoomId || "hub";
      var typeOptions = seen.slice();
      if (typeOptions.indexOf("nimiqlive.test") < 0) typeOptions.unshift("nimiqlive.test");
      var interactionOpts = interactions.map(function (it) {
        return "<option value='" + esc(it.kind) + "'>" + esc(it.label) + (it.available ? "" : " (coming soon)") + "</option>";
      }).join("");
      var roomOpts = rooms.map(function (r) {
        return "<option value='" + esc(r.id) + "'>" + esc(r.displayName) + " (" + esc(r.id) + ")</option>";
      }).join("");
      var datalist = typeOptions.map(function (t) {
        return "<option value='" + esc(t) + "'></option>";
      }).join("");
      var rows = mappings.map(function (m) {
        var soon = isAvailable(m.interactionKind, interactions) ? "" : " <span class='le-soon'>coming soon</span>";
        return "<tr>" +
          "<td class='mono'>" + esc(m.eventType) + "</td>" +
          "<td>" + esc(interactionLabel(m.interactionKind, interactions)) + soon + "</td>" +
          "<td>" + esc(roomLabel(m, rooms, currentRoomId)) + "</td>" +
          "<td class='" + (m.enabled ? "le-on" : "le-off") + "'>" + (m.enabled ? "On" : "Off") + "</td>" +
          "<td><button type='button' class='ghost' data-edit='" + esc(m.id) + "'>Edit</button> " +
          "<button type='button' class='danger' data-del='" + esc(m.id) + "'>Delete</button></td>" +
          "</tr>";
      }).join("");
      if (!rows) {
        rows = "<tr><td colspan='5' class='le-hint'>No custom rules yet. Unmapped nimiqlive.test still starts Live Boost.</td></tr>";
      }
      panel.innerHTML =
        "<div class='le-panel'>" +
        "<h2>When a Live Event arrives</h2>" +
        "<p class='le-hint'>NimiqLIVE only reports that something happened. You choose the in-game interaction and which room it is aimed at. Current is the cinema stream room if one is connected, otherwise Hub. Live Boost is world-wide today. Coming-soon interactions save but do not run yet.</p>" +
        "<input type='hidden' id='le-id'/>" +
        "<div class='le-grid'>" +
        "<div class='le-field'><label for='le-type'>Event type</label>" +
        "<input id='le-type' list='le-type-list' placeholder='nimiqlive.test' autocomplete='off'/>" +
        "<datalist id='le-type-list'>" + datalist + "</datalist></div>" +
        "<div class='le-field'><label for='le-interaction'>Interaction</label>" +
        "<select id='le-interaction'>" + interactionOpts + "</select></div>" +
        "<div class='le-field'><label for='le-room-target'>Room</label>" +
        "<select id='le-room-target'>" +
        "<option value='current'>Current</option>" +
        "<option value='hub'>Hub</option>" +
        "<option value='other'>Other</option>" +
        "</select></div>" +
        "<div class='le-field' id='le-room-id-wrap' hidden><label for='le-room-id'>Other room</label>" +
        "<select id='le-room-id'>" + roomOpts + "</select></div>" +
        "</div>" +
        "<div class='le-actions'>" +
        "<label><input type='checkbox' id='le-enabled' checked/> Enabled</label>" +
        "<button type='button' id='le-save'>Add rule</button>" +
        "<button type='button' id='le-cancel' class='ghost' hidden>Cancel</button>" +
        "<span id='le-msg'></span>" +
        "</div></div>" +
        "<div class='le-panel'>" +
        "<h2>Rules</h2>" +
        "<p class='le-hint'>Built-in fallback: <span class='mono'>nimiqlive.test</span> → Live Boost on Current, used only when that type has no enabled rule.</p>" +
        "<table class='le-table'><thead><tr><th>Event type</th><th>Interaction</th><th>Room</th><th>State</th><th></th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div>";

      document.getElementById("le-room-target").addEventListener("change", syncRoomPicker);
      document.getElementById("le-cancel").addEventListener("click", function () {
        fillForm(null, interactions);
        document.getElementById("le-msg").textContent = "";
      });
      document.getElementById("le-save").addEventListener("click", async function () {
        var msg = document.getElementById("le-msg");
        var id = document.getElementById("le-id").value.trim();
        var path = id ? "/api/admin/live-events/mappings/" + encodeURIComponent(id) : "/api/admin/live-events/mappings";
        var method = id ? "PUT" : "POST";
        var out = await api(path, { method: method, body: JSON.stringify(formBody()) });
        if (out.status === 201 || out.status === 200) {
          await load();
          return;
        }
        msg.className = "err";
        msg.textContent = out.json && out.json.error ? String(out.json.error) : "Save failed (" + out.status + ").";
      });
      panel.querySelectorAll("[data-edit]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-edit");
          var m = mappings.filter(function (row) { return row.id === id; })[0];
          if (m) fillForm(m, interactions);
        });
      });
      panel.querySelectorAll("[data-del]").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          var id = btn.getAttribute("data-del");
          if (!id) return;
          var out = await api("/api/admin/live-events/mappings/" + encodeURIComponent(id), { method: "DELETE" });
          if (out.status === 200) await load();
        });
      });
      fillForm(null, interactions);
    }
    load();
  </script>
</body>
</html>`;
}
