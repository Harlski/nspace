import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/feedback` (data via admin feedback APIs). */
export function adminFeedbackPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Feedback - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .fb-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.75rem 0.85rem; width: 100%; box-sizing: border-box; }
    .fb-back {
      appearance: none; border: none; background: transparent; color: #93c5fd;
      font: inherit; font-size: 0.82rem; font-weight: 600; padding: 0; margin: 0 0 0.65rem;
      cursor: pointer;
    }
    .fb-back:hover { color: #bfdbfe; }
    .fb-panel h2 { margin: 0 0 0.55rem; font-size: 0.92rem; color: #c8d4e4; font-weight: 600; }
    .fb-filters { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.65rem; align-items: center; }
    .fb-filters select, .fb-filters input {
      background: #0a1018; color: #d8e2f0; border: 1px solid #263348; border-radius: 6px;
      padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8rem;
    }
    .fb-filters button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.35rem 0.65rem; cursor: pointer; font: inherit; font-size: 0.8rem;
    }
    .fb-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .fb-table th, .fb-table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: top; }
    .fb-table tr[data-id] { cursor: pointer; }
    .fb-table tr[data-id]:hover, .fb-table tr.is-selected { background: #152030; }
    .fb-wallet { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
    .fb-ident { width: 22px; height: 22px; border-radius: 4px; flex-shrink: 0; object-fit: contain; background: rgba(0,0,0,0.2); }
    .fb-wallet__text { font-size: 0.76rem; color: #b8c5d9; word-break: break-all; }
    .fb-submitter {
      display: flex; align-items: center; gap: 0.55rem; margin: 0.35rem 0 0.75rem;
      padding: 0.5rem 0.6rem; border: 1px solid #263348; border-radius: 8px; background: #0a1018;
    }
    .fb-submitter__ident { width: 40px; height: 40px; border-radius: 6px; object-fit: contain; flex-shrink: 0; }
    .fb-submitter__wallet { font-size: 0.8rem; color: #d8e2f0; word-break: break-all; }
    .fb-report {
      margin: 0.65rem 0 0.85rem; padding: 0.55rem 0.65rem;
      border: 1px solid #3d2a14; border-radius: 8px; background: #141008;
    }
    .fb-report h3 { margin: 0 0 0.45rem; font-size: 0.82rem; color: #fcd34d; font-weight: 600; }
    .fb-report__player {
      display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.55rem;
      padding: 0.45rem 0.55rem; border: 1px solid #263348; border-radius: 8px; background: #0a1018;
    }
    .fb-report__player-ident { width: 36px; height: 36px; border-radius: 6px; object-fit: contain; flex-shrink: 0; }
    .fb-report__quoted {
      white-space: pre-wrap; word-break: break-word; line-height: 1.45;
      color: #e8dcc8; padding: 0.45rem 0.55rem; border-radius: 6px;
      border: 1px solid #4a3820; background: #0c0a06;
    }
    .fb-chat-history { margin: 0.75rem 0 0.85rem; }
    .fb-chat-history h3 { margin: 0 0 0.45rem; font-size: 0.82rem; color: #c8d4e4; font-weight: 600; }
    .fb-chat-history__list {
      max-height: 14rem; overflow: auto; display: flex; flex-direction: column; gap: 0.35rem;
      padding: 0.45rem; border: 1px solid #263348; border-radius: 8px; background: #0a1018;
    }
    .fb-chat-history__line {
      font-size: 0.76rem; line-height: 1.4; color: #b8c5d9; padding: 0.25rem 0.35rem;
      border-radius: 4px;
    }
    .fb-chat-history__line--reported {
      background: #2a2010; border: 1px solid #4a3820; color: #f5e6c8;
    }
    .fb-chat-history__time { color: #6b7d95; margin-right: 0.35rem; }
    .fb-badge { display: inline-block; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .fb-badge--open { background: #1e3a5f; color: #93c5fd; }
    .fb-badge--answered { background: #3b2f14; color: #fcd34d; }
    .fb-badge--integrated { background: #14352a; color: #86efac; }
    .fb-badge--closed { background: #2a2a2a; color: #a3a3a3; }
    .fb-thread { max-height: 22rem; overflow: auto; display: flex; flex-direction: column; gap: 0.55rem; margin: 0.5rem 0; padding-right: 0.25rem; }
    .fb-msg { border: 1px solid #223044; border-radius: 8px; padding: 0.45rem 0.55rem; background: #0a1018; }
    .fb-msg--admin { border-color: #2d4a3a; background: #0c1512; }
    .fb-msg__meta { font-size: 0.72rem; color: #6b7d95; margin-bottom: 0.25rem; }
    .fb-msg__body { white-space: pre-wrap; word-break: break-word; line-height: 1.45; color: #d8e2f0; }
    .fb-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0; }
    .fb-actions button, .fb-reply button {
      background: #1a2738; color: #d8e2f0; border: 1px solid #334155; border-radius: 6px;
      padding: 0.35rem 0.6rem; cursor: pointer; font: inherit; font-size: 0.78rem;
    }
    .fb-actions button.primary, .fb-reply button.primary {
      background: var(--ms-accent); color: #eef6ff; border-color: var(--ms-accent-hover-border);
    }
    .fb-reply textarea {
      width: 100%; box-sizing: border-box; min-height: 4.5rem; resize: vertical;
      background: #0a1018; color: #d8e2f0; border: 1px solid #263348; border-radius: 6px;
      padding: 0.45rem 0.55rem; font: inherit; font-size: 0.82rem; line-height: 1.45;
    }
    .fb-reward { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; margin-top: 0.5rem; }
    .fb-reward input {
      width: 6rem; background: #0a1018; color: #d8e2f0; border: 1px solid #263348;
      border-radius: 6px; padding: 0.35rem 0.5rem; font: inherit; font-size: 0.82rem;
    }
    .err { color: #f87171; font-size: 0.82rem; }
    .ok { color: #86efac; font-size: 0.78rem; }
    .hint { color: #6b7d95; font-size: 0.76rem; line-height: 1.45; }
    #panel.ms-panel { max-width: 72rem; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("feedback")}
  <h1 id="fbDocTitle" class="ms-doc-title">Feedback</h1>
  <div id="panel" class="ms-panel mono">Loading…</div>
  <script>
    var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
    var selectedId = "";
    var view = "list";
    var filterStatus = "";
    var filterKind = "";
    var filterWallet = "";
    var identiconCache = {};
    function walletShort(wallet) {
      var w = String(wallet || "").replace(/\\s+/g, "").trim();
      if (w.length <= 12) return w;
      return w.slice(0, 6) + "…" + w.slice(-4);
    }
    function identImg(wallet, size) {
      var w = escHtml(String(wallet || "").trim());
      if (!w) return "";
      var px = size || 22;
      return (
        '<img class="fb-ident" data-fb-wallet="' + w + '" alt="" width="' + px +
        '" height="' + px + '" />'
      );
    }
    function walletCell(wallet) {
      var w = String(wallet || "").trim();
      if (!w) return "-";
      return (
        '<span class="fb-wallet">' + identImg(w, 22) +
        '<span class="fb-wallet__text">' + escHtml(walletShort(w)) + "</span></span>"
      );
    }
    async function fetchIdenticon(wallet) {
      var w = String(wallet || "").trim();
      if (!w) return "";
      if (identiconCache[w]) return identiconCache[w];
      try {
        var r = await fetch("/api/identicon/" + encodeURIComponent(w), { cache: "force-cache" });
        if (!r.ok) return "";
        var j = await r.json();
        var url = String(j.identicon || "");
        identiconCache[w] = url;
        return url;
      } catch (e) {
        return "";
      }
    }
    async function hydrateIdenticons(root) {
      if (!root) return;
      var imgs = root.querySelectorAll("img[data-fb-wallet]");
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var w = img.getAttribute("data-fb-wallet") || "";
        if (!w || img.dataset.fbLoaded === "1") continue;
        var url = await fetchIdenticon(w);
        if (url) img.src = url;
        img.dataset.fbLoaded = "1";
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
    function fmtTime(ms) {
      if (!ms) return "-";
      try { return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC"; }
      catch { return String(ms); }
    }
    function badge(status) {
      var cls = "fb-badge fb-badge--" + escHtml(status || "open");
      return '<span class="' + cls + '">' + escHtml(status || "open") + "</span>";
    }
    function authGateHtml(msg) {
      return (
        "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
        "<div class='ms-auth-gate-msg'>" + escHtml(msg || "You must be signed in.") + "</div>" +
        "</div>"
      );
    }
    async function api(token, path, opts) {
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
    function renderReportContext(ticket) {
      var ctx = ticket.reportContext;
      if (!ctx || typeof ctx !== "object") return "";
      var wallet = String(ctx.reportedWallet || "").trim();
      var name = String(ctx.reportedDisplayName || "").trim() || "Unknown";
      var quoted = String(ctx.reportedMessage || "").trim();
      var history = Array.isArray(ctx.reportedUserChatHistory)
        ? ctx.reportedUserChatHistory.slice()
        : [];
      history.sort(function (a, b) {
        return (a.at || 0) - (b.at || 0);
      });
      var historyHtml = "";
      if (history.length) {
        var lines = history.map(function (line) {
          var text = String(line.text || "");
          var at = line.at || 0;
          var isReported =
            quoted &&
            text === quoted &&
            (!ctx.reportedAtMs || Math.abs(at - ctx.reportedAtMs) < 5000);
          return (
            '<div class="fb-chat-history__line' +
            (isReported ? " fb-chat-history__line--reported" : "") +
            '"><span class="fb-chat-history__time">' +
            fmtTime(at) +
            "</span>" +
            escHtml(text) +
            "</div>"
          );
        }).join("");
        historyHtml =
          '<div class="fb-chat-history"><h3>Recent chat from reported player</h3>' +
          '<div class="fb-chat-history__list">' +
          lines +
          "</div></div>";
      } else if (ticket.source === "report") {
        historyHtml =
          '<p class="hint">No recent chat history was captured for this player (messages may have expired from the server backlog).</p>';
      }
      return (
        '<div class="fb-report"><h3>Chat report</h3>' +
        (wallet
          ? '<div class="fb-report__player">' +
            identImg(wallet, 36) +
            '<div><div class="fb-submitter__wallet">' +
            escHtml(name) +
            "</div><div class='hint mono'>" +
            escHtml(wallet) +
            "</div></div></div>"
          : "") +
        (quoted
          ? '<div class="fb-report__quoted">' + escHtml(quoted) + "</div>"
          : '<p class="hint">No quoted message.</p>') +
        historyHtml +
        "</div>"
      );
    }
    function renderDetail(token, ticket) {
      if (!ticket) {
        return '<p class="hint">Could not load this ticket.</p>';
      }
      var msgs = (ticket.messages || []).slice().sort(function (a, b) {
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      }).map(function (m) {
        var who = m.isAdmin ? "Admin" : (m.authorWallet || "Player");
        return (
          '<div class="fb-msg' + (m.isAdmin ? " fb-msg--admin" : "") + '">' +
          '<div class="fb-msg__meta">' + escHtml(who) + " · " + fmtTime(m.createdAtMs) + "</div>" +
          '<div class="fb-msg__body">' + escHtml(m.body) + "</div></div>"
        );
      }).join("");
      var reward = "";
      if (ticket.rewardLuna) {
        var nim = (Number(ticket.rewardLuna) / 100000).toFixed(4);
        reward = '<p class="ok">Rewarded: ' + escHtml(nim) + " NIM</p>";
      } else if (ticket.status === "integrated") {
        reward =
          '<div class="fb-reward">' +
          '<label>NIM reward <input type="number" id="fb-reward-nim" min="0.1" max="2" step="0.01" value="0.25"/></label>' +
          '<button type="button" class="primary" id="fb-reward-btn">Send NIM</button>' +
          "</div>";
      }
      var submitter = String(ticket.wallet || "").trim();
      return (
        '<button type="button" class="fb-back" id="fb-back-btn">← Back to inbox</button>' +
        '<h2>Ticket ' + escHtml(ticket.id.slice(0, 8)) + "…</h2>" +
        '<p class="hint">' + badge(ticket.status) + " · " + escHtml(ticket.kind) +
        (ticket.source === "report" ? " · report" : "") +
        " · updated " + fmtTime(ticket.updatedAtMs) + "</p>" +
        (submitter
          ? '<div class="fb-submitter">' + identImg(submitter, 40) +
            '<span class="fb-submitter__wallet">Reporter: ' + escHtml(submitter) + "</span></div>"
          : "") +
        renderReportContext(ticket) +
        '<div class="fb-thread">' + msgs + "</div>" +
        '<div class="fb-actions">' +
        '<button type="button" data-status="answered">Mark answered</button>' +
        '<button type="button" data-status="integrated">Mark integrated</button>' +
        '<button type="button" data-status="closed">Close</button>' +
        "</div>" +
        reward +
        '<div class="fb-reply">' +
        '<textarea id="fb-reply-text" maxlength="700" placeholder="Admin reply…"></textarea>' +
        '<div style="margin-top:0.45rem;display:flex;gap:0.45rem;align-items:center;">' +
        '<button type="button" class="primary" id="fb-reply-btn">Send reply</button>' +
        '<span id="fb-detail-msg" class="ok" hidden></span>' +
        "</div></div>"
      );
    }
    function renderList(tickets, total) {
      if (!tickets.length) {
        return '<p class="hint">No tickets match filters.</p>';
      }
      var rows = tickets.map(function (t) {
        return (
          "<tr data-id=\\"" + escHtml(t.id) + "\\">" +
          "<td>" + badge(t.status) + "</td>" +
          "<td>" + escHtml(t.kind) + "</td>" +
          "<td>" + walletCell(t.wallet) + "</td>" +
          "<td>" + escHtml((t.preview || "").slice(0, 48)) + "</td>" +
          "<td>" + fmtTime(t.updatedAtMs) + "</td></tr>"
        );
      }).join("");
      return (
        '<p class="hint">' + total + " ticket(s)</p>" +
        '<table class="fb-table"><thead><tr><th>Status</th><th>Kind</th><th>Wallet</th><th>Preview</th><th>Updated</th></tr></thead>' +
        "<tbody>" + rows + "</tbody></table>"
      );
    }
    async function loadList(token) {
      var q = "?limit=80";
      if (filterStatus) q += "&status=" + encodeURIComponent(filterStatus);
      if (filterKind) q += "&kind=" + encodeURIComponent(filterKind);
      if (filterWallet.trim()) q += "&wallet=" + encodeURIComponent(filterWallet.trim());
      return api(token, "/api/admin/feedback" + q);
    }
    function renderInboxPanel(tickets, total) {
      return (
        '<div class="fb-panel"><h2>Inbox</h2>' +
        '<div class="fb-filters">' +
        '<select id="fb-filter-status"><option value="">All statuses</option>' +
        '<option value="open">open</option><option value="answered">answered</option>' +
        '<option value="integrated">integrated</option><option value="closed">closed</option></select>' +
        '<select id="fb-filter-kind"><option value="">All kinds</option>' +
        '<option value="bug">bug</option><option value="feature">feature</option>' +
        '<option value="suggestion">suggestion</option></select>' +
        '<input id="fb-filter-wallet" placeholder="Wallet filter" />' +
        '<button type="button" id="fb-filter-btn">Apply</button></div>' +
        '<div id="fb-list">' + renderList(tickets, total) + "</div></div>"
      );
    }
    function wireInbox(token) {
      var statusEl = document.getElementById("fb-filter-status");
      var kindEl = document.getElementById("fb-filter-kind");
      var walletEl = document.getElementById("fb-filter-wallet");
      if (statusEl) statusEl.value = filterStatus;
      if (kindEl) kindEl.value = filterKind;
      if (walletEl) walletEl.value = filterWallet;
      document.getElementById("fb-filter-btn")?.addEventListener("click", function () {
        filterStatus = statusEl ? statusEl.value : "";
        filterKind = kindEl ? kindEl.value : "";
        filterWallet = walletEl ? walletEl.value : "";
        view = "list";
        void refresh(token);
      });
      document.querySelectorAll(".fb-table tr[data-id]").forEach(function (row) {
        row.addEventListener("click", function () {
          selectedId = row.getAttribute("data-id") || "";
          view = "detail";
          void refresh(token);
        });
      });
    }
    async function loadDetail(token, id) {
      return api(token, "/api/admin/feedback/" + encodeURIComponent(id));
    }
    function wireDetail(token, ticket) {
      if (!ticket) return;
      document.getElementById("fb-back-btn")?.addEventListener("click", function () {
        view = "list";
        void refresh(token);
      });
      panel.querySelectorAll("[data-status]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var st = btn.getAttribute("data-status");
          void (async function () {
            var out = await api(token, "/api/admin/feedback/" + encodeURIComponent(ticket.id), {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status: st }),
            });
            if (out.status === 200) {
              await refresh(token);
            } else if (out.status === 401) {
              await load();
            }
          })();
        });
      });
      var replyBtn = document.getElementById("fb-reply-btn");
      if (replyBtn) {
        replyBtn.addEventListener("click", function () {
          var ta = document.getElementById("fb-reply-text");
          var msg = ta ? ta.value.trim() : "";
          if (!msg) return;
          void (async function () {
            var out = await api(token, "/api/admin/feedback/" + encodeURIComponent(ticket.id) + "/messages", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ message: msg }),
            });
            if (out.status === 200) {
              await refresh(token);
            } else if (out.status === 401) {
              await load();
            }
          })();
        });
      }
      var rewardBtn = document.getElementById("fb-reward-btn");
      if (rewardBtn) {
        rewardBtn.addEventListener("click", function () {
          var inp = document.getElementById("fb-reward-nim");
          var nim = inp ? Number(inp.value) : 0;
          if (!Number.isFinite(nim) || nim < 0.1 || nim > 2) return;
          void (async function () {
            var out = await api(token, "/api/admin/feedback/" + encodeURIComponent(ticket.id) + "/reward", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ amountNim: nim }),
            });
            if (out.status === 200) {
              await refresh(token);
            } else if (out.status === 401) {
              await load();
            }
          })();
        });
      }
    }
    async function refresh(token) {
      var panel = document.getElementById("panel");
      var docTitle = document.getElementById("fbDocTitle");
      if (!panel) return;
      var listOut = await loadList(token);
      if (listOut.status === 401) {
        if (docTitle) docTitle.hidden = true;
        panel.innerHTML = authGateHtml("You must be signed in.");
        return;
      }
      if (listOut.status === 403) {
        if (docTitle) docTitle.hidden = false;
        panel.innerHTML = "<p class='err'>Forbidden</p><p class='hint'>Server admin wallet only.</p>";
        return;
      }
      if (listOut.status !== 200) {
        if (docTitle) docTitle.hidden = false;
        panel.innerHTML = "<p class='err'>Could not load feedback (" + listOut.status + ").</p>";
        return;
      }
      if (docTitle) docTitle.hidden = false;
      var tickets = listOut.body.tickets || [];
      var total = listOut.body.total || tickets.length;
      if (view === "detail" && selectedId) {
        var dOut = await loadDetail(token, selectedId);
        if (dOut.status === 401) {
          if (docTitle) docTitle.hidden = true;
          panel.innerHTML = authGateHtml("You must be signed in.");
          return;
        }
        if (dOut.status !== 200 || !dOut.body.ticket) {
          view = "list";
          selectedId = "";
          panel.innerHTML = renderInboxPanel(tickets, total);
          void hydrateIdenticons(panel);
          wireInbox(token);
          return;
        }
        panel.innerHTML =
          '<div class="fb-panel" id="fb-detail">' + renderDetail(token, dOut.body.ticket) + "</div>";
        void hydrateIdenticons(panel);
        wireDetail(token, dOut.body.ticket);
        return;
      }
      view = "list";
      panel.innerHTML = renderInboxPanel(tickets, total);
      void hydrateIdenticons(panel);
      wireInbox(token);
    }
    async function load() {
      var panel = document.getElementById("panel");
      var docTitle = document.getElementById("fbDocTitle");
      if (!panel) return;
      var token = readAuthToken();
      if (!token) {
        if (docTitle) docTitle.hidden = true;
        panel.innerHTML = authGateHtml("You must be signed in.");
        return;
      }
      await refresh(token);
    }
    load();
  </script>
</body>
</html>`;
}
