import type { Game } from "../game/Game.js";
import { apiUrl } from "../net/apiBase.js";
import { ROOM_ID } from "../game/constants.js";

const ENABLED = import.meta.env.VITE_ADMIN_ENABLED === "true";

type TabId = "layout" | "fog" | "camera";

export function installAdminOverlay(
  hudRoot: HTMLElement,
  game: Game,
  opts: { roomId: string }
): { destroy: () => void } {
  if (!ENABLED) {
    return { destroy: () => {} };
  }

  const frame = hudRoot.querySelector(".game-frame");
  if (!frame) {
    return { destroy: () => {} };
  }

  const wrap = document.createElement("div");
  wrap.className = "admin-overlay-wrap";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "admin-overlay-toggle";
  toggle.textContent = "Admin";
  toggle.title = "Toggle admin tools (also `)";

  const panel = document.createElement("div");
  panel.className = "admin-overlay-panel";
  panel.hidden = true;

  panel.innerHTML = `
    <div class="admin-overlay-title">Admin</div>
    <div class="admin-overlay-tabs" role="tablist">
      <button type="button" class="admin-overlay-tab admin-overlay-tab--active" data-tab="layout" role="tab" aria-selected="true">Layout</button>
      <button type="button" class="admin-overlay-tab" data-tab="fog" role="tab" aria-selected="false">Fog</button>
      <button type="button" class="admin-overlay-tab" data-tab="camera" role="tab" aria-selected="false">Camera</button>
    </div>
    <div class="admin-overlay-tab-panel" data-panel="layout">
      <p class="admin-overlay-hint">Random extra floor tiles (500×500 world). No auth required.</p>
      <label class="admin-overlay-field"><span>Room ID</span>
        <input type="text" class="admin-overlay-input" id="admin-room" />
      </label>
      <label class="admin-overlay-field"><span>Extra tiles to add</span>
        <input type="number" class="admin-overlay-input" id="admin-count" min="1" max="5000" value="400" />
      </label>
      <label class="admin-overlay-field"><span>Seed</span>
        <input type="number" class="admin-overlay-input" id="admin-seed" value="0" />
      </label>
      <label class="admin-overlay-field admin-overlay-check"><input type="checkbox" id="admin-clear" />
        <span>Clear existing extra floor first</span>
      </label>
      <button type="button" class="admin-overlay-btn" id="admin-random">Random layout</button>
    </div>
    <div class="admin-overlay-tab-panel" data-panel="fog" hidden>
      <p class="admin-overlay-hint">Fog uses horizontal distance on the ground from your avatar. Disabled = render like before fog of war.</p>
      <label class="admin-overlay-field admin-overlay-check"><input type="checkbox" id="fog-enabled" />
        <span>Enable fog of war</span>
      </label>
      <label class="admin-overlay-field"><span>Inner radius (full clarity, world units)</span>
        <input type="number" class="admin-overlay-input" id="fog-inner" min="0" max="400" step="0.5" />
      </label>
      <label class="admin-overlay-field"><span>Outer radius (full fog edge)</span>
        <input type="number" class="admin-overlay-input" id="fog-outer" min="0.5" max="400" step="0.5" />
      </label>
      <button type="button" class="admin-overlay-btn admin-overlay-btn-secondary" id="fog-apply">Apply fog</button>
    </div>
    <div class="admin-overlay-tab-panel" data-panel="camera" hidden>
      <p class="admin-overlay-hint">Scroll wheel zoom is clamped to min/max frustum.</p>
      <label class="admin-overlay-field"><span>Min frustum</span>
        <input type="number" class="admin-overlay-input" id="admin-zmin" min="1" step="0.5" />
      </label>
      <label class="admin-overlay-field"><span>Max frustum</span>
        <input type="number" class="admin-overlay-input" id="admin-zmax" min="1" step="0.5" />
      </label>
      <button type="button" class="admin-overlay-btn admin-overlay-btn-secondary" id="admin-zoom-apply">Apply zoom limits</button>
    </div>
    <div class="admin-overlay-status" id="admin-status"></div>
  `;

  wrap.appendChild(toggle);
  wrap.appendChild(panel);
  frame.appendChild(wrap);

  const $ = <T extends HTMLElement>(id: string): T => panel.querySelector(`#${id}`) as T;

  const roomInput = $("admin-room") as HTMLInputElement;
  roomInput.value = opts.roomId;

  const zmin = $("admin-zmin") as HTMLInputElement;
  const zmax = $("admin-zmax") as HTMLInputElement;
  const fogEnabled = $("fog-enabled") as HTMLInputElement;
  const fogInner = $("fog-inner") as HTMLInputElement;
  const fogOuter = $("fog-outer") as HTMLInputElement;
  const statusEl = $("admin-status") as HTMLDivElement;

  const tabButtons = panel.querySelectorAll<HTMLButtonElement>(".admin-overlay-tab");
  const tabPanels = panel.querySelectorAll<HTMLElement>(".admin-overlay-tab-panel");

  const setTab = (id: TabId): void => {
    tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === id;
      btn.classList.toggle("admin-overlay-tab--active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    tabPanels.forEach((p) => {
      p.hidden = p.dataset.panel !== id;
    });
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tab as TabId | undefined;
      if (id) setTab(id);
    });
  });

  const syncZoomFields = (): void => {
    const b = game.getZoomBounds();
    zmin.value = String(b.min);
    zmax.value = String(b.max);
  };

  const syncFogFields = (): void => {
    fogEnabled.checked = game.getFogOfWarEnabled();
    const r = game.getFogOfWarRadii();
    fogInner.value = String(r.inner);
    fogOuter.value = String(r.outer);
  };

  const setStatus = (s: string, err = false): void => {
    statusEl.textContent = s;
    statusEl.classList.toggle("admin-overlay-status--err", err);
  };

  const openPanel = (): void => {
    syncZoomFields();
    syncFogFields();
    setTab("layout");
    setStatus(`Frustum: ${game.getZoomFrustumSize().toFixed(1)} · Fog: ${game.getFogOfWarEnabled() ? "on" : "off"}`);
  };

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) openPanel();
  });

  $("admin-zoom-apply").addEventListener("click", () => {
    const lo = Number(zmin.value);
    const hi = Number(zmax.value);
    game.setZoomBounds(lo, hi);
    syncZoomFields();
    setStatus(`Zoom limits applied. Frustum: ${game.getZoomFrustumSize().toFixed(1)}`);
  });

  $("fog-apply").addEventListener("click", () => {
    game.setFogOfWarEnabled(fogEnabled.checked);
    const inner = Number(fogInner.value);
    const outer = Number(fogOuter.value);
    game.setFogOfWarRadii(inner, outer);
    syncFogFields();
    const r = game.getFogOfWarRadii();
    setStatus(
      `Fog ${game.getFogOfWarEnabled() ? "on" : "off"} · inner ${r.inner.toFixed(1)} · outer ${r.outer.toFixed(1)}`
    );
  });

  $("admin-random").addEventListener("click", async () => {
    const roomId = roomInput.value.trim() || opts.roomId;
    const targetCount = Number(($("admin-count") as HTMLInputElement).value);
    const seed = Number(($("admin-seed") as HTMLInputElement).value);
    const clearExisting = ($("admin-clear") as HTMLInputElement).checked;
    setStatus("Requesting…");
    try {
      const r = await fetch(apiUrl("/api/admin/random-layout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          targetCount,
          seed,
          clearExisting,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setStatus(String(data.error ?? r.statusText), true);
        return;
      }
      setStatus(
        `Placed ${String(data.placed)} tiles (${String(data.totalExtra)} extra total).`
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "request_failed", true);
    }
  });

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== "`" || e.repeat) return;
    const t = document.activeElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) openPanel();
  };
  window.addEventListener("keydown", onKey);

  return {
    destroy() {
      window.removeEventListener("keydown", onKey);
      wrap.remove();
    },
  };
}
