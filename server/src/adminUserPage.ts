import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/user/:profile` (dossier + sanctions via admin APIs). */
export function adminUserPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Player - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .u-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.75rem 0.85rem; margin-bottom: 0.75rem; }
    .u-panel h2 { margin: 0 0 0.55rem; font-size: 0.92rem; color: #c8d4e4; font-weight: 600; }
    .u-meta { color: #9fb0c7; font-size: 0.78rem; line-height: 1.5; margin: 0.2rem 0; }
    .u-wallet { color: #6b7d95; font-size: 0.74rem; word-break: break-all; cursor: help; }
    .u-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.55rem; }
    .u-actions button, .u-actions a.btn {
      background: #1a2738; color: #d8e2f0; border: 1px solid #334155; border-radius: 6px;
      padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.78rem; text-decoration: none;
      display: inline-block;
    }
    .u-actions button.danger { color: #f87171; border-color: #5a2a2a; }
    .u-actions button.primary, .u-actions a.btn.primary {
      background: var(--ms-accent); color: #eef6ff; border-color: var(--ms-accent-hover-border);
    }
    .u-steps { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.45rem 0; font-size: 0.78rem; }
    .u-step { border: 1px solid #334155; border-radius: 999px; padding: 0.2rem 0.55rem; color: #9fb0c7; }
    .u-step.is-done { border-color: #2f6b4a; color: #86efac; background: #10261a; }
    .u-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .u-table th, .u-table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: top; }
    .u-status { margin-top: 0.5rem; color: #9fb0c7; font-size: 0.78rem; min-height: 1rem; }
    .hint { color: #6b7d95; font-size: 0.76rem; line-height: 1.45; margin: 0 0 0.65rem; }
    .err { color: #f87171; }
    .ok { color: #86efac; }
    .back { margin: 0 0 0.75rem; font-size: 0.8rem; }
    .back a { color: #93c5fd; }
    .u-stats { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0.55rem 0; }
    .u-stat { background: #121a27; border: 1px solid #263348; border-radius: 8px; padding: 0.35rem 0.55rem; min-width: 5.6rem; }
    .u-stat b { display: block; color: #e8eef7; font-size: 0.9rem; font-weight: 600; }
    .u-stat span { color: #6b7d95; font-size: 0.68rem; }
    .u-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 0.15rem 0 0.45rem; font-size: 0.72rem; color: #9fb0c7; }
    .u-swatch { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 2px; margin-right: 0.28rem; vertical-align: -1px; }
    .u-timeline svg { width: 100%; height: auto; display: block; }
    .u-bars { display: grid; height: 88px; gap: 2px; align-items: end; margin-top: 0.7rem; }
    .u-bar { position: relative; height: 100%; background: #121a27; border-radius: 2px; }
    .u-bar-conn, .u-bar-act { position: absolute; left: 0; right: 0; bottom: 0; }
    .u-bar-conn { background: #1d4ed8; }
    .u-bar-act { background: #34d399; }
    .u-bar-ticks { display: grid; gap: 2px; margin-top: 0.2rem; color: #6b7d95; font-size: 0.62rem; }
    .u-bar-ticks span { text-align: center; overflow: hidden; white-space: nowrap; }
    .u-spin {
      display: inline-block; width: 0.7rem; height: 0.7rem; margin-right: 0.35rem;
      border: 2px solid #334155; border-top-color: #93c5fd; border-radius: 50%;
      vertical-align: -2px; animation: u-spin 0.8s linear infinite;
    }
    @keyframes u-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .u-spin { animation: none; } }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("moderation")}
  <h1 id="userDocTitle" class="ms-doc-title">Player</h1>
  <div id="panel" class="ms-panel mono"><p class="hint"><span class="u-spin" aria-hidden="true"></span>Loading…</p></div>
  <script>
(function () {
  var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
  var token = "";
  var player = null;
  var chatCursor = null;
  var chatRows = [];
  var activityHours = 24;

  function profileKeyFromPath() {
    var parts = location.pathname.split("/").filter(Boolean);
    // /admin/user/:profile
    if (parts.length >= 3 && parts[0] === "admin" && parts[1] === "user") {
      try { return decodeURIComponent(parts[2]); } catch (e) { return parts[2]; }
    }
    return "";
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
    if (typeof at !== "number" || !Number.isFinite(at)) return "—";
    return new Date(at).toISOString().replace("T", " ").slice(0, 19);
  }

  function fmtActive(ms) {
    var n = Math.max(0, Math.floor(Number(ms) || 0));
    var m = Math.floor(n / 60000);
    var h = Math.floor(m / 60);
    var d = Math.floor(h / 24);
    m = m % 60;
    h = h % 24;
    var parts = [];
    if (d) parts.push(d + "d");
    if (h) parts.push(h + "h");
    if (m || !parts.length) parts.push(m + "m");
    return parts.join(" ");
  }

  function stepChip(label, done) {
    return "<span class='u-step" + (done ? " is-done" : "") + "'>" + escHtml(label) + (done ? " ✓" : "") + "</span>";
  }

  async function runAction(act) {
    if (!player) return;
    var status = document.getElementById("userStatus");
    if (status) status.textContent = "…";
    var body = { action: "", target: player.wallet };
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
    } else if (act === "tutorial_reset") {
      if (!window.confirm("Reset tutorial for this player? They will need Mine → Pay → Exit again on the next Nimiq Pay session.")) {
        if (status) status.textContent = "Cancelled.";
        return;
      }
      body.action = "tutorial_reset";
    } else if (act === "set_username") {
      var uname = window.prompt("Set custom username:", player.username || "");
      if (uname === null) {
        if (status) status.textContent = "Cancelled.";
        return;
      }
      body.action = "set_username";
      body.username = String(uname).trim();
    } else return;

    var out = await api("/api/admin/moderation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (out.status !== 200) {
      if (status) status.textContent = "Error " + out.status + (out.body && out.body.error ? ": " + out.body.error : "");
      return;
    }
    if (status) status.textContent = "Saved.";
    if (out.body && out.body.player) {
      player = out.body.player;
      render();
      return;
    }
    await loadPlayer(player.wallet);
  }

  async function loadChat(reset) {
    if (!player) return;
    if (reset) {
      chatCursor = null;
      chatRows = [];
    }
    var q = "/api/admin/chat?wallet=" + encodeURIComponent(player.wallet) + "&limit=50";
    if (chatCursor) q += "&cursor=" + encodeURIComponent(chatCursor);
    var out = await api(q);
    if (out.status !== 200) return;
    var msgs = (out.body && out.body.messages) || [];
    chatRows = chatRows.concat(msgs);
    chatCursor = out.body && out.body.nextCursor ? out.body.nextCursor : null;
    renderChatOnly();
  }

  function fmtNimLuna(luna) {
    var raw = String(luna == null ? "0" : luna);
    if (!/^\\d+$/.test(raw)) return "0 NIM";
    var n = BigInt(raw);
    var whole = n / 100000n;
    var frac = (n % 100000n).toString().padStart(5, "0").replace(/0+$/, "");
    return (frac ? whole.toString() + "." + frac : whole.toString()) + " NIM";
  }

  function overlapMs(spans, a, b) {
    var total = 0;
    var list = spans || [];
    for (var i = 0; i < list.length; i++) {
      var s = Math.max(list[i].startMs, a);
      var e = Math.min(list[i].endMs, b);
      if (e > s) total += e - s;
    }
    return total;
  }

  function renderActivityViz(data, hours) {
    var w0 = Number(data.windowStartMs);
    var w1 = Number(data.windowEndMs);
    var span = Math.max(1, w1 - w0);
    var plotL = 78;
    var plotR = 948;
    var plotW = plotR - plotL;
    function xOf(ts) {
      return plotL + ((Number(ts) - w0) / span) * plotW;
    }
    function num(v) {
      return (Math.round(v * 100) / 100).toString();
    }
    function spanTitle(kind, startMs, endMs) {
      return kind + " " + fmtTime(startMs) + " - " + fmtTime(endMs) + " UTC (" + fmtActive(endMs - startMs) + ")";
    }

    var svg = "";
    svg += "<svg class='u-timeline' viewBox='0 0 960 150' role='img' aria-label='Connected and active time'>";
    svg += "<text x='4' y='33' fill='#9fb0c7' font-size='11'>Connected</text>";
    svg += "<text x='4' y='63' fill='#9fb0c7' font-size='11'>Active</text>";
    svg += "<text x='4' y='90' fill='#9fb0c7' font-size='11'>NIM</text>";
    var steps = hours === 168 ? 7 : 8;
    for (var t = 0; t <= steps; t++) {
      var ts = w0 + (span * t) / steps;
      var x = xOf(ts);
      svg += "<line x1='" + num(x) + "' y1='14' x2='" + num(x) + "' y2='108' stroke='#1c2838' stroke-width='1'/>";
      var d = new Date(ts);
      var label = hours === 168
        ? (d.getUTCMonth() + 1) + "/" + d.getUTCDate()
        : String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
      svg += "<text x='" + num(x) + "' y='126' fill='#6b7d95' font-size='11' text-anchor='middle'>" + escHtml(label) + "</text>";
    }
    svg += "<text x='" + plotR + "' y='142' fill='#6b7d95' font-size='11' text-anchor='end'>UTC</text>";
    var connected = data.connected || [];
    for (var c = 0; c < connected.length; c++) {
      var cs = connected[c];
      var cx = xOf(cs.startMs);
      var cw = Math.max(1.5, xOf(cs.endMs) - cx);
      svg += "<rect x='" + num(cx) + "' y='18' width='" + num(cw) + "' height='22' rx='2' fill='#1d4ed8'><title>" + escHtml(spanTitle("Connected", cs.startMs, cs.endMs)) + "</title></rect>";
    }
    var active = data.active || [];
    for (var a = 0; a < active.length; a++) {
      var aspan = active[a];
      var ax = xOf(aspan.startMs);
      var aw = Math.max(1.5, xOf(aspan.endMs) - ax);
      svg += "<rect x='" + num(ax) + "' y='48' width='" + num(aw) + "' height='22' rx='2' fill='#34d399'><title>" + escHtml(spanTitle("Active", aspan.startMs, aspan.endMs)) + "</title></rect>";
    }
    var earns = data.earns || [];
    for (var e = 0; e < earns.length; e++) {
      var earn = earns[e];
      var ex = xOf(earn.atMs);
      svg += "<circle cx='" + num(ex) + "' cy='86' r='3.5' fill='#fbbf24'><title>" + escHtml(fmtTime(earn.atMs) + " UTC - " + fmtNimLuna(earn.amountLuna) + " gameplay") + "</title></circle>";
    }
    svg += "<line x1='" + plotL + "' y1='108' x2='" + plotR + "' y2='108' stroke='#334155' stroke-width='1'/>";
    svg += "</svg>";

    var buckets = hours === 168 ? 7 : 24;
    var bucketMs = span / buckets;
    var scale = hours === 168 ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    var bars = "";
    var ticks = "";
    for (var b = 0; b < buckets; b++) {
      var b0 = w0 + b * bucketMs;
      var b1 = b0 + bucketMs;
      var conn = overlapMs(connected, b0, b1);
      var act = overlapMs(active, b0, b1);
      var connPct = Math.max(0, Math.min(100, (conn / scale) * 100));
      var actPct = Math.max(0, Math.min(100, (act / scale) * 100));
      var bd = new Date(b0);
      var blabel = hours === 168
        ? (bd.getUTCMonth() + 1) + "/" + bd.getUTCDate()
        : (b % 3 === 0 ? String(bd.getUTCHours()).padStart(2, "0") : "");
      var btitle = fmtTime(b0) + " - " + fmtTime(b1) + " UTC. Connected " + fmtActive(conn) + ", active " + fmtActive(act);
      bars += "<div class='u-bar' title='" + escHtml(btitle) + "'><div class='u-bar-conn' style='height:" + connPct.toFixed(2) + "%'></div><div class='u-bar-act' style='height:" + actPct.toFixed(2) + "%'></div></div>";
      ticks += "<span>" + escHtml(blabel) + "</span>";
    }
    var grid = "grid-template-columns:repeat(" + buckets + ",minmax(0,1fr))";
    var scaleNote = hours === 168
      ? "Each column is one day. A full column is 24 hours."
      : "Each column is one hour. A full column is 60 minutes.";

    var share = data.connectedMs > 0 ? Math.round((Number(data.activeMs) * 100) / Number(data.connectedMs)) : 0;
    var idleMin = Math.max(1, Math.round(Number(data.idleCapMs || 300000) / 60000));
    var stats =
      stat("Connected", fmtActive(data.connectedMs)) +
      stat("Active", fmtActive(data.activeMs)) +
      stat("Active share", share + "%") +
      stat("Sessions", String(data.sessionCount || 0)) +
      stat("Longest", fmtActive(data.longestConnectedMs)) +
      stat("Gameplay NIM", fmtNimLuna(data.nimEarnedLuna));

    var sessionRows = data.sessions || [];
    var table;
    if (!sessionRows.length) {
      table = "<p class='hint'>No sessions in this window.</p>";
    } else {
      table = "<table class='u-table'><thead><tr><th>Started (UTC)</th><th>Ended (UTC)</th><th>Connected</th><th>Active</th><th>Gameplay NIM</th><th>Room</th></tr></thead><tbody>";
      for (var s = 0; s < sessionRows.length; s++) {
        var row = sessionRows[s];
        var started = fmtTime(row.startedAt);
        if (row.startedAt < w0) started += " (before window)";
        var ended = row.endedAt
          ? fmtTime(row.endedAt)
          : (row.closedWithoutSignOut ? "sign-out not recorded" : "still connected");
        table += "<tr><td>" + escHtml(started) + "</td><td>" + escHtml(ended) + "</td><td>" +
          escHtml(fmtActive(row.connectedMs)) + "</td><td>" + escHtml(fmtActive(row.activeMs)) + "</td><td>" +
          escHtml(fmtNimLuna(row.nimEarnedLuna)) + "</td><td>" + escHtml(row.roomId || "-") + "</td></tr>";
      }
      table += "</tbody></table>";
      if (data.sessionsTruncated) {
        table += "<p class='hint'>Showing the 40 most recent sessions. Totals include every session in the window.</p>";
      }
    }

    return (
      "<div class='u-stats'>" + stats + "</div>" +
      "<div class='u-legend'>" +
      "<span><i class='u-swatch' style='background:#1d4ed8'></i>Connected</span>" +
      "<span><i class='u-swatch' style='background:#34d399'></i>Active</span>" +
      "<span><i class='u-swatch' style='background:#fbbf24'></i>Gameplay NIM</span>" +
      "</div>" +
      svg +
      "<div class='u-bars' style='" + grid + "'>" + bars + "</div>" +
      "<div class='u-bar-ticks' style='" + grid + "'>" + ticks + "</div>" +
      "<p class='hint'>" + escHtml(scaleNote) + " Active fills while actions arrive, and pauses after " +
      idleMin + " minutes with no action. That is the same rule as the hourly Telegram digest. Gameplay NIM is the credited earn, not the later chain send.</p>" +
      table
    );
  }

  function stat(label, value) {
    return "<div class='u-stat'><b>" + escHtml(value) + "</b><span>" + escHtml(label) + "</span></div>";
  }

  function setActivityHours(hours) {
    activityHours = hours;
    var b24 = document.getElementById("activity24");
    var b7 = document.getElementById("activity7");
    if (b24) b24.className = hours === 24 ? "primary" : "";
    if (b7) b7.className = hours === 168 ? "primary" : "";
    void loadActivity();
  }

  async function loadActivity() {
    var viz = document.getElementById("activityViz");
    if (!viz || !player) return;
    viz.innerHTML = "<p class='hint'><span class='u-spin' aria-hidden='true'></span>Loading activity…</p>";
    var out = await api(
      "/api/admin/player/activity?q=" + encodeURIComponent(player.wallet) + "&hours=" + activityHours
    );
    viz = document.getElementById("activityViz");
    if (!viz) return;
    if (out.status !== 200 || !out.body || !out.body.activity) {
      var msg = out.status === 503
        ? "Activity history needs the Analytics Service. The rest of this page is unaffected."
        : "Could not load activity history.";
      viz.innerHTML = "<p class='err'>" + escHtml(msg) + "</p>";
      return;
    }
    viz.innerHTML = renderActivityViz(out.body.activity, activityHours);
  }

  function renderChatOnly() {
    var el = document.getElementById("chatBody");
    var more = document.getElementById("chatMore");
    if (!el) return;
    if (!chatRows.length) {
      el.innerHTML = "<tr><td colspan='3' class='hint'>No chat in the last 7 days.</td></tr>";
    } else {
      el.innerHTML = chatRows.map(function (m) {
        return (
          "<tr>" +
          "<td>" + fmtTime(m.at) + "</td>" +
          "<td>" + escHtml(m.roomId || "—") + "</td>" +
          "<td>" + escHtml(m.text || "") + "</td>" +
          "</tr>"
        );
      }).join("");
    }
    if (more) more.hidden = !chatCursor;
  }

  function render() {
    var panel = document.getElementById("panel");
    if (!panel || !player) return;
    document.title = (player.displayName || "Player") + " - Admin - Nimiq Space";
    var titleEl = document.getElementById("userDocTitle");
    if (titleEl) titleEl.textContent = player.displayName || "Player";

    var t = player.tutorial || {};
    var mod = player.moderation || {};
    var act = player.activity || {};
    var presence = player.presence || {};
    var rooms = player.rooms || [];

    var presenceLine = presence.online
      ? "<span class='ok'>Online</span> in " + escHtml(presence.roomId || "?")
      : "<span>Offline</span>";

    var lastVisitLine = act.lastVisit
      ? act.lastVisit.nimEarnedLabel + " payouts sent, " + fmtActive(act.lastVisit.activeMs) + " active" +
        (act.lastVisit.endedAt ? " (ended " + fmtTime(act.lastVisit.endedAt) + " UTC)" : "")
      : "none";

    var aliases = (player.recentAliases || []).length
      ? (player.recentAliases || []).map(escHtml).join(", ")
      : "—";

    var roomsHtml = rooms.length
      ? "<table class='u-table'><thead><tr><th>Room</th><th>Visibility</th><th>Players</th></tr></thead><tbody>" +
        rooms.map(function (r) {
          return (
            "<tr><td>" + escHtml(r.displayName) + " <span class='u-wallet'>(" + escHtml(r.id) + ")</span></td>" +
            "<td>" + (r.isPublic ? "public" : "private") + "</td>" +
            "<td>" + escHtml(String(r.playerCount)) + "</td></tr>"
          );
        }).join("") +
        "</tbody></table>"
      : "<p class='hint'>No owned rooms.</p>";

    panel.innerHTML =
      "<p class='back'><a href='/admin/moderation'>← Moderation lists</a></p>" +
      "<section class='u-panel'>" +
      "<h2>Identity</h2>" +
      "<p class='u-meta'><strong>" + escHtml(player.displayName) + "</strong>" +
      (player.username ? "" : " <span class='hint'>(no custom username)</span>") +
      "</p>" +
      "<p class='u-wallet' title='" + escHtml(player.wallet) + "'>" + escHtml(player.wallet) + "</p>" +
      "<p class='u-meta'>Aliases: " + aliases + "</p>" +
      "<p class='u-meta'>Country: " + escHtml(player.country || "—") + "</p>" +
      "<p class='u-meta'>Profile message: " + (player.profileMessage ? escHtml(player.profileMessage) : "—") + "</p>" +
      "</section>" +

      "<section class='u-panel'>" +
      "<h2>Activity</h2>" +
      "<p class='u-meta'>Presence: " + presenceLine + "</p>" +
      "<p class='u-meta'>Last visit: " + escHtml(lastVisitLine) + "</p>" +
      "<p class='u-meta'>Today (UTC): " + escHtml((act.today && act.today.nimEarnedLabel) || "0 NIM") +
      " payouts sent, " + fmtActive(act.today && act.today.activeMs) + " active</p>" +
      "</section>" +

      "<section class='u-panel'>" +
      "<h2>Login history</h2>" +
      "<p class='hint'>Last 24 hours by default, same window as the hourly Telegram digest. Connected runs from sign-in to sign-out. Active is the play inside that. Empty stretches are signed out, or still connected and idle.</p>" +
      "<div class='u-actions u-range' style='margin-top:0'>" +
      "<button type='button' id='activity24' class='" + (activityHours === 24 ? "primary" : "") + "'>Last 24 hours</button>" +
      "<button type='button' id='activity7' class='" + (activityHours === 168 ? "primary" : "") + "'>Last 7 days</button>" +
      "</div>" +
      "<div id='activityViz'><p class='hint'><span class='u-spin' aria-hidden='true'></span>Loading activity…</p></div>" +
      "</section>" +

      "<section class='u-panel'>" +
      "<h2>Sanctions</h2>" +
      "<p class='u-meta'>Mining: " + (mod.miningRestricted ? "<span class='err'>restricted</span>" : "allowed") +
      (mod.miningNote ? " — " + escHtml(mod.miningNote) : "") + "</p>" +
      "<p class='u-meta'>Chat: " + (mod.channelMuted ? "<span class='err'>muted</span>" : "open") + "</p>" +
      "<p class='u-meta'>Username set: " + (mod.usernameSetBanned ? "<span class='err'>banned</span>" : "allowed") + "</p>" +
      "<div class='u-actions'>" +
      "<button type='button' data-act='set_username'>Set username</button>" +
      "<button type='button' data-act='clear_username'>Clear username</button>" +
      (mod.usernameSetBanned
        ? "<button type='button' data-act='allow_name'>Allow name</button>"
        : "<button type='button' class='danger' data-act='ban_name'>Ban name</button>") +
      (mod.channelMuted
        ? "<button type='button' data-act='unmute'>Unmute chat</button>"
        : "<button type='button' class='danger' data-act='mute'>Mute chat</button>") +
      (mod.miningRestricted
        ? "<button type='button' data-act='allow_mining'>Allow mining</button>"
        : "<button type='button' class='danger' data-act='ban_mining'>Ban mining</button>") +
      "</div>" +
      "<div class='u-status' id='userStatus'></div>" +
      "</section>" +

      "<section class='u-panel'>" +
      "<h2>Tutorial</h2>" +
      "<p class='u-meta'>" +
      (t.needsTutorialWhenPay
        ? "<span class='ok'>Needs lesson on next Pay login</span>"
        : "Completed" + (t.completedAt ? " @ " + fmtTime(t.completedAt) : "")) +
      "</p>" +
      "<div class='u-steps'>" +
      stepChip("1 Mine", !!(t.steps && t.steps.mine)) +
      stepChip("2 Pay", !!(t.steps && t.steps.pay)) +
      stepChip("3 Exit", !!(t.steps && t.steps.exit)) +
      "</div>" +
      "<div class='u-actions'>" +
      "<button type='button' class='primary' data-act='tutorial_reset'>Reset tutorial (steps 1–3)</button>" +
      "</div>" +
      "</section>" +

      "<section class='u-panel'>" +
      "<h2>Owned rooms</h2>" +
      roomsHtml +
      "</section>" +

      "<section class='u-panel'>" +
      "<h2>Recent chat (7 days)</h2>" +
      "<div class='u-actions' style='margin-top:0;margin-bottom:0.5rem'>" +
      "<a class='btn primary' href='" + escHtml(player.chatLogUrl || ("/admin/chat?wallet=" + encodeURIComponent(player.wallet))) + "'>Open full chat log</a>" +
      "<button type='button' id='chatMore' hidden>Load more</button>" +
      "</div>" +
      "<table class='u-table'><thead><tr><th>When (UTC)</th><th>Room</th><th>Text</th></tr></thead>" +
      "<tbody id='chatBody'><tr><td colspan='3' class='hint'>Loading…</td></tr></tbody></table>" +
      "</section>";

    panel.querySelectorAll("button[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        void runAction(btn.getAttribute("data-act"));
      });
    });
    document.getElementById("chatMore")?.addEventListener("click", function () {
      void loadChat(false);
    });
    document.getElementById("activity24")?.addEventListener("click", function () {
      setActivityHours(24);
    });
    document.getElementById("activity7")?.addEventListener("click", function () {
      setActivityHours(168);
    });
    void loadActivity();
  }

  async function loadPlayer(q) {
    var out = await api("/api/admin/player?q=" + encodeURIComponent(q));
    var panel = document.getElementById("panel");
    if (out.status === 401 || out.status === 403) {
      panel.innerHTML = authGateHtml("System admin wallet required.");
      return;
    }
    if (out.status === 404) {
      panel.innerHTML = "<p class='err'>No player found for " + escHtml(q) + ".</p>" +
        "<p class='back'><a href='/admin/moderation'>← Moderation</a></p>";
      return;
    }
    if (out.status !== 200 || !out.body || !out.body.player) {
      panel.innerHTML = "<p class='err'>Failed to load player.</p>";
      return;
    }
    player = out.body.player;
    // Prefer the nicer username URL when we resolved via wallet.
    if (player.profilePath && location.pathname !== player.profilePath && player.username) {
      try {
        history.replaceState(null, "", player.profilePath);
      } catch (e) { /* ignore */ }
    }
    render();
    await loadChat(true);
  }

  async function boot() {
    token = readAuthToken();
    if (!token) {
      document.getElementById("panel").innerHTML = authGateHtml();
      return;
    }
    var key = profileKeyFromPath();
    if (!key) {
      document.getElementById("panel").innerHTML =
        "<p class='err'>Missing profile in URL.</p>" +
        "<p class='back'><a href='/admin/moderation'>← Moderation</a></p>";
      return;
    }
    await loadPlayer(key);
  }

  boot();
})();
  </script>
</body>
</html>`;
}
