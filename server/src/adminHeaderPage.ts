import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import {
  HEADER_MARQUEE_MAX_MESSAGES,
  HEADER_MARQUEE_NEWS_MAX_LEN,
} from "./headerMarqueeSettingsStore.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/header` — in-game header marquee (login streaks + optional news). */
export function adminHeaderPageHtml(): string {
  const maxLine = HEADER_MARQUEE_NEWS_MAX_LEN;
  const maxLines = HEADER_MARQUEE_MAX_MESSAGES;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Header banner — Admin — Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84rem; }
    .set-panel { max-width: 40rem; margin: 0.75rem 0 1.25rem; padding: 0.85rem 1rem; border: 1px solid #263348; border-radius: 10px; background: #0f1622; }
    .set-panel h2 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #c8d4e4; font-weight: 600; }
    .set-row { display: flex; align-items: flex-start; gap: 0.65rem; flex-wrap: wrap; margin-bottom: 0.55rem; }
    .set-row label { font-size: 0.82rem; color: #b8c5d9; line-height: 1.45; cursor: pointer; flex: 1 1 14rem; min-width: 0; }
    .set-actions { margin-top: 0.75rem; display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
    .set-actions button {
      background: var(--ms-accent); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 6px; padding: 0.4rem 0.75rem; cursor: pointer; font: inherit; font-size: 0.82rem;
    }
    .set-hint { font-size: 0.76rem; color: #6b7d95; margin: 0.35rem 0 0; line-height: 1.45; }
    .err { color: #f87171; font-size: 0.82rem; }
    .ok { color: #86efac; font-size: 0.78rem; }
    #panel.ms-panel { max-width: 48rem; }
    #news-body { width: 100%; min-height: 4.5rem; box-sizing: border-box; resize: vertical; padding: 0.45rem 0.55rem; border-radius: 8px; border: 1px solid #2f3d53; background: #0c121c; color: #e6edf3; font: inherit; font-size: 0.82rem; }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("header")}
  <h1 class="ms-doc-title">Header banner</h1>
  <div id="panel" class="ms-panel mono">Loading…</div>
  <script>
    var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
    var LINE_MAX = ${maxLine};
    var LINES_MAX = ${maxLines};
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
        var r = await fetch("/api/admin/header-marquee", {
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
        var bannerOn = Boolean(j.bannerEnabled);
        var streakOn = Boolean(j.loginStreakLeaderboardEnabled);
        var newsOn = Boolean(j.newsMessageEnabled);
        var msgs = Array.isArray(j.newsMessages) ? j.newsMessages : [];
        var streakSec = Math.max(1, Math.min(180, parseInt(String(j.marqueeStreakSeconds || 60), 10) || 60));
        var msgSec = Math.max(1, Math.min(120, parseInt(String(j.marqueeMessageSeconds || 10), 10) || 10));
        panel.innerHTML =
          "<div class='set-panel'>" +
          "<h2>In-game top strip</h2>" +
          "<p class='set-hint'>Banner sits at the bottom of the top HUD bar. Streak ticker alternates with each announcement line (fade between).</p>" +
          "<div class='set-row'>" +
          "<input type='checkbox' id='banner-on' " +
          (bannerOn ? "checked " : "") +
          "/>" +
          "<label for='banner-on'>Show header banner (master). When off, nothing from this feature is shown in-game.</label>" +
          "</div>" +
          "<div class='set-row'>" +
          "<input type='checkbox' id='streak-on' " +
          (streakOn ? "checked " : "") +
          "/>" +
          "<label for='streak-on'>Include login-streak leaderboard (top 10, UTC calendar days).</label>" +
          "</div>" +
          "<div class='set-row'>" +
          "<input type='checkbox' id='news-on' " +
          (newsOn ? "checked " : "") +
          "/>" +
          "<label for='news-on'>Include announcement lines (below). Each non-empty line rotates in order with the streak.</label>" +
          "</div>" +
          "<div class='set-row' style='align-items:center'>" +
          "<label for='streak-sec' style='flex:0 0 auto'>Streak safety timeout (s)</label>" +
          "<input type='number' id='streak-sec' min='30' max='180' step='1' value='" +
          streakSec +
          "' style='width:5rem'/>" +
          "<label for='msg-sec' style='flex:0 0 auto;margin-left:0.75rem'>Each message (seconds)</label>" +
          "<input type='number' id='msg-sec' min='1' max='120' step='1' value='" +
          msgSec +
          "' style='width:5rem'/>" +
          "</div>" +
          "<p class='set-hint'>Streak advances to the next line after <strong>one full horizontal scroll</strong> of the leaderboard (not on a fixed clock). The streak timeout is a safety net if the browser never reports that loop (min 55s client-side).</p>" +
          "<label class='set-hint' for='news-body' style='display:block;margin-top:0.65rem'>Announcements — one per line (max " +
          LINES_MAX +
          " lines, " +
          LINE_MAX +
          " chars each)</label>" +
          "<textarea id='news-body' rows='8' spellcheck='true'></textarea>" +
          "<div class='set-actions'>" +
          "<button type='button' id='save-btn'>Save</button>" +
          "<span id='save-msg' class='ok' hidden></span>" +
          "</div></div>";
        var ta = document.getElementById("news-body");
        if (ta) ta.value = msgs.join("\\n");
        var saveBtn = document.getElementById("save-btn");
        var msg = document.getElementById("save-msg");
        if (saveBtn && msg) {
          saveBtn.addEventListener("click", async function () {
            msg.hidden = true;
            var b = document.getElementById("banner-on");
            var st = document.getElementById("streak-on");
            var nw = document.getElementById("news-on");
            var bodyEl = document.getElementById("news-body");
            var streakSecEl = document.getElementById("streak-sec");
            var msgSecEl = document.getElementById("msg-sec");
            var raw = bodyEl ? String(bodyEl.value || "") : "";
            var lines = raw.split(/\\r?\\n/).map(function (s) { return s.trim(); }).filter(Boolean);
            if (lines.length > LINES_MAX) lines = lines.slice(0, LINES_MAX);
            var streakS = parseInt(String(streakSecEl && streakSecEl.value || "60"), 10);
            var msgS = parseInt(String(msgSecEl && msgSecEl.value || "10"), 10);
            try {
              var pr = await fetch("/api/admin/header-marquee", {
                method: "PUT",
                headers: {
                  authorization: "Bearer " + token,
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  bannerEnabled: b && b.checked,
                  loginStreakLeaderboardEnabled: st && st.checked,
                  newsMessageEnabled: nw && nw.checked,
                  newsMessages: lines,
                  marqueeStreakSeconds: streakS,
                  marqueeMessageSeconds: msgS,
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
