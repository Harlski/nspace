import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/cosmetics` - catalog CRUD, changelog, grants, preview. */
export function adminCosmeticsPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Cosmetics - Admin - Nimiq Space</title>
  ${mainSiteFaviconLinkTag()}
  ${analyticsFontLinkTags()}
  <style>
    ${analyticsPageRootCss()}
    ${mainSiteShellCss()}
    ${analyticsTopbarCss()}
    .cx-panel { border: 1px solid #263348; border-radius: 10px; background: #0f1622; padding: 0.75rem 0.85rem; margin-bottom: 0.85rem; }
    .cx-panel h2 { margin: 0 0 0.55rem; font-size: 0.92rem; color: #c8d4e4; font-weight: 600; }
    .cx-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .cx-table th, .cx-table td { text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #1c2838; vertical-align: top; }
    .cx-btn {
      appearance: none; border: 1px solid #334155; background: #1e293b; color: #e2e8f0;
      border-radius: 6px; padding: 0.3rem 0.55rem; font: inherit; font-size: 0.76rem; cursor: pointer;
    }
    .cx-btn--accent { background: var(--ms-accent); border-color: var(--ms-accent-hover-border); color: #eef6ff; }
    .cx-field { margin-bottom: 0.55rem; }
    .cx-field label { display: block; font-size: 0.76rem; color: #94a3b8; margin-bottom: 0.2rem; }
    .cx-field input, .cx-field select, .cx-field textarea {
      width: 100%; box-sizing: border-box; background: #0a1018; color: #d8e2f0;
      border: 1px solid #263348; border-radius: 6px; padding: 0.35rem 0.5rem; font: inherit; font-size: 0.8rem;
    }
    .cx-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    @media (max-width: 900px) { .cx-grid-2 { grid-template-columns: 1fr; } }
    .cx-msg { font-size: 0.78rem; color: #86efac; margin-top: 0.45rem; }
    .cx-err { font-size: 0.78rem; color: #fca5a5; margin-top: 0.45rem; }
    .cx-badge { font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: #1e293b; color: #94a3b8; }
    .cx-badge--published { background: #14532d; color: #86efac; }
    .cx-badge--archived { background: #3f1f1f; color: #fca5a5; }
    .cx-log { font-size: 0.72rem; color: #9fb0c7; max-height: 14rem; overflow: auto; }
    .cx-log li { margin-bottom: 0.35rem; }
    #cxRoot.ms-panel { max-width: 72rem; }
    .cx-preview-card {
      display: flex; gap: 0.75rem; align-items: flex-start; margin-top: 0.45rem;
      padding: 0.55rem; border: 1px solid #263348; border-radius: 8px; background: #0a1018;
    }
    .cx-preview-ident {
      width: 64px; height: 64px; border-radius: 8px; flex-shrink: 0; object-fit: cover;
      background: #1e293b;
    }
    .cx-preview-meta { flex: 1; min-width: 0; font-size: 0.76rem; color: #9fb0c7; }
    .cx-preview-meta strong { color: #e2e8f0; display: block; margin-bottom: 0.25rem; }
    .cx-preview-swatches { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem; }
    .cx-preview-swatch {
      font-size: 0.68rem; padding: 0.15rem 0.4rem; border-radius: 4px;
      border: 1px solid #334155; background: #1e293b; color: #cbd5e1;
    }
    .cx-preview-swatch--aura-cyan { box-shadow: 0 0 0 2px #44d4ff inset; }
    .cx-preview-swatch--aura-gold { box-shadow: 0 0 0 2px #ffcc44 inset; }
    .cx-preview-swatch--aura-rose { box-shadow: 0 0 0 2px #ff6699 inset; }
    .cx-preview-swatch--aura-violet { box-shadow: 0 0 0 2px #aa77ff inset; }
    .cx-preview-swatch--aura-lime { box-shadow: 0 0 0 2px #88ee55 inset; }
    .cx-preview-swatch--bubble-pastel { background: rgba(255, 210, 230, 0.35); }
    .cx-preview-swatch--bubble-dark { background: rgba(20, 24, 36, 0.85); color: #e2e8f0; }
    .cx-preview-gl-wrap {
      margin-top: 0.55rem; border: 1px solid #263348; border-radius: 8px; overflow: hidden;
      background: #0f1419; aspect-ratio: 4 / 3; position: relative;
    }
    #cxPreviewGl { display: block; width: 100%; height: 100%; }
    .cx-preview-toolbar {
      display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-top: 0.45rem;
    }
    .cx-preview-toolbar .cx-btn.is-active { border-color: var(--ms-accent); color: #eef6ff; }
    .cx-kenney-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
      gap: 0.35rem; max-height: 14rem; overflow: auto; margin-top: 0.45rem;
      padding: 0.35rem; border: 1px solid #263348; border-radius: 8px; background: #0a1018;
    }
    .cx-kenney-chip {
      appearance: none; border: 1px solid #334155; background: #1e293b; border-radius: 6px;
      padding: 0.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .cx-kenney-chip img { image-rendering: pixelated; width: 32px; height: 32px; object-fit: contain; }
    .cx-kenney-chip.is-active { border-color: var(--ms-accent); box-shadow: 0 0 0 1px var(--ms-accent); }
    .cx-attribution { font-size: 0.72rem; color: #7b8da8; margin-top: 0.55rem; }
    .cx-attribution a { color: #94a3b8; }
  </style>
  <script type="module" src="/assets/admin-cosmetic-preview.js"></script>
</head>
<body class="ms-site ms-site--wide">
  ${analyticsTopbarHtml("cosmetics")}
  <main class="ms-panel" id="cxRoot">
    <h1 class="ms-panel__title">Cosmetic catalog</h1>
    <p class="ms-panel__lead">Manage shop listings, publish/archive SKUs, grant entitlements, and preview presets.</p>
    <div id="cxErr" class="cx-err" hidden></div>
    <div id="cxMsg" class="cx-msg" hidden></div>

    <div class="cx-grid-2">
      <div>
        <section class="cx-panel">
          <h2>Catalog entries</h2>
          <table class="cx-table" id="cxList"><thead><tr>
            <th>SKU</th><th>Name</th><th>Slot</th><th>Status</th><th></th>
          </tr></thead><tbody></tbody></table>
        </section>
        <section class="cx-panel" id="cxCreatePanel">
          <h2>Create draft</h2>
          <div class="cx-field"><label>Cosmetic SKU (immutable)</label><input id="cxNewSku" placeholder="aura-blue-v1"/></div>
          <div class="cx-field"><label>Preset</label><select id="cxNewPreset"></select></div>
          <div class="cx-field"><label>Display name</label><input id="cxNewName"/></div>
          <div class="cx-field"><label>Description</label><textarea id="cxNewDesc" rows="2"></textarea></div>
          <div class="cx-field"><label>Collection</label><input id="cxNewCollection" placeholder="Starter"/></div>
          <div class="cx-field"><label>Sort order</label><input id="cxNewSort" type="number" value="0"/></div>
          <div class="cx-field"><label>Price (NIM)</label><input id="cxNewPrice" type="number" min="0" step="0.00001" value="1"/></div>
          <button type="button" class="cx-btn cx-btn--accent" id="cxCreateBtn">Create draft</button>
        </section>
      </div>
      <div>
        <section class="cx-panel" id="cxEditPanel" hidden>
          <h2 id="cxEditTitle">Edit entry</h2>
          <input type="hidden" id="cxEditSku"/>
          <div class="cx-field"><label>Preset (read-only)</label><input id="cxEditPreset" readonly/></div>
          <div class="cx-field"><label>Slot (read-only)</label><input id="cxEditSlot" readonly/></div>
          <div class="cx-field"><label>Display name</label><input id="cxEditName"/></div>
          <div class="cx-field"><label>Description</label><textarea id="cxEditDesc" rows="2"></textarea></div>
          <div class="cx-field"><label>Collection</label><input id="cxEditCollection"/></div>
          <div class="cx-field"><label>Sort order</label><input id="cxEditSort" type="number"/></div>
          <div class="cx-field"><label>Price (NIM)</label><input id="cxEditPrice" type="number" min="0" step="0.00001"/></div>
          <div id="cxDeployFields" hidden>
            <div class="cx-field"><label>Cooldown (sec)</label><input id="cxEditCooldown" type="number"/></div>
            <div class="cx-field"><label>Duration (sec)</label><input id="cxEditDuration" type="number"/></div>
            <div class="cx-field"><label>Room cap</label><input id="cxEditRoomCap" type="number"/></div>
            <div class="cx-field"><label>Deploy range (tiles)</label><input id="cxEditRange" type="number"/></div>
          </div>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.5rem;">
            <button type="button" class="cx-btn cx-btn--accent" id="cxSaveBtn">Save</button>
            <button type="button" class="cx-btn" id="cxPublishBtn">Publish</button>
            <button type="button" class="cx-btn" id="cxArchiveBtn">Archive</button>
          </div>
          <div class="cx-field"><label>Grant to wallet</label><input id="cxGrantWallet" placeholder="NQ…"/></div>
          <button type="button" class="cx-btn" id="cxGrantBtn">Grant entitlement</button>
        </section>
        <section class="cx-panel" id="cxPreviewPanel">
          <h2>Catalog preview</h2>
          <div class="cx-field"><label>Wallet address</label><input id="cxPreviewWallet"/></div>
          <div class="cx-field"><label>Preset ID</label><input id="cxPreviewPreset" readonly/></div>
          <div class="cx-preview-gl-wrap">
            <canvas id="cxPreviewGl" aria-label="Cosmetic WebGL preview"></canvas>
          </div>
          <div class="cx-preview-toolbar">
            <span style="font-size:0.72rem;color:#94a3b8;">Camera:</span>
            <button type="button" class="cx-btn is-active" data-cx-camera-corner="0">Corner 1</button>
            <button type="button" class="cx-btn" data-cx-camera-corner="1">Corner 2</button>
            <button type="button" class="cx-btn" data-cx-camera-corner="2">Corner 3</button>
            <button type="button" class="cx-btn" data-cx-camera-corner="3">Corner 4</button>
            <button type="button" class="cx-btn" id="cxPreviewDeployBurst">Deploy burst</button>
          </div>
          <div class="cx-preview-card" id="cxPreviewCard">
            <img class="cx-preview-ident" id="cxPreviewIdent" alt="" width="64" height="64"/>
            <div class="cx-preview-meta">
              <strong id="cxPreviewLabel">Select an entry to preview</strong>
              <span id="cxPreviewSlot"></span>
              <div class="cx-preview-swatches" id="cxPreviewSwatches"></div>
            </div>
          </div>
          <p style="font-size:0.78rem;color:#7b8da8;margin-top:0.45rem;">WebGL preview uses the same renderer path as in-game wardrobe VFX (isometric ortho, Kenney sprites where configured).</p>
        </section>
        <section class="cx-panel" id="cxKenneyPanel">
          <h2>Kenney particle library</h2>
          <div class="cx-field">
            <label>Category filter</label>
            <select id="cxKenneyFilter">
              <option value="all">All</option>
              <option value="spark">Spark</option>
              <option value="smoke">Smoke</option>
              <option value="magic">Magic</option>
              <option value="light">Light</option>
              <option value="twirl">Twirl</option>
              <option value="flare">Flare</option>
              <option value="muzzle">Muzzle</option>
              <option value="flame">Flame</option>
              <option value="fire">Fire</option>
              <option value="star">Star</option>
              <option value="circle">Circle</option>
              <option value="trace">Trace</option>
              <option value="slash">Slash</option>
              <option value="scorch">Scorch</option>
              <option value="dirt">Dirt</option>
              <option value="symbol">Symbol</option>
              <option value="window">Window</option>
            </select>
          </div>
          <div class="cx-kenney-grid" id="cxKenneyGrid"></div>
          <p class="cx-attribution" id="cxKenneyAttribution"></p>
        </section>
        <section class="cx-panel" id="cxChangelogPanel" hidden>
          <h2>Changelog</h2>
          <ul class="cx-log" id="cxChangelog"></ul>
        </section>
      </div>
    </div>
  </main>
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
        "<p class='ms-auth-gate-hint'><a href='/admin'>Sign in via Admin</a></p>" +
        "</div>"
      );
    }
    async function api(path, opts) {
      var t = readAuthToken();
      if (!t) throw new Error("not_signed_in");
      var r = await fetch(path, Object.assign({
        headers: { authorization: "Bearer " + t, "content-type": "application/json" },
      }, opts || {}));
      var j = null;
      try { j = await r.json(); } catch (e) { j = {}; }
      if (!r.ok) {
        var err = new Error((j && j.error) || r.statusText || "request_failed");
        err.status = r.status;
        throw err;
      }
      return j;
    }
    var errEl = document.getElementById("cxErr");
    var msgEl = document.getElementById("cxMsg");
    var gridEl = document.querySelector(".cx-grid-2");
    function showErr(e) {
      errEl.hidden = false;
      errEl.textContent = String((e && e.message) || e);
      msgEl.hidden = true;
    }
    function showMsg(t) {
      msgEl.hidden = false;
      msgEl.textContent = t;
      errEl.hidden = true;
    }
    function showAuthGate(msg) {
      if (gridEl) gridEl.hidden = true;
      errEl.hidden = true;
      msgEl.hidden = true;
      var gate = document.createElement("div");
      gate.innerHTML = authGateHtml(msg);
      document.getElementById("cxRoot").appendChild(gate.firstChild);
    }

    var presets = [];
    var catalog = [];
    var identiconCache = {};

    function previewSwatchClass(presetId) {
      if (presetId.indexOf("aura-") === 0) return "cx-preview-swatch cx-preview-swatch--" + presetId;
      if (presetId === "bubble-rounded-pastel") return "cx-preview-swatch cx-preview-swatch--bubble-pastel";
      if (presetId === "bubble-sharp-dark") return "cx-preview-swatch cx-preview-swatch--bubble-dark";
      return "cx-preview-swatch";
    }

    function renderPreviewSwatches(presetId, slot) {
      var box = document.getElementById("cxPreviewSwatches");
      box.replaceChildren();
      if (!presetId) return;
      var chip = document.createElement("span");
      chip.className = previewSwatchClass(presetId);
      chip.textContent = (slot || "preset") + ": " + presetId;
      box.appendChild(chip);
      if (slot === "deployable") {
        var note = document.createElement("span");
        note.className = "cx-preview-swatch";
        note.textContent = "Deployable (tile effect in Items wheel)";
        box.appendChild(note);
      }
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

    async function refreshCatalogPreview() {
      var wallet = document.getElementById("cxPreviewWallet").value.trim();
      var presetId = document.getElementById("cxPreviewPreset").value.trim();
      var img = document.getElementById("cxPreviewIdent");
      var label = document.getElementById("cxPreviewLabel");
      var slotEl = document.getElementById("cxPreviewSlot");
      var preset = presets.find(function (p) { return p.presetId === presetId; });
      label.textContent = preset ? preset.label : (presetId || "Select an entry to preview");
      slotEl.textContent = preset ? "Slot: " + preset.slot : "";
      renderPreviewSwatches(presetId, preset ? preset.slot : "");
      var burstBtn = document.getElementById("cxPreviewDeployBurst");
      if (burstBtn) burstBtn.hidden = !(preset && preset.slot === "deployable");
      if (presetId && preset && window.__nsAdminCosmeticPreview) {
        window.__nsAdminCosmeticPreview.applyCatalogPreset(presetId, preset.slot);
      } else if (window.__nsAdminCosmeticPreview) {
        window.__nsAdminCosmeticPreview.bindCanvas();
      }
      if (wallet) {
        var url = await fetchIdenticon(wallet);
        if (url) img.src = url;
      }
    }

    function nimFromLuna(luna) {
      return (Number(BigInt(luna)) / 100000).toFixed(5).replace(/\\.?0+$/, "");
    }
    function lunaFromNim(nim) {
      var parts = String(nim).split(".");
      var whole = BigInt(parts[0] || "0");
      var frac = 0n;
      if (parts[1]) {
        var f = (parts[1] + "00000").slice(0, 5);
        frac = BigInt(f);
      }
      return (whole * 100000n + frac).toString();
    }

    async function loadPresets() {
      var j = await api("/api/admin/cosmetics/presets");
      presets = j.presets || [];
      var sel = document.getElementById("cxNewPreset");
      sel.replaceChildren.apply(sel, presets.map(function (p) {
        var o = document.createElement("option");
        o.value = p.presetId;
        o.textContent = p.label + " (" + p.slot + ")";
        return o;
      }));
    }

    function renderList() {
      var tbody = document.querySelector("#cxList tbody");
      tbody.replaceChildren.apply(tbody, catalog.map(function (e) {
        var tr = document.createElement("tr");
        var badge = e.status === "published" ? "cx-badge--published" : e.status === "archived" ? "cx-badge--archived" : "";
        tr.innerHTML = "<td class=mono>" + esc(e.cosmeticSku) + "</td><td>" + esc(e.displayName) + "</td><td>" + esc(e.slot) + "</td><td><span class=cx-badge " + badge + ">" + esc(e.status) + "</span></td><td></td>";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cx-btn";
        btn.textContent = "Edit";
        btn.onclick = function () { openEdit(e.cosmeticSku); };
        tr.lastElementChild.appendChild(btn);
        return tr;
      }));
    }

    async function loadCatalog() {
      var j = await api("/api/admin/cosmetics/catalog");
      catalog = j.entries || [];
      renderList();
    }

    async function openEdit(sku) {
      var j = await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku));
      var e = j.entry;
      document.getElementById("cxEditPanel").hidden = false;
      document.getElementById("cxChangelogPanel").hidden = false;
      document.getElementById("cxEditSku").value = e.cosmeticSku;
      document.getElementById("cxEditTitle").textContent = e.displayName;
      document.getElementById("cxEditPreset").value = e.presetId;
      document.getElementById("cxEditSlot").value = e.slot;
      document.getElementById("cxEditName").value = e.displayName;
      document.getElementById("cxEditDesc").value = e.description;
      document.getElementById("cxEditCollection").value = e.collection;
      document.getElementById("cxEditSort").value = e.sortOrder;
      document.getElementById("cxEditPrice").value = nimFromLuna(e.priceLuna);
      document.getElementById("cxPreviewPreset").value = e.presetId;
      void refreshCatalogPreview();
      var deploy = e.slot === "deployable";
      document.getElementById("cxDeployFields").hidden = !deploy;
      if (deploy) {
        document.getElementById("cxEditCooldown").value = e.cooldownSec != null ? e.cooldownSec : "";
        document.getElementById("cxEditDuration").value = e.durationSec != null ? e.durationSec : "";
        document.getElementById("cxEditRoomCap").value = e.roomCap != null ? e.roomCap : "";
        document.getElementById("cxEditRange").value = e.deployRange != null ? e.deployRange : "";
      }
      document.getElementById("cxPublishBtn").hidden = e.status !== "draft";
      document.getElementById("cxArchiveBtn").hidden = e.status !== "published";
      var log = document.getElementById("cxChangelog");
      log.replaceChildren.apply(log, (j.changelog || []).map(function (r) {
        var li = document.createElement("li");
        li.textContent = r.at + " · " + r.action + " · " + String(r.actorWallet).slice(0, 8) + "…";
        return li;
      }));
    }

    document.getElementById("cxCreateBtn").onclick = async function () {
      try {
        await api("/api/admin/cosmetics/catalog", {
          method: "POST",
          body: JSON.stringify({
            cosmeticSku: document.getElementById("cxNewSku").value,
            presetId: document.getElementById("cxNewPreset").value,
            displayName: document.getElementById("cxNewName").value,
            description: document.getElementById("cxNewDesc").value,
            collection: document.getElementById("cxNewCollection").value,
            sortOrder: Number(document.getElementById("cxNewSort").value) || 0,
            priceLuna: lunaFromNim(document.getElementById("cxNewPrice").value),
          }),
        });
        showMsg("Draft created.");
        await loadCatalog();
      } catch (e) { showErr(e); }
    };

    document.getElementById("cxSaveBtn").onclick = async function () {
      var sku = document.getElementById("cxEditSku").value;
      var body = {
        displayName: document.getElementById("cxEditName").value,
        description: document.getElementById("cxEditDesc").value,
        collection: document.getElementById("cxEditCollection").value,
        sortOrder: Number(document.getElementById("cxEditSort").value) || 0,
        priceLuna: lunaFromNim(document.getElementById("cxEditPrice").value),
      };
      if (document.getElementById("cxEditSlot").value === "deployable") {
        body.cooldownSec = Number(document.getElementById("cxEditCooldown").value) || null;
        body.durationSec = Number(document.getElementById("cxEditDuration").value) || null;
        body.roomCap = Number(document.getElementById("cxEditRoomCap").value) || null;
        body.deployRange = Number(document.getElementById("cxEditRange").value) || null;
      }
      try {
        await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku), {
          method: "PUT",
          body: JSON.stringify(body),
        });
        showMsg("Saved.");
        await loadCatalog();
        await openEdit(sku);
      } catch (e) { showErr(e); }
    };

    document.getElementById("cxPublishBtn").onclick = async function () {
      var sku = document.getElementById("cxEditSku").value;
      try {
        await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku) + "/publish", { method: "POST", body: "{}" });
        showMsg("Published.");
        await loadCatalog();
        await openEdit(sku);
      } catch (e) { showErr(e); }
    };

    document.getElementById("cxArchiveBtn").onclick = async function () {
      var sku = document.getElementById("cxEditSku").value;
      try {
        await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku) + "/archive", { method: "POST", body: "{}" });
        showMsg("Archived.");
        await loadCatalog();
        await openEdit(sku);
      } catch (e) { showErr(e); }
    };

    document.getElementById("cxGrantBtn").onclick = async function () {
      var sku = document.getElementById("cxEditSku").value;
      var wallet = document.getElementById("cxGrantWallet").value;
      try {
        await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku) + "/grant", {
          method: "POST",
          body: JSON.stringify({ wallet: wallet }),
        });
        showMsg("Granted.");
        await openEdit(sku);
      } catch (e) { showErr(e); }
    };

    var previewWallet = previewWalletAddress();
    if (previewWallet) {
      document.getElementById("cxPreviewWallet").value = previewWallet;
    }
    document.getElementById("cxPreviewWallet").addEventListener("input", function () {
      void refreshCatalogPreview();
    });

    async function load() {
      if (!readAuthToken()) {
        showAuthGate("Sign in with your admin wallet to manage cosmetics.");
        return;
      }
      try {
        await loadPresets();
        await loadCatalog();
        await refreshCatalogPreview();
      } catch (e) {
        if (e && e.message === "not_signed_in") {
          showAuthGate("Sign in with your admin wallet to manage cosmetics.");
          return;
        }
        if (e && e.status === 403) {
          showAuthGate("This wallet is not authorized for cosmetic admin.");
          return;
        }
        showErr(e);
      }
    }
    load();
  })();
  </script>
</body>
</html>`;
}
