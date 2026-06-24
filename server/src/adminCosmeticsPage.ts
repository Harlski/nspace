import {
  analyticsFontLinkTags,
  analyticsPageRootCss,
  analyticsTopbarCss,
  analyticsTopbarHtml,
} from "./analyticsTopbar.js";
import { mainSiteFaviconLinkTag, mainSiteShellCss } from "./mainSiteShell.js";

/** HTML shell for `/admin/cosmetics` — catalog CRUD, changelog, grants, preview. */
export function adminCosmeticsPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Cosmetics — Admin — Nimiq Space</title>
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
  </style>
</head>
<body>
  ${analyticsTopbarHtml("campaign")}
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
          <p style="font-size:0.78rem;color:#7b8da8;">Preview renders in-game on the identicon for the wallet above (client VFX).</p>
        </section>
        <section class="cx-panel" id="cxChangelogPanel" hidden>
          <h2>Changelog</h2>
          <ul class="cx-log" id="cxChangelog"></ul>
        </section>
      </div>
    </div>
  </main>
  <script type="module">
    const token = localStorage.getItem("nspace_session");
    if (!token) { location.href = "/admin"; }
    async function api(path, opts = {}) {
      const r = await fetch(path, {
        ...opts,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + token,
          ...(opts.headers || {}),
        },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      return j;
    }
    const errEl = document.getElementById("cxErr");
    const msgEl = document.getElementById("cxMsg");
    function showErr(e) { errEl.hidden = false; errEl.textContent = String(e.message || e); msgEl.hidden = true; }
    function showMsg(t) { msgEl.hidden = false; msgEl.textContent = t; errEl.hidden = true; }

    let presets = [];
    let catalog = [];

    function nimFromLuna(luna) {
      return (Number(BigInt(luna)) / 100000).toFixed(5).replace(/\\.?0+$/, "");
    }
    function lunaFromNim(nim) {
      const parts = String(nim).split(".");
      const whole = BigInt(parts[0] || "0");
      let frac = 0n;
      if (parts[1]) {
        const f = (parts[1] + "00000").slice(0, 5);
        frac = BigInt(f);
      }
      return (whole * 100000n + frac).toString();
    }

    async function loadPresets() {
      const j = await api("/api/admin/cosmetics/presets");
      presets = j.presets || [];
      const sel = document.getElementById("cxNewPreset");
      sel.replaceChildren(...presets.map(p => {
        const o = document.createElement("option");
        o.value = p.presetId;
        o.textContent = p.label + " (" + p.slot + ")";
        return o;
      }));
    }

    function renderList() {
      const tbody = document.querySelector("#cxList tbody");
      tbody.replaceChildren(...catalog.map(e => {
        const tr = document.createElement("tr");
        const badge = e.status === "published" ? "cx-badge--published" : e.status === "archived" ? "cx-badge--archived" : "";
        tr.innerHTML = "<td class=mono>" + e.cosmeticSku + "</td><td>" + e.displayName + "</td><td>" + e.slot + "</td><td><span class=cx-badge " + badge + ">" + e.status + "</span></td><td></td>";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cx-btn";
        btn.textContent = "Edit";
        btn.onclick = () => openEdit(e.cosmeticSku);
        tr.lastElementChild.appendChild(btn);
        return tr;
      }));
    }

    async function loadCatalog() {
      const j = await api("/api/admin/cosmetics/catalog");
      catalog = j.entries || [];
      renderList();
    }

    async function openEdit(sku) {
      const j = await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku));
      const e = j.entry;
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
      const deploy = e.slot === "deployable";
      document.getElementById("cxDeployFields").hidden = !deploy;
      if (deploy) {
        document.getElementById("cxEditCooldown").value = e.cooldownSec ?? "";
        document.getElementById("cxEditDuration").value = e.durationSec ?? "";
        document.getElementById("cxEditRoomCap").value = e.roomCap ?? "";
        document.getElementById("cxEditRange").value = e.deployRange ?? "";
      }
      document.getElementById("cxPublishBtn").hidden = e.status !== "draft";
      document.getElementById("cxArchiveBtn").hidden = e.status !== "published";
      const log = document.getElementById("cxChangelog");
      log.replaceChildren(...(j.changelog || []).map(r => {
        const li = document.createElement("li");
        li.textContent = r.at + " · " + r.action + " · " + r.actorWallet.slice(0, 8) + "…";
        return li;
      }));
    }

    document.getElementById("cxCreateBtn").onclick = async () => {
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

    document.getElementById("cxSaveBtn").onclick = async () => {
      const sku = document.getElementById("cxEditSku").value;
      const body = {
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

    document.getElementById("cxPublishBtn").onclick = async () => {
      const sku = document.getElementById("cxEditSku").value;
      try {
        await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku) + "/publish", { method: "POST", body: "{}" });
        showMsg("Published.");
        await loadCatalog();
        await openEdit(sku);
      } catch (e) { showErr(e); }
    };

    document.getElementById("cxArchiveBtn").onclick = async () => {
      const sku = document.getElementById("cxEditSku").value;
      try {
        await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku) + "/archive", { method: "POST", body: "{}" });
        showMsg("Archived.");
        await loadCatalog();
        await openEdit(sku);
      } catch (e) { showErr(e); }
    };

    document.getElementById("cxGrantBtn").onclick = async () => {
      const sku = document.getElementById("cxEditSku").value;
      const wallet = document.getElementById("cxGrantWallet").value;
      try {
        await api("/api/admin/cosmetics/catalog/" + encodeURIComponent(sku) + "/grant", {
          method: "POST",
          body: JSON.stringify({ wallet }),
        });
        showMsg("Granted.");
        await openEdit(sku);
      } catch (e) { showErr(e); }
    };

    try {
      const sess = JSON.parse(atob(token.split(".")[1] || "") || "{}");
      if (sess.sub) document.getElementById("cxPreviewWallet").value = sess.sub;
    } catch { /* ignore */ }

    loadPresets().then(loadCatalog).catch(showErr);
  </script>
</body>
</html>`;
}
