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
  <title>Chat — Admin — Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .chat-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.75rem 0.85rem; }
    .chat-filters { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.65rem; align-items: center; }
    .chat-filters select, .chat-filters input {
      background: #0a1018; color: #d8e2f0; border: 1px solid #263348; border-radius: 6px;
      padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8rem;
    }
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
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("chat")}
  <h1 class="ms-doc-title">Chat log</h1>
  <div class="chat-panel ms-mono">
    <div class="chat-filters">
      <label>Window
        <select id="days">
          <option value="1">24 hours</option>
          <option value="7" selected>7 days</option>
          <option value="30">30 days</option>
        </select>
      </label>
      <label>Room <input id="roomId" type="text" placeholder="hub" style="width:6rem"/></label>
      <label>Wallet <input id="wallet" type="text" placeholder="NQ…" style="width:14rem"/></label>
      <button type="button" id="searchBtn">Search</button>
      <button type="button" id="moreBtn" hidden>Load more</button>
    </div>
    <table class="chat-table">
      <thead><tr><th>Time (UTC)</th><th>Room</th><th>Sender</th><th>Message</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <div id="detail" class="chat-detail" hidden></div>
    <div id="status" class="chat-status"></div>
  </div>
  <script>
(function () {
  var token = localStorage.getItem("nspace_admin_token") || localStorage.getItem("nspace_token") || "";
  var rowsEl = document.getElementById("rows");
  var detailEl = document.getElementById("detail");
  var statusEl = document.getElementById("status");
  var moreBtn = document.getElementById("moreBtn");
  var cursor = null;
  var mutes = {};

  function setStatus(msg, isErr) {
    statusEl.textContent = msg || "";
    statusEl.className = "chat-status" + (isErr ? " err" : "");
  }

  function api(path) {
    return fetch(path, { headers: { Authorization: "Bearer " + token } }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  function fmtTime(at) {
    return new Date(at).toISOString().replace("T", " ").slice(0, 19);
  }

  function rowKey(m) {
    return m.roomId + "|" + m.fromAddress + "|" + m.at;
  }

  function loadMutes() {
    return api("/api/admin/bans").then(function (d) {
      mutes = {};
      (d.channelMutes || []).forEach(function (m) { mutes[m.address] = true; });
    }).catch(function () {});
  }

  function renderDetail(m) {
    var q = new URLSearchParams({
      roomId: m.roomId,
      fromAddress: m.fromAddress,
      at: String(m.at)
    });
    return api("/api/admin/chat/message?" + q).then(function (d) {
      var msg = d.message;
      if (!msg) { detailEl.hidden = true; return; }
      detailEl.hidden = false;
      var muted = !!mutes[msg.fromAddress];
      var html = "<h3>" + fmtTime(msg.at) + " · " + msg.roomId + "</h3>";
      html += "<div><strong>" + escapeHtml(msg.displayName || msg.fromAddress) + "</strong> <span class=mono>" + msg.fromAddress + "</span></div>";
      html += "<div style=margin-top:0.35rem>" + escapeHtml(msg.text) + "</div>";
      if (msg.textOriginal) {
        html += "<div class=chat-original><strong>Original:</strong> " + escapeHtml(msg.textOriginal) + "</div>";
      }
      html += "<div class=chat-audience><strong>Live audience</strong><ul>";
      (msg.audienceLive || []).forEach(function (w) { html += "<li class=mono>" + w + "</li>"; });
      if (!(msg.audienceLive || []).length) html += "<li>(none recorded)</li>";
      html += "</ul></div>";
      html += "<div class=chat-audience><strong>Backlog on join</strong><ul>";
      (msg.audienceBacklog || []).forEach(function (w) { html += "<li class=mono>" + w + "</li>"; });
      if (!(msg.audienceBacklog || []).length) html += "<li>(none)</li>";
      html += "</ul></div>";
      html += "<div class=chat-actions>";
      html += "<button type=button class=" + (muted ? "primary" : "danger") + " data-mute=" + msg.fromAddress + " data-muted=" + (muted ? "1" : "0") + ">" + (muted ? "Unmute" : "Mute") + "</button>";
      html += "<a class=btn-link href=/admin/feedback?wallet=" + encodeURIComponent(msg.fromAddress) + ">Feedback</a>";
      html += "</div>";
      detailEl.innerHTML = html;
      detailEl.querySelector("[data-mute]").addEventListener("click", function (ev) {
        var btn = ev.currentTarget;
        var target = btn.getAttribute("data-mute");
        var wantMute = btn.getAttribute("data-muted") !== "1";
        fetch("/api/admin/moderation", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ action: "channel_mute", target: target, muted: wantMute })
        }).then(function (r) { return r.json(); }).then(function () {
          mutes[target] = wantMute;
          renderDetail(m);
          setStatus(wantMute ? "Muted." : "Unmuted.");
        }).catch(function () { setStatus("Mute failed.", true); });
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function appendRows(messages, replace) {
    if (replace) rowsEl.innerHTML = "";
    messages.forEach(function (m) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-key", rowKey(m));
      var sender = (m.displayName ? escapeHtml(m.displayName) + " " : "") + "<span class=mono>" + m.fromAddress.slice(0, 8) + "…</span>";
      var text = escapeHtml(m.text) + (m.hasOriginal ? "<span class=chat-flag>filtered</span>" : "");
      tr.innerHTML = "<td>" + fmtTime(m.at) + "</td><td>" + escapeHtml(m.roomId) + "</td><td>" + sender + "</td><td>" + text + "</td>";
      tr.addEventListener("click", function () {
        Array.prototype.forEach.call(rowsEl.querySelectorAll("tr"), function (r) { r.classList.remove("is-selected"); });
        tr.classList.add("is-selected");
        renderDetail(m).catch(function () { setStatus("Detail failed.", true); });
      });
      rowsEl.appendChild(tr);
    });
  }

  function search(append) {
    var days = Number(document.getElementById("days").value) || 7;
    var roomId = document.getElementById("roomId").value.trim();
    var wallet = document.getElementById("wallet").value.trim();
    var to = Date.now();
    var from = to - days * 86400000;
    var q = new URLSearchParams({ from: String(from), to: String(to), limit: "50" });
    if (roomId) q.set("roomId", roomId);
    if (wallet) q.set("wallet", wallet);
    if (append && cursor) q.set("cursor", cursor);
    setStatus("Loading…");
    return api("/api/admin/chat?" + q).then(function (d) {
      cursor = d.nextCursor || null;
      moreBtn.hidden = !cursor;
      appendRows(d.messages || [], !append);
      setStatus((d.messages || []).length ? "" : "No messages in this window.");
    }).catch(function () { setStatus("Search failed.", true); });
  }

  document.getElementById("searchBtn").addEventListener("click", function () {
    cursor = null;
    detailEl.hidden = true;
    search(false).catch(function () {});
  });
  moreBtn.addEventListener("click", function () { search(true).catch(function () {}); });

  loadMutes().then(function () { search(false).catch(function () {}); });
})();
  </script>
</body>
</html>`;
}
