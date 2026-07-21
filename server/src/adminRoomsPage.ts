import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";
import { nimiqHexLoaderSvg } from "./nimiqHexLoaderMarkup.js";

/**
 * System-admin room manager: Official / Player Owned tabs, per-room cards with a
 * 2D thumbnail and a click-through interactive 3D preview, plus property and
 * builder-allowlist editing. Server-rendered HTML + inline JS, Bearer-authed.
 */
export function adminRoomsPageHtml(): string {
  const msSigningHexSpinner = JSON.stringify(nimiqHexLoaderSvg("ms-spinner"));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Rooms - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-size: 0.84rem; }
    .status { margin-top: 0.55rem; color: #9fb0c7; }
    .err { color: #f87171; }
    .ok { color: #4ade80; }
    .rooms-tabs { display: flex; gap: 0.4rem; margin-bottom: 0.9rem; flex-wrap: wrap; }
    .rooms-tab { background: #0f1622; color: #c8d4e4; border: 1px solid #2c3b52; border-radius: 999px; padding: 0.4rem 0.9rem; cursor: pointer; font: inherit; font-size: 0.82rem; font-weight: 650; }
    .rooms-tab[aria-selected="true"] { background: var(--ms-accent, #2b5ea7); color: #eef6ff; border-color: var(--ms-accent-hover-border, #4d83d0); }
    .rooms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.85rem; }
    .room-card { background: #131b27; border: 1px solid #263348; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .room-thumb { position: relative; width: 100%; aspect-ratio: 1 / 1; background: #0b1119 repeating-conic-gradient(#10161f 0% 25%, #0d131b 0% 50%) 0 / 24px 24px; display: flex; align-items: center; justify-content: center; }
    .room-thumb img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }
    .room-thumb-preview { position: absolute; right: 0.5rem; bottom: 0.5rem; background: rgba(11, 17, 25, 0.82); border: 1px solid #2f3d53; color: #e6edf3; border-radius: 8px; padding: 0.3rem 0.55rem; font-size: 0.74rem; cursor: pointer; }
    .room-thumb-preview:hover { border-color: var(--ms-accent-hover-border, #4d83d0); }
    .room-body { padding: 0.7rem 0.75rem 0.85rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .room-name { font-size: 0.98rem; font-weight: 700; color: #eef6ff; line-height: 1.2; }
    .room-meta { font-size: 0.74rem; color: #8b9cb3; display: flex; flex-wrap: wrap; gap: 0.35rem 0.7rem; }
    .room-tag { display: inline-block; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.1rem 0.4rem; border-radius: 999px; border: 1px solid #2f3d53; color: #b8c5d9; }
    .room-tag--official { color: #ffd28a; border-color: #5a4a2a; }
    .room-tag--player { color: #9fd3ff; border-color: #2a4a5a; }
    .room-tag--builtin { color: #c8b8ff; border-color: #3a2a5a; }
    .room-tag--hidden { color: #f0a; border-color: #5a2a4a; }
    .room-tag--deleted { color: #f87171; border-color: #5a2a2a; }
    .room-editor { margin-top: 0.2rem; border-top: 1px solid #243044; padding-top: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .room-field { display: flex; flex-direction: column; gap: 0.2rem; }
    .room-field label { font-size: 0.72rem; color: #8b9cb3; text-transform: uppercase; letter-spacing: 0.04em; }
    .room-field input[type="text"], .room-field input[type="number"], .room-field select { background: #0f1622; color: #dbe6f4; border: 1px solid #2c3b52; border-radius: 6px; padding: 0.4rem 0.5rem; font: inherit; font-size: 0.84rem; width: 100%; box-sizing: border-box; }
    .room-row { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
    .room-toggle { display: inline-flex; gap: 0.4rem; align-items: center; font-size: 0.82rem; color: #c8d4e4; }
    .room-builders { display: flex; flex-direction: column; gap: 0.3rem; }
    .room-builder-list { display: flex; flex-direction: column; gap: 0.25rem; }
    .room-builder-item { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; background: #0f1622; border: 1px solid #263348; border-radius: 6px; padding: 0.3rem 0.45rem; }
    .room-builder-item .mono { font-size: 0.76rem; }
    .room-builder-item .builder-label { font-size: 0.8rem; color: #dbe6f4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .room-builder-item .builder-label .mono { color: #8b9cb3; margin-left: 0.35rem; }
    .room-builder-add { display: flex; gap: 0.4rem; }
    .room-builder-add input { flex: 1 1 auto; }
    .room-builder-combo { position: relative; }
    .room-builder-results { position: absolute; left: 0; right: 0; top: calc(100% + 2px); z-index: 50; background: #0f1622; border: 1px solid #2c3b52; border-radius: 6px; max-height: 13rem; overflow-y: auto; box-shadow: 0 12px 28px rgba(0,0,0,0.5); }
    .room-builder-results[hidden] { display: none; }
    .room-builder-result { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.35rem 0.5rem; cursor: pointer; border-bottom: 1px solid #1c2738; }
    .room-builder-result:last-child { border-bottom: 0; }
    .room-builder-result:hover, .room-builder-result.is-active { background: #1a2434; }
    .room-builder-result .builder-name { font-size: 0.82rem; color: #eef6ff; }
    .room-builder-result .builder-addr { font-size: 0.7rem; color: #8b9cb3; }
    .room-builder-empty { padding: 0.4rem 0.5rem; font-size: 0.76rem; color: #8b9cb3; }
    .btn { background: var(--ms-accent, #2b5ea7); color: #eef6ff; border: 1px solid var(--ms-accent-hover-border, #4d83d0); border-radius: 6px; padding: 0.4rem 0.7rem; cursor: pointer; font: inherit; font-size: 0.82rem; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn--ghost { background: transparent; color: #c8d4e4; border-color: #3d4f66; }
    .btn--danger { background: transparent; color: #f87171; border-color: #5a2a2a; }
    .room-card-status { font-size: 0.76rem; min-height: 1rem; }
    .preview-backdrop { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(0,0,0,0.62); box-sizing: border-box; }
    .preview-dialog { width: 100%; max-width: 920px; height: min(82vh, 720px); background: #0b1119; border: 1px solid #2d3c52; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.6); }
    .preview-head { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; border-bottom: 1px solid #243044; }
    .preview-head h3 { margin: 0; font-size: 0.95rem; color: #eef6ff; }
    .preview-close { background: transparent; border: 1px solid #3d4f66; color: #c8d4e4; border-radius: 8px; padding: 0.3rem 0.6rem; cursor: pointer; }
    .preview-frame { flex: 1; border: 0; width: 100%; background: #0b1119; }
    .template-create-card { margin-bottom: 0.85rem; }
    .template-create-preview { margin-top: 0.65rem; display: grid; grid-template-columns: minmax(140px, 220px) 1fr; gap: 0.75rem; align-items: stretch; }
    .template-create-preview[hidden] { display: none; }
    .template-create-preview__meta { grid-column: 1 / -1; font-size: 0.78rem; color: #9fb0c7; display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; align-items: center; }
    .template-create-preview__frame { min-height: 260px; border: 1px solid #243044; border-radius: 8px; overflow: hidden; background: #0b1119; }
    .template-create-preview__frame iframe { width: 100%; height: 100%; min-height: 260px; border: 0; display: block; }
    .template-create-actions { margin-top: 0.65rem; display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
    @media (max-width: 720px) {
      .template-create-preview { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body class="ms-site">
  ${analyticsTopbarHtml("rooms")}
  <h1 id="adminDocTitle" class="ms-doc-title">Rooms</h1>
  <div id="panel" class="ms-panel ms-mono">Loading...</div>
  <script>
    var MS_SIGNING_HEX_SPINNER = ${msSigningHexSpinner};
    var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
    var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
    function readAuthToken() {
      if (typeof window.__nsHydrateMainSiteAuth === "function") window.__nsHydrateMainSiteAuth();
      for (var i = 0; i < AUTH_KEYS.length; i++) {
        var t = sessionStorage.getItem(AUTH_KEYS[i]);
        if (t) return t;
      }
      return "";
    }
    function writeAuthToken(token) {
      for (var j = 0; j < AUTH_KEYS.length; j++) sessionStorage.setItem(AUTH_KEYS[j], token);
      var addr = sessionStorage.getItem(AUTH_ADDR_KEY) || "";
      if (typeof window.__nsSaveMainSiteAuth === "function") window.__nsSaveMainSiteAuth(token, addr);
    }
    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function walletCompact(v) { return String(v || "").replace(/\\s+/g, "").toUpperCase(); }
    function walletGrouped(v) { return walletCompact(v).replace(/(.{4})(?=.)/g, "$1 "); }
    function walletShort(v) { var c = walletCompact(v); return c.length <= 12 ? c : c.slice(0, 8) + "…" + c.slice(-4); }
    function parseJwtSub(token) {
      try {
        var p = String(token || "").split(".")[1] || "";
        if (!p) return "";
        var json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
        return String(JSON.parse(json).sub || "");
      } catch (e) { return ""; }
    }
    function toB64(u8) { var s = ""; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
    var signingDotsTimer = null;
    function walletSigningMarkup() {
      return "<div class='ms-wallet-signing ms-wallet-signing--column' role='status' aria-live='polite'>" + MS_SIGNING_HEX_SPINNER +
        "<p class='ms-signing-in-line'><span class='ms-signing-static'>Signing in</span><span class='ms-signing-dots-live' aria-hidden='true'>.</span></p>" +
        "<span class='ms-sr-only'>Signing in</span></div>";
    }
    function stopSigningDots() { if (signingDotsTimer) { clearInterval(signingDotsTimer); signingDotsTimer = null; } }
    function startSigningDots(root) {
      stopSigningDots();
      var el = root.querySelector(".ms-signing-dots-live");
      if (!el) return;
      var states = [".", "..", "...", "."]; var i = 0; el.textContent = states[0];
      signingDotsTimer = setInterval(function () { i = (i + 1) % states.length; el.textContent = states[i]; }, 400);
    }
    function isUserCancel(e) {
      var m = String((e && e.message) || e || "").toLowerCase();
      return ["connection was closed", "user closed", "user denied", "rejected", "aborted", "cancelled", "canceled"].some(function (k) { return m.indexOf(k) !== -1; });
    }
    async function runWalletLogin() {
      var panel = document.getElementById("panel");
      stopSigningDots();
      if (panel) { panel.innerHTML = walletSigningMarkup(); startSigningDots(panel); }
      try {
        var extraTpAck = undefined;
        var verified = null;
        var lastPayload = null;
        while (true) {
          var nonceResp = await fetch("/api/auth/nonce");
          if (!nonceResp.ok) throw new Error("nonce_failed");
          var nonce = String((await nonceResp.json()).nonce || "");
          var message = "Login:v1:" + nonce;
          lastPayload = await window.__nsMainSiteSignLoginPayload(nonce, message);
          var verifyPayload = window.nspaceTermsPrivacyVerifyPayload(lastPayload, extraTpAck);
          var verifyResp = await window.nspacePostAuthVerify(verifyPayload);
          if (verifyResp.ok) { window.nspaceTermsPrivacyPersistLocal(); verified = await verifyResp.json(); break; }
          var errBody = await verifyResp.json().catch(function () { return {}; });
          if (verifyResp.status === 403 && (errBody.error === "terms_privacy_ack_required" || errBody.error === "legal_consent_required")) {
            await window.nspaceShowTermsPrivacyAckBarrier();
            extraTpAck = window.NSPACE_TERMS_PRIVACY_DOCS_VERSION;
            continue;
          }
          throw new Error(String(errBody.error || "verify_failed"));
        }
        var token = String(verified.token || "");
        var address = String(verified.address || (lastPayload && lastPayload.signer) || "");
        if (!token) throw new Error("missing_token");
        if (address) sessionStorage.setItem(AUTH_ADDR_KEY, address);
        writeAuthToken(token);
        stopSigningDots();
        window.location.reload();
      } catch (e) {
        stopSigningDots();
        if (panel) {
          panel.innerHTML = "<div class='ms-auth-gate ms-auth-gate--standalone'><div class='ms-auth-gate-msg'>" +
            (isUserCancel(e) ? "You must be signed in." : "Sign-in could not be completed.") + "</div></div>";
        }
      }
    }
    window.__nsMainSiteLoginClick = function () { void runWalletLogin(); };

    async function fetchAuthStatus(token) {
      try {
        var r = await fetch("/api/analytics/auth-status", { headers: { authorization: "Bearer " + token }, cache: "no-store" });
        if (!r.ok) return { systemAdmin: false };
        return await r.json();
      } catch (e) { return { systemAdmin: false }; }
    }

    var roomsData = [];
    var templatesData = [];
    var usersData = [];
    var userByWallet = {};
    var activeTab = "official";
    var token = "";
    var PLAY_SPACE_TEMPLATE_PICK_KEY = "nspace_admin_play_space_template_id";
    var templateCreatePickId = "";
    var templateCreateSnapshotOk = true;

    // Established short wallet form (first 4 + last 4, no gap), mirrors server walletDisplayName.
    function walletLabelShort(v) { var c = walletCompact(v); return c.length <= 8 ? c : c.slice(0, 4) + c.slice(-4); }
    function builderLabel(wallet) {
      var u = userByWallet[walletCompact(wallet)];
      if (u && u.username) return u.username;
      return walletLabelShort(wallet);
    }

    function thumbSrc(id) { return "/api/admin/rooms/" + encodeURIComponent(id) + "/thumbnail.png?token=" + encodeURIComponent(token); }

    function categoryTag(room) {
      if (room.isBuiltin) return "<span class='room-tag room-tag--builtin'>Built-in</span>";
      if (room.isOfficial) return "<span class='room-tag room-tag--official'>Official</span>";
      return "<span class='room-tag room-tag--player'>Player</span>";
    }

    function bgValue(room) {
      if (room.backgroundNeutral) return "neutral:" + room.backgroundNeutral;
      if (room.backgroundHueDeg != null) return "hue:" + room.backgroundHueDeg;
      return "default";
    }

    function builderListHtml(room) {
      if (!room.builderEditable) return "";
      var items = (room.builderAddresses || []).map(function (w) {
        var label = builderLabel(w);
        var sub = label === walletShort(w) ? "" : "<span class='mono'>" + esc(walletShort(w)) + "</span>";
        return "<div class='room-builder-item'><span class='builder-label' title='" + esc(w) + "'>" + esc(label) + sub +
          "</span><button class='btn btn--danger' data-builder-remove='" + esc(w) + "'>Remove</button></div>";
      }).join("");
      return "<div class='room-builders'><label>Builders (can build/edit)</label>" +
        "<div class='room-builder-list'>" + (items || "<span class='status' style='margin:0'>No extra builders.</span>") + "</div>" +
        "<div class='room-builder-add room-builder-combo'>" +
        "<input type='text' data-builder-search placeholder='Search users by name or NQ…' autocomplete='off'/>" +
        "<div class='room-builder-results' data-builder-results hidden></div></div></div>";
    }

    // Ownership transfer is only meaningful for player rooms (built-in and
    // official rooms have no per-wallet owner).
    function ownerTransferHtml(room) {
      if (room.isBuiltin || room.isOfficial) return "";
      var current = room.ownerAddress
        ? "<span class='builder-label' title='" + esc(room.ownerAddress) + "'>" + esc(builderLabel(room.ownerAddress)) +
          "<span class='mono'>" + esc(walletShort(room.ownerAddress)) + "</span></span>"
        : "<span class='builder-label'>No owner</span>";
      var pending = "";
      if (room.pendingOwnerAddress) {
        pending = "<div class='room-builder-item'><span class='builder-label' title='" + esc(room.pendingOwnerAddress) + "'>New owner: " +
          esc(builderLabel(room.pendingOwnerAddress)) + "<span class='mono'>" + esc(walletShort(room.pendingOwnerAddress)) + "</span></span>" +
          "<button class='btn btn--ghost' data-owner-clear>Undo</button></div>";
      }
      return "<div class='room-builders'><label>Owner (transfer)</label>" +
        "<div class='room-builder-list'><div class='room-builder-item'>" + current + "</div>" + pending + "</div>" +
        "<div class='room-builder-add room-builder-combo'>" +
        "<input type='text' data-owner-search placeholder='Transfer to user by name or NQ…' autocomplete='off'/>" +
        "<div class='room-builder-results' data-owner-results hidden></div></div></div>";
    }

    function cardHtml(room) {
      var tags = categoryTag(room) +
        (room.isPublic ? "" : "<span class='room-tag room-tag--hidden'>Hidden</span>") +
        (room.isDeleted ? "<span class='room-tag room-tag--deleted'>Deleted</span>" : "");
      var owner = room.ownerAddress ? "Owner " + walletShort(room.ownerAddress) : (room.isOfficial ? "Official (no owner)" : "No owner");
      var neutralSel = room.backgroundNeutral || "";
      var editor =
        "<div class='room-editor'>" +
        "<div class='room-field'><label>Display name</label><input type='text' data-field='displayName' value='" + esc(room.displayName) + "' maxlength='48'/></div>" +
        "<div class='room-row'><label class='room-toggle'><input type='checkbox' data-field='isPublic' " + (room.isPublic ? "checked" : "") + "/> Public (listed in catalog)</label></div>" +
        "<div class='room-field'><label>Background</label><div class='room-row'>" +
          "<select data-field='bgMode'>" +
            "<option value='default'" + (room.backgroundNeutral == null && room.backgroundHueDeg == null ? " selected" : "") + ">Default</option>" +
            "<option value='hue'" + (room.backgroundHueDeg != null ? " selected" : "") + ">Hue</option>" +
            "<option value='neutral'" + (room.backgroundNeutral != null ? " selected" : "") + ">Neutral</option>" +
          "</select>" +
          "<input type='number' data-field='bgHue' min='0' max='359' value='" + (room.backgroundHueDeg != null ? room.backgroundHueDeg : 210) + "' style='max-width:6rem'/>" +
          "<select data-field='bgNeutral'>" +
            "<option value='gray'" + (neutralSel === "gray" ? " selected" : "") + ">Gray</option>" +
            "<option value='black'" + (neutralSel === "black" ? " selected" : "") + ">Black</option>" +
            "<option value='white'" + (neutralSel === "white" ? " selected" : "") + ">White</option>" +
          "</select>" +
        "</div></div>" +
        ownerTransferHtml(room) +
        builderListHtml(room) +
        "<div class='room-row'><button class='btn' data-save>Save changes</button><span class='room-card-status' data-card-status></span></div>" +
        "</div>";
      return "<div class='room-card' data-room-id='" + esc(room.id) + "'>" +
        "<div class='room-thumb'><img loading='lazy' alt='" + esc(room.displayName) + " preview' src='" + esc(thumbSrc(room.id)) + "'/>" +
        (room.isDeleted ? "" : "<button class='room-thumb-preview' data-preview='" + esc(room.id) + "'>Open 3D preview</button>") + "</div>" +
        "<div class='room-body'>" +
        "<div class='room-name'>" + esc(room.displayName) + "</div>" +
        "<div class='room-meta'>" + tags + "</div>" +
        "<div class='room-meta'><span class='mono'>" + esc(room.id) + "</span><span>" + esc(owner) + "</span><span>" + esc(String(room.playerCount)) + " online</span><span>BG " + esc(bgValue(room)) + "</span></div>" +
        editor +
        "</div></div>";
    }

    function roomsForTab(tab) {
      return roomsData.filter(function (r) {
        if (tab === "official") return r.isBuiltin || r.isOfficial;
        return !r.isBuiltin && !r.isOfficial;
      });
    }

    function templateCardHtml(t) {
      var tags =
        (t.isDefault ? "<span class='room-tag room-tag--official'>Default</span>" : "") +
        (t.archived ? "<span class='room-tag room-tag--deleted'>Archived</span>" : "") +
        (t.sourceAvailable === false ? "<span class='room-tag room-tag--hidden'>Source missing</span>" : "");
      var actions = "";
      if (!t.archived && !t.isDefault) {
        actions += "<button class='btn' data-tmpl-default>Set default</button>";
      }
      if (!t.archived) {
        actions += "<button class='btn' data-tmpl-resync" + (t.sourceAvailable === false ? " disabled" : "") + ">Resync</button>";
        actions += "<button class='btn' data-tmpl-pick>Use for next create</button>";
        actions += "<button class='btn btn--danger' data-tmpl-archive>Archive</button>";
      } else {
        actions += "<button class='btn' data-tmpl-restore>Restore</button>";
      }
      return "<div class='room-card' data-template-id='" + esc(t.id) + "'>" +
        "<div class='room-body'>" +
        "<div class='room-name'>" + esc(t.displayName) + "</div>" +
        "<div class='room-meta'>" + tags + "</div>" +
        "<div class='room-meta'><span class='mono'>" + esc(t.id) + "</span>" +
        (t.sourceRoomId ? "<span>Source <span class='mono'>" + esc(t.sourceRoomId) + "</span></span>" : "<span>No source</span>") +
        "</div>" +
        "<p class='status' style='margin:0.5rem 0 0'>" + esc(t.description || "") + "</p>" +
        "<div class='room-row' style='margin-top:0.75rem;flex-wrap:wrap;gap:0.35rem'>" + actions +
        "<span class='room-card-status' data-tmpl-status></span></div>" +
        "</div></div>";
    }

    function isTemplateSourceRoomId(roomId) {
      if (!roomId || roomId.indexOf("invite-lobby-") === 0) return false;
      if (roomId.indexOf("match-pitch") !== -1) return false;
      if (roomId === "pixel" || roomId === "canvas") return false;
      return true;
    }

    function templateSourceRooms() {
      return roomsData.filter(function (r) {
        return !r.isDeleted && isTemplateSourceRoomId(r.id);
      }).sort(function (a, b) {
        return a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id);
      });
    }

    function roomCategoryLabel(room) {
      if (room.isBuiltin) return "Built-in";
      if (room.isOfficial) return "Official";
      return "Player";
    }

    function templateCreateSelectHtml() {
      var rooms = templateSourceRooms();
      var opts = "<option value=''>Choose a room…</option>" + rooms.map(function (r) {
        var selected = r.id === templateCreatePickId ? " selected" : "";
        return "<option value='" + esc(r.id) + "'" + selected + ">" +
          esc(r.displayName) + " (" + esc(r.id) + ") - " + esc(roomCategoryLabel(r)) + "</option>";
      }).join("");
      return "<select data-new-source aria-label='Source room'>" + opts + "</select>";
    }

    function templatesPanelHtml() {
      var picked = templateCreatePickId
        ? roomsData.find(function (r) { return r.id === templateCreatePickId; })
        : null;
      var previewHidden = picked ? "" : " hidden";
      var createForm =
        "<div class='room-card template-create-card'>" +
        "<div class='room-body'><div class='room-name'>Create template from room</div>" +
        "<div class='room-field'><label>Source room</label>" + templateCreateSelectHtml() + "</div>" +
        "<div class='template-create-preview'" + previewHidden + " data-create-preview>" +
        (picked
          ? "<div class='template-create-preview__meta'>" +
            "<span><strong>Template name:</strong> " + esc(picked.displayName) + "</span>" +
            "<span class='mono'>" + esc(picked.id) + "</span>" +
            categoryTag(picked) +
            "</div>" +
            "<div class='room-thumb'><img alt='" + esc(picked.displayName) + " thumbnail' src='" + esc(thumbSrc(picked.id)) + "'/></div>" +
            "<div class='template-create-preview__frame'>" +
            "<iframe title='3D preview' src='/roomPreview.html?room=" + encodeURIComponent(picked.id) + "' loading='lazy'></iframe>" +
            "</div>"
          : "") +
        "</div>" +
        "<div class='template-create-actions'>" +
        "<button class='btn' data-create-template" + (picked && templateCreateSnapshotOk ? "" : " disabled") + ">Create template</button>" +
        "<span class='room-card-status' data-create-status></span>" +
        "</div></div></div>";
      var list = templatesData.length
        ? "<div class='rooms-grid'>" + templatesData.map(templateCardHtml).join("") + "</div>"
        : "<p class='status'>No templates yet.</p>";
      return createForm + list;
    }

    async function verifyTemplateSourceSnapshot(roomId, statusEl, createBtn) {
      if (!roomId) {
        templateCreateSnapshotOk = true;
        if (createBtn) createBtn.disabled = true;
        return;
      }
      if (statusEl) statusEl.textContent = "Checking layout…";
      templateCreateSnapshotOk = false;
      if (createBtn) createBtn.disabled = true;
      try {
        var r = await fetch("/api/admin/rooms/" + encodeURIComponent(roomId) + "/layout", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (!r.ok) {
          if (statusEl) statusEl.textContent = "Could not load room layout.";
          return;
        }
        var snap = await r.json();
        if (snap.spatial) {
          if (statusEl) statusEl.textContent = "This room uses a spatial layout and cannot be snapshotted.";
          return;
        }
        templateCreateSnapshotOk = true;
        if (createBtn) createBtn.disabled = false;
        if (statusEl) statusEl.textContent = "";
      } catch (e) {
        if (statusEl) statusEl.textContent = "Could not verify room layout.";
      }
    }

    function bindTemplateCreateForm(panel) {
      var selectEl = panel.querySelector("[data-new-source]");
      if (!selectEl) return;
      selectEl.addEventListener("change", function () {
        templateCreatePickId = selectEl.value.trim();
        templateCreateSnapshotOk = !templateCreatePickId;
        rerender();
        if (templateCreatePickId) {
          void verifyTemplateSourceSnapshot(
            templateCreatePickId,
            panel.querySelector("[data-create-status]"),
            panel.querySelector("[data-create-template]")
          );
        }
      });
      if (templateCreatePickId) {
        void verifyTemplateSourceSnapshot(
          templateCreatePickId,
          panel.querySelector("[data-create-status]"),
          panel.querySelector("[data-create-template]")
        );
      }
    }

    async function patchTemplate(id, body, statusEl) {
      if (statusEl) statusEl.textContent = "Saving…";
      try {
        var r = await fetch("/api/admin/play-space-templates/" + encodeURIComponent(id), {
          method: "PATCH",
          headers: { authorization: "Bearer " + token, "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          var err = await r.json().catch(function () { return {}; });
          throw new Error(String(err.message || err.error || r.status));
        }
        await loadTemplates();
        if (statusEl) statusEl.textContent = "Saved.";
      } catch (e) {
        if (statusEl) statusEl.textContent = String((e && e.message) || e);
      }
    }

    async function resyncTemplate(id, statusEl) {
      if (statusEl) statusEl.textContent = "Resyncing…";
      try {
        var r = await fetch("/api/admin/play-space-templates/" + encodeURIComponent(id) + "/resync", {
          method: "POST",
          headers: { authorization: "Bearer " + token },
        });
        if (!r.ok) {
          var err = await r.json().catch(function () { return {}; });
          throw new Error(String(err.message || err.error || r.status));
        }
        await loadTemplates();
        if (statusEl) statusEl.textContent = "Resynced.";
      } catch (e) {
        if (statusEl) statusEl.textContent = String((e && e.message) || e);
      }
    }

    function bindTemplateCard(card) {
      var id = card.getAttribute("data-template-id");
      var statusEl = card.querySelector("[data-tmpl-status]");
      var defBtn = card.querySelector("[data-tmpl-default]");
      if (defBtn) defBtn.addEventListener("click", function () { void patchTemplate(id, { setDefault: true }, statusEl); });
      var archBtn = card.querySelector("[data-tmpl-archive]");
      if (archBtn) archBtn.addEventListener("click", function () { void patchTemplate(id, { archived: true }, statusEl); });
      var restoreBtn = card.querySelector("[data-tmpl-restore]");
      if (restoreBtn) restoreBtn.addEventListener("click", function () { void patchTemplate(id, { archived: false }, statusEl); });
      var resyncBtn = card.querySelector("[data-tmpl-resync]");
      if (resyncBtn) resyncBtn.addEventListener("click", function () { void resyncTemplate(id, statusEl); });
      var pickBtn = card.querySelector("[data-tmpl-pick]");
      if (pickBtn) pickBtn.addEventListener("click", function () {
        sessionStorage.setItem(PLAY_SPACE_TEMPLATE_PICK_KEY, id);
        if (statusEl) statusEl.textContent = "Selected for next Play Space create.";
      });
    }

    async function createTemplateFromRoom(panel) {
      var sourceEl = panel.querySelector("[data-new-source]");
      var statusEl = panel.querySelector("[data-create-status]");
      var sourceRoomId = sourceEl && sourceEl.value.trim();
      var room = sourceRoomId
        ? roomsData.find(function (r) { return r.id === sourceRoomId; })
        : null;
      var displayName = room ? room.displayName.trim() : "";
      if (!sourceRoomId || !displayName) {
        if (statusEl) statusEl.textContent = "Choose a source room first.";
        return;
      }
      if (!templateCreateSnapshotOk) {
        if (statusEl) statusEl.textContent = "This room cannot be used as a template source.";
        return;
      }
      if (statusEl) statusEl.textContent = "Creating…";
      try {
        var r = await fetch("/api/admin/play-space-templates", {
          method: "POST",
          headers: { authorization: "Bearer " + token, "content-type": "application/json" },
          body: JSON.stringify({ sourceRoomId: sourceRoomId, displayName: displayName }),
        });
        if (!r.ok) {
          var err = await r.json().catch(function () { return {}; });
          throw new Error(String(err.message || err.error || r.status));
        }
        templateCreatePickId = "";
        templateCreateSnapshotOk = true;
        await loadTemplates();
        if (statusEl) statusEl.textContent = "Created.";
      } catch (e) {
        if (statusEl) statusEl.textContent = String((e && e.message) || e);
      }
    }

    function openPreview(id) {
      var room = roomsData.find(function (r) { return r.id === id; });
      var backdrop = document.createElement("div");
      backdrop.className = "preview-backdrop";
      backdrop.innerHTML =
        "<div class='preview-dialog'><div class='preview-head'><h3>" + esc(room ? room.displayName : id) +
        " - 3D preview</h3><button class='preview-close' data-preview-close>Close</button></div>" +
        "<iframe class='preview-frame' src='/roomPreview.html?room=" + encodeURIComponent(id) + "' title='Room preview'></iframe></div>";
      document.body.appendChild(backdrop);
      function close() { backdrop.remove(); document.removeEventListener("keydown", onEsc); }
      function onEsc(e) { if (e.key === "Escape") close(); }
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
      backdrop.querySelector("[data-preview-close]").addEventListener("click", close);
      document.addEventListener("keydown", onEsc);
    }

    function collectPatch(card, room) {
      var patch = {};
      var nameEl = card.querySelector("[data-field='displayName']");
      if (nameEl && nameEl.value.trim() !== room.displayName) patch.displayName = nameEl.value.trim();
      var pubEl = card.querySelector("[data-field='isPublic']");
      if (pubEl && pubEl.checked !== room.isPublic) patch.isPublic = pubEl.checked;
      var bgMode = card.querySelector("[data-field='bgMode']").value;
      if (bgMode === "default") {
        if (room.backgroundHueDeg != null || room.backgroundNeutral != null) { patch.backgroundHueDeg = null; }
      } else if (bgMode === "hue") {
        var hue = Number(card.querySelector("[data-field='bgHue']").value);
        if (room.backgroundHueDeg !== hue || room.backgroundNeutral != null) patch.backgroundHueDeg = hue;
      } else if (bgMode === "neutral") {
        var neutral = card.querySelector("[data-field='bgNeutral']").value;
        if (room.backgroundNeutral !== neutral) patch.backgroundNeutral = neutral;
      }
      if (room.builderEditable) patch.builderAddresses = (room.builderAddresses || []).slice();
      if (!room.isBuiltin && !room.isOfficial && room.pendingOwnerAddress) {
        var curOwner = walletCompact(room.ownerAddress || "");
        if (room.pendingOwnerAddress !== curOwner) patch.ownerAddress = room.pendingOwnerAddress;
      }
      return patch;
    }

    async function saveRoom(card, room, statusEl) {
      var patch = collectPatch(card, room);
      if (Object.keys(patch).length === 0) { statusEl.className = "room-card-status status"; statusEl.textContent = "Nothing changed."; return; }
      statusEl.className = "room-card-status status"; statusEl.textContent = "Saving…";
      try {
        var r = await fetch("/api/admin/rooms/" + encodeURIComponent(room.id), {
          method: "PUT",
          headers: { authorization: "Bearer " + token, "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(String(j.error || ("HTTP " + r.status)));
        statusEl.className = "room-card-status ok"; statusEl.textContent = "Saved.";
        await loadRooms();
      } catch (e) {
        statusEl.className = "room-card-status err"; statusEl.textContent = String((e && e.message) || e);
      }
    }

    function builderMatches(room, query) {
      var existing = room.builderAddresses || [];
      var q = String(query || "").trim().toLowerCase();
      var qCompact = walletCompact(query);
      var out = [];
      for (var i = 0; i < usersData.length && out.length < 40; i++) {
        var u = usersData[i];
        if (existing.indexOf(u.wallet) !== -1) continue;
        if (q) {
          var nameHit = u.username && u.username.toLowerCase().indexOf(q) !== -1;
          var walletHit = u.wallet.indexOf(qCompact) !== -1;
          if (!nameHit && !walletHit) continue;
        }
        out.push(u);
      }
      return out;
    }

    function bindBuilderCombo(card, room, statusEl) {
      var searchInput = card.querySelector("[data-builder-search]");
      var resultsEl = card.querySelector("[data-builder-results]");
      if (!searchInput || !resultsEl) return;

      function addWallet(w) {
        var c = walletCompact(w);
        if (!/^NQ[0-9A-Z]{34}$/.test(c)) { statusEl.className = "room-card-status err"; statusEl.textContent = "Invalid NQ address."; return; }
        room.builderAddresses = room.builderAddresses || [];
        if (room.builderAddresses.indexOf(c) === -1) room.builderAddresses.push(c);
        rerender();
      }

      function renderResults() {
        var matches = builderMatches(room, searchInput.value);
        var raw = walletCompact(searchInput.value);
        var html = matches.map(function (u) {
          var name = u.username || walletLabelShort(u.wallet);
          return "<div class='room-builder-result' data-pick='" + esc(u.wallet) + "'>" +
            "<span class='builder-name'>" + esc(name) + "</span>" +
            "<span class='builder-addr mono'>" + esc(walletShort(u.wallet)) + "</span></div>";
        }).join("");
        if (!html) {
          if (/^NQ[0-9A-Z]{34}$/.test(raw)) {
            html = "<div class='room-builder-result' data-pick='" + esc(raw) + "'>" +
              "<span class='builder-name'>Add this wallet</span>" +
              "<span class='builder-addr mono'>" + esc(walletShort(raw)) + "</span></div>";
          } else {
            html = "<div class='room-builder-empty'>No matching users.</div>";
          }
        }
        resultsEl.innerHTML = html;
        resultsEl.hidden = false;
        resultsEl.querySelectorAll("[data-pick]").forEach(function (el) {
          el.addEventListener("mousedown", function (e) { e.preventDefault(); addWallet(el.getAttribute("data-pick")); });
        });
      }

      searchInput.addEventListener("focus", renderResults);
      searchInput.addEventListener("input", renderResults);
      searchInput.addEventListener("blur", function () { setTimeout(function () { resultsEl.hidden = true; }, 150); });
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var first = resultsEl.querySelector("[data-pick]");
          if (first) addWallet(first.getAttribute("data-pick"));
        } else if (e.key === "Escape") {
          resultsEl.hidden = true;
        }
      });
    }

    function ownerMatches(room, query) {
      var cur = walletCompact(room.ownerAddress || "");
      var q = String(query || "").trim().toLowerCase();
      var qCompact = walletCompact(query);
      var out = [];
      for (var i = 0; i < usersData.length && out.length < 40; i++) {
        var u = usersData[i];
        if (u.wallet === cur) continue;
        if (q) {
          var nameHit = u.username && u.username.toLowerCase().indexOf(q) !== -1;
          var walletHit = u.wallet.indexOf(qCompact) !== -1;
          if (!nameHit && !walletHit) continue;
        }
        out.push(u);
      }
      return out;
    }

    function bindOwnerCombo(card, room, statusEl) {
      var searchInput = card.querySelector("[data-owner-search]");
      var resultsEl = card.querySelector("[data-owner-results]");
      if (!searchInput || !resultsEl) return;

      function setOwner(w) {
        var c = walletCompact(w);
        if (!/^NQ[0-9A-Z]{34}$/.test(c)) { statusEl.className = "room-card-status err"; statusEl.textContent = "Invalid NQ address."; return; }
        if (c === walletCompact(room.ownerAddress || "")) { statusEl.className = "room-card-status err"; statusEl.textContent = "That wallet already owns this room."; return; }
        room.pendingOwnerAddress = c;
        rerender();
      }

      function renderResults() {
        var matches = ownerMatches(room, searchInput.value);
        var raw = walletCompact(searchInput.value);
        var html = matches.map(function (u) {
          var name = u.username || walletLabelShort(u.wallet);
          return "<div class='room-builder-result' data-owner-pick='" + esc(u.wallet) + "'>" +
            "<span class='builder-name'>" + esc(name) + "</span>" +
            "<span class='builder-addr mono'>" + esc(walletShort(u.wallet)) + "</span></div>";
        }).join("");
        if (!html) {
          if (/^NQ[0-9A-Z]{34}$/.test(raw)) {
            html = "<div class='room-builder-result' data-owner-pick='" + esc(raw) + "'>" +
              "<span class='builder-name'>Transfer to this wallet</span>" +
              "<span class='builder-addr mono'>" + esc(walletShort(raw)) + "</span></div>";
          } else {
            html = "<div class='room-builder-empty'>No matching users.</div>";
          }
        }
        resultsEl.innerHTML = html;
        resultsEl.hidden = false;
        resultsEl.querySelectorAll("[data-owner-pick]").forEach(function (el) {
          el.addEventListener("mousedown", function (e) { e.preventDefault(); setOwner(el.getAttribute("data-owner-pick")); });
        });
      }

      searchInput.addEventListener("focus", renderResults);
      searchInput.addEventListener("input", renderResults);
      searchInput.addEventListener("blur", function () { setTimeout(function () { resultsEl.hidden = true; }, 150); });
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var first = resultsEl.querySelector("[data-owner-pick]");
          if (first) setOwner(first.getAttribute("data-owner-pick"));
        } else if (e.key === "Escape") {
          resultsEl.hidden = true;
        }
      });
    }

    function bindCard(card) {
      var id = card.getAttribute("data-room-id");
      var room = roomsData.find(function (r) { return r.id === id; });
      if (!room) return;
      var statusEl = card.querySelector("[data-card-status]");
      var saveBtn = card.querySelector("[data-save]");
      if (saveBtn) saveBtn.addEventListener("click", function () { void saveRoom(card, room, statusEl); });
      bindBuilderCombo(card, room, statusEl);
      bindOwnerCombo(card, room, statusEl);
      var ownerClearBtn = card.querySelector("[data-owner-clear]");
      if (ownerClearBtn) ownerClearBtn.addEventListener("click", function () { room.pendingOwnerAddress = ""; rerender(); });
      card.querySelectorAll("[data-builder-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var w = btn.getAttribute("data-builder-remove");
          room.builderAddresses = (room.builderAddresses || []).filter(function (x) { return x !== w; });
          rerender();
        });
      });
      var prevBtn = card.querySelector("[data-preview]");
      if (prevBtn) prevBtn.addEventListener("click", function () { openPreview(id); });
    }

    function rerender() {
      var panel = document.getElementById("panel");
      var counts = { official: roomsForTab("official").length, player: roomsForTab("player").length, templates: templatesData.length };
      var tabs = "<div class='rooms-tabs'>" +
        "<button class='rooms-tab' data-tab='official' aria-selected='" + (activeTab === "official") + "'>Official rooms (" + counts.official + ")</button>" +
        "<button class='rooms-tab' data-tab='player' aria-selected='" + (activeTab === "player") + "'>Player Owned (" + counts.player + ")</button>" +
        "<button class='rooms-tab' data-tab='templates' aria-selected='" + (activeTab === "templates") + "'>Play Space templates (" + counts.templates + ")</button>" +
        "</div>";
      var body;
      if (activeTab === "templates") {
        body = templatesPanelHtml();
      } else {
        var list = roomsForTab(activeTab);
        body = list.length
          ? "<div class='rooms-grid'>" + list.map(cardHtml).join("") + "</div>"
          : "<p class='status'>No rooms in this tab.</p>";
      }
      panel.innerHTML = tabs + body;
      panel.querySelectorAll(".rooms-tab").forEach(function (b) {
        b.addEventListener("click", function () { activeTab = b.getAttribute("data-tab"); rerender(); });
      });
      if (activeTab === "templates") {
        var createBtn = panel.querySelector("[data-create-template]");
        if (createBtn) createBtn.addEventListener("click", function () { void createTemplateFromRoom(panel); });
        bindTemplateCreateForm(panel);
        panel.querySelectorAll("[data-template-id]").forEach(bindTemplateCard);
      } else {
        panel.querySelectorAll(".room-card").forEach(bindCard);
      }
    }

    async function loadUsers() {
      try {
        var r = await fetch("/api/admin/users", { headers: { authorization: "Bearer " + token }, cache: "no-store" });
        if (!r.ok) return;
        var j = await r.json();
        usersData = Array.isArray(j.users) ? j.users : [];
        userByWallet = {};
        usersData.forEach(function (u) { userByWallet[walletCompact(u.wallet)] = u; });
      } catch (e) { /* non-fatal: combobox falls back to raw NQ entry */ }
    }

    async function loadTemplates() {
      var r = await fetch("/api/admin/play-space-templates?includeArchived=1", {
        headers: { authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (r.status === 401) throw new Error("Session expired. Sign in again.");
      if (r.status === 403) throw new Error("NS_ADMIN_DENIED");
      if (!r.ok) throw new Error("Request failed (" + r.status + ").");
      var j = await r.json();
      templatesData = Array.isArray(j.templates) ? j.templates : [];
      rerender();
    }

    async function loadRooms() {
      var r = await fetch("/api/admin/rooms", { headers: { authorization: "Bearer " + token }, cache: "no-store" });
      if (r.status === 401) throw new Error("Session expired. Sign in again.");
      if (r.status === 403) throw new Error("NS_ADMIN_DENIED");
      if (!r.ok) throw new Error("Request failed (" + r.status + ").");
      var j = await r.json();
      roomsData = Array.isArray(j.rooms) ? j.rooms : [];
      rerender();
    }

    async function load() {
      var panel = document.getElementById("panel");
      var docTitle = document.getElementById("adminDocTitle");
      token = readAuthToken();
      var signed = sessionStorage.getItem(AUTH_ADDR_KEY) || parseJwtSub(token);
      if (signed) sessionStorage.setItem(AUTH_ADDR_KEY, signed);
      if (!token) {
        if (docTitle) docTitle.hidden = true;
        panel.innerHTML = "<div class='ms-auth-gate ms-auth-gate--standalone'><div class='ms-auth-gate-msg'>You must be signed in.</div></div>";
        return;
      }
      if (typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(token)) {
        panel.innerHTML = "<div class='ms-auth-gate ms-auth-gate--standalone'><div class='ms-auth-gate-msg'>Your session has expired. Use <strong>Sign in again</strong> above.</div></div>";
        return;
      }
      var status = await fetchAuthStatus(token);
      if (!status.systemAdmin) {
        if (docTitle) docTitle.hidden = true;
        panel.innerHTML = "<div class='ms-auth-gate ms-auth-gate--standalone'><div class='ms-auth-gate-msg'>This page is for system admins only.</div></div>";
        return;
      }
      try {
        await loadUsers();
        await loadTemplates();
        await loadRooms();
      } catch (e) {
        var msg = String((e && e.message) || e);
        if (msg === "NS_ADMIN_DENIED") msg = "Access denied for this wallet.";
        panel.innerHTML = "<div class='ms-auth-gate'><div class='ms-auth-gate-msg err'>" + esc(msg) + "</div></div>";
      }
    }
    load();
  </script>
</body>
</html>`;
}
