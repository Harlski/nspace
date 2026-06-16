import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import {
  billboardFaceAspectRatio,
  PAID_BILLBOARD_ORIENTATION,
} from "./billboardImageSpec.js";
import { advertiseBillboardPreviewModuleScript } from "./advertiseBillboardPreviewScript.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";
import { nimiqHexLoaderSvg } from "./nimiqHexLoaderMarkup.js";

/** HTML shell for `/advertise` — mini-app billboard campaign dashboard. */
export function advertisePageHtml(): string {
  const previewAspectRatio = billboardFaceAspectRatio(PAID_BILLBOARD_ORIENTATION);
  const previewModule = advertiseBillboardPreviewModuleScript();
  const nimiqHexSpinner = JSON.stringify(nimiqHexLoaderSvg("ms-spinner"));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Advertise — Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    body.ms-site.adv-page {
      font-size: 16px;
      line-height: 1.5;
    }
    .adv-page .ms-doc-title {
      font-size: clamp(1.75rem, 4vw, 2rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 0.35rem;
    }
    .adv-guide-link {
      font-size: 0.9rem;
      color: #9fb0c7;
      margin: 0 0 1rem;
      max-width: 42rem;
      line-height: 1.45;
    }
    .adv-guide-link a { color: #93c5fd; font-weight: 600; text-decoration: none; }
    .adv-guide-link a:hover { text-decoration: underline; }
    .adv-panel { max-width: 52rem; margin: 0.75rem 0 1.25rem; padding: 1rem 1.1rem; border: 1px solid #263348; border-radius: 12px; background: #0f1622; }
    .adv-panel h2 { margin: 0 0 0.75rem; font-size: 1.25rem; font-weight: 700; color: #e6edf3; letter-spacing: -0.01em; }
    .adv-row { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
    .adv-row label, .adv-row-label { font-size: 0.875rem; font-weight: 600; color: #9fb0c7; }
    .adv-text, .adv-input {
      width: 100%; box-sizing: border-box;
      background: #0a1018; color: #e6edf3; border: 1px solid #334155; border-radius: 8px;
      padding: 0.55rem 0.65rem; font: inherit; font-size: 1rem; line-height: 1.4;
    }
    .adv-input:focus { outline: 2px solid rgba(90, 160, 255, 0.45); border-color: #4d83d0; }
    .adv-text { min-height: 2.4rem; resize: vertical; }
    .adv-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-top: 0.65rem; }
    .adv-actions button {
      background: var(--ms-accent); color: #ffffff; border: 1px solid var(--ms-accent-hover-border);
      border-radius: 8px; padding: 0.5rem 0.9rem; cursor: pointer; font: inherit; font-size: 0.9375rem; font-weight: 700;
    }
    .adv-actions button.secondary { background: #1a2433; border-color: #334155; color: #c8d4e4; font-weight: 600; }
    .adv-hint, .adv-small { font-size: 0.8125rem; color: #6b7d95; margin: 0.15rem 0 0; line-height: 1.45; }
    .adv-notice { font-size: 0.875rem; color: #9fb0c7; margin: 0.5rem 0 0; line-height: 1.45; }
    .adv-meta { font-size: 0.8125rem; color: #7b8da8; line-height: 1.45; }
    .adv-tx-history { margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #1e293b; }
    .adv-tx-title { margin: 0 0 0.5rem; font-size: 0.8125rem; font-weight: 600; color: #9fb0c7; }
    .adv-tx-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
    .adv-tx-item {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.8fr) auto;
      gap: 0.5rem;
      align-items: baseline;
      font-size: 0.8125rem;
      color: #7b8da8;
    }
    .adv-tx-date { color: #9fb0c7; }
    .adv-tx-amount { font-variant-numeric: tabular-nums; color: #c8d4e4; }
    .adv-tx-link { white-space: nowrap; }
    .adv-status {
      display: inline-block; font-size: 0.68rem; padding: 0.12rem 0.38rem; border-radius: 4px;
      background: #1e293b; color: #94a3b8; text-transform: capitalize;
    }
    .adv-status--active, .adv-status--approved { background: #14532d; color: #86efac; }
    .adv-status--live { background: #0f5132; color: #6ee7b7; }
    .adv-status--not-live { background: #1e293b; color: #94a3b8; }
    .adv-status-group { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
    .adv-status--expired { background: #3f1f1f; color: #fca5a5; }
    .adv-status--rejected { background: #3f1f1f; color: #fca5a5; }
    .adv-status--pending_payment { background: #422006; color: #fcd34d; }
    .adv-status--pending_approval { background: #1e3a5f; color: #93c5fd; }
    .adv-status--draft { background: #1e293b; color: #94a3b8; }
    .adv-campaign-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: 0.65rem;
      margin-top: 0.75rem;
    }
    .adv-campaign-tile {
      border: 1px solid #263348;
      border-radius: 10px;
      background: #0a1018;
      padding: 0.5rem;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      text-align: left;
      font: inherit;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .adv-campaign-tile:hover { border-color: #3d5168; }
    .adv-campaign-tile.is-selected {
      border-color: var(--ms-accent);
      box-shadow: 0 0 0 1px var(--ms-accent);
    }
    .adv-campaign-thumb {
      width: 100%;
      aspect-ratio: ${previewAspectRatio} / 1;
      flex: none;
      border-radius: 6px;
      background-color: #111820;
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
      border: 1px solid #1e293b;
    }
    .adv-campaign-thumb--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4b5f78;
      font-size: 0.68rem;
    }
    .adv-campaign-tile-title {
      margin: 0;
      font-size: 0.78rem;
      color: #e2e8f0;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .adv-campaign-detail {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #263348;
    }
    .adv-campaign-detail[hidden] { display: none !important; }
    .adv-campaign-detail h3 { margin: 0 0 0.5rem; font-size: 1.0625rem; font-weight: 700; color: #e6edf3; }
    .adv-detail-layout { display: grid; gap: 1rem; margin-top: 0.65rem; }
    .adv-existing-detail-layout { display: grid; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #263348; }
    @media (min-width: 720px) {
      .adv-detail-layout { grid-template-columns: 1fr min(26rem, 46vw); align-items: start; }
      .adv-existing-detail-layout { grid-template-columns: 1fr min(26rem, 46vw); align-items: start; }
    }
    .adv-fund-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(5, 10, 18, 0.72);
    }
    .adv-fund-overlay[hidden] { display: none !important; }
    .adv-fund-popover {
      width: min(22rem, 100%);
      border: 1px solid #334155;
      border-radius: 12px;
      background: #0f1622;
      padding: 1rem;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    }
    .adv-fund-popover h3 { margin: 0 0 0.85rem; font-size: 1.0625rem; font-weight: 700; color: #e6edf3; }
    .adv-fund-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem 0.35rem 0.35rem;
      text-align: center;
    }
    .adv-fund-status[hidden] { display: none !important; }
    .adv-fund-status__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 2.4rem;
    }
    .adv-fund-status__icon .ms-spinner {
      height: 2.4rem;
      width: calc(2.4rem * 54 / 48);
    }
    .adv-fund-status__tick {
      width: 2.4rem;
      height: 2.4rem;
      color: #34d399;
    }
    .adv-fund-status__text {
      margin: 0;
      font-size: 0.9rem;
      line-height: 1.45;
      color: #c8d4e4;
      max-width: 18rem;
    }
    .adv-fund-status__text--ok { color: #86efac; font-weight: 600; }
    .adv-fund-status__text--err { color: #f87171; }
    .adv-fund-recipient {
      margin: 0.35rem 0 0.65rem;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      border: 1px dashed #334155;
      font-size: 0.8125rem;
      color: #b8c5d9;
      word-break: break-all;
      line-height: 1.4;
    }
    .adv-edit-panel[hidden] { display: none !important; }
    .err { color: #f87171; font-size: 0.875rem; }
    .ok { color: #86efac; font-size: 0.8125rem; }
    #panel.ms-panel { max-width: 56rem; border: 0; background: transparent; padding: 0; }
    .adv-pay-box { margin-top: 0.5rem; padding: 0.55rem 0.65rem; border: 1px dashed #334155; border-radius: 8px; font-size: 0.8125rem; color: #b8c5d9; word-break: break-all; line-height: 1.45; }
    .adv-form-grid { display: grid; gap: 1rem; }
    .adv-image-upload { display: flex; flex-direction: column; gap: 0.35rem; }
    .adv-image-upload-row {
      display: flex;
      align-items: stretch;
      gap: 0.45rem;
      min-width: 0;
    }
    .adv-image-file-wrap {
      position: relative;
      flex-shrink: 0;
      display: inline-flex;
    }
    .adv-image-file {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      font-size: 0;
    }
    .adv-image-file-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.5rem;
      padding: 0.45rem 0.85rem;
      border: 1px solid #334155;
      border-radius: 8px;
      background: #1a2433;
      color: #c8d4e4;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }
    .adv-image-file-wrap:hover .adv-image-file-btn,
    .adv-image-file:focus-visible + .adv-image-file-btn {
      border-color: #4d83d0;
      color: #e6edf3;
    }
    .adv-image-input {
      flex: 1;
      min-width: 0;
    }
    .adv-upload-status { margin: 0; }
    .adv-audience-stats {
      margin-top: 0.65rem;
      padding: 0.55rem 0.65rem;
      border: 1px solid #263348;
      border-radius: 8px;
      background: rgba(15, 22, 34, 0.45);
      font-size: 0.8125rem;
      color: #b8c5d9;
      line-height: 1.45;
    }
    .adv-audience-stats h4 {
      margin: 0 0 0.35rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #9fb0c7;
    }
    .adv-audience-stats p { margin: 0.15rem 0; }
    .adv-time-remaining {
      margin: 0.65rem 0 0.5rem;
      padding: 0.65rem 0.75rem;
      border: 1px solid #263348;
      border-radius: 10px;
      background: rgba(12, 18, 28, 0.72);
    }
    .adv-time-remaining__head {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin-bottom: 0.55rem;
    }
    .adv-time-remaining__title {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7b8da8;
    }
    .adv-time-remaining__headline {
      font-size: 1.05rem;
      font-weight: 700;
      color: #e6edf3;
      line-height: 1.3;
    }
    .adv-time-remaining__bar {
      height: 0.55rem;
      border-radius: 999px;
      background: #1a2433;
      overflow: hidden;
      border: 1px solid #263348;
    }
    .adv-time-remaining__fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.25s ease;
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
    }
    .adv-time-remaining--high .adv-time-remaining__fill {
      background: linear-gradient(90deg, #059669, #34d399);
    }
    .adv-time-remaining--medium .adv-time-remaining__fill {
      background: linear-gradient(90deg, #d97706, #fbbf24);
    }
    .adv-time-remaining--low .adv-time-remaining__fill,
    .adv-time-remaining--expired .adv-time-remaining__fill {
      background: linear-gradient(90deg, #b91c1c, #f87171);
    }
    .adv-time-remaining--expired .adv-time-remaining__headline { color: #fca5a5; }
    .adv-time-remaining__meta,
    .adv-time-remaining__expires {
      margin: 0.45rem 0 0;
      font-size: 0.78rem;
      color: #7b8da8;
      line-height: 1.45;
    }
    .adv-fund-estimate-card {
      margin: 0.35rem 0 0.65rem;
      padding: 0.55rem 0.65rem;
      border: 1px solid #263348;
      border-radius: 8px;
      background: rgba(15, 22, 34, 0.55);
    }
    .adv-fund-estimate__primary {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #e6edf3;
    }
    .adv-fund-estimate__secondary {
      margin: 0.2rem 0 0;
      font-size: 0.78rem;
      color: #7b8da8;
    }
    @media (min-width: 720px) {
      .adv-form-grid { grid-template-columns: 1fr min(26rem, 46vw); align-items: start; }
    }
    .adv-preview-wrap { margin-top: 0.15rem; }
    .adv-preview-wrap h3 { margin: 0 0 0.5rem; font-size: 0.875rem; font-weight: 600; color: #9fb0c7; }
    .adv-preview-canvas {
      width: 100%;
      height: 20rem;
      min-height: 16rem;
      display: block;
      border-radius: 8px;
      border: 1px solid #263348;
      background: #0f1419;
    }
    .adv-preview-caption { display: none; }
    .adv-preview-warn {
      margin-top: 0.35rem;
      font-size: 0.72rem;
      color: #fbbf24;
      line-height: 1.35;
    }
    .adv-preview-warn[hidden] { display: none !important; }
    .adv-tabs {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      margin: 0 0 0.85rem;
    }
    .adv-tab {
      appearance: none;
      border: 1px solid #334155;
      background: #1a2433;
      color: #c8d4e4;
      border-radius: 8px;
      padding: 0.45rem 0.85rem;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .adv-tab:hover { border-color: #4d83d0; color: #e6edf3; }
    .adv-tab.is-active {
      background: var(--ms-accent);
      border-color: var(--ms-accent-hover-border);
      color: #ffffff;
    }
    .adv-tab-panel[hidden] { display: none !important; }
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
<body class="ms-site adv-page">
  ${analyticsTopbarHtml("advertise")}
  <h1 class="ms-doc-title" id="advDocTitle">Advertise</h1>
  <p class="adv-guide-link"><a href="/advertise/how-it-works">How advertising works</a> — steps from campaign to in-game billboard.</p>
  <div id="panel" class="ms-panel">Loading…</div>
  <div id="advFundOverlay" class="adv-fund-overlay" hidden>
    <div class="adv-fund-popover" role="dialog" aria-labelledby="advFundTitle">
      <h3 id="advFundTitle">Fund</h3>
      <div id="advFundFormBody">
      <div class="adv-row">
        <label for="advFundAmount">Amount (NIM)</label>
        <input class="adv-input" id="advFundAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="100"/>
      </div>
      <div class="adv-fund-estimate-card">
        <p class="adv-fund-estimate__primary" id="advFundEstimatePrimary">Enter an amount to fund your campaign</p>
        <p class="adv-fund-estimate__secondary" id="advFundEstimateSecondary"></p>
      </div>
      <p class="adv-small">Send to</p>
      <div class="adv-fund-recipient ms-mono" id="advFundRecipient"></div>
      <div class="adv-actions">
        <button type="button" id="advFundConfirmBtn">Pay with wallet</button>
        <button type="button" class="secondary" id="advFundCancelBtn">Cancel</button>
      </div>
      </div>
      <div id="advFundStatus" class="adv-fund-status" hidden>
        <div id="advFundStatusIcon" class="adv-fund-status__icon" aria-hidden="true"></div>
        <p id="advFundStatusText" class="adv-fund-status__text"></p>
      </div>
      <div id="advFundMsg" class="adv-hint" hidden></div>
      <div id="advFundResult" class="adv-pay-box" hidden></div>
    </div>
  </div>
  <script>
    var NIMIQ_HEX_SPINNER = ${nimiqHexSpinner};
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
    function escHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    }
    function statusLabel(st) {
      var labels = {
        pending_approval: "Pending Approval",
        pending_payment: "Pending Payment",
        approved: "Approved",
        rejected: "Rejected",
        expired: "Expired",
        draft: "Draft",
        active: "Active",
      };
      var key = String(st || "draft");
      if (labels[key]) return labels[key];
      return key.replace(/_/g, " ");
    }
    async function api(path, opts) {
      var token = readAuthToken();
      if (!token) throw new Error("not_signed_in");
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
              headers: { authorization: "Bearer " + token, "content-type": "application/json" },
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
    var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
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
    function renderBillboardPreviewHtml(canvasId, warnId, wallet, imageUrl) {
      var walletAttr = wallet
        ? ' data-wallet="' + escHtml(wallet) + '"'
        : "";
      var imageAttr = imageUrl
        ? ' data-image-url="' + escHtml(imageUrl) + '"'
        : "";
      var warnAttr = warnId ? ' data-warn-id="' + escHtml(warnId) + '"' : "";
      return (
        '<div class="adv-preview-wrap">' +
        '<h3>Preview</h3>' +
        '<canvas class="adv-preview-canvas" id="' + escHtml(canvasId) + '"' + walletAttr + imageAttr + warnAttr + ' aria-label="Billboard preview"></canvas>' +
        '<p class="adv-preview-warn" id="' + escHtml(warnId) + '" hidden></p>' +
        '</div>'
      );
    }
    function isPreviewCanvasReady(canvas) {
      if (!canvas || canvas.hidden) return false;
      if (canvas.closest("[hidden]")) return false;
      return canvas.clientWidth > 0 && canvas.clientHeight > 0;
    }
    function bindMainBillboardPreview() {
      if ((advDashboardState.activeTab || "new") !== "new") return;
      if (typeof window.__advBindBillboardPreview !== "function") {
        requestAnimationFrame(bindMainBillboardPreview);
        return;
      }
      var canvas = document.getElementById("advPreviewCanvas");
      if (!isPreviewCanvasReady(canvas)) {
        requestAnimationFrame(bindMainBillboardPreview);
        return;
      }
      window.__advBindBillboardPreview(
        document.getElementById("advImage"),
        canvas,
        document.getElementById("advPreviewWarn")
      );
    }
    function updateBillboardPreviewCanvas(canvas, opts) {
      if (!canvas || typeof window.__advUpdateBillboardPreview !== "function") return;
      if (opts && opts.imageUrl) canvas.setAttribute("data-image-url", opts.imageUrl);
      if (opts && opts.wallet) canvas.setAttribute("data-wallet", opts.wallet);
      window.__advUpdateBillboardPreview(canvas, opts || {});
    }
    function bindStaticBillboardPreview(canvas, warnEl) {
      if (!canvas) return;
      if (!isPreviewCanvasReady(canvas)) {
        requestAnimationFrame(function () {
          bindStaticBillboardPreview(canvas, warnEl);
        });
        return;
      }
      var imageUrl = canvas.getAttribute("data-image-url") || "";
      if (!imageUrl) return;
      if (typeof window.__advMountBillboardPreview !== "function") {
        requestAnimationFrame(function () {
          bindStaticBillboardPreview(canvas, warnEl);
        });
        return;
      }
      var preview = window.__advMountBillboardPreview(canvas, warnEl);
      updateBillboardPreviewCanvas(canvas, {
        imageUrl: imageUrl,
        wallet: canvas.getAttribute("data-wallet") || "",
        warnEl: warnEl,
      });
    }
    function syncExistingCampaignPreview(c, previewWallet) {
      var previewSlot = document.getElementById("advExistingPreviewSlot");
      var canvas = document.getElementById("advExistingPreviewCanvas");
      if (!previewSlot || !canvas) return;
      var show = c && shouldShowCampaignPreview(c);
      previewSlot.hidden = !show;
      if (!show) return;
      updateBillboardPreviewCanvas(canvas, {
        imageUrl: c.imageUrl,
        wallet: previewWallet || "",
        warnEl: document.getElementById("advExistingPreviewWarn"),
      });
    }
    function bindDetailBillboardPreviews() {
      if ((advDashboardState.activeTab || "new") !== "existing") return;
      if (typeof window.__advBindBillboardPreview !== "function") {
        requestAnimationFrame(bindDetailBillboardPreviews);
        return;
      }
      var bind = window.__advBindBillboardPreview;
      var editImages = document.querySelectorAll(".adv-campaign-detail .adv-edit-image");
      for (var ei = 0; ei < editImages.length; ei++) {
        (function (input) {
          var cid = input.getAttribute("data-id");
          if (!cid) return;
          bind(
            input,
            document.getElementById("advPreviewCanvas-" + cid),
            document.getElementById("advPreviewWarn-" + cid)
          );
        })(editImages[ei]);
      }
      var staticCanvases = document.querySelectorAll(
        ".adv-campaign-detail .adv-edit-panel canvas.adv-preview-canvas[data-image-url]"
      );
      for (var si = 0; si < staticCanvases.length; si++) {
        (function (canvas) {
          if (canvas.dataset.advStaticPreviewBound === "1") return;
          canvas.dataset.advStaticPreviewBound = "1";
          var warnId = canvas.getAttribute("data-warn-id");
          bindStaticBillboardPreview(canvas, warnId ? document.getElementById(warnId) : null);
        })(staticCanvases[si]);
      }
      var selected = advDashboardState.selectedId ? campaignById(advDashboardState.selectedId) : null;
      syncExistingCampaignPreview(selected, advDashboardState.previewWallet || "");
    }
    function bindActiveTabPreviews() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var tab = advDashboardState.activeTab || "new";
          if (tab === "new") bindMainBillboardPreview();
          else bindDetailBillboardPreviews();
        });
      });
    }
    function bindAllBillboardPreviews() {
      bindMainBillboardPreview();
      bindDetailBillboardPreviews();
    }
    function slideDwellTiers(meta) {
      return meta.slideDwellTiers || [];
    }
    function referenceDwellSec(meta) {
      return 10;
    }
    function baseNimPerMinute(meta) {
      var econ = meta.visibilityEconomics || {};
      return Number(econ.baseNimPerMinuteVisible || 0.5);
    }
    function formatNimPerMinuteLabel(rate) {
      var n = Number(rate);
      if (!Number.isFinite(n) || n <= 0) return "0";
      return (Math.round(n * 100) / 100).toFixed(2);
    }
    function formatVisibilityDuration(minutes) {
      if (!Number.isFinite(minutes) || minutes <= 0) return "0 minutes";
      if (minutes < 90) return Math.round(minutes) + " minutes";
      if (minutes < 48 * 60) {
        var h = minutes / 60;
        return h >= 10 ? Math.round(h) + " hours" : h.toFixed(1) + " hours";
      }
      var days = minutes / (24 * 60);
      return days >= 10 ? Math.round(days) + " days" : days.toFixed(1) + " days";
    }
    function estimateVisibility(meta, fundNim) {
      var fund = Number(fundNim);
      if (!Number.isFinite(fund) || fund <= 0) return null;
      var rate = baseNimPerMinute(meta);
      if (rate <= 0) return null;
      var minutes = fund / rate;
      return {
        nimPerMinuteVisible: rate,
        visibleMinutes: minutes,
        visibleHours: minutes / 60,
        visibleDurationLabel: formatVisibilityDuration(minutes),
      };
    }
    function dwellLabel(sec) {
      return String(sec) + " s";
    }
    function renderSlideDwellOptions(meta, selectedSec, inputId) {
      var tiers = slideDwellTiers(meta);
      var ref = referenceDwellSec(meta);
      var html =
        '<div class="adv-row"><label for="' + escHtml(inputId) + '">On-screen duration</label>' +
        '<select class="adv-input adv-dwell-select" id="' + escHtml(inputId) + '">';
      for (var i = 0; i < tiers.length; i++) {
        var t = tiers[i];
        var sel = Number(selectedSec || ref) === Number(t.dwellSec) ? " selected" : "";
        html +=
          '<option value="' + escHtml(String(t.dwellSec)) + '"' + sel + ">" +
          escHtml(dwellLabel(t.dwellSec)) + "</option>";
      }
      return html + "</select></div>";
    }
    function defaultFundNim(meta) {
      var ex = meta.exampleFundNim24h;
      if (ex !== undefined && ex !== null) return String(ex);
      return "100";
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
    function renderCampaignAudienceStats(c) {
      if (!c || !c.analytics) return "";
      var a = c.analytics;
      if (
        !a.uniqueViewers &&
        !a.totalVisibleMs &&
        !a.linkClicks
      ) {
        return (
          '<div class="adv-audience-stats">' +
          "<h4>Audience</h4>" +
          "<p>No views recorded yet. Stats count players within 7 blocks while active in the game tab.</p>" +
          "</div>"
        );
      }
      return (
        '<div class="adv-audience-stats">' +
        "<h4>Audience</h4>" +
        "<p><strong>" +
        escHtml(String(a.uniqueViewers || 0)) +
        "</strong> unique viewers</p>" +
        "<p><strong>" +
        escHtml(formatVisibleMs(a.totalVisibleMs || 0)) +
        "</strong> total on-screen time</p>" +
        "<p><strong>" +
        escHtml(formatVisibleMs(a.avgVisibleMsPerViewer || 0)) +
        "</strong> avg per viewer</p>" +
        "<p><strong>" +
        escHtml(String(a.linkClicks || 0)) +
        "</strong> link visits (" +
        escHtml(String(a.uniqueLinkClickers || 0)) +
        " unique)</p>" +
        "<p>Last seen: " +
        escHtml(formatAnalyticsLastSeen(a.lastSeenAt)) +
        "</p>" +
        "</div>"
      );
    }
    function prepaidMeterTone(p) {
      if (!p || p.isExpired || !p.hasPrepaidBalance) return "expired";
      var pct = p.prepaidRemainingPercent;
      if (pct === null || pct === undefined) return "neutral";
      if (pct >= 50) return "high";
      if (pct >= 20) return "medium";
      return "low";
    }
    function renderCampaignTimeRemaining(c) {
      if (!c || !c.prepaid) return "";
      var p = c.prepaid;
      if (!p.hasPrepaidBalance && !p.totalFundedNimLabel) return "";
      var tone = prepaidMeterTone(p);
      var pct = p.prepaidRemainingPercent;
      var fillWidth =
        pct !== null && pct !== undefined ? Math.max(0, Math.min(100, pct)) : 0;
      var showBar = pct !== null && pct !== undefined && p.totalFundedNimLabel;
      var headline =
        p.isExpired || !p.hasPrepaidBalance
          ? "Prepaid time used up"
          : "~" + p.remainingOnScreenLabel + " on-screen time left";
      var metaParts = [];
      if (p.remainingNimLabel) metaParts.push(p.remainingNimLabel + " NIM left");
      if (p.usedNimLabel && Number(p.usedNimLabel) > 0) {
        metaParts.push(p.usedNimLabel + " NIM used");
      } else if (p.totalFundedNimLabel) {
        metaParts.push(p.totalFundedNimLabel + " NIM funded");
      }
      var expiryLine = "";
      return (
        '<div class="adv-time-remaining adv-time-remaining--' +
        escHtml(tone) +
        '">' +
        '<div class="adv-time-remaining__head">' +
        '<span class="adv-time-remaining__title">Prepaid visibility</span>' +
        '<span class="adv-time-remaining__headline">' +
        escHtml(headline) +
        "</span></div>" +
        (showBar
          ? '<div class="adv-time-remaining__bar" role="progressbar" aria-valuenow="' +
            escHtml(String(fillWidth)) +
            '" aria-valuemin="0" aria-valuemax="100" aria-label="Prepaid balance remaining">' +
            '<div class="adv-time-remaining__fill" style="width:' +
            fillWidth +
            '%"></div></div>'
          : "") +
        (metaParts.length
          ? '<p class="adv-time-remaining__meta">' +
            escHtml(metaParts.join(" · ")) +
            "</p>"
          : "") +
        '<p class="adv-time-remaining__expires">' +
        escHtml(
          "Time left updates as balance drains while players are within 7 blocks and active in the game tab."
        ) +
        "</p></div>"
      );
    }
    function renderCampaignImageField(opts) {
      opts = opts || {};
      var urlId = opts.urlInputId ? ' id="' + escHtml(opts.urlInputId) + '"' : "";
      var dataId = opts.dataId ? ' data-id="' + escHtml(opts.dataId) + '"' : "";
      var extraClass = opts.urlInputClass ? " " + escHtml(opts.urlInputClass) : "";
      var statusId = opts.statusId || "advImageUploadStatus";
      return (
        '<div class="adv-image-upload">' +
        '<div class="adv-image-upload-row">' +
        '<label class="adv-image-file-wrap">' +
        '<input type="file" class="adv-image-file" accept="image/png,image/jpeg,image/webp" />' +
        '<span class="adv-image-file-btn">Choose file</span>' +
        '</label>' +
        '<input class="adv-input adv-image-input' + extraClass + '"' + urlId + dataId +
        ' value="' + escHtml(opts.value || "") + '" placeholder="https://…"/>' +
        '</div>' +
        '<p class="adv-upload-status adv-hint" id="' + escHtml(statusId) + '" hidden></p>' +
        '</div>'
      );
    }
    function mapImageUploadError(code) {
      if (code === "image_too_large") return "Image is too large (max 2.5 MB).";
      if (code === "invalid_image_format") return "Use PNG, JPEG, or WebP.";
      if (code === "invalid_image_data") return "Could not read that image file.";
      if (code === "upload_failed") return "Upload failed. Try again.";
      return code || "Upload failed.";
    }
    function uploadCampaignImageFile(file) {
      var token = readAuthToken();
      if (!token) return Promise.reject(new Error("not_signed_in"));
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl
        ? setTimeout(function () {
            ctrl.abort();
          }, 60000)
        : null;
      var contentType = String((file && file.type) || "application/octet-stream");
      return fetch("/api/advertise/campaigns/upload-image", {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "content-type": contentType,
        },
        body: file,
        signal: ctrl ? ctrl.signal : undefined,
      })
        .then(function (r) {
          if (timer) clearTimeout(timer);
          return r.json().then(function (body) {
            return { ok: r.ok, status: r.status, body: body };
          });
        })
        .catch(function (err) {
          if (timer) clearTimeout(timer);
          throw err;
        });
    }
    function bindCampaignImageUploads(root) {
      if (!root) return;
      var blocks = root.querySelectorAll(".adv-image-upload");
      for (var bi = 0; bi < blocks.length; bi++) {
        (function (block) {
          var fileInput = block.querySelector(".adv-image-file");
          var urlInput = block.querySelector(".adv-image-input");
          var statusEl = block.querySelector(".adv-upload-status");
          if (!fileInput || !urlInput || fileInput.dataset.uploadBound === "1") return;
          fileInput.dataset.uploadBound = "1";
          fileInput.addEventListener("change", function () {
            var file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (statusEl) {
              statusEl.hidden = false;
              statusEl.textContent = "Uploading…";
              statusEl.className = "adv-upload-status adv-hint";
            }
            uploadCampaignImageFile(file)
              .then(function (r) {
                if (r.ok && r.body && r.body.imageUrl) {
                  urlInput.value = r.body.imageUrl;
                  urlInput.dispatchEvent(new Event("input", { bubbles: true }));
                  if (statusEl) {
                    statusEl.textContent = "Uploaded.";
                    statusEl.className = "adv-upload-status adv-hint";
                    statusEl.hidden = false;
                  }
                  fileInput.value = "";
                  return;
                }
                if (statusEl) {
                  var errCode = r.body && r.body.error;
                  if (r.status === 503 || errCode === "backend_unavailable") {
                    statusEl.textContent = "Game server is not running. Start it on port 3001 and try again.";
                  } else {
                    statusEl.textContent = mapImageUploadError(errCode);
                  }
                  statusEl.className = "adv-upload-status err";
                  statusEl.hidden = false;
                }
              })
              .catch(function (err) {
                if (statusEl) {
                  if (err && err.name === "AbortError") {
                    statusEl.textContent = "Upload timed out. Try again.";
                  } else if (String((err && err.message) || err) === "not_signed_in") {
                    statusEl.textContent = "Sign in to upload images.";
                  } else {
                    statusEl.textContent = "Upload failed. Check that the game server is running.";
                  }
                  statusEl.className = "adv-upload-status err";
                  statusEl.hidden = false;
                }
              });
          });
        })(blocks[bi]);
      }
    }
    function renderCampaignForm(meta, previewWallet) {
      var bb = meta.billboard || {};
      window.__advBillboardRecW = bb.recommendedWidthPx || 1600;
      window.__advBillboardRecH = bb.recommendedHeightPx || 984;
      return (
        '<div class="adv-panel">' +
        '<h2>New campaign</h2>' +
        '<div class="adv-form-grid">' +
        '<div class="adv-form-fields">' +
        '<div class="adv-row"><label for="advName">Project Name</label>' +
        '<input class="adv-input" id="advName" maxlength="80" placeholder="My project"/></div>' +
        '<div class="adv-row"><label for="advTarget">Project URL</label>' +
        '<input class="adv-input" id="advTarget" placeholder="https://…"/></div>' +
        '<div class="adv-row"><label for="advImage">Image</label>' +
        renderCampaignImageField({ urlInputId: "advImage", statusId: "advImageUploadStatus" }) +
        '</div>' +
        renderSlideDwellOptions(meta, referenceDwellSec(meta), "advDisplayInterval") +
        '<p class="adv-small">' + escHtml(String(bb.recommendedWidthPx || 1600)) + '×' + escHtml(String(bb.recommendedHeightPx || 984)) + ' px · PNG, JPEG, WebP</p>' +
        '<p class="adv-small">' +
          escHtml(formatNimPerMinuteLabel(baseNimPerMinute(meta))) +
          ' NIM/min on screen · ' +
          escHtml(String(meta.exampleFundNim24h || 100)) +
          ' NIM ≈ 24h · pay any amount</p>' +
        '<div class="adv-actions"><button type="button" id="advCreateBtn">Save draft</button></div>' +
        '<div id="advFormMsg" class="adv-hint" hidden></div>' +
        '</div>' +
        renderBillboardPreviewHtml("advPreviewCanvas", "advPreviewWarn", previewWallet) +
        '</div></div>'
      );
    }
    var CAMPAIGN_STATUS_ORDER = {
      approved: 0,
      active: 0,
      pending_approval: 1,
      pending_payment: 2,
      draft: 3,
      expired: 4,
      rejected: 5,
    };
    var HUB_API_CDN = "https://esm.sh/@nimiq/hub-api@1.13.0";
    var advDashboardState = { meta: null, campaigns: [], selectedId: "", previewWallet: "", activeTab: "", fundCampaignId: "", fundAmountDraft: "", fundPayBundle: null, fundPayPrepare: null, fundPayPrepareKey: "" };
    var advWalletState = { hub: null, hubLoad: null };
    var advPaymentPollTimer = null;
    var advFundPrepareTimer = null;
    var advFundSuccessCloseTimer = null;
    var advGridClickBound = false;
    function setFundPaymentUi(state, message) {
      var form = document.getElementById("advFundFormBody");
      var status = document.getElementById("advFundStatus");
      var icon = document.getElementById("advFundStatusIcon");
      var text = document.getElementById("advFundStatusText");
      var msg = document.getElementById("advFundMsg");
      if (msg) {
        msg.hidden = true;
        msg.textContent = "";
      }
      if (!form || !status || !icon || !text) return;
      if (state === "idle") {
        status.hidden = true;
        form.hidden = false;
        icon.innerHTML = "";
        text.textContent = "";
        text.className = "adv-fund-status__text";
        return;
      }
      form.hidden = true;
      status.hidden = false;
      if (state === "confirming") {
        icon.innerHTML = NIMIQ_HEX_SPINNER;
        text.textContent = message || "Confirming payment on chain…";
        text.className = "adv-fund-status__text";
        return;
      }
      if (state === "success") {
        icon.innerHTML =
          '<svg class="adv-fund-status__tick" viewBox="0 0 24 24" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>' +
          '<path d="M8 12.5 L11 15.5 L16 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          "</svg>";
        text.textContent = message || "Payment received";
        text.className = "adv-fund-status__text adv-fund-status__text--ok";
        return;
      }
      if (state === "error") {
        icon.innerHTML = "";
        text.textContent = message || "Payment could not be confirmed.";
        text.className = "adv-fund-status__text adv-fund-status__text--err";
      }
    }
    function resetFundPaymentUi() {
      if (advFundSuccessCloseTimer) {
        clearTimeout(advFundSuccessCloseTimer);
        advFundSuccessCloseTimer = null;
      }
      setFundPaymentUi("idle");
    }
    function fundOverlayOpenForCampaign(campaignId) {
      var overlay = document.getElementById("advFundOverlay");
      return (
        !!overlay &&
        !overlay.hidden &&
        advDashboardState.fundCampaignId === campaignId
      );
    }
    function stopPaymentSyncPoll() {
      if (advPaymentPollTimer) {
        clearInterval(advPaymentPollTimer);
        advPaymentPollTimer = null;
      }
    }
    function sortCampaigns(list) {
      return list.slice().sort(function (a, b) {
        var oa = CAMPAIGN_STATUS_ORDER[a.status];
        var ob = CAMPAIGN_STATUS_ORDER[b.status];
        if (oa === undefined) oa = 9;
        if (ob === undefined) ob = 9;
        if (oa !== ob) return oa - ob;
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
    }
    function statusClass(st) {
      var s = String(st || "draft");
      return "adv-status adv-status--" + s;
    }
    function renderStatusTags(c) {
      var html =
        '<span class="adv-status-group">' +
        '<span class="' +
        escHtml(statusClass(c.status)) +
        '">' +
        escHtml(statusLabel(c.status)) +
        "</span>";
      if (c && c.status === "approved") {
        if (c.inRotationSet) {
          html += ' <span class="adv-status adv-status--live">Live</span>';
        } else {
          html += ' <span class="adv-status adv-status--not-live">Not Live</span>';
        }
      }
      html += "</span>";
      return html;
    }
    function campaignById(id) {
      var list = advDashboardState.campaigns || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    }
    function campaignThumbStyle(url) {
      var u = String(url || "").trim();
      if (!u) return "";
      return "background-image:url(" + encodeURI(u).replace(/'/g, "%27") + ")";
    }
    function renderCampaignTile(c, selectedId) {
      var thumb = c.imageUrl
        ? '<div class="adv-campaign-thumb" style="' + campaignThumbStyle(c.imageUrl) + '"></div>'
        : '<div class="adv-campaign-thumb adv-campaign-thumb--empty">No image</div>';
      var sel = c.id === selectedId ? " is-selected" : "";
      return (
        '<button type="button" class="adv-campaign-tile' + sel + '" data-campaign-id="' + escHtml(c.id) + '">' +
        thumb +
        '<p class="adv-campaign-tile-title">' + escHtml(c.projectName) + '</p>' +
        renderStatusTags(c) +
        '</button>'
      );
    }
    function renderCampaignEditForm(c, previewWallet) {
      return (
        '<div class="adv-edit-panel" data-edit="' + escHtml(c.id) + '" hidden>' +
        '<div class="adv-row"><label>Name</label>' +
        '<input class="adv-input adv-edit-name" data-id="' + escHtml(c.id) + '" maxlength="80" value="' + escHtml(c.projectName) + '"/></div>' +
        '<div class="adv-row"><label>Mini-app URL</label>' +
        '<input class="adv-input adv-edit-target" data-id="' + escHtml(c.id) + '" value="' + escHtml(c.miniappTargetUrl) + '"/></div>' +
        '<div class="adv-row"><label>Billboard image</label>' +
        renderCampaignImageField({
          dataId: c.id,
          urlInputClass: "adv-edit-image",
          value: c.imageUrl,
          statusId: "advImageUploadStatus-" + c.id,
        }) +
        '</div>' +
        renderSlideDwellOptions(
          advDashboardState.meta || {},
          c.displayIntervalSec || referenceDwellSec(advDashboardState.meta || {}),
          "advEditDisplayInterval-" + c.id
        ) +
        renderBillboardPreviewHtml("advPreviewCanvas-" + c.id, "advPreviewWarn-" + c.id, previewWallet) +
        '<div class="adv-actions">' +
        '<button type="button" class="adv-save-btn" data-id="' + escHtml(c.id) + '">Save</button>' +
        '<button type="button" class="secondary adv-cancel-edit-btn" data-id="' + escHtml(c.id) + '">Cancel</button>' +
        '</div>' +
        '<div class="adv-edit-msg adv-hint" data-id="' + escHtml(c.id) + '" hidden></div>' +
        '</div>'
      );
    }
    function canEditCampaign(c) {
      return c && c.status === "draft";
    }
    function canEditCampaignDuration(c) {
      return (
        c &&
        (c.status === "pending_payment" ||
          c.status === "pending_approval" ||
          c.status === "approved" ||
          c.status === "expired")
      );
    }
    function shouldShowCampaignPreview(c) {
      return c && String(c.imageUrl || "").trim();
    }
    function canFundCampaign(c) {
      return (
        c &&
        (c.status === "draft" ||
          c.status === "pending_payment" ||
          c.status === "expired" ||
          c.status === "approved")
      );
    }
    function fundButtonLabel(c) {
      if (c && c.status === "pending_payment") return "Retry payment";
      if (c && c.status === "approved") return "Add funds";
      return "Fund";
    }
    function campaignStatusHint(c) {
      if (!c) return "";
      if (c.status === "pending_payment") {
        return '<p class="adv-notice">Waiting for payment. Use <strong>Retry payment</strong> to open your wallet again. If the quote expired, retry creates a new one.</p>';
      }
      if (c.status === "pending_approval") {
        return '<p class="adv-notice">Pending Approval — your campaign is in the admin review queue.</p>';
      }
      if (c.status === "approved") {
        if (c.inRotationSet) {
          return '<p class="adv-notice">Your advert is <strong>live on billboards</strong> in Nimiq Space. Use <strong>Add funds</strong> to top up prepaid balance without going offline.</p>';
        }
        return '<p class="adv-notice">Approved — your advert will appear on billboards once placement is complete. Use <strong>Add funds</strong> to increase prepaid balance.</p>';
      }
      if (c.status === "rejected") {
        return '<p class="adv-notice">Rejected. Contact support if you believe this was a mistake.</p>';
      }
      if (c.status === "expired") {
        return '<p class="adv-notice">Ended. Fund to continue.</p>';
      }
      return "";
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
    function renderCampaignTxHistory(transactions) {
      var el = document.getElementById("advCampaignTxHistory");
      if (!el) return;
      if (!transactions || !transactions.length) {
        el.innerHTML = '<p class="adv-small">No payments recorded yet.</p>';
        return;
      }
      var html = '<h4 class="adv-tx-title">Transaction history</h4><ul class="adv-tx-list">';
      for (var i = 0; i < transactions.length; i++) {
        var tx = transactions[i];
        var link = tx.explorerUrl
          ? '<a class="adv-tx-link ms-link-expl" href="' +
            escHtml(tx.explorerUrl) +
            '" target="_blank" rel="noopener noreferrer">nimiq.watch</a>'
          : "";
        html +=
          '<li class="adv-tx-item">' +
          '<span class="adv-tx-date">' +
          escHtml(formatTxDate(tx.recordedAt)) +
          "</span>" +
          '<span class="adv-tx-amount">' +
          escHtml(tx.amountNimLabel || "0") +
          " NIM</span>" +
          link +
          "</li>";
      }
      html += "</ul>";
      el.innerHTML = html;
    }
    async function loadCampaignTransactions(campaignId) {
      var el = document.getElementById("advCampaignTxHistory");
      if (!el || !campaignId) return;
      el.innerHTML = '<p class="adv-small">Loading transactions…</p>';
      try {
        var r = await api(
          "/api/advertise/campaigns/" + encodeURIComponent(campaignId) + "/transactions",
          { method: "GET" }
        );
        if (!r.ok) {
          el.innerHTML = '<p class="adv-small">Could not load transactions.</p>';
          return;
        }
        renderCampaignTxHistory((r.body && r.body.transactions) || []);
      } catch (e) {
        el.innerHTML = '<p class="adv-small">Could not load transactions.</p>';
      }
    }
    function updateCampaignInState(campaign) {
      if (!campaign || !campaign.id) return;
      var list = advDashboardState.campaigns || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === campaign.id) {
          list[i] = campaign;
          advDashboardState.campaigns = list;
          return;
        }
      }
    }
    function handlePaymentSyncResponse(r, campaignId) {
      var body = r.body || {};
      var campaign = body.campaign || null;
      if (campaign) updateCampaignInState(campaign);
      var fundOpen = fundOverlayOpenForCampaign(campaignId);
      if (body.intentExpired || body.error === "payment_intent_expired") {
        stopPaymentSyncPoll();
        if (fundOpen) {
          setFundPaymentUi(
            "error",
            "Payment quote expired. Close and use Retry payment."
          );
        }
        refreshCampaignsUi();
        return;
      }
      if (campaign && campaign.status === "pending_approval") {
        stopPaymentSyncPoll();
        if (fundOpen) {
          setFundPaymentUi(
            "success",
            "Payment received — pending admin approval."
          );
          advFundSuccessCloseTimer = setTimeout(function () {
            advFundSuccessCloseTimer = null;
            closeFundPopover();
          }, 2800);
        }
        refreshCampaignsUi();
        if (campaignId) void loadCampaignTransactions(campaignId);
        return;
      }
      if (body.topUpApplied && campaign && campaign.status === "approved") {
        stopPaymentSyncPoll();
        if (fundOpen) {
          setFundPaymentUi("success", "Payment received — balance updated.");
          advFundSuccessCloseTimer = setTimeout(function () {
            advFundSuccessCloseTimer = null;
            closeFundPopover();
          }, 2800);
        }
        refreshCampaignsUi();
        if (campaignId) void loadCampaignTransactions(campaignId);
        return;
      }
      if (r.ok || r.status === 202 || body.paymentPending) {
        var awaitingPayment =
          campaign &&
          (campaign.status === "pending_payment" ||
            (campaign.status === "approved" && campaign.intentId));
        if (!awaitingPayment) {
          stopPaymentSyncPoll();
        } else if (fundOpen) {
          setFundPaymentUi("confirming", "Confirming payment on chain…");
        }
        refreshCampaignsUi();
        if (campaignId) void loadCampaignTransactions(campaignId);
        return;
      }
      if (fundOpen && body.error) {
        setFundPaymentUi("error", mapFundSyncError(body.error));
      }
    }
    function mapFundSyncError(code) {
      if (code === "payment_intent_expired") {
        return "Payment quote expired. Close and use Retry payment.";
      }
      if (code === "payment_not_confirmed") {
        return "Payment not confirmed yet. Still checking…";
      }
      return "Could not confirm payment. Try again shortly.";
    }
    function runPaymentSyncOnce(campaignId) {
      if (!campaignId) return Promise.resolve();
      return api(
        "/api/advertise/campaigns/" + encodeURIComponent(campaignId) + "/sync",
        { method: "POST", body: "{}" }
      ).then(function (r) {
        handlePaymentSyncResponse(r, campaignId);
      });
    }
    function startPaymentSyncPoll(campaignId) {
      if (!campaignId) return;
      stopPaymentSyncPoll();
      var tries = 0;
      void runPaymentSyncOnce(campaignId);
      advPaymentPollTimer = setInterval(function () {
        tries++;
        if (tries > 72) {
          stopPaymentSyncPoll();
          if (fundOverlayOpenForCampaign(campaignId)) {
            setFundPaymentUi(
              "error",
              "Still confirming on chain. You can close this — we will update your campaign when payment lands."
            );
          }
          return;
        }
        void runPaymentSyncOnce(campaignId);
      }, 5000);
    }
    function probePaymentSyncOnce(campaignId) {
      if (!campaignId) return;
      api("/api/advertise/campaigns/" + encodeURIComponent(campaignId) + "/sync", {
        method: "POST",
        body: "{}",
      })
        .then(function (r) {
          var body = r.body || {};
          handlePaymentSyncResponse(r, campaignId);
          if (
            (r.ok || r.status === 202 || body.paymentPending) &&
            !body.intentExpired &&
            body.error !== "payment_intent_expired"
          ) {
            var campaign = body.campaign;
            if (campaign && campaign.status === "pending_payment") {
              startPaymentSyncPoll(campaignId);
            } else if (campaign && campaign.status === "approved" && campaign.intentId) {
              startPaymentSyncPoll(campaignId);
            }
          }
        })
        .catch(function () {});
    }
    function renderCampaignDurationEditor(c) {
      return (
        '<div class="adv-duration-panel" data-duration="' + escHtml(c.id) + '">' +
        renderSlideDwellOptions(
          advDashboardState.meta || {},
          c.displayIntervalSec || referenceDwellSec(advDashboardState.meta || {}),
          "advDwell-" + c.id
        ) +
        '<div class="adv-actions">' +
        '<button type="button" class="adv-save-duration-btn" data-id="' + escHtml(c.id) + '">Save duration</button>' +
        "</div>" +
        '<div class="adv-duration-msg adv-hint" data-id="' + escHtml(c.id) + '" hidden></div>' +
        "</div>"
      );
    }
    function renderCampaignDetailBody(c, previewWallet) {
      if (!c) return "";
      var actions = '<div class="adv-actions">';
      if (canEditCampaign(c)) {
        actions += '<button type="button" class="secondary adv-detail-edit-btn" data-id="' + escHtml(c.id) + '">Edit</button>';
      }
      if (canFundCampaign(c)) {
        actions += '<button type="button" class="adv-detail-fund-btn" data-id="' + escHtml(c.id) + '">' + escHtml(fundButtonLabel(c)) + '</button>';
      }
      actions += "</div>";
      var extendHint = campaignStatusHint(c);
      var durationHtml = canEditCampaignDuration(c) ? renderCampaignDurationEditor(c) : "";
      return (
        '<h3>' + escHtml(c.projectName) + " " + renderStatusTags(c) + "</h3>" +
        '<div class="adv-detail-body">' +
        '<div class="adv-meta">' + escHtml(c.miniappTargetUrl) + '</div>' +
        renderCampaignTimeRemaining(c) +
        (!canEditCampaignDuration(c)
          ? '<div class="adv-meta">' +
            escHtml(dwellLabel(c.displayIntervalSec || referenceDwellSec(advDashboardState.meta || {}))) +
            " on screen</div>"
          : "") +
        renderCampaignAudienceStats(c) +
        extendHint +
        durationHtml +
        actions +
        (canEditCampaign(c) ? renderCampaignEditForm(c, previewWallet) : "") +
        '<div id="advCampaignTxHistory" class="adv-tx-history" data-campaign-id="' +
        escHtml(c.id) +
        '"><p class="adv-small">Loading transactions…</p></div>' +
        "</div>"
      );
    }
    function renderExistingCampaignLayout(selected, previewWallet) {
      if (!selected) return "";
      var showPreview = shouldShowCampaignPreview(selected);
      return (
        '<div class="adv-existing-detail-layout" id="advExistingDetailLayout">' +
        '<div class="adv-campaign-detail" id="advCampaignDetailSlot">' +
        renderCampaignDetailBody(selected, previewWallet) +
        "</div>" +
        '<div class="adv-preview-wrap" id="advExistingPreviewSlot"' +
        (showPreview ? "" : " hidden") +
        ">" +
        renderBillboardPreviewHtml(
          "advExistingPreviewCanvas",
          "advExistingPreviewWarn",
          previewWallet,
          selected.imageUrl
        ) +
        "</div></div>"
      );
    }
    function renderCampaignDetail(c, previewWallet) {
      return renderCampaignDetailBody(c, previewWallet);
    }
    function renderAdvertiseTabBar(activeTab) {
      return (
        '<div class="adv-tabs" role="tablist" aria-label="Advertise">' +
        '<button type="button" class="adv-tab' +
        (activeTab === "new" ? " is-active" : "") +
        '" data-adv-tab="new" role="tab" aria-selected="' +
        (activeTab === "new" ? "true" : "false") +
        '">New</button>' +
        '<button type="button" class="adv-tab' +
        (activeTab === "existing" ? " is-active" : "") +
        '" data-adv-tab="existing" role="tab" aria-selected="' +
        (activeTab === "existing" ? "true" : "false") +
        '">Existing campaigns</button>' +
        "</div>"
      );
    }
    function renderCampaignsSection(campaigns, selectedId, previewWallet) {
      var sorted = sortCampaigns(campaigns);
      var tiles = "";
      for (var i = 0; i < sorted.length; i++) {
        tiles += renderCampaignTile(sorted[i], selectedId);
      }
      var selected = selectedId ? campaignById(selectedId) : null;
      return (
        '<div class="adv-panel" id="advCampaignsPanel">' +
        (sorted.length
          ? '<div class="adv-campaign-grid">' + tiles + "</div>"
          : '<p class="adv-small">No campaigns yet. Create one on the <strong>New</strong> tab.</p>') +
        renderExistingCampaignLayout(selected, previewWallet) +
        "</div>"
      );
    }
    function renderAdvertiseDashboard(meta, campaigns, selectedId, previewWallet, activeTab) {
      return (
        renderAdvertiseTabBar(activeTab) +
        '<div class="adv-tab-panel" id="advTabNew" role="tabpanel"' +
        (activeTab === "new" ? "" : " hidden") +
        ">" +
        renderCampaignForm(meta, previewWallet) +
        "</div>" +
        '<div class="adv-tab-panel" id="advTabExisting" role="tabpanel"' +
        (activeTab === "existing" ? "" : " hidden") +
        ">" +
        renderCampaignsSection(campaigns, selectedId, previewWallet) +
        "</div>"
      );
    }
    function syncAdvertiseTabPanels() {
      var tab = advDashboardState.activeTab || "new";
      document.querySelectorAll("[data-adv-tab]").forEach(function (btn) {
        var isActive = btn.getAttribute("data-adv-tab") === tab;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      var newPanel = document.getElementById("advTabNew");
      var existingPanel = document.getElementById("advTabExisting");
      if (newPanel) newPanel.hidden = tab !== "new";
      if (existingPanel) existingPanel.hidden = tab !== "existing";
      if (typeof window.__advDisposeBillboardPreviewsIn === "function") {
        if (tab !== "new" && newPanel) window.__advDisposeBillboardPreviewsIn(newPanel);
        if (tab !== "existing" && existingPanel) {
          window.__advDisposeBillboardPreviewsIn(existingPanel);
        }
      }
      bindActiveTabPreviews();
    }
    function bindAdvertiseTabs() {
      document.querySelectorAll("[data-adv-tab]").forEach(function (btn) {
        if (btn.dataset.advTabBound === "1") return;
        btn.dataset.advTabBound = "1";
        btn.addEventListener("click", function () {
          var tab = btn.getAttribute("data-adv-tab");
          if (!tab || tab === advDashboardState.activeTab) return;
          advDashboardState.activeTab = tab;
          syncAdvertiseTabPanels();
        });
      });
    }
    function refreshCampaignsUi() {
      var campaignsPanel = document.getElementById("advCampaignsPanel");
      var gridHost = campaignsPanel ? campaignsPanel.querySelector(".adv-campaign-grid") : null;
      if (!campaignsPanel) return;
      var campaigns = advDashboardState.campaigns || [];
      var selectedId = advDashboardState.selectedId || "";
      var previewWallet = advDashboardState.previewWallet || "";
      var sorted = sortCampaigns(campaigns);
      if (gridHost) {
        var tiles = "";
        for (var i = 0; i < sorted.length; i++) {
          tiles += renderCampaignTile(sorted[i], selectedId);
        }
        gridHost.innerHTML = tiles;
      }
      var oldDetail = campaignsPanel.querySelector("#advExistingDetailLayout");
      var selected = selectedId ? campaignById(selectedId) : null;
      if (!selected) {
        if (oldDetail) oldDetail.remove();
        return;
      }
      if (!oldDetail) {
        campaignsPanel.insertAdjacentHTML(
          "beforeend",
          renderExistingCampaignLayout(selected, previewWallet)
        );
        bindCampaignDetailHandlers(campaignsPanel);
        syncExistingCampaignPreview(selected, previewWallet);
        void loadCampaignTransactions(selected.id);
        return;
      }
      var detailSlot = document.getElementById("advCampaignDetailSlot");
      if (detailSlot) detailSlot.innerHTML = renderCampaignDetailBody(selected, previewWallet);
      syncExistingCampaignPreview(selected, previewWallet);
      bindCampaignDetailHandlers(campaignsPanel);
      void loadCampaignTransactions(selected.id);
    }
    function bindCampaignGridHandlers() {
      if (advGridClickBound) return;
      advGridClickBound = true;
      document.addEventListener("click", function (ev) {
        var target = ev.target;
        if (!target || !target.closest) return;
        var tile = target.closest(".adv-campaign-tile");
        if (!tile) return;
        var panel = document.getElementById("advCampaignsPanel");
        if (!panel || !panel.contains(tile)) return;
        var id = tile.getAttribute("data-campaign-id");
        if (!id || id === advDashboardState.selectedId) return;
        advDashboardState.selectedId = id;
        refreshCampaignsUi();
      });
    }
    function bindCampaignDetailHandlers(root) {
      var editBtn = root.querySelector(".adv-detail-edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", function (ev) {
          var id = ev.currentTarget.getAttribute("data-id");
          var panel = root.querySelector('.adv-edit-panel[data-edit="' + id + '"]');
          if (panel) panel.hidden = false;
          requestAnimationFrame(bindDetailBillboardPreviews);
        });
      }
      var fundBtn = root.querySelector(".adv-detail-fund-btn");
      if (fundBtn) {
        fundBtn.addEventListener("click", function (ev) {
          openFundPopover(ev.currentTarget.getAttribute("data-id"));
        });
      }
      var saveBtns = root.querySelectorAll(".adv-save-btn");
      for (var s = 0; s < saveBtns.length; s++) {
        saveBtns[s].addEventListener("click", onSaveCampaign);
      }
      var cancelBtns = root.querySelectorAll(".adv-cancel-edit-btn");
      for (var c = 0; c < cancelBtns.length; c++) {
        cancelBtns[c].addEventListener("click", onCancelEditCampaign);
      }
      var durationBtns = root.querySelectorAll(".adv-save-duration-btn");
      for (var d = 0; d < durationBtns.length; d++) {
        durationBtns[d].addEventListener("click", onSaveCampaignDuration);
      }
    }
    function updateFundEstimate() {
      var meta = advDashboardState.meta || {};
      var amountInput = document.getElementById("advFundAmount");
      var primary = document.getElementById("advFundEstimatePrimary");
      var secondary = document.getElementById("advFundEstimateSecondary");
      if (!amountInput || !primary) return;
      var amountNim = readFundAmountNim(amountInput);
      var rate = formatNimPerMinuteLabel(baseNimPerMinute(meta));
      primary.textContent = amountNim
        ? amountNim + " NIM prepaid on approval"
        : "Enter an amount to fund your campaign";
      if (secondary) {
        secondary.textContent =
          rate +
          " NIM/min on-screen while active players are within 7 blocks · balance drains from real views";
      }
    }
    function openFundPopover(campaignId) {
      var c = campaignById(campaignId);
      var meta = advDashboardState.meta || {};
      if (!c) return;
      advDashboardState.fundCampaignId = campaignId;
      var overlay = document.getElementById("advFundOverlay");
      var amountInput = document.getElementById("advFundAmount");
      var recipient = document.getElementById("advFundRecipient");
      var title = document.getElementById("advFundTitle");
      var msg = document.getElementById("advFundMsg");
      var result = document.getElementById("advFundResult");
      if (!overlay || !amountInput || !recipient) return;
      if (title) {
        title.textContent =
          (c.status === "approved" ? "Add funds · " : "Fund · ") + c.projectName;
      }
      amountInput.value = defaultFundNim(meta);
      advDashboardState.fundAmountDraft = String(amountInput.value || "").trim();
      recipient.textContent = String(meta.fundRecipientAddress || "");
      if (msg) { msg.hidden = true; msg.textContent = ""; }
      if (result) { result.hidden = true; result.innerHTML = ""; }
      resetFundPaymentUi();
      updateFundEstimate();
      overlay.hidden = false;
      if (isNimiqPayMiniApp()) scheduleFundPayPrepare();
    }
    function closeFundPopover() {
      var overlay = document.getElementById("advFundOverlay");
      if (overlay) overlay.hidden = true;
      stopPaymentSyncPoll();
      resetFundPaymentUi();
      advDashboardState.fundCampaignId = "";
      advDashboardState.fundPayBundle = null;
      advDashboardState.fundPayPrepare = null;
      advDashboardState.fundPayPrepareKey = "";
      if (advFundPrepareTimer) clearTimeout(advFundPrepareTimer);
    }
    function fundPayPrepareKey(campaignId, amountNim) {
      return String(campaignId || "") + ":" + String(amountNim || "");
    }
    function scheduleFundPayPrepare() {
      if (!isNimiqPayMiniApp()) return;
      if (advFundPrepareTimer) clearTimeout(advFundPrepareTimer);
      advFundPrepareTimer = setTimeout(function () {
        advFundPrepareTimer = null;
        void refreshFundPayBundle(false);
      }, 320);
    }
    function armFundPayPrepare() {
      if (!isNimiqPayMiniApp()) return;
      var id = advDashboardState.fundCampaignId;
      var amountInput = document.getElementById("advFundAmount");
      if (!id || !amountInput) return;
      var amountNim = readFundAmountNim(amountInput);
      if (!amountNim) return;
      var key = fundPayPrepareKey(id, amountNim);
      if (advDashboardState.fundPayPrepareKey === key && advDashboardState.fundPayPrepare) return;
      advDashboardState.fundPayPrepareKey = key;
      advDashboardState.fundPayPrepare = refreshFundPayBundle(true);
    }
    async function loadExistingFundPayBundle(campaignId, amountNim) {
      var r = await api("/api/advertise/campaigns/" + encodeURIComponent(campaignId) + "/intent", {
        method: "GET",
      });
      if (!r.ok || !r.body || !r.body.intent) return null;
      var intent = r.body.intent;
      var label = String(intent.amountNimLabel || "").trim();
      if (label && amountNim && label !== amountNim) return null;
      var resolvedNim = amountNim || label;
      if (!resolvedNim) return null;
      var amountLuna = resolvePaymentAmountLuna(intent, resolvedNim);
      if (amountLuna == null) return null;
      return {
        intent: intent,
        meta: advDashboardState.meta || {},
        amountLuna: amountLuna,
        amountNim: resolvedNim,
        key: fundPayPrepareKey(campaignId, resolvedNim),
      };
    }
    async function refreshFundPayBundle(force) {
      var id = advDashboardState.fundCampaignId;
      var amountInput = document.getElementById("advFundAmount");
      if (!id || !amountInput) return null;
      var amountNim = readFundAmountNim(amountInput);
      if (!amountNim) return null;
      var key = fundPayPrepareKey(id, amountNim);
      if (!force && advDashboardState.fundPayBundle && advDashboardState.fundPayBundle.key === key) {
        return advDashboardState.fundPayBundle;
      }
      try {
        var existing = await loadExistingFundPayBundle(id, amountNim);
        if (existing) {
          advDashboardState.fundPayBundle = existing;
          return existing;
        }
        var bundle = await createIntentForFund(id, amountNim);
        bundle.key = key;
        advDashboardState.fundPayBundle = bundle;
        return bundle;
      } catch (e) {
        advDashboardState.fundPayBundle = null;
        return null;
      }
    }
    async function ensureFundPayBundle(campaignId, amountNim) {
      var key = fundPayPrepareKey(campaignId, amountNim);
      if (advDashboardState.fundPayBundle && advDashboardState.fundPayBundle.key === key) {
        return advDashboardState.fundPayBundle;
      }
      if (advDashboardState.fundPayPrepare && advDashboardState.fundPayPrepareKey === key) {
        try {
          var prepared = await advDashboardState.fundPayPrepare;
          if (prepared && prepared.key === key) return prepared;
        } catch (prepErr) {
          /* fall through to fresh create */
        }
      }
      var existing = await loadExistingFundPayBundle(campaignId, amountNim);
      if (existing) {
        advDashboardState.fundPayBundle = existing;
        return existing;
      }
      var bundle = await createIntentForFund(campaignId, amountNim);
      bundle.key = key;
      advDashboardState.fundPayBundle = bundle;
      return bundle;
    }
    function isNimiqPayMiniApp() {
      return typeof window !== "undefined" && window.nimiqPay != null;
    }
    function isProviderErrorResponse(x) {
      if (!x || typeof x !== "object" || !x.error || typeof x.error !== "object") return false;
      return typeof x.error.message === "string" || typeof x.error.type === "string";
    }
    function providerErrorText(result) {
      if (!result || !result.error || typeof result.error !== "object") {
        return "nimiq_pay_payment_failed";
      }
      return String(result.error.message || result.error.type || "nimiq_pay_payment_failed");
    }
    function walletPaymentErrorMessage(err) {
      var msg = err instanceof Error ? err.message : String(err || "payment_failed");
      if (msg.indexOf("nimiq_pay:") === 0) {
        return "Nimiq Pay: " + msg.slice("nimiq_pay:".length) + ". You can pay manually using the details below.";
      }
      if (msg === "invalid_amount" || msg.indexOf("invalid_amount:") === 0) {
        return "Payment amount is missing or invalid. Check the amount field and try again.";
      }
      if (msg === "missing_recipient") {
        return "Payment recipient is not configured on the server. Pay manually using the details below.";
      }
      if (msg === "nimiq_provider_timeout") {
        return "Nimiq Pay wallet is not ready. Close and reopen this page in Nimiq Pay, then try again.";
      }
      var lower = msg.toLowerCase();
      if (lower.indexOf("invalid amount") !== -1 || lower.indexOf("invalid_amount") !== -1) {
        return "Payment amount was rejected by Nimiq Pay. Check the amount and try again.";
      }
      if (lower.indexOf("failed to open popup") !== -1 || lower.indexOf("popup") !== -1) {
        return "Could not open Nimiq Hub (popup blocked). Allow popups for this site and try again.";
      }
      if (
        lower.indexOf("cancel") !== -1 ||
        lower.indexOf("abort") !== -1 ||
        lower.indexOf("denied") !== -1 ||
        lower.indexOf("rejected") !== -1
      ) {
        return "Payment cancelled.";
      }
      return msg;
    }
    function mapIntentCreateError(err) {
      if (err === "payment_intent_not_configured") {
        return "Payments are not configured on this server. Set PAYMENT_INTENT_SERVICE_URL and PAYMENT_INTENT_API_SECRET in server/.env and run the payment-intent sidecar.";
      }
      if (err.indexOf("not implemented yet") !== -1 || err.indexOf("payment_intent_feature_stale") !== -1) {
        return "Payment service is out of date. Rebuild it: docker compose build payment-intent && docker compose --profile payment up -d payment-intent";
      }
      if (err === "payment_intent_expired" || err === "payment_intent_failed") {
        return "Payment quote expired. Click Retry payment to create a new one.";
      }
      if (err === "fund_below_minimum" || err === "invalid_amount") {
        return "Enter a valid fund amount (at least 0.00001 NIM).";
      }
      if (err === "amount_required") return "Enter a fund amount.";
      if (err === "campaign_not_payable") {
        return "This campaign cannot be funded in its current state.";
      }
      return err || "Could not create payment intent";
    }
    function preloadWalletSdks() {
      if (!advWalletState.hubLoad) {
        advWalletState.hubLoad = import(HUB_API_CDN).then(function (HubMod) {
          var HubApi = HubMod.default;
          advWalletState.hub = new HubApi("https://hub.nimiq.com");
          return advWalletState.hub;
        });
      }
    }
    async function ensureHubApi() {
      preloadWalletSdks();
      return advWalletState.hubLoad;
    }
    function waitForNimiqProvider(timeoutMs) {
      if (window.nimiq) return Promise.resolve(window.nimiq);
      var ms = timeoutMs == null ? 15000 : timeoutMs;
      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          clearInterval(interval);
          reject(new Error("nimiq_provider_timeout"));
        }, ms);
        var interval = setInterval(function () {
          if (window.nimiq) {
            clearTimeout(timer);
            clearInterval(interval);
            resolve(window.nimiq);
          }
        }, 50);
      });
    }
    function normalizeFundAmountNim(raw, meta) {
      var t = String(raw != null ? raw : "").trim().replace(/,/g, ".");
      t = t.replace(/[^\\d.]/g, "");
      var dot = t.indexOf(".");
      if (dot >= 0) {
        t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\\./g, "");
      }
      while (t.length > 1 && t.charAt(0) === "0" && t.charAt(1) !== ".") {
        t = t.slice(1);
      }
      if (t.endsWith(".")) t = t.slice(0, -1);
      if (!t && meta) t = defaultFundNim(meta);
      if (/^\\d+(\\.\\d+)?$/.test(t)) return t;
      var n = parseFloat(t);
      if (!isFinite(n) || n <= 0) return "";
      if (Number.isInteger(n)) return String(n);
      return n.toFixed(5).replace(/\\.?0+$/, "");
    }
    function readFundAmountNim(amountInput) {
      var meta = advDashboardState.meta || {};
      if (!amountInput) return normalizeFundAmountNim(advDashboardState.fundAmountDraft || "", meta);
      var raw = "";
      if (amountInput.value != null) raw = String(amountInput.value).trim();
      if (!raw && amountInput.getAttribute) {
        var attrVal = amountInput.getAttribute("value");
        if (attrVal) raw = String(attrVal).trim();
      }
      if (!raw && typeof amountInput.valueAsNumber === "number" && isFinite(amountInput.valueAsNumber) && amountInput.valueAsNumber > 0) {
        var n = amountInput.valueAsNumber;
        if (n >= 1 && Number.isInteger(n)) {
          raw = String(n);
        } else {
          raw = n.toFixed(5).replace(/\\.?0+$/, "");
        }
      }
      var normalized = normalizeFundAmountNim(raw, meta);
      if (!normalized && advDashboardState.fundAmountDraft) {
        normalized = normalizeFundAmountNim(advDashboardState.fundAmountDraft, meta);
      }
      if (normalized) advDashboardState.fundAmountDraft = normalized;
      return normalized;
    }
    function nimAmountToLunaClient(nim) {
      var t = normalizeFundAmountNim(nim, null);
      if (!t) return null;
      var parts = t.split(".");
      var whole = parseInt(parts[0] || "0", 10);
      var fracStr = (parts[1] || "").padEnd(5, "0").slice(0, 5);
      var frac = parseInt(fracStr, 10);
      if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null;
      var luna = whole * 100000 + frac;
      if (!Number.isFinite(luna) || luna < 1) return null;
      return luna;
    }
    function parseIntentAmountLuna(intent) {
      if (!intent || typeof intent !== "object") return null;
      var raw = intent.amountLuna != null ? String(intent.amountLuna).trim() : "";
      if (raw.indexOf(".") >= 0) raw = raw.split(".")[0];
      if (!/^\\d+$/.test(raw)) {
        var label = intent.amountNimLabel != null ? String(intent.amountNimLabel).trim() : "";
        if (label) return nimAmountToLunaClient(label);
        return null;
      }
      var n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1) return null;
      return n;
    }
    function resolvePaymentAmountLuna(intent, amountNim) {
      var fromIntent = parseIntentAmountLuna(intent);
      if (fromIntent != null) return fromIntent;
      return nimAmountToLunaClient(amountNim);
    }
    function paymentRecipient(intent, meta) {
      return formatWalletGrouped(
        String(
          intent.recipient ||
            (meta && meta.fundRecipientAddress) ||
            ""
        ).trim()
      );
    }
    function formatWalletGrouped(addr) {
      var raw = String(addr || "").trim();
      if (!raw) return "";
      if (/\\s/.test(raw)) return raw.replace(/\\s+/g, " ").trim();
      var compact = raw.replace(/\\s+/g, "").toUpperCase();
      return compact.replace(/(.{4})(?=.)/g, "$1 ");
    }
    function buildCheckoutOpts(intent, amountNim, meta) {
      var amountLuna = resolvePaymentAmountLuna(intent, amountNim);
      if (amountLuna == null) throw new Error("invalid_amount");
      var recipient = paymentRecipient(intent, meta);
      if (!recipient) throw new Error("missing_recipient");
      var opts = {
        appName: "Nimiq Space advertise",
        recipient: recipient,
        value: Math.floor(amountLuna),
      };
      var memo = String(intent.memo || "").trim();
      if (memo) opts.extraData = memo;
      return opts;
    }
    async function createIntentForFund(campaignId, amountNim) {
      var r = await api("/api/advertise/campaigns/" + encodeURIComponent(campaignId) + "/intent", {
        method: "POST",
        body: JSON.stringify({ amountNim: amountNim }),
      });
      if (!r.ok) {
        throw new Error(mapIntentCreateError((r.body && r.body.error) || "intent_failed"));
      }
      var intent = (r.body && r.body.intent) || {};
      var meta = advDashboardState.meta || {};
      if (r.body && r.body.campaign) {
        updateCampaignInState(r.body.campaign);
        advDashboardState.selectedId = campaignId;
      }
      refreshCampaignsUi();
      var amountLuna = resolvePaymentAmountLuna(intent, amountNim);
      if (amountLuna == null) {
        throw new Error("invalid_amount");
      }
      return { intent: intent, meta: meta, amountLuna: amountLuna, amountNim: amountNim };
    }
    function paymentRecipientCompact(intent, meta) {
      return String(
        intent.recipient ||
          (meta && meta.fundRecipientAddress) ||
          ""
      )
        .trim()
        .replace(/\\s+/g, "")
        .toUpperCase();
    }
    function utf8ToHex(text) {
      var bytes = new TextEncoder().encode(String(text || ""));
      var hex = "";
      for (var i = 0; i < bytes.length; i++) {
        hex += ("0" + bytes[i].toString(16)).slice(-2);
      }
      return hex;
    }
    function lunaFromIntent(intent, amountLunaFallback) {
      if (intent && intent.amountLuna != null) {
        var raw = String(intent.amountLuna).trim();
        if (raw.indexOf(".") >= 0) raw = raw.split(".")[0];
        if (/^\\d+$/.test(raw)) {
          var parsed = parseInt(raw, 10);
          if (Number.isFinite(parsed) && parsed >= 1) return parsed;
        }
      }
      var fb = Number(amountLunaFallback);
      if (Number.isFinite(fb) && fb >= 1) return Math.trunc(fb);
      return null;
    }
    function buildNimiqPayTx(intent, amountLuna, meta, opts) {
      opts = opts || {};
      var value = lunaFromIntent(intent, amountLuna);
      if (value == null) throw new Error("invalid_amount");
      var recipient = opts.grouped
        ? paymentRecipient(intent, meta)
        : paymentRecipientCompact(intent, meta);
      if (!recipient) throw new Error("missing_recipient");
      var tx = { recipient: recipient, value: Math.floor(value) };
      var memo = String(intent.memo || "").trim();
      if (memo) {
        tx.data = opts.dataHex ? utf8ToHex(memo) : memo;
      }
      return tx;
    }
    function extractThrownMessage(err) {
      if (err instanceof Error) return err.message;
      if (err && typeof err === "object") {
        if (typeof err.message === "string") return err.message;
        if (err.error && typeof err.error === "object") {
          if (typeof err.error.message === "string") return err.error.message;
          if (typeof err.error.type === "string") return err.error.type;
        }
      }
      return String(err || "nimiq_pay_payment_failed");
    }
    async function invokeNimiqPaySend(nimiq, tx) {
      try {
        if (tx.data) return await nimiq.sendBasicTransactionWithData(tx);
        return await nimiq.sendBasicTransaction(tx);
      } catch (err) {
        throw new Error("nimiq_pay:" + extractThrownMessage(err));
      }
    }
    async function fundViaNimiqPay(intent, amountLuna, meta) {
      var nimiq = window.nimiq;
      if (!nimiq) nimiq = await waitForNimiqProvider(5000);
      var validityStartHeight;
      try {
        validityStartHeight = await nimiq.getBlockNumber();
      } catch (heightErr) {
        validityStartHeight = undefined;
      }
      var attempts = [
        { grouped: true, dataHex: false },
        { grouped: false, dataHex: false },
        { grouped: true, dataHex: true },
      ];
      var lastMsg = "nimiq_pay_payment_failed";
      for (var ai = 0; ai < attempts.length; ai++) {
        var tx = buildNimiqPayTx(intent, amountLuna, meta, attempts[ai]);
        if (validityStartHeight != null && Number.isFinite(validityStartHeight)) {
          tx.validityStartHeight = validityStartHeight;
        }
        var result = await invokeNimiqPaySend(nimiq, tx);
        if (typeof result === "string" && result.trim()) return result;
        if (isProviderErrorResponse(result)) {
          lastMsg = providerErrorText(result);
          var lower = lastMsg.toLowerCase();
          if (lower.indexOf("invalid_amount") === -1 && lower.indexOf("invalid amount") === -1) {
            break;
          }
          continue;
        }
        if (result && typeof result === "object" && result.error) {
          lastMsg = providerErrorText(result);
          break;
        }
        lastMsg = "nimiq_pay_unexpected_response";
        break;
      }
      throw new Error("nimiq_pay:" + lastMsg);
    }
    async function fundViaHubWithIntentPost(hub, campaignId, amountNim) {
      var checkoutRequest = createIntentForFund(campaignId, amountNim).then(function (created) {
        return buildCheckoutOpts(created.intent, amountNim, created.meta);
      });
      return hub.checkout(checkoutRequest);
    }
    async function loadDashboard() {
      var panel = document.getElementById("panel");
      var token = readAuthToken();
      if (!token) {
        panel.innerHTML =
          '<div class="ms-auth-gate ms-auth-gate--standalone"><div class="ms-auth-gate-msg">Sign in to continue.</div></div>';
        return;
      }
      try {
        var metaR = await api("/api/advertise/meta", { method: "GET" });
        var listR = await api("/api/advertise/campaigns", { method: "GET" });
        if (!metaR.ok || !listR.ok) {
          var errCode = (metaR.body && metaR.body.error) || (listR.body && listR.body.error);
          var errMsg = "Could not load campaigns.";
          if (metaR.status === 503 || listR.status === 503 || errCode === "backend_unavailable") {
            errMsg = "Game server is not running on port 3001. Restart npm run dev and hard-refresh.";
          }
          panel.innerHTML = '<p class="err">' + escHtml(errMsg) + "</p>";
          return;
        }
      var meta = metaR.body || {};
      var campaigns = (listR.body && listR.body.campaigns) || [];
      var previewWallet = previewWalletAddress();
      var selectedId = advDashboardState.selectedId || "";
      if (selectedId) {
        var found = false;
        for (var si = 0; si < campaigns.length; si++) {
          if (campaigns[si].id === selectedId) { found = true; break; }
        }
        if (!found) selectedId = "";
      }
      if (!selectedId && campaigns.length && advDashboardState.activeTab === "existing") {
        selectedId = sortCampaigns(campaigns)[0].id;
      }
      if (!advDashboardState.activeTab) {
        advDashboardState.activeTab = campaigns.length ? "existing" : "new";
      }
      advDashboardState.meta = meta;
      advDashboardState.campaigns = campaigns;
      advDashboardState.previewWallet = previewWallet;
      advDashboardState.selectedId = selectedId;
      var html = renderAdvertiseDashboard(
        meta,
        campaigns,
        selectedId,
        previewWallet,
        advDashboardState.activeTab
      );
      if (typeof window.__advDisposeBillboardPreviewsIn === "function") {
        window.__advDisposeBillboardPreviewsIn(panel);
      }
      panel.innerHTML = html;
      document.getElementById("advCreateBtn").addEventListener("click", onCreateCampaign);
      bindAdvertiseTabs();
      bindCampaignGridHandlers();
      bindCampaignDetailHandlers(panel);
      bindActiveTabPreviews();
      bindCampaignImageUploads(panel);
      for (var pi = 0; pi < campaigns.length; pi++) {
        var cp = campaigns[pi];
        var needsPaymentSync =
          cp.status === "pending_payment" ||
          (cp.status === "approved" && cp.intentId);
        if (needsPaymentSync && cp.id === selectedId) {
          probePaymentSyncOnce(cp.id);
          break;
        }
      }
      } catch (e) {
        var loadErr = String((e && e.message) || e || "");
        var loadFailMsg = "Could not load campaigns.";
        if (loadErr === "backend_timeout") {
          loadFailMsg =
            "Game server is not responding on port 3001. Restart npm run dev and hard-refresh.";
        }
        panel.innerHTML = '<p class="err">' + escHtml(loadFailMsg) + "</p>";
      }
    }
    function onCancelEditCampaign(ev) {
      var id = ev.currentTarget.getAttribute("data-id");
      var panel = document.querySelector('.adv-edit-panel[data-edit="' + id + '"]');
      if (panel) panel.hidden = true;
    }
    async function onSaveCampaignDuration(ev) {
      var id = ev.currentTarget.getAttribute("data-id");
      var msg = document.querySelector('.adv-duration-msg[data-id="' + id + '"]');
      var dwellEl = document.getElementById("advDwell-" + id);
      var body = {
        displayIntervalSec: Number((dwellEl || {}).value || 10),
      };
      var r = await api("/api/advertise/campaigns/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        if (msg) {
          msg.textContent = (r.body && r.body.error) || "Save failed";
          msg.className = "err";
          msg.hidden = false;
        }
        return;
      }
      if (r.body && r.body.campaign) {
        updateCampaignInState(r.body.campaign);
      }
      if (msg) {
        msg.textContent = "Duration saved.";
        msg.className = "ok";
        msg.hidden = false;
      }
      refreshCampaignsUi();
    }
    async function onSaveCampaign(ev) {
      var id = ev.currentTarget.getAttribute("data-id");
      var msg = document.querySelector('.adv-edit-msg[data-id="' + id + '"]');
      var body = {
        projectName: (document.querySelector('.adv-edit-name[data-id="' + id + '"]') || {}).value,
        miniappTargetUrl: (document.querySelector('.adv-edit-target[data-id="' + id + '"]') || {}).value,
        imageUrl: (document.querySelector('.adv-edit-image[data-id="' + id + '"]') || {}).value,
        displayIntervalSec: Number(
          (document.getElementById("advEditDisplayInterval-" + id) || {}).value || 10
        ),
      };
      var r = await api("/api/advertise/campaigns/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        if (msg) {
          msg.textContent = (r.body && r.body.error) || "Save failed";
          msg.className = "err";
          msg.hidden = false;
        }
        return;
      }
      await loadDashboard();
    }
    async function onCreateCampaign() {
      var msg = document.getElementById("advFormMsg");
      msg.hidden = true;
      var body = {
        projectName: document.getElementById("advName").value,
        miniappTargetUrl: document.getElementById("advTarget").value,
        imageUrl: document.getElementById("advImage").value,
        displayIntervalSec: Number(
          (document.getElementById("advDisplayInterval") || {}).value || 10
        ),
      };
      var r = await api("/api/advertise/campaigns", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) {
        msg.textContent = (r.body && r.body.error) || "Create failed";
        msg.className = "err";
        msg.hidden = false;
        return;
      }
      if (r.body && r.body.campaign && r.body.campaign.id) {
        advDashboardState.activeTab = "existing";
        advDashboardState.selectedId = r.body.campaign.id;
      }
      await loadDashboard();
    }
    async function onFundConfirm() {
      var id = advDashboardState.fundCampaignId;
      var amountInput = document.getElementById("advFundAmount");
      var msg = document.getElementById("advFundMsg");
      var confirmBtn = document.getElementById("advFundConfirmBtn");
      if (!id || !amountInput) return;
      var amountNim = readFundAmountNim(amountInput);
      if (!amountNim) {
        if (msg) {
          msg.textContent = "Enter a valid fund amount (at least 0.00001 NIM).";
          msg.className = "err";
          msg.hidden = false;
        }
        return;
      }
      if (msg) { msg.hidden = true; msg.textContent = ""; }
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = isNimiqPayMiniApp() ? "Creating payment…" : "Opening wallet…";
      }
      try {
        if (isNimiqPayMiniApp()) {
          var payKey = fundPayPrepareKey(id, amountNim);
          var payBundle = advDashboardState.fundPayBundle;
          if (!payBundle || payBundle.key !== payKey) {
            payBundle = await ensureFundPayBundle(id, amountNim);
          }
          if (confirmBtn) confirmBtn.textContent = "Opening wallet…";
          await fundViaNimiqPay(payBundle.intent, payBundle.amountLuna, payBundle.meta);
        } else {
          var hub = await ensureHubApi();
          await fundViaHubWithIntentPost(hub, id, amountNim);
        }
        setFundPaymentUi("confirming", "Payment sent. Confirming on chain…");
        startPaymentSyncPoll(id);
      } catch (payErr) {
        var payMsg = walletPaymentErrorMessage(payErr);
        if (msg) {
          if (payMsg === "Payment cancelled.") {
            resetFundPaymentUi();
            msg.textContent = "Payment cancelled. Use Retry payment to try again.";
            msg.className = "adv-hint";
            msg.hidden = false;
          } else if (
            payMsg.indexOf("pay manually") !== -1 ||
            payMsg.indexOf("popup blocked") !== -1 ||
            payMsg.indexOf("not configured") !== -1
          ) {
            msg.textContent = payMsg;
            msg.className = "err";
            msg.hidden = false;
          } else {
            msg.textContent = payMsg;
            msg.className = "err";
            msg.hidden = false;
          }
        }
        if (
          payMsg !== "Payment cancelled." &&
          payMsg.indexOf("popup blocked") === -1
        ) {
          setFundPaymentUi("confirming", "Checking payment status…");
          startPaymentSyncPoll(id);
        }
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Pay with wallet";
        }
      }
    }
    function bindFundOverlayHandlers() {
      var cancelBtn = document.getElementById("advFundCancelBtn");
      var confirmBtn = document.getElementById("advFundConfirmBtn");
      var overlay = document.getElementById("advFundOverlay");
      var amountInput = document.getElementById("advFundAmount");
      if (cancelBtn) cancelBtn.addEventListener("click", closeFundPopover);
      if (confirmBtn) {
        confirmBtn.addEventListener("pointerdown", armFundPayPrepare);
        confirmBtn.addEventListener("click", function () { void onFundConfirm(); });
      }
      if (amountInput) {
        amountInput.addEventListener("input", function () {
          advDashboardState.fundAmountDraft = readFundAmountNim(amountInput);
          advDashboardState.fundPayBundle = null;
          updateFundEstimate();
          scheduleFundPayPrepare();
        });
        amountInput.addEventListener("change", function () {
          advDashboardState.fundAmountDraft = readFundAmountNim(amountInput);
          advDashboardState.fundPayBundle = null;
          updateFundEstimate();
          scheduleFundPayPrepare();
        });
      }
      if (overlay) {
        overlay.addEventListener("click", function (ev) {
          if (ev.target === overlay) closeFundPopover();
        });
      }
    }
    function startAdvertisePage() {
      preloadWalletSdks();
      if (isNimiqPayMiniApp()) {
        void waitForNimiqProvider(15000).catch(function () {});
      }
      bindCampaignGridHandlers();
      bindFundOverlayHandlers();
      if (window.__advPreviewModuleReady) {
        void loadDashboard();
        return;
      }
      document.addEventListener("adv-preview-ready", function () {
        void loadDashboard();
      }, { once: true });
    }
    startAdvertisePage();
  </script>
</body>
</html>`;
}
