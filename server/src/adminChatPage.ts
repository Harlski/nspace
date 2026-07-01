import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/chat` (data via admin chat APIs). */
export function adminChatPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Chat - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .chat-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.75rem 0.85rem; }
    .chat-filters { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.65rem; align-items: center; }
    .chat-filters select {
      background: #0a1018; color: #d8e2f0; border: 1px solid #263348; border-radius: 6px;
      padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8rem; max-width: 16rem;
    }
    .chat-filters #roomId { min-width: 10rem; }
    .chat-filters #wallet { min-width: 14rem; }
    .chat-filters button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.35rem 0.65rem; cursor: pointer; font: inherit; font-size: 0.8rem;
    }
    .chat-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .chat-table th, .chat-table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: top; }
    .chat-table tr[data-key] { cursor: pointer; }
    .chat-table tr[data-key]:hover, .chat-table tr.is-selected { background: #152030; }
    .chat-detail { margin-top: 0.75rem; padding: 0.65rem; border: 1px solid #263348; border-radius: 8px; background: #0a1018; }
    .chat-detail[hidden] { display: none; }
    .chat-detail h3 { margin: 0 0 0.45rem; font-size: 0.88rem; color: #eef6ff; }
    .chat-original { color: #f87171; white-space: pre-wrap; word-break: break-word; margin: 0.35rem 0; }
    .chat-audience { margin: 0.45rem 0; font-size: 0.76rem; color: #b8c5d9; }
    .chat-audience ul { margin: 0.2rem 0 0; padding-left: 1.1rem; }
    .chat-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.55rem; }
    .chat-actions button, .chat-actions a.btn-link {
      background: #1a2738; color: #d8e2f0; border: 1px solid #334155; border-radius: 6px;
      padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.78rem; text-decoration: none;
      display: inline-block;
    }
    .chat-actions button.primary { background: var(--ms-accent); color: #eef6ff; border-color: var(--ms-accent-hover-border); }
    .chat-actions button.danger { color: #f87171; border-color: #5a2a2a; }
    .chat-status { margin-top: 0.5rem; color: #9fb0c7; font-size: 0.78rem; min-height: 1rem; }
    .chat-flag { color: #fcd34d; font-size: 0.7rem; margin-left: 0.25rem; }
    .err { color: #f87171; }
    .hint { color: #9fb0c7; font-size: 0.82rem; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("chat")}
  <h1 id="chatDocTitle" class="ms-doc-title">Chat log</h1>
  <div id="panel" class="ms-panel ms-mono">Loading…</div>
  <script>
(function () {
  var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
  var token = "";
  var cursor = null;
  var mutes = {};
  var roomsData = [];
  var usersData = [];

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

  function rowKey(m) {
    return m.roomId + "|" + m.fromAddress + "|" + m.at;
  }

  function queryPrefill() {
    var q = new URLSearchParams(location.search);
    return {
      roomId: String(q.get("roomId") || "").trim(),
      wallet: String(q.get("wallet") || "").trim(),
    };
  }

  function roomOptionsHtml(selectedId) {
    var html = "<option value=''>All rooms</option>";
    roomsData.slice().sort(function (a, b) {
      return String(a.displayName || a.id).localeCompare(String(b.displayName || b.id));
    }).forEach(function (room) {
      var id = String(room.id || "");
      var label = String(room.displayName || id) + " (" + id + ")";
      html += "<option value='" + escHtml(id) + "'" + (id === selectedId ? " selected" : "") + ">" +
        escHtml(label) + "</option>";
    });
    return html;
  }

  function walletOptionsHtml(selectedWallet) {
    var sel = String(selectedWallet || "").replace(/\\s+/g, "").toUpperCase();
    var html = "<option value=''>All users</option>";
    usersData.slice().sort(function (a, b) {
      return String(a.label || a.wallet).localeCompare(String(b.label || b.wallet));
    }).forEach(function (user) {
      var w = String(user.wallet || "").replace(/\\s+/g, "").toUpperCase();
      var label = String(user.label || w);
      html += "<option value='" + escHtml(w) + "'" + (w === sel ? " selected" : "") + ">" +
        escHtml(label) + "</option>";
    });
    return html;
  }

  function renderShell(prefill) {
    var panel = document.getElementById("panel");
    if (!panel) return;
    panel.innerHTML =
      "<div class='chat-panel'>" +
      "<div class='chat-filters'>" +
      "<label>Window <select id='days'>" +
      "<option value='1'>24 hours</option>" +
      "<option value='7' selected>7 days</option>" +
      "<option value='30'>30 days</option>" +
      "</select></label>" +
      "<label>Room <select id='roomId'>" + roomOptionsHtml(prefill.roomId) + "</select></label>" +
      "<label>User <select id='wallet'>" + walletOptionsHtml(prefill.wallet) + "</select></label>" +
      "<button type='button' id='searchBtn'>Search</button>" +
      "<button type='button' id='moreBtn' hidden>Load more</button>" +
      "</div>" +
      "<table class='chat-table'><thead><tr><th>Time (UTC)</th><th>Room</th><th>Sender</th><th>Message</th></tr></thead>" +
      "<tbody id='rows'></tbody></table>" +
      "<div id='detail' class='chat-detail' hidden></div>" +
      "<div id='status' class='chat-status'></div>" +
      "</div>";

    document.getElementById("searchBtn").addEventListener("click", function () {
      cursor = null;
      document.getElementById("detail").hidden = true;
      search(false).catch(function () {});
    });
    document.getElementById("moreBtn").addEventListener("click", function () {
      search(true).catch(function () {});
    });
  }

  function setStatus(msg, isErr) {
    var statusEl = document.getElementById("status");
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "chat-status" + (isErr ? " err" : "");
  }

  function loadMutes() {
    return api("/api/admin/bans").then(function (out) {
      if (out.status !== 200) throw new Error(String(out.status));
      mutes = {};
      (out.body.channelMutes || []).forEach(function (m) { mutes[m.address] = true; });
    });
  }

  function renderDetail(m) {
    var detailEl = document.getElementById("detail");
    var q = new URLSearchParams({
      roomId: m.roomId,
      fromAddress: m.fromAddress,
      at: String(m.at)
    });
    return api("/api/admin/chat/message?" + q).then(function (out) {
      if (out.status !== 200) throw new Error(String(out.status));
      var msg = out.body.message;
      if (!msg) { detailEl.hidden = true; return; }
      detailEl.hidden = false;
      var muted = !!mutes[msg.fromAddress];
      var html = "<h3>" + fmtTime(msg.at) + " · " + escHtml(msg.roomId) + "</h3>";
      html += "<div><strong>" + escHtml(msg.displayName || msg.fromAddress) + "</strong> <span class=mono>" + escHtml(msg.fromAddress) + "</span></div>";
      html += "<div style=margin-top:0.35rem>" + escHtml(msg.text) + "</div>";
      if (msg.textOriginal) {
        html += "<div class=chat-original><strong>Original:</strong> " + escHtml(msg.textOriginal) + "</div>";
      }
      html += "<div class=chat-audience><strong>Live audience</strong><ul>";
      (msg.audienceLive || []).forEach(function (w) { html += "<li class=mono>" + escHtml(w) + "</li>"; });
      if (!(msg.audienceLive || []).length) html += "<li>(none recorded)</li>";
      html += "</ul></div>";
      html += "<div class=chat-audience><strong>Backlog on join</strong><ul>";
      (msg.audienceBacklog || []).forEach(function (w) { html += "<li class=mono>" + escHtml(w) + "</li>"; });
      if (!(msg.audienceBacklog || []).length) html += "<li>(none)</li>";
      html += "</ul></div>";
      html += "<div class=chat-actions>";
      html += "<button type=button class=" + (muted ? "primary" : "danger") + " data-mute=" + escHtml(msg.fromAddress) + " data-muted=" + (muted ? "1" : "0") + ">" + (muted ? "Unmute" : "Mute") + "</button>";
      html += "<a class=btn-link href=/admin/feedback?wallet=" + encodeURIComponent(msg.fromAddress) + ">Feedback</a>";
      html += "</div>";
      detailEl.innerHTML = html;
      detailEl.querySelector("[data-mute]").addEventListener("click", function (ev) {
        var btn = ev.currentTarget;
        var target = btn.getAttribute("data-mute");
        var wantMute = btn.getAttribute("data-muted") !== "1";
        api("/api/admin/moderation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "channel_mute", target: target, muted: wantMute })
        }).then(function (out) {
          if (out.status !== 200) throw new Error(String(out.status));
          mutes[target] = wantMute;
          renderDetail(m);
          setStatus(wantMute ? "Muted." : "Unmuted.");
        }).catch(function () { setStatus("Mute failed.", true); });
      });
    });
  }

  function appendRows(messages, replace) {
    var rowsEl = document.getElementById("rows");
    if (!rowsEl) return;
    if (replace) rowsEl.innerHTML = "";
    messages.forEach(function (m) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-key", rowKey(m));
      var sender = (m.displayName ? escHtml(m.displayName) + " " : "") + "<span class=mono>" + escHtml(m.fromAddress.slice(0, 8)) + "…</span>";
      var text = escHtml(m.text) + (m.hasOriginal ? "<span class=chat-flag>filtered</span>" : "");
      tr.innerHTML = "<td>" + fmtTime(m.at) + "</td><td>" + escHtml(m.roomId) + "</td><td>" + sender + "</td><td>" + text + "</td>";
      tr.addEventListener("click", function () {
        Array.prototype.forEach.call(rowsEl.querySelectorAll("tr"), function (r) { r.classList.remove("is-selected"); });
        tr.classList.add("is-selected");
        renderDetail(m).catch(function () { setStatus("Detail failed.", true); });
      });
      rowsEl.appendChild(tr);
    });
  }

  function search(append) {
    var daysEl = document.getElementById("days");
    var roomEl = document.getElementById("roomId");
    var walletEl = document.getElementById("wallet");
    var moreBtn = document.getElementById("moreBtn");
    var days = Number(daysEl && daysEl.value) || 7;
    var roomId = roomEl ? String(roomEl.value || "").trim() : "";
    var wallet = walletEl ? String(walletEl.value || "").trim() : "";
    var to = Date.now();
    var from = to - days * 86400000;
    var q = new URLSearchParams({ from: String(from), to: String(to), limit: "50" });
    if (roomId) q.set("roomId", roomId);
    if (wallet) q.set("wallet", wallet);
    if (append && cursor) q.set("cursor", cursor);
    setStatus("Loading…");
    return api("/api/admin/chat?" + q).then(function (out) {
      if (out.status === 401) { void load(); return; }
      if (out.status === 403) {
        setStatus("Forbidden - server admin wallet only.", true);
        return;
      }
      if (out.status !== 200) throw new Error(String(out.status));
      cursor = out.body.nextCursor || null;
      if (moreBtn) moreBtn.hidden = !cursor;
      appendRows(out.body.messages || [], !append);
      setStatus((out.body.messages || []).length ? "" : "No messages in this window.");
    }).catch(function () { setStatus("Search failed.", true); });
  }

  async function loadMeta() {
    var roomsOut = await api("/api/admin/rooms");
    if (roomsOut.status === 401) return { status: 401 };
    if (roomsOut.status === 403) return { status: 403 };
    if (roomsOut.status !== 200) return { status: roomsOut.status };
    roomsData = roomsOut.body.rooms || [];
    var usersOut = await api("/api/admin/users");
    if (usersOut.status === 401) return { status: 401 };
    if (usersOut.status === 403) return { status: 403 };
    if (usersOut.status !== 200) return { status: usersOut.status };
    usersData = usersOut.body.users || [];
    return { status: 200 };
  }

  async function load() {
    var panel = document.getElementById("panel");
    var docTitle = document.getElementById("chatDocTitle");
    if (!panel) return;
    token = readAuthToken();
    if (!token) {
      if (docTitle) docTitle.hidden = true;
      panel.innerHTML = authGateHtml("You must be signed in.");
      return;
    }
    var meta = await loadMeta();
    if (meta.status === 401) {
      if (docTitle) docTitle.hidden = true;
      panel.innerHTML = authGateHtml("You must be signed in.");
      return;
    }
    if (meta.status === 403) {
      if (docTitle) docTitle.hidden = false;
      panel.innerHTML = "<p class='err'>Forbidden</p><p class='hint'>Server admin wallet only.</p>";
      return;
    }
    if (meta.status !== 200) {
      if (docTitle) docTitle.hidden = false;
      panel.innerHTML = "<p class='err'>Could not load admin data (" + meta.status + ").</p>";
      return;
    }
    if (docTitle) docTitle.hidden = false;
    var prefill = queryPrefill();
    renderShell(prefill);
    try {
      await loadMutes();
      await search(false);
    } catch (e) {
      setStatus("Could not load chat data.", true);
    }
  }

  load();
})();
  </script>
</body>
</html>`;
}
