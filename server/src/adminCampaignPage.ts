import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { advertiseBillboardPreviewModuleScript } from "./advertiseBillboardPreviewScript.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/campaign` — pending approvals + rotation set CRUD. */
export function adminCampaignPageHtml(): string {
  const previewModule = advertiseBillboardPreviewModuleScript();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Campaigns — Admin — Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .mono { font-family: "Fira Mono", ui-monospace, monospace; font-size: 0.84rem; }
    .cp-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.75rem 0.85rem; margin-bottom: 0.85rem; }
    .cp-panel h2 { margin: 0 0 0.55rem; font-size: 0.92rem; color: #c8d4e4; font-weight: 600; }
    .cp-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .cp-table th, .cp-table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: top; }
    .cp-btn {
      appearance: none; border: 1px solid #334155; background: #1e293b; color: #e2e8f0;
      border-radius: 6px; padding: 0.3rem 0.55rem; font: inherit; font-size: 0.76rem; cursor: pointer;
    }
    .cp-btn--accent { background: var(--ms-accent); border-color: var(--ms-accent-hover-border); color: #eef6ff; }
    .cp-btn--danger { background: #3f1f1f; border-color: #7f1d1d; color: #fecaca; }
    .cp-btn--icon {
      width: 2rem; height: 2rem; padding: 0; display: inline-flex; align-items: center; justify-content: center;
      font-size: 1rem; line-height: 1; font-weight: 700;
    }
    .cp-btn--approve { background: #14532d; border-color: #166534; color: #86efac; }
    .cp-btn--approve:hover:not(:disabled) { background: #166534; border-color: #22c55e; color: #bbf7d0; }
    .cp-btn--reject { background: #3f1f1f; border-color: #7f1d1d; color: #fca5a5; }
    .cp-btn--reject:hover:not(:disabled) { background: #5c1a1a; border-color: #b91c1c; color: #fecaca; }
    .cp-owner { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
    .cp-owner__ident {
      width: 22px; height: 22px; border-radius: 4px; flex-shrink: 0;
      object-fit: contain; background: rgba(0, 0, 0, 0.2);
    }
    .cp-owner__text { font-size: 0.76rem; color: #b8c5d9; word-break: break-all; }
    .cp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .cp-row-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .cp-field { margin-bottom: 0.55rem; }
    .cp-field label { display: block; font-size: 0.76rem; color: #94a3b8; margin-bottom: 0.2rem; }
    .cp-field input, .cp-field select, .cp-field textarea {
      width: 100%; box-sizing: border-box; background: #0a1018; color: #d8e2f0;
      border: 1px solid #263348; border-radius: 6px; padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8rem;
    }
    .cp-items { list-style: none; margin: 0; padding: 0; }
    .cp-items li {
      display: flex; align-items: center; gap: 0.45rem; padding: 0.35rem 0;
      border-bottom: 1px solid #1c2838; font-size: 0.78rem;
    }
    .cp-items__label { flex: 1; min-width: 0; }
    .cp-msg { font-size: 0.78rem; color: #86efac; margin-top: 0.45rem; }
    .cp-err { font-size: 0.78rem; color: #fca5a5; margin-top: 0.45rem; }
    .cp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    @media (max-width: 900px) { .cp-grid-2 { grid-template-columns: 1fr; } }
    .cp-lead { margin: 0 0 0.85rem; font-size: 0.84rem; line-height: 1.45; color: var(--ms-muted-bright); max-width: 52rem; }
    #cpRoot.ms-panel { max-width: 72rem; }
    .cp-tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.85rem; }
    .cp-tab {
      appearance: none; border: 1px solid #334155; background: #1e293b; color: #c8d4e4;
      border-radius: 8px; padding: 0.42rem 0.8rem; font: inherit; font-size: 0.84rem; font-weight: 600; cursor: pointer;
    }
    .cp-tab:hover { border-color: #4d83d0; color: #e6edf3; }
    .cp-tab.is-active { background: var(--ms-accent); border-color: var(--ms-accent-hover-border); color: #ffffff; }
    .cp-tab-panel[hidden] { display: none !important; }
    .cp-tab-layout { display: grid; gap: 0.85rem; align-items: start; }
    @media (min-width: 900px) {
      .cp-tab-layout { grid-template-columns: 1fr min(24rem, 40vw); }
    }
    .cp-preview-panel {
      border: 1px solid #263348; border-radius: 10px; background: #0a1018;
      padding: 0.75rem 0.85rem; position: sticky; top: 0.75rem;
    }
    .cp-preview-panel h2 { margin: 0 0 0.55rem; font-size: 0.92rem; color: #c8d4e4; font-weight: 600; }
    .cp-preview-canvas {
      width: 100%; height: 18rem; min-height: 14rem; display: block;
      border-radius: 8px; border: 1px solid #263348; background: #0f1419;
    }
    .cp-preview-warn { margin-top: 0.35rem; font-size: 0.72rem; color: #fbbf24; line-height: 1.35; }
    .cp-preview-warn[hidden] { display: none !important; }
    .cp-preview-caption { margin: 0.45rem 0 0; font-size: 0.78rem; color: #7b8da8; }
    .cp-preview-details { margin: 0.45rem 0 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .cp-preview-detail { font-size: 0.78rem; line-height: 1.45; color: #9fb0c7; }
    .cp-preview-detail__label { color: #7b8da8; font-weight: 600; }
    .cp-preview-detail__value { color: #c8d4e4; word-break: break-word; }
    .cp-preview-detail__value--fund { font-variant-numeric: tabular-nums; }
    .cp-fund-cell { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cp-stat-note {
      margin: 0 0 0.75rem; padding: 0.55rem 0.65rem; border-radius: 8px;
      border: 1px solid #1e3a5f; background: #0f1a28; font-size: 0.76rem; line-height: 1.45; color: #93c5fd;
    }
    .cp-subhead {
      margin: 0 0 0.35rem; font-size: 0.84rem; color: #c8d4e4; font-weight: 600;
    }
    .cp-tx-history { margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid #1e293b; }
    .cp-tx-title { margin: 0 0 0.4rem; font-size: 0.75rem; font-weight: 600; color: #9fb0c7; }
    .cp-tx-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .cp-tx-item {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.7fr) auto;
      gap: 0.4rem;
      align-items: baseline;
      font-size: 0.72rem;
      color: #7b8da8;
    }
    .cp-tx-date { color: #9fb0c7; }
    .cp-tx-amount { font-variant-numeric: tabular-nums; color: #c8d4e4; }
    .cp-table tr.cp-row-selectable { cursor: pointer; }
    .cp-table tr.cp-row-selectable:hover { background: rgba(90, 160, 255, 0.06); }
    .cp-table tr.is-selected { background: rgba(90, 160, 255, 0.1); }
    .cp-items li.cp-item-previewable { cursor: pointer; }
    .cp-items li.cp-item-previewable:hover { background: rgba(90, 160, 255, 0.06); }
    .cp-items li.is-selected { background: rgba(90, 160, 255, 0.1); }
  </style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.174.0/build/three.module.js"
    }
  }
  </script>
  <script type="module">${previewModule}</script>
</head>
<body class="ms-site ms-site--wide">
  ${analyticsTopbarHtml("campaign")}
  <h1 class="ms-doc-title">Campaign billboards</h1>
  <p class="cp-lead">Approve funded campaigns and manage rotation sets for in-game placement.</p>
  <div id="cpRoot" class="ms-panel">Loading…</div>
  <script>
  (function () {
    var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
    var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
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
    function parseJwtSub(token) {
      try {
        var p = String(token || "").split(".")[1] || "";
        var pad = p.replace(/-/g, "+").replace(/_/g, "/");
        pad += "====".slice(0, (4 - (pad.length % 4)) % 4);
        return String(JSON.parse(atob(pad)).sub || "");
      } catch (e) {
        return "";
      }
    }
    function previewWalletAddress() {
      var cached = sessionStorage.getItem(AUTH_ADDR_KEY);
      if (cached && String(cached).trim()) return String(cached).trim();
      return parseJwtSub(readAuthToken());
    }
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    }
    function authGateHtml(msg) {
      return (
        "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
        "<div class='ms-auth-gate-msg'>" + esc(msg || "You must be signed in.") + "</div>" +
        "</div>"
      );
    }
    function apiBackendError(status, body) {
      if (status === 503 || (body && body.error === "backend_unavailable")) {
        return "Game server is not running on port 3001. Restart npm run dev and hard-refresh.";
      }
      return "";
    }
    async function api(path, opts) {
      var t = readAuthToken();
      if (!t) throw new Error("not_signed_in");
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl
        ? setTimeout(function () {
            ctrl.abort();
          }, 15000)
        : null;
      try {
        var r = await fetch(
          path,
          Object.assign(
            {
              headers: { authorization: "Bearer " + t, "content-type": "application/json" },
              signal: ctrl ? ctrl.signal : undefined,
            },
            opts || {}
          )
        );
        var body = null;
        try {
          body = await r.json();
        } catch (e) {
          body = null;
        }
        return { ok: r.ok, status: r.status, body: body };
      } catch (e) {
        if (e && e.name === "AbortError") throw new Error("backend_timeout");
        throw e;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    var state = {
      overview: null,
      editingSetId: null,
      draftItems: [],
      activeTab: "pending",
      previewSelection: null,
    };
    var identiconCache = {};

    function walletShort(wallet) {
      var w = String(wallet || "").replace(/\\s+/g, "").trim();
      if (w.length <= 8) return w;
      return w.slice(0, 4) + w.slice(-4);
    }

    function ownerLabel(campaign) {
      if (!campaign) return "";
      if (campaign.ownerDisplayName) return String(campaign.ownerDisplayName);
      return walletShort(campaign.ownerWallet);
    }

    function ownerCell(campaign) {
      var w = String((campaign && campaign.ownerWallet) || "").trim();
      if (!w) return "—";
      return (
        '<span class="cp-owner">' +
        '<img class="cp-owner__ident" data-cp-wallet="' +
        esc(w) +
        '" alt="" width="22" height="22" />' +
        '<span class="cp-owner__text">' +
        esc(ownerLabel(campaign)) +
        "</span></span>"
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

    async function hydrateOwnerIdenticons(root) {
      if (!root) return;
      var imgs = root.querySelectorAll("img[data-cp-wallet]");
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var wallet = img.getAttribute("data-cp-wallet") || "";
        if (!wallet || img.dataset.cpLoaded === "1") continue;
        var url = await fetchIdenticon(wallet);
        if (url) img.src = url;
        img.dataset.cpLoaded = "1";
      }
    }

    function campaignById(id) {
      if (!id || !state.overview) return null;
      var pending = state.overview.pendingCampaigns || [];
      for (var pi = 0; pi < pending.length; pi++) {
        if (pending[pi].id === id) return pending[pi];
      }
      var approved = state.overview.approvedCampaigns || [];
      for (var ai = 0; ai < approved.length; ai++) {
        if (approved[ai].id === id) return approved[ai];
      }
      var expired = state.overview.expiredCampaigns || [];
      for (var ei = 0; ei < expired.length; ei++) {
        if (expired[ei].id === id) return expired[ei];
      }
      var unfunded = state.overview.unfundedCampaigns || [];
      for (var ui = 0; ui < unfunded.length; ui++) {
        if (unfunded[ui].id === id) return unfunded[ui];
      }
      return null;
    }

    function campaignStatusLabel(c) {
      if (!c) return "";
      var labels = {
        draft: "Draft",
        pending_payment: "Pending payment",
        pending_approval: "Pending approval",
        approved: "Approved",
        expired: "Expired",
        rejected: "Rejected",
      };
      return labels[c.status] || String(c.status || "").replace(/_/g, " ");
    }

    function placeholderById(id) {
      if (!id || !state.overview) return null;
      var list = state.overview.placeholders || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    }

    function previewSelectionFromDraftItem(item) {
      if (!item) return null;
      if (item.kind === "campaign" && item.campaignId) {
        return { kind: "campaign", id: item.campaignId };
      }
      if (item.kind === "placeholder" && item.placeholderAdvertId) {
        return { kind: "placeholder", id: item.placeholderAdvertId };
      }
      return null;
    }

    function defaultPreviewSelection() {
      if (!state.overview) return null;
      if (state.activeTab === "rotations" && state.editingSetId && state.draftItems.length) {
        return previewSelectionFromDraftItem(state.draftItems[0]);
      }
      if (state.activeTab === "pending") {
        var pending = state.overview.pendingCampaigns || [];
        return pending.length ? { kind: "campaign", id: pending[0].id } : null;
      }
      if (state.activeTab === "approved") {
        var approvedTab = state.overview.approvedCampaigns || [];
        return approvedTab.length ? { kind: "campaign", id: approvedTab[0].id } : null;
      }
      if (state.activeTab === "inactive") {
        var expiredList = state.overview.expiredCampaigns || [];
        if (expiredList.length) return { kind: "campaign", id: expiredList[0].id };
        var unfundedList = state.overview.unfundedCampaigns || [];
        if (unfundedList.length) return { kind: "campaign", id: unfundedList[0].id };
        return null;
      }
      return null;
    }

    function resolvePreviewSelection() {
      if (state.previewSelection) {
        if (state.previewSelection.kind === "campaign" && campaignById(state.previewSelection.id)) {
          return state.previewSelection;
        }
        if (state.previewSelection.kind === "placeholder" && placeholderById(state.previewSelection.id)) {
          return state.previewSelection;
        }
      }
      var fallback = defaultPreviewSelection();
      if (fallback) state.previewSelection = fallback;
      return fallback;
    }

    function previewPayload(selection) {
      if (!selection) return null;
      if (selection.kind === "campaign") {
        var campaign = campaignById(selection.id);
        if (!campaign) return null;
        return {
          kind: "campaign",
          imageUrl: campaign.imageUrl ? String(campaign.imageUrl) : "",
          wallet: campaign.ownerWallet ? String(campaign.ownerWallet) : "",
          campaign: campaign,
          placeholder: null,
        };
      }
      if (selection.kind === "placeholder") {
        var placeholder = placeholderById(selection.id);
        if (!placeholder) return null;
        return {
          kind: "placeholder",
          imageUrl: placeholder.imageUrl ? String(placeholder.imageUrl) : "",
          wallet: previewWalletAddress(),
          campaign: null,
          placeholder: placeholder,
        };
      }
      return null;
    }

    function resolvePreviewPayload() {
      return previewPayload(resolvePreviewSelection());
    }

    function idlePreviewPayload() {
      return {
        kind: "idle",
        imageUrl: "",
        wallet: previewWalletAddress(),
        campaign: null,
        placeholder: null,
      };
    }

    function previewPayloadForActiveTab() {
      var tab = state.activeTab || "pending";
      if (
        tab !== "pending" &&
        tab !== "rotations" &&
        tab !== "approved" &&
        tab !== "inactive"
      ) {
        return null;
      }
      return resolvePreviewPayload() || idlePreviewPayload();
    }

    function renderTabBar() {
      var tab = state.activeTab || "pending";
      var pendingCount = (state.overview && state.overview.pendingCampaigns
        ? state.overview.pendingCampaigns.length
        : 0);
      var approvedCount = (state.overview && state.overview.approvedCampaigns
        ? state.overview.approvedCampaigns.length
        : 0);
      var expiredCount = (state.overview && state.overview.expiredCampaigns
        ? state.overview.expiredCampaigns.length
        : 0);
      var unfundedCount = (state.overview && state.overview.unfundedCampaigns
        ? state.overview.unfundedCampaigns.length
        : 0);
      var inactiveCount = expiredCount + unfundedCount;
      var setCount = (state.overview && state.overview.rotationSets
        ? state.overview.rotationSets.length
        : 0);
      return (
        '<div class="cp-tabs" role="tablist" aria-label="Campaign admin">' +
        '<button type="button" class="cp-tab' +
        (tab === "pending" ? " is-active" : "") +
        '" data-cp-tab="pending" role="tab" aria-selected="' +
        (tab === "pending" ? "true" : "false") +
        '">Pending approvals (' + pendingCount + ")</button>" +
        '<button type="button" class="cp-tab' +
        (tab === "approved" ? " is-active" : "") +
        '" data-cp-tab="approved" role="tab" aria-selected="' +
        (tab === "approved" ? "true" : "false") +
        '">Approved campaigns (' + approvedCount + ")</button>" +
        '<button type="button" class="cp-tab' +
        (tab === "inactive" ? " is-active" : "") +
        '" data-cp-tab="inactive" role="tab" aria-selected="' +
        (tab === "inactive" ? "true" : "false") +
        '">Expired / unfunded (' + inactiveCount + ")</button>" +
        '<button type="button" class="cp-tab' +
        (tab === "rotations" ? " is-active" : "") +
        '" data-cp-tab="rotations" role="tab" aria-selected="' +
        (tab === "rotations" ? "true" : "false") +
        '">Rotations (' + setCount + ")</button>" +
        "</div>"
      );
    }

    function activeTabPanelEl() {
      var tab = state.activeTab || "pending";
      if (tab === "rotations") return document.getElementById("cpTabRotations");
      if (tab === "approved") return document.getElementById("cpTabApproved");
      if (tab === "inactive") return document.getElementById("cpTabInactive");
      return document.getElementById("cpTabPending");
    }

    function renderInactiveCampaignRows(campaigns, previewCampaignId) {
      var html = "";
      for (var i = 0; i < campaigns.length; i++) {
        var c = campaigns[i];
        var sel = previewCampaignId === c.id ? " is-selected" : "";
        html +=
          '<tr class="cp-row-selectable' + sel + '" data-preview-campaign="' + esc(c.id) + '">' +
          "<td>" + esc(c.projectName) + "</td>" +
          "<td>" + ownerCell(c) + "</td>" +
          "<td>" + esc(campaignStatusLabel(c)) + "</td>" +
          '<td class="cp-fund-cell">' + esc(c.totalFundedNimLabel || "0") + " NIM</td>" +
          '<td class="cp-fund-cell">' + esc(c.remainingNimLabel || formatFundNim(c.balanceLuna)) + "</td>" +
          "<td>" + esc(c.updatedAt || "—") + "</td></tr>";
      }
      return html;
    }

    function activePreviewPanel() {
      var tab = activeTabPanelEl();
      return tab ? tab.querySelector(".cp-preview-panel") : null;
    }

    function formatFundNim(balanceLuna) {
      if (balanceLuna === null || balanceLuna === undefined || balanceLuna === "") {
        return "0 NIM";
      }
      var n = Number(balanceLuna);
      if (!Number.isFinite(n) || n < 0) return "—";
      return String(n / 100000) + " NIM";
    }

    function formatVisibleMs(ms) {
      var n = Math.max(0, Math.floor(Number(ms) || 0));
      if (n < 1000) return n + " ms";
      var sec = Math.floor(n / 1000);
      if (sec < 90) return sec + " s";
      var min = Math.floor(sec / 60);
      sec = sec % 60;
      if (min < 90) {
        return sec > 0 ? min + " min " + sec + " s" : min + " min";
      }
      var hr = Math.floor(min / 60);
      min = min % 60;
      if (hr < 48) {
        return min > 0 ? hr + " h " + min + " min" : hr + " h";
      }
      var days = Math.floor(hr / 24);
      hr = hr % 24;
      return hr > 0 ? days + " d " + hr + " h" : days + " d";
    }

    function formatAnalyticsLastSeen(iso) {
      if (!iso) return "—";
      try {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      } catch (e) {
        return "—";
      }
    }

    function renderCampaignAnalyticsHtml(campaign) {
      if (!campaign || !campaign.analytics) return "";
      var a = campaign.analytics;
      return (
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">Unique viewers:</span> ' +
        '<span class="cp-preview-detail__value">' +
        esc(String(a.uniqueViewers || 0)) +
        "</span></div>" +
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">On-screen time:</span> ' +
        '<span class="cp-preview-detail__value">' +
        esc(formatVisibleMs(a.totalVisibleMs || 0)) +
        " (avg " +
        esc(formatVisibleMs(a.avgVisibleMsPerViewer || 0)) +
        " per viewer)</span></div>" +
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">Link visits:</span> ' +
        '<span class="cp-preview-detail__value">' +
        esc(String(a.linkClicks || 0)) +
        " (" +
        esc(String(a.uniqueLinkClickers || 0)) +
        " unique)</span></div>" +
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">Last seen:</span> ' +
        '<span class="cp-preview-detail__value">' +
        esc(formatAnalyticsLastSeen(a.lastSeenAt)) +
        "</span></div>"
      );
    }

    function renderCampaignPrepaidHtml(campaign) {
      if (!campaign || !campaign.prepaid) return "";
      var p = campaign.prepaid;
      if (!p.hasPrepaidBalance && !p.totalFundedNimLabel) return "";
      var headline =
        p.isExpired || !p.hasPrepaidBalance
          ? "Prepaid time used up"
          : "~" + p.remainingOnScreenLabel + " on-screen left";
      var nimLine =
        (p.remainingNimLabel || "0") +
        " NIM left" +
        (p.totalFundedNimLabel ? " of " + p.totalFundedNimLabel + " NIM funded" : "");
      return (
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">On-screen time left:</span> ' +
        '<span class="cp-preview-detail__value">' +
        esc(headline) +
        "</span></div>" +
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">Prepaid balance:</span> ' +
        '<span class="cp-preview-detail__value cp-preview-detail__value--fund">' +
        esc(nimLine) +
        "</span></div>" +
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">Billing:</span> ' +
        '<span class="cp-preview-detail__value">Drains from live views (7 blocks, active players)</span></div>'
      );
    }

    function renderPreviewDetailsHtml(payload) {
      if (!payload || payload.kind === "idle") {
        return '<p class="cp-preview-caption">Select a slide to preview.</p>';
      }
      if (payload.kind === "placeholder" && payload.placeholder) {
        var ph = payload.placeholder;
        var phUrl = String(ph.visitUrl || "");
        var phImageNote = payload.imageUrl
          ? ""
          : ' <span class="cp-preview-caption">(no image)</span>';
        return (
          '<div class="cp-preview-detail">' +
          '<span class="cp-preview-detail__label">Advert Name:</span> ' +
          '<span class="cp-preview-detail__value">' +
          esc(ph.name) +
          phImageNote +
          "</span></div>" +
          '<div class="cp-preview-detail">' +
          '<span class="cp-preview-detail__label">URL:</span> ' +
          '<span class="cp-preview-detail__value">' +
          (phUrl
            ? '<a href="' +
              esc(phUrl) +
              '" target="_blank" rel="noopener noreferrer" class="mono ms-link-expl">' +
              esc(phUrl) +
              "</a>"
            : "—") +
          "</span></div>" +
          '<div class="cp-preview-detail">' +
          '<span class="cp-preview-detail__label">Current Fund Amount:</span> ' +
          '<span class="cp-preview-detail__value cp-preview-detail__value--fund">—</span></div>'
        );
      }
      var campaign = payload.campaign;
      if (!campaign) {
        return '<p class="cp-preview-caption">Select a slide to preview.</p>';
      }
      var url = String(campaign.miniappTargetUrl || "");
      var imageNote = payload.imageUrl
        ? ""
        : ' <span class="cp-preview-caption">(no image)</span>';
      var fundHtml = "";
      if (campaign.totalFundedNimLabel !== undefined) {
        fundHtml +=
          '<div class="cp-preview-detail">' +
          '<span class="cp-preview-detail__label">Total funded:</span> ' +
          '<span class="cp-preview-detail__value cp-preview-detail__value--fund">' +
          esc(campaign.totalFundedNimLabel || "0") +
          " NIM</span></div>" +
          '<div class="cp-preview-detail">' +
          '<span class="cp-preview-detail__label">Used balance:</span> ' +
          '<span class="cp-preview-detail__value cp-preview-detail__value--fund">' +
          esc(campaign.usedNimLabel || "0") +
          " NIM</span></div>" +
          '<div class="cp-preview-detail">' +
          '<span class="cp-preview-detail__label">Remaining balance:</span> ' +
          '<span class="cp-preview-detail__value cp-preview-detail__value--fund">' +
          esc(campaign.remainingNimLabel || formatFundNim(campaign.balanceLuna)) +
          "</span></div>";
      } else {
        fundHtml +=
          '<div class="cp-preview-detail">' +
          '<span class="cp-preview-detail__label">Current Fund Amount:</span> ' +
          '<span class="cp-preview-detail__value cp-preview-detail__value--fund">' +
          esc(formatFundNim(campaign.balanceLuna)) +
          "</span></div>";
      }
      return (
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">Advert Name:</span> ' +
        '<span class="cp-preview-detail__value">' +
        esc(campaign.projectName) +
        imageNote +
        "</span></div>" +
        '<div class="cp-preview-detail">' +
        '<span class="cp-preview-detail__label">URL:</span> ' +
        '<span class="cp-preview-detail__value">' +
        (url
          ? '<a href="' +
            esc(url) +
            '" target="_blank" rel="noopener noreferrer" class="mono ms-link-expl">' +
            esc(url) +
            "</a>"
          : "—") +
        "</span></div>" +
        fundHtml +
        renderCampaignPrepaidHtml(campaign) +
        renderCampaignAnalyticsHtml(campaign)
      );
    }

    function renderPreviewPanel(payload) {
      var imageUrl = payload && payload.imageUrl ? String(payload.imageUrl) : "";
      var wallet = payload && payload.wallet ? String(payload.wallet) : "";
      var walletAttr = wallet ? ' data-wallet="' + esc(wallet) + '"' : "";
      var imageAttr = imageUrl ? ' data-image-url="' + esc(imageUrl) + '"' : "";
      return (
        '<div class="cp-preview-panel">' +
        "<h2>Preview</h2>" +
        '<canvas class="cp-preview-canvas adv-preview-canvas"' +
        walletAttr +
        imageAttr +
        ' aria-label="Billboard preview"></canvas>' +
        '<p class="cp-preview-warn" hidden></p>' +
        '<div class="cp-preview-details">' +
        renderPreviewDetailsHtml(payload) +
        "</div>" +
        '<div class="cp-tx-history"></div>' +
        "</div>"
      );
    }

    function syncAdminPreview(payload) {
      var panel = activePreviewPanel();
      if (!panel) return;
      var canvas = panel.querySelector(".cp-preview-canvas");
      if (!canvas || typeof window.__advUpdateBillboardPreview !== "function") {
        requestAnimationFrame(function () {
          syncAdminPreview(payload);
        });
        return;
      }
      if (canvas.hidden || canvas.closest("[hidden]") || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
        requestAnimationFrame(function () {
          syncAdminPreview(payload);
        });
        return;
      }
      updatePreviewPanelInTab(payload);
    }

    function setPreviewSelection(selection) {
      state.previewSelection = selection || null;
      var campaignId =
        selection && selection.kind === "campaign" ? selection.id : "";
      var placeholderId =
        selection && selection.kind === "placeholder" ? selection.id : "";
      document.querySelectorAll("[data-preview-campaign]").forEach(function (row) {
        row.classList.toggle(
          "is-selected",
          campaignId && row.getAttribute("data-preview-campaign") === campaignId
        );
      });
      document.querySelectorAll("[data-preview-campaign-item]").forEach(function (row) {
        row.classList.toggle(
          "is-selected",
          campaignId && row.getAttribute("data-preview-campaign-item") === campaignId
        );
      });
      document.querySelectorAll("[data-preview-placeholder-item]").forEach(function (row) {
        row.classList.toggle(
          "is-selected",
          placeholderId && row.getAttribute("data-preview-placeholder-item") === placeholderId
        );
      });
    }

    function formatTxDate(iso) {
      if (!iso) return "";
      try {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      } catch (e) {
        return String(iso);
      }
    }

    function renderAdminCampaignTxHistory(transactions, panel) {
      var root = panel || activePreviewPanel();
      var el = root ? root.querySelector(".cp-tx-history") : null;
      if (!el) return;
      if (!transactions || !transactions.length) {
        el.innerHTML = "";
        return;
      }
      var html = '<h3 class="cp-tx-title">Payments</h3><ul class="cp-tx-list">';
      for (var i = 0; i < transactions.length; i++) {
        var tx = transactions[i];
        var link = tx.explorerUrl
          ? '<a class="ms-link-expl" href="' +
            esc(tx.explorerUrl) +
            '" target="_blank" rel="noopener noreferrer">nimiq.watch</a>'
          : "";
        html +=
          '<li class="cp-tx-item">' +
          '<span class="cp-tx-date">' +
          esc(formatTxDate(tx.recordedAt)) +
          "</span>" +
          '<span class="cp-tx-amount">' +
          esc(tx.amountNimLabel || "0") +
          " NIM</span>" +
          link +
          "</li>";
      }
      html += "</ul>";
      el.innerHTML = html;
    }

    async function loadAdminCampaignTransactions(campaignId, panel) {
      var root = panel || activePreviewPanel();
      var el = root ? root.querySelector(".cp-tx-history") : null;
      if (!el) return;
      if (!campaignId) {
        el.innerHTML = "";
        return;
      }
      var loadingNote = document.createElement("p");
      loadingNote.className = "cp-preview-caption";
      loadingNote.textContent = "Loading payments…";
      el.innerHTML = "";
      el.appendChild(loadingNote);
      try {
        var r = await api(
          "/api/admin/advertise/campaigns/" + encodeURIComponent(campaignId) + "/transactions",
          { method: "GET" }
        );
        if (!r.ok) {
          el.innerHTML = "";
          return;
        }
        renderAdminCampaignTxHistory((r.body && r.body.transactions) || [], root);
      } catch (e) {
        el.innerHTML = "";
      }
    }

    function updatePreviewPanelInTab(payload) {
      var panel = activePreviewPanel();
      if (!panel) return;
      var details = panel.querySelector(".cp-preview-details");
      if (details) details.innerHTML = renderPreviewDetailsHtml(payload);
      var canvas = panel.querySelector(".cp-preview-canvas");
      var warnEl = panel.querySelector(".cp-preview-warn");
      if (canvas && typeof window.__advUpdateBillboardPreview === "function") {
        window.__advUpdateBillboardPreview(canvas, {
          imageUrl: payload && payload.imageUrl ? String(payload.imageUrl) : "",
          wallet: payload && payload.wallet ? String(payload.wallet) : "",
          warnEl: warnEl,
        });
      }
      var campaignId =
        payload && payload.kind === "campaign" && payload.campaign
          ? payload.campaign.id
          : "";
      void loadAdminCampaignTransactions(campaignId, panel);
    }

    function itemLabel(item) {
      if (!item) return "";
      if (item.kind === "campaign") {
        var c = (state.overview.approvedCampaigns || []).find(function (x) { return x.id === item.campaignId; });
        return c ? ("Campaign: " + c.projectName) : ("Campaign: " + item.campaignId);
      }
      var p = (state.overview.placeholders || []).find(function (x) { return x.id === item.placeholderAdvertId; });
      return p ? ("Placeholder: " + p.name) : ("Placeholder: " + item.placeholderAdvertId);
    }

    function renderItemsEditor() {
      var ul = document.getElementById("cpItemsList");
      if (!ul) return;
      ul.innerHTML = "";
      for (var i = 0; i < state.draftItems.length; i++) {
        (function (idx) {
          var item = state.draftItems[idx];
          var li = document.createElement("li");
          if (item.kind === "campaign" && item.campaignId) {
            li.className = "cp-item-previewable";
            li.setAttribute("data-preview-campaign-item", item.campaignId);
            li.addEventListener("click", function (ev) {
              if (ev.target && ev.target.closest && ev.target.closest("button")) return;
              var sel = { kind: "campaign", id: item.campaignId };
              setPreviewSelection(sel);
              updatePreviewPanelInTab(previewPayload(sel));
            });
          } else if (item.kind === "placeholder" && item.placeholderAdvertId) {
            li.className = "cp-item-previewable";
            li.setAttribute("data-preview-placeholder-item", item.placeholderAdvertId);
            li.addEventListener("click", function (ev) {
              if (ev.target && ev.target.closest && ev.target.closest("button")) return;
              var selPh = { kind: "placeholder", id: item.placeholderAdvertId };
              setPreviewSelection(selPh);
              updatePreviewPanelInTab(previewPayload(selPh));
            });
          }
          var lab = document.createElement("span");
          lab.className = "cp-items__label";
          lab.textContent = (idx + 1) + ". " + itemLabel(item);
          var up = document.createElement("button");
          up.type = "button"; up.className = "cp-btn"; up.textContent = "↑";
          up.disabled = idx === 0;
          up.onclick = function () {
            var tmp = state.draftItems[idx - 1];
            state.draftItems[idx - 1] = state.draftItems[idx];
            state.draftItems[idx] = tmp;
            renderItemsEditor();
          };
          var down = document.createElement("button");
          down.type = "button"; down.className = "cp-btn"; down.textContent = "↓";
          down.disabled = idx >= state.draftItems.length - 1;
          down.onclick = function () {
            var tmp2 = state.draftItems[idx + 1];
            state.draftItems[idx + 1] = state.draftItems[idx];
            state.draftItems[idx] = tmp2;
            renderItemsEditor();
          };
          var rm = document.createElement("button");
          rm.type = "button"; rm.className = "cp-btn cp-btn--danger"; rm.textContent = "Remove";
          rm.onclick = function () {
            state.draftItems.splice(idx, 1);
            renderItemsEditor();
          };
          li.appendChild(lab); li.appendChild(up); li.appendChild(down); li.appendChild(rm);
          ul.appendChild(li);
        })(i);
      }
      setPreviewSelection(state.previewSelection);
    }

    function render() {
      var root = document.getElementById("cpRoot");
      if (!root || !state.overview) return;
      if (typeof window.__advDisposeBillboardPreviewsIn === "function") {
        window.__advDisposeBillboardPreviewsIn(root);
      }
      var ov = state.overview;
      var pending = ov.pendingCampaigns || [];
      var approved = ov.approvedCampaigns || [];
      var expired = ov.expiredCampaigns || [];
      var unfunded = ov.unfundedCampaigns || [];
      var sets = ov.rotationSets || [];
      var editing = state.editingSetId
        ? sets.find(function (s) { return s.id === state.editingSetId; })
        : null;
      var tab = state.activeTab || "pending";
      var previewSelection = resolvePreviewSelection();
      var previewCampaignId =
        previewSelection && previewSelection.kind === "campaign" ? previewSelection.id : "";
      var previewPayloadForTab = previewPayloadForActiveTab();

      var html = renderTabBar();

      html += '<div class="cp-tab-panel" id="cpTabPending" role="tabpanel"' +
        (tab === "pending" ? "" : " hidden") + ">";
      html += '<div class="cp-tab-layout">';
      html += '<div class="cp-panel"><h2>Pending approval</h2>';
      if (!pending.length) {
        html += '<p class="cp-lead">No campaigns awaiting approval.</p>';
      } else {
        html += '<table class="cp-table"><thead><tr><th>Project</th><th>Owner</th><th>Target</th><th></th></tr></thead><tbody>';
        for (var pi = 0; pi < pending.length; pi++) {
          var p = pending[pi];
          var sel = previewCampaignId === p.id ? " is-selected" : "";
          html += '<tr class="cp-row-selectable' + sel + '" data-preview-campaign="' + esc(p.id) + '">' +
            "<td>" + esc(p.projectName) + "</td><td>" + ownerCell(p) + "</td>" +
            '<td class="mono"><a href="' + esc(p.miniappTargetUrl) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' +
            esc(p.miniappTargetUrl) + "</a></td>" +
            '<td><div class="cp-row-actions">' +
            '<button type="button" class="cp-btn cp-btn--icon cp-btn--approve" data-approve="' + esc(p.id) + '" aria-label="Approve" title="Approve">✓</button>' +
            '<button type="button" class="cp-btn cp-btn--icon cp-btn--reject" data-reject="' + esc(p.id) + '" aria-label="Reject" title="Reject">✕</button>' +
            "</div></td></tr>";
        }
        html += "</tbody></table>";
      }
      html += "</div>";
      html += renderPreviewPanel(tab === "pending" ? previewPayloadForTab : null);
      html += "</div></div>";

      html += '<div class="cp-tab-panel" id="cpTabApproved" role="tabpanel"' +
        (tab === "approved" ? "" : " hidden") + ">";
      html += '<div class="cp-tab-layout">';
      html += '<div class="cp-panel"><h2>Approved campaigns (' + approved.length + ")</h2>";
      html += '<p class="cp-stat-note">Audience stats and balance drain use the same live-view rules (7 blocks, tab-visible, not AFK). Used balance reflects drained prepaid NIM.</p>';
      if (!approved.length) {
        html += '<p class="cp-lead">None yet — approve funded campaigns on the Pending tab.</p>';
      } else {
        html += '<table class="cp-table"><thead><tr><th>Project</th><th>Owner</th><th>Viewers</th><th>Link visits</th><th>Total funded</th><th>Used</th><th>Remaining</th><th>Time left</th><th>Live</th></tr></thead><tbody>';
        for (var ai = 0; ai < approved.length; ai++) {
          var a = approved[ai];
          var asel = previewCampaignId === a.id ? " is-selected" : "";
          var liveLabel = a.inRotationSet ? "Live" : "Not live";
          var analytics = a.analytics || {};
          var prepaid = a.prepaid || {};
          var timeLeft =
            prepaid.remainingOnScreenLabel && prepaid.hasPrepaidBalance
              ? "~" + prepaid.remainingOnScreenLabel
              : prepaid.isExpired || a.status === "expired"
                ? "Used up"
                : "—";
          html += '<tr class="cp-row-selectable' + asel + '" data-preview-campaign="' + esc(a.id) + '">' +
            "<td>" + esc(a.projectName) + "</td><td>" + ownerCell(a) + "</td>" +
            "<td>" + esc(String(analytics.uniqueViewers || 0)) + "</td>" +
            "<td>" + esc(String(analytics.linkClicks || 0)) + "</td>" +
            '<td class="cp-fund-cell">' + esc(a.totalFundedNimLabel || "0") + " NIM</td>" +
            '<td class="cp-fund-cell">' + esc(a.usedNimLabel || "0") + " NIM</td>" +
            '<td class="cp-fund-cell">' + esc(a.remainingNimLabel || formatFundNim(a.balanceLuna)) + "</td>" +
            "<td>" + esc(timeLeft) + "</td>" +
            "<td>" + esc(liveLabel) + "</td></tr>";
        }
        html += "</tbody></table>";
      }
      html += "</div>";
      html += renderPreviewPanel(tab === "approved" ? previewPayloadForTab : null);
      html += "</div></div>";

      html += '<div class="cp-tab-panel" id="cpTabInactive" role="tabpanel"' +
        (tab === "inactive" ? "" : " hidden") + ">";
      html += '<div class="cp-tab-layout">';
      html += '<div class="cp-panel"><h2>Expired / unfunded</h2>';
      if (!expired.length && !unfunded.length) {
        html += '<p class="cp-lead">No expired or unfunded campaigns.</p>';
      } else {
        if (expired.length) {
          html += '<h3 class="cp-subhead">Expired (' + expired.length + ")</h3>";
          html += '<p class="cp-lead">Approved campaigns that ran out of prepaid balance or passed expiry.</p>';
          html += '<table class="cp-table"><thead><tr><th>Project</th><th>Owner</th><th>Status</th><th>Total funded</th><th>Remaining</th><th>Updated</th></tr></thead><tbody>';
          html += renderInactiveCampaignRows(expired, previewCampaignId);
          html += "</tbody></table>";
        }
        if (unfunded.length) {
          html += '<h3 class="cp-subhead"' + (expired.length ? ' style="margin-top:1rem"' : "") + ">Unfunded (" + unfunded.length + ")</h3>";
          html += '<p class="cp-lead">Drafts and campaigns that never completed payment.</p>';
          html += '<table class="cp-table"><thead><tr><th>Project</th><th>Owner</th><th>Status</th><th>Total funded</th><th>Remaining</th><th>Updated</th></tr></thead><tbody>';
          html += renderInactiveCampaignRows(unfunded, previewCampaignId);
          html += "</tbody></table>";
        }
      }
      html += "</div>";
      html += renderPreviewPanel(tab === "inactive" ? previewPayloadForTab : null);
      html += "</div></div>";

      html += '<div class="cp-tab-panel" id="cpTabRotations" role="tabpanel"' +
        (tab === "rotations" ? "" : " hidden") + ">";
      html += '<div class="cp-tab-layout">';
      html += '<div>';
      html += '<div class="cp-panel"><h2>Rotation sets (' + sets.length + ")</h2>";
      html += '<p class="cp-lead">Create ordered slide lists for in-game campaign billboards (Build → Campaign tab). Up to 8 slides per set.</p>';
      html += '<div class="cp-field"><label for="cpNewSetName">New set name</label>';
      html += '<input id="cpNewSetName" maxlength="80" placeholder="Hub carousel A"/></div>';
      html += '<div class="cp-row-actions"><button type="button" class="cp-btn cp-btn--accent" id="cpNewSetBtn">Create rotation set</button></div>';
      html += '<p class="cp-lead" style="margin-top:0.45rem">Empty sets seed with default Nimiq placeholder adverts. Edit to reorder slides and add approved campaigns.</p>';
      html += '<div id="cpNewSetMsg"></div>';
      if (!sets.length) html += '<p class="cp-lead">No rotation sets yet.</p>';
      else {
        html += '<table class="cp-table" style="margin-top:0.55rem"><thead><tr><th>Name</th><th>Slides</th><th></th></tr></thead><tbody>';
        for (var si = 0; si < sets.length; si++) {
          var s = sets[si];
          html += "<tr><td>" + esc(s.name) + "</td><td>" + esc(String((s.items || []).length)) + "</td>" +
            '<td><button type="button" class="cp-btn" data-edit-set="' + esc(s.id) + '">Edit</button> ' +
            '<button type="button" class="cp-btn cp-btn--danger" data-del-set="' + esc(s.id) + '">Delete</button></td></tr>';
        }
        html += "</tbody></table>";
      }
      html += "</div>";

      if (editing) {
        html += '<div class="cp-panel" id="cpEditPanel"><h2>Edit rotation set: ' + esc(editing.name) + "</h2>";
        html += '<div class="cp-field"><label for="cpSetName">Name</label><input id="cpSetName" value="' + esc(editing.name) + '"/></div>';
        html += '<div class="cp-field"><label for="cpPlaceholderDwell">Placeholder dwell (seconds)</label>' +
          '<input id="cpPlaceholderDwell" type="number" min="1" max="300" value="' + esc(String(editing.placeholderDwellSec || 10)) + '"/></div>';
        html += '<p class="cp-lead">Order = display order. Click any slide to preview. Campaign slides use each campaign dwell (10/30/45s).</p>';
        html += '<ul id="cpItemsList" class="cp-items"></ul>';
        html += '<div class="cp-row-actions" style="margin-top:0.55rem">';
        html += '<select id="cpAddPlaceholder" class="cp-btn" style="min-width:10rem">';
        html += '<option value="">Add placeholder…</option>';
        (ov.placeholders || []).forEach(function (ph) {
          html += '<option value="' + esc(ph.id) + '">' + esc(ph.name) + "</option>";
        });
        html += "</select>";
        html += '<select id="cpAddCampaign" class="cp-btn" style="min-width:10rem">';
        html += '<option value="">Add campaign…</option>';
        approved.forEach(function (c) {
          html += '<option value="' + esc(c.id) + '">' + esc(c.projectName) + "</option>";
        });
        html += "</select>";
        html += '<button type="button" class="cp-btn cp-btn--accent" id="cpSaveSetBtn">Save set</button>';
        html += '<button type="button" class="cp-btn" id="cpCancelEditBtn">Cancel</button>';
        html += '</div><div id="cpEditMsg"></div></div>';
      }
      html += "</div>";
      html += renderPreviewPanel(tab === "rotations" ? previewPayloadForTab : null);
      html += "</div></div>";

      root.innerHTML = html;

      root.querySelectorAll("[data-cp-tab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var nextTab = btn.getAttribute("data-cp-tab");
          if (!nextTab || nextTab === state.activeTab) return;
          var pendingPanel = document.getElementById("cpTabPending");
          var approvedPanel = document.getElementById("cpTabApproved");
          var inactivePanel = document.getElementById("cpTabInactive");
          var rotationsPanel = document.getElementById("cpTabRotations");
          if (typeof window.__advDisposeBillboardPreviewsIn === "function") {
            if (nextTab !== "pending" && pendingPanel) {
              window.__advDisposeBillboardPreviewsIn(pendingPanel);
            }
            if (nextTab !== "approved" && approvedPanel) {
              window.__advDisposeBillboardPreviewsIn(approvedPanel);
            }
            if (nextTab !== "inactive" && inactivePanel) {
              window.__advDisposeBillboardPreviewsIn(inactivePanel);
            }
            if (nextTab !== "rotations" && rotationsPanel) {
              window.__advDisposeBillboardPreviewsIn(rotationsPanel);
            }
          }
          state.activeTab = nextTab;
          resolvePreviewSelection();
          render();
        });
      });

      root.querySelectorAll("[data-preview-campaign]").forEach(function (row) {
        row.addEventListener("click", function (ev) {
          if (ev.target && ev.target.closest && ev.target.closest("button, a")) return;
          var id = row.getAttribute("data-preview-campaign");
          var sel = { kind: "campaign", id: id };
          setPreviewSelection(sel);
          updatePreviewPanelInTab(previewPayload(sel) || idlePreviewPayload());
        });
      });

      root.querySelectorAll("[data-approve]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-approve");
          btn.disabled = true;
          api("/api/admin/advertise/campaigns/" + encodeURIComponent(id) + "/approve", { method: "POST", body: "{}" })
            .then(function () { return load(); })
            .catch(function () { btn.disabled = false; });
        });
      });
      root.querySelectorAll("[data-reject]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-reject");
          var note = window.prompt("Reject reason (optional):") || "";
          btn.disabled = true;
          api("/api/admin/advertise/campaigns/" + encodeURIComponent(id) + "/reject", {
            method: "POST",
            body: JSON.stringify({ note: note }),
          }).then(function () { return load(); }).catch(function () { btn.disabled = false; });
        });
      });
      var newBtn = document.getElementById("cpNewSetBtn");
      if (newBtn) {
        newBtn.addEventListener("click", function () {
          var nameEl = document.getElementById("cpNewSetName");
          var msgEl = document.getElementById("cpNewSetMsg");
          var name = nameEl ? String(nameEl.value || "").trim() : "";
          if (!name) {
            if (msgEl) {
              msgEl.className = "cp-err";
              msgEl.textContent = "Enter a name for the rotation set.";
            }
            return;
          }
          newBtn.disabled = true;
          if (msgEl) msgEl.textContent = "";
          api("/api/admin/campaign/rotation-sets", {
            method: "POST",
            body: JSON.stringify({ name: name }),
          }).then(function (r) {
            if (!r.ok) {
              if (msgEl) {
                msgEl.className = "cp-err";
                msgEl.textContent = (r.body && r.body.error) || "Could not create rotation set.";
              }
              return;
            }
            if (r.body && r.body.rotationSet) {
              state.editingSetId = r.body.rotationSet.id;
              state.draftItems = (r.body.rotationSet.items || []).map(function (it) {
                return it.kind === "campaign"
                  ? { kind: "campaign", campaignId: it.campaignId }
                  : { kind: "placeholder", placeholderAdvertId: it.placeholderAdvertId };
              });
              if (nameEl) nameEl.value = "";
            }
            return load();
          }).finally(function () {
            newBtn.disabled = false;
          });
        });
      }
      root.querySelectorAll("[data-edit-set]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.editingSetId = btn.getAttribute("data-edit-set");
          var set = sets.find(function (s) { return s.id === state.editingSetId; });
          state.draftItems = (set && set.items ? set.items : []).map(function (it) {
            return it.kind === "campaign"
              ? { kind: "campaign", campaignId: it.campaignId }
              : { kind: "placeholder", placeholderAdvertId: it.placeholderAdvertId };
          });
          state.previewSelection = previewSelectionFromDraftItem(state.draftItems[0]);
          render();
          renderItemsEditor();
        });
      });
      root.querySelectorAll("[data-del-set]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!window.confirm("Delete this rotation set?")) return;
          var id = btn.getAttribute("data-del-set");
          api("/api/admin/campaign/rotation-sets/" + encodeURIComponent(id), { method: "DELETE" })
            .then(function () { return load(); });
        });
      });

      if (editing) {
        renderItemsEditor();
        var addPh = document.getElementById("cpAddPlaceholder");
        if (addPh) {
          addPh.addEventListener("change", function () {
            var v = addPh.value;
            if (!v) return;
            if (state.draftItems.length >= 8) return;
            state.draftItems.push({ kind: "placeholder", placeholderAdvertId: v });
            var selPh = { kind: "placeholder", id: v };
            setPreviewSelection(selPh);
            updatePreviewPanelInTab(previewPayload(selPh));
            addPh.value = "";
            renderItemsEditor();
          });
        }
        var addC = document.getElementById("cpAddCampaign");
        if (addC) {
          addC.addEventListener("change", function () {
            var cv = addC.value;
            if (!cv) return;
            var selCv = { kind: "campaign", id: cv };
            setPreviewSelection(selCv);
            updatePreviewPanelInTab(previewPayload(selCv));
            if (state.draftItems.length >= 8) return;
            state.draftItems.push({ kind: "campaign", campaignId: cv });
            addC.value = "";
            renderItemsEditor();
          });
        }
        var saveBtn = document.getElementById("cpSaveSetBtn");
        if (saveBtn) {
          saveBtn.addEventListener("click", function () {
            var nameEl = document.getElementById("cpSetName");
            var dwellEl = document.getElementById("cpPlaceholderDwell");
            var msgEl = document.getElementById("cpEditMsg");
            api("/api/admin/campaign/rotation-sets/" + encodeURIComponent(editing.id), {
              method: "PUT",
              body: JSON.stringify({
                name: nameEl ? nameEl.value : editing.name,
                placeholderDwellSec: dwellEl ? Number(dwellEl.value) : editing.placeholderDwellSec,
                items: state.draftItems,
              }),
            }).then(function (r) {
              if (msgEl) {
                msgEl.className = r.ok ? "cp-msg" : "cp-err";
                msgEl.textContent = r.ok ? "Saved. In-game boards update on next room change." : ((r.body && r.body.error) || "Save failed");
              }
              if (r.ok) return load();
            });
          });
        }
        var cancelBtn = document.getElementById("cpCancelEditBtn");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", function () {
            state.editingSetId = null;
            state.draftItems = [];
            render();
          });
        }
      }
      setPreviewSelection(previewSelection);
      void hydrateOwnerIdenticons(root);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          syncAdminPreview(previewPayloadForTab);
        });
      });
    }

    async function load() {
      var root = document.getElementById("cpRoot");
      if (!readAuthToken()) {
        if (root) root.innerHTML = authGateHtml("Sign in with your admin wallet to manage campaigns.");
        return;
      }
      try {
        var r = await api("/api/admin/campaign/overview");
        if (r.status === 401) {
          if (root) root.innerHTML = authGateHtml("Session expired. Sign in again.");
          return;
        }
        if (r.status === 403 || !r.ok) {
          if (root) {
            var backendMsg = apiBackendError(r.status, r.body);
            root.innerHTML = authGateHtml(
              backendMsg || "This wallet is not authorized for campaign admin."
            );
          }
          return;
        }
        state.overview = r.body;
        if (state.editingSetId) {
          var set = (state.overview.rotationSets || []).find(function (s) { return s.id === state.editingSetId; });
          if (!set) state.editingSetId = null;
        }
        resolvePreviewSelection();
        render();
      } catch (e) {
        var msg = String((e && e.message) || e || "");
        if (root) {
          var loadMsg = "Could not load campaign admin.";
          if (msg === "not_signed_in") {
            loadMsg = "Sign in with your admin wallet to manage campaigns.";
          } else if (msg === "backend_timeout") {
            loadMsg =
              "Game server is not responding on port 3001. Restart npm run dev and hard-refresh.";
          }
          root.innerHTML = authGateHtml(loadMsg);
        }
      }
    }
    load();
  })();
  </script>
</body>
</html>`;
}
