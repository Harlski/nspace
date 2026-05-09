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

function defaultGlobalTierId(
  releases: { tiers: PatchnoteTier[] }[]
): (typeof PATCHNOTE_TIER_ORDER)[number] | null {
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

/** Display tag for a semver folder name (matches former `<summary>` styling). */
function versionTag(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

function versionTriggerLabel(version: string, isLatest: boolean): string {
  const tag = versionTag(version);
  return isLatest ? `LATEST NOTES ${tag}` : `NOTES ${tag}`;
}

function initialVisibleTierForRelease(
  rel: { tiers: PatchnoteTier[] },
  preferred: (typeof PATCHNOTE_TIER_ORDER)[number]
): (typeof PATCHNOTE_TIER_ORDER)[number] {
  const ids = new Set(rel.tiers.map((t) => t.tierId));
  if (ids.has(preferred)) return preferred;
  for (const id of PATCHNOTE_TIER_ORDER) {
    if (ids.has(id)) return id;
  }
  return rel.tiers[0]!.tierId;
}

function applyVisibleRelease(root: HTMLElement, versionIdx: number): void {
  for (const panel of root.querySelectorAll(".patchnotes-page__rel-panel")) {
    const idx = Number((panel as HTMLElement).dataset.versionIdx);
    if (Number.isNaN(idx)) continue;
    (panel as HTMLElement).hidden = idx !== versionIdx;
  }
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
 * Full-screen patch notes: same shell as the main menu card; version and audience tier are
 * custom dropdowns; one release body visible at a time (newest by default).
 */
export function mountPatchnotesPage(app: HTMLElement): () => void {
  app.innerHTML = "";

  const releases = PATCHNOTE_RELEASES;
  const globalTierDefault = defaultGlobalTierId(releases);
  const tierIdsInAny = new Set<string>();
  for (const r of releases) for (const t of r.tiers) tierIdsInAny.add(t.tierId);
  const globalTierOptions = PATCHNOTE_TIER_ORDER.filter((id) => tierIdsInAny.has(id));

  const clientMetaHtml = `<p class="patchnotes-page__meta patchnotes-page__meta--center">
      Client ${escapeAttr(APP_DISPLAY_VERSION)}
    </p>`;

  const versionPickerHtml =
    releases.length === 0
      ? ""
      : `<div class="patchnotes-page__tier-pop">
            <button
              type="button"
              class="patchnotes-page__tier-trigger"
              id="patchnotes-version-trigger"
              aria-expanded="false"
              aria-haspopup="listbox"
              aria-label="Patch notes version"
            >${escapeAttr(versionTriggerLabel(releases[0]!.version, true))}</button>
            <ul class="patchnotes-page__tier-menu" id="patchnotes-version-menu" role="listbox" hidden>
              ${releases
                .map(
                  (rel, idx) => `
              <li role="option" tabindex="-1" class="patchnotes-page__tier-option" data-version-idx="${String(idx)}">${escapeAttr(
                    versionTag(rel.version)
                  )}</li>`
                )
                .join("")}
            </ul>
          </div>`;

  const tierPickerHtml =
    releases.length === 0 || !globalTierDefault
      ? ""
      : `<div class="patchnotes-page__tier-pop">
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
          </div>`;

  const controlsRowHtml =
    releases.length === 0 || !globalTierDefault
      ? versionPickerHtml
        ? `<div class="patchnotes-page__tier-row">${versionPickerHtml}</div>`
        : ""
      : `<div class="patchnotes-page__tier-row">${versionPickerHtml}${tierPickerHtml}</div>`;

  const rows =
    releases.length === 0
      ? `<p class="patchnotes-page__empty">No published patch notes in this build yet.</p>`
      : releases
          .map((rel, idx) => {
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
            <div class="patchnotes-page__rel-panel" data-version-idx="${String(idx)}"${idx === 0 ? "" : " hidden"}>
              <div class="patchnotes-page__body">
                <div class="patchnotes-page__tier-view">${panels}</div>
              </div>
            </div>`;
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
            ${controlsRowHtml}
          </header>
          <div class="patchnotes-page__list">${rows}</div>
        </div>
      </div>
    </div>
  `;
  app.appendChild(root);

  if (globalTierDefault) applyGlobalTier(root, globalTierDefault);

  const tierTrigger = root.querySelector("#patchnotes-tier-trigger") as HTMLButtonElement | null;
  const tierMenu = root.querySelector("#patchnotes-tier-menu") as HTMLUListElement | null;
  const versionTrigger = root.querySelector("#patchnotes-version-trigger") as HTMLButtonElement | null;
  const versionMenu = root.querySelector("#patchnotes-version-menu") as HTMLUListElement | null;
  const pops = [...root.querySelectorAll(".patchnotes-page__tier-pop")] as HTMLElement[];

  let tierMenuOpen = false;
  let versionMenuOpen = false;

  const closeTierMenu = (): void => {
    if (!tierMenuOpen) return;
    tierMenuOpen = false;
    if (tierMenu) tierMenu.hidden = true;
    tierTrigger?.setAttribute("aria-expanded", "false");
  };

  const openTierMenu = (): void => {
    tierMenuOpen = true;
    if (tierMenu) tierMenu.hidden = false;
    tierTrigger?.setAttribute("aria-expanded", "true");
  };

  const closeVersionMenu = (): void => {
    if (!versionMenuOpen) return;
    versionMenuOpen = false;
    if (versionMenu) versionMenu.hidden = true;
    versionTrigger?.setAttribute("aria-expanded", "false");
  };

  const openVersionMenu = (): void => {
    versionMenuOpen = true;
    if (versionMenu) versionMenu.hidden = false;
    versionTrigger?.setAttribute("aria-expanded", "true");
  };

  const closeAllMenus = (): void => {
    closeTierMenu();
    closeVersionMenu();
  };

  const onDocMouseDown = (ev: MouseEvent): void => {
    if (!tierMenuOpen && !versionMenuOpen) return;
    const t = ev.target as Node;
    for (const p of pops) {
      if (p.contains(t)) return;
    }
    closeAllMenus();
  };

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") closeAllMenus();
  };

  if (versionTrigger && versionMenu && releases.length > 0) {
    versionTrigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeTierMenu();
      if (versionMenuOpen) closeVersionMenu();
      else openVersionMenu();
    });

    versionMenu.addEventListener("click", (ev) => {
      const opt = (ev.target as HTMLElement).closest(
        ".patchnotes-page__tier-option"
      ) as HTMLElement | null;
      if (!opt || opt.dataset.versionIdx === undefined) return;
      const idx = Number(opt.dataset.versionIdx);
      if (Number.isNaN(idx) || idx < 0 || idx >= releases.length) return;
      const rel = releases[idx]!;
      versionTrigger.textContent = versionTriggerLabel(rel.version, idx === 0);
      applyVisibleRelease(root, idx);
      closeVersionMenu();
    });
  }

  if (tierTrigger && tierMenu && globalTierDefault) {
    tierTrigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeVersionMenu();
      if (tierMenuOpen) closeTierMenu();
      else openTierMenu();
    });

    tierMenu.addEventListener("click", (ev) => {
      const opt = (ev.target as HTMLElement).closest(
        ".patchnotes-page__tier-option"
      ) as HTMLElement | null;
      if (!opt || opt.dataset.tierId === undefined) return;
      const id = opt.dataset.tierId;
      tierTrigger.textContent = tierLabel(id);
      applyGlobalTier(root, id);
      closeTierMenu();
    });
  }

  if (pops.length > 0) {
    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  return () => {
    document.removeEventListener("mousedown", onDocMouseDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    app.innerHTML = "";
  };
}
