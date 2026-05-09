import { APP_DISPLAY_VERSION } from "../appVersion.js";
import {
  PATCHNOTE_TIER_LABEL,
  PATCHNOTE_TIER_ORDER,
  type PatchnoteTier,
} from "./collectPatchnotes.js";
import { PATCHNOTE_RELEASES } from "./patchnoteData.js";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function defaultGlobalTierId(releases: { tiers: PatchnoteTier[] }[]): string | null {
  if (releases.length === 0) return null;
  const union = new Set<string>();
  for (const r of releases) for (const t of r.tiers) union.add(t.tierId);
  for (const id of PATCHNOTE_TIER_ORDER) {
    if (union.has(id)) return id;
  }
  return null;
}

function tierLabel(id: string): string {
  return (PATCHNOTE_TIER_LABEL as Record<string, string>)[id] ?? id;
}

function initialVisibleTierForRelease(rel: { tiers: PatchnoteTier[] }, preferred: string): string {
  const ids = new Set(rel.tiers.map((t) => t.tierId));
  if (ids.has(preferred)) return preferred;
  for (const id of PATCHNOTE_TIER_ORDER) {
    if (ids.has(id)) return id;
  }
  return rel.tiers[0]!.tierId;
}

function applyGlobalTier(root: HTMLElement, preferredId: string): void {
  for (const body of root.querySelectorAll(".patchnotes-page__body")) {
    const panels = [...body.querySelectorAll(".patchnotes-page__tier-panel")] as HTMLElement[];
    if (panels.length === 0) continue;
    const byId = new Map<string, HTMLElement>();
    for (const p of panels) {
      const id = p.dataset.tierId;
      if (id) byId.set(id, p);
    }
    let chosen = byId.get(preferredId) ?? null;
    if (!chosen) {
      for (const id of PATCHNOTE_TIER_ORDER) {
        const p = byId.get(id);
        if (p) {
          chosen = p;
          break;
        }
      }
    }
    if (!chosen) continue;
    for (const p of panels) p.hidden = p !== chosen;
  }
}

/**
 * Full-screen patch notes: same shell as the main menu card, slim `<details>` per release.
 * Newest release is expanded by default.
 */
export function mountPatchnotesPage(app: HTMLElement): () => void {
  app.innerHTML = "";

  const releases = PATCHNOTE_RELEASES;
  const latest = releases[0]?.version ?? "";
  const globalTierDefault = defaultGlobalTierId(releases);
  const tierIdsInAny = new Set<string>();
  for (const r of releases) for (const t of r.tiers) tierIdsInAny.add(t.tierId);
  const globalTierOptions = PATCHNOTE_TIER_ORDER.filter((id) => tierIdsInAny.has(id));

  const clientMetaHtml = `<p class="patchnotes-page__meta patchnotes-page__meta--center">
      Client ${escapeAttr(APP_DISPLAY_VERSION)}
      ${
        latest
          ? ` · latest notes <span class="patchnotes-page__meta-ver">${escapeAttr(latest)}</span>`
          : ""
      }
    </p>`;

  const tierRowHtml =
    releases.length === 0 || !globalTierDefault
      ? ""
      : `<div class="patchnotes-page__tier-row">
          <div class="patchnotes-page__tier-pop">
            <button
              type="button"
              class="patchnotes-page__tier-trigger"
              id="patchnotes-tier-trigger"
              aria-expanded="false"
              aria-haspopup="listbox"
              aria-label="Patch note level"
            >${escapeAttr(tierLabel(globalTierDefault))}</button>
            <ul class="patchnotes-page__tier-menu" id="patchnotes-tier-menu" role="listbox" hidden>
              ${globalTierOptions
                .map(
                  (id) => `
              <li role="option" tabindex="-1" class="patchnotes-page__tier-option" data-tier-id="${escapeAttr(id)}">${escapeAttr(
                    tierLabel(id)
                  )}</li>`
                )
                .join("")}
            </ul>
          </div>
        </div>`;

  const rows =
    releases.length === 0
      ? `<p class="patchnotes-page__empty">No published patch notes in this build yet.</p>`
      : releases
          .map((rel, idx) => {
            const open = idx === 0 ? " open" : "";
            const vLabel = rel.version.startsWith("v") ? rel.version : `v${rel.version}`;
            const visId = initialVisibleTierForRelease(rel, globalTierDefault!);
            const panels = rel.tiers
              .map(
                (t) => `
              <div class="patchnotes-page__tier-panel" data-tier-id="${escapeAttr(t.tierId)}"${
                  t.tierId === visId ? "" : " hidden"
                }>
                <div class="patchnotes-page__md">${t.html}</div>
              </div>`
              )
              .join("");
            return `
            <details class="patchnotes-page__rel"${open}>
              <summary class="patchnotes-page__sum"><span>${escapeAttr(vLabel)}</span></summary>
              <div class="patchnotes-page__body">
                <div class="patchnotes-page__tier-view">${panels}</div>
              </div>
            </details>`;
          })
          .join("");

  const root = document.createElement("div");
  root.className = "main-menu patchnotes-page";
  root.innerHTML = `
    <div class="main-menu__backdrop" aria-hidden="true"></div>
    <div class="main-menu__content">
      <div class="main-menu__card" role="presentation">
        <div class="main-menu__card-rim" aria-hidden="true"></div>
        <div class="main-menu__card-inner">
          <header class="main-menu__header patchnotes-page__header">
            <div class="patchnotes-page__topbar">
              <a class="patchnotes-page__back" href="/" aria-label="Home">←</a>
              <div class="patchnotes-page__title-wrap">
                <h1 class="main-menu__title patchnotes-page__title">
                  <span class="main-menu__title-nimiq">PATCH</span>
                  <span class="main-menu__title-space">NOTES</span>
                </h1>
              </div>
              <span class="patchnotes-page__topbar-balance" aria-hidden="true"></span>
            </div>
            ${clientMetaHtml}
            ${tierRowHtml}
          </header>
          <div class="patchnotes-page__list">${rows}</div>
        </div>
      </div>
    </div>
  `;
  app.appendChild(root);

  if (globalTierDefault) applyGlobalTier(root, globalTierDefault);

  const trigger = root.querySelector("#patchnotes-tier-trigger") as HTMLButtonElement | null;
  const menu = root.querySelector("#patchnotes-tier-menu") as HTMLUListElement | null;
  const pop = root.querySelector(".patchnotes-page__tier-pop") as HTMLElement | null;

  let menuOpen = false;
  const closeMenu = (): void => {
    if (!menuOpen) return;
    menuOpen = false;
    if (menu) menu.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
  };

  const openMenu = (): void => {
    menuOpen = true;
    if (menu) menu.hidden = false;
    trigger?.setAttribute("aria-expanded", "true");
  };

  const onDocMouseDown = (ev: MouseEvent): void => {
    if (!menuOpen || !pop) return;
    const t = ev.target as Node;
    if (pop.contains(t)) return;
    closeMenu();
  };

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") closeMenu();
  };

  if (trigger && menu && pop && globalTierDefault) {
    trigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (menuOpen) closeMenu();
      else openMenu();
    });

    menu.addEventListener("click", (ev) => {
      const opt = (ev.target as HTMLElement).closest(
        ".patchnotes-page__tier-option"
      ) as HTMLElement | null;
      if (!opt) return;
      const id = opt.dataset.tierId;
      if (!id) return;
      trigger.textContent = tierLabel(id);
      applyGlobalTier(root, id);
      closeMenu();
    });

    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  return () => {
    document.removeEventListener("mousedown", onDocMouseDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    app.innerHTML = "";
  };
}
