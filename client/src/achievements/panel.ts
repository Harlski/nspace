import { fetchMyAchievements, type AchievementProgress, type AchievementUnlockMessage } from "./api.js";
import { hydratePresetSwatches, presetSwatchMarkup } from "../cosmetics/presetSwatch.js";
import {
  SUMMARY_VIEW_ID,
  achievementsForCategory,
  orderedCategories,
  overallProgress,
  progressPercent,
  recentCompletedAchievements,
  type AchievementViewId,
  viewTitle,
  categoryProgress,
  isAchievementVisibleInView,
  syncDerivedAchievementProgress,
  navRows,
  type AchievementNavRow,
} from "./panelData.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function formatCompletedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderIconHtml(a: AchievementProgress): string {
  const parts: string[] = ['<div class="achievement-panel__icon">'];
  if (a.rewardPresetId) {
    parts.push(
      presetSwatchMarkup(a.rewardPresetId, "trail", "achievement-panel__reward-swatch")
    );
  }
  if (a.completed) {
    parts.push(
      '<span class="achievement-panel__glyph achievement-panel__glyph--done" aria-hidden="true">✓</span>'
    );
  } else {
    parts.push(
      '<span class="achievement-panel__glyph achievement-panel__glyph--pending" aria-hidden="true"></span>'
    );
  }
  parts.push("</div>");
  return parts.join("");
}

function renderAchievementRow(
  a: AchievementProgress,
  opts?: { showDate?: boolean; clickable?: boolean }
): string {
  const pct =
    a.threshold > 0
      ? Math.min(100, Math.round((a.progress / a.threshold) * 100))
      : a.completed
        ? 100
        : 0;
  const reward =
    a.rewardDisplayName != null
      ? `<span class="achievement-panel__reward">Unlocks: ${esc(a.rewardDisplayName)}</span>`
      : "";
  const status = a.completed
    ? `<span class="achievement-panel__status achievement-panel__status--done">Complete</span>`
    : `<span class="achievement-panel__status">${a.progress} / ${a.threshold}</span>`;
  const date =
    opts?.showDate && a.completedAt
      ? `<span class="achievement-panel__date">${esc(formatCompletedDate(a.completedAt))}</span>`
      : "";
  const tag = opts?.clickable ? "button" : "div";
  const typeAttr = opts?.clickable ? ' type="button"' : "";
  const dataAttr = ` data-achievement-id="${esc(a.achievementId)}"${
    opts?.clickable ? ` data-achievement-category="${esc(a.category)}"` : ""
  }`;
  const rowClass = `achievement-panel__row${a.completed ? " achievement-panel__row--done" : ""}${opts?.clickable ? " achievement-panel__row--clickable" : ""}`;
  const inner = `<${tag} class="${rowClass}"${typeAttr}${dataAttr}>
    ${renderIconHtml(a)}
    <div class="achievement-panel__row-body">
      <div class="achievement-panel__row-head">
        <span class="achievement-panel__title">${esc(a.title)}</span>
        ${date}
      </div>
      <p class="achievement-panel__desc">${esc(a.description)}</p>
      ${reward}
      <div class="achievement-panel__progress" aria-hidden="true"><div class="achievement-panel__progress-fill" style="width:${pct}%"></div></div>
      ${status}
    </div>
    <span class="achievement-panel__points">${a.points} AP</span>
  </${tag}>`;
  return opts?.clickable ? `<li class="achievement-panel__list-item">${inner}</li>` : `<li class="achievement-panel__list-item">${inner}</li>`;
}

function renderProgressBar(earned: number, total: number): string {
  const pct = progressPercent(earned, total);
  return `<div class="achievement-panel__progress" role="presentation"><div class="achievement-panel__progress-fill" style="width:${pct}%"></div></div>`;
}

export type AchievementPanel = {
  root: HTMLElement;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  /** Merge a server unlock into the open panel and highlight the matching row. */
  applyUnlock: (unlock: AchievementUnlockMessage) => void;
};

export function createAchievementPanel(parent: HTMLElement): AchievementPanel {
  const root = document.createElement("div");
  root.className = "achievement-panel";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <button type="button" class="achievement-panel__backdrop" aria-label="Close achievements"></button>
    <div class="achievement-panel__dialog" role="dialog" aria-modal="true" aria-labelledby="achievement-panel-title">
      <button type="button" class="achievement-panel__close" aria-label="Close">×</button>
      <header class="achievement-panel__header">
        <div class="achievement-panel__header-main">
          <h2 id="achievement-panel-title" class="achievement-panel__title-main">Achievements</h2>
          <p class="achievement-panel__points-total" id="achievementPanelPointsTotal"></p>
        </div>
      </header>
      <div class="achievement-panel__layout">
        <nav class="achievement-panel__nav achievement-panel__nav--sidebar" aria-label="Achievement categories">
          <ul class="achievement-panel__nav-list" id="achievementPanelNavSidebar"></ul>
        </nav>
        <div class="achievement-panel__content" id="achievementPanelContent"></div>
      </div>
      <div class="achievement-panel__dropup">
        <button type="button" class="achievement-panel__dropup-trigger" id="achievementPanelDropupTrigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="achievementPanelDropupMenu"></button>
        <div class="achievement-panel__dropup-menu" id="achievementPanelDropupMenu" role="listbox" hidden></div>
      </div>
    </div>
  `;
  parent.appendChild(root);

  const backdrop = root.querySelector(
    ".achievement-panel__backdrop"
  ) as HTMLButtonElement;
  const closeBtn = root.querySelector(
    ".achievement-panel__close"
  ) as HTMLButtonElement;
  const contentEl = root.querySelector(
    "#achievementPanelContent"
  ) as HTMLElement;
  const pointsEl = root.querySelector(
    "#achievementPanelPointsTotal"
  ) as HTMLElement;
  const navSidebar = root.querySelector(
    "#achievementPanelNavSidebar"
  ) as HTMLUListElement;
  const dropupTrigger = root.querySelector(
    "#achievementPanelDropupTrigger"
  ) as HTMLButtonElement;
  const dropupMenu = root.querySelector(
    "#achievementPanelDropupMenu"
  ) as HTMLElement;

  let openState = false;
  let loadGen = 0;
  let refreshGen = 0;
  let achievements: AchievementProgress[] = [];
  let viewId: AchievementViewId = SUMMARY_VIEW_ID;
  let dropupOpen = false;
  /** Unlocks waiting for a glow until their row appears in the active view. */
  const pendingUnlockHighlights = new Set<string>();

  const sheetMql = window.matchMedia("(max-width: 560px)");
  const applySheetMode = (): void => {
    const sheet =
      sheetMql.matches ||
      document.documentElement.classList.contains("nspace-mobile-play-host");
    root.classList.toggle("achievement-panel--sheet", sheet);
  };
  applySheetMode();
  sheetMql.addEventListener("change", applySheetMode);

  function setDropupOpen(next: boolean): void {
    dropupOpen = next;
    dropupMenu.hidden = !next;
    dropupTrigger.setAttribute("aria-expanded", next ? "true" : "false");
    root.classList.toggle("achievement-panel--dropup-open", next);
  }

  function isAchievementVisibleInCurrentView(achievementId: string): boolean {
    return isAchievementVisibleInView(achievements, viewId, achievementId);
  }

  function highlightUnlockedRow(achievementId: string): boolean {
    const row = contentEl.querySelector<HTMLElement>(
      `[data-achievement-id="${CSS.escape(achievementId)}"]`
    );
    if (!row) return false;
    requestAnimationFrame(() => {
      row.classList.remove("achievement-panel__row--just-unlocked");
      // Force reflow so repeated unlocks retrigger the animation.
      void row.offsetWidth;
      row.classList.add("achievement-panel__row--just-unlocked");
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      row.addEventListener(
        "animationend",
        () => {
          row.classList.remove("achievement-panel__row--just-unlocked");
        },
        { once: true }
      );
    });
    return true;
  }

  function flushPendingUnlockHighlights(): void {
    for (const id of [...pendingUnlockHighlights]) {
      if (!isAchievementVisibleInCurrentView(id)) continue;
      if (highlightUnlockedRow(id)) {
        pendingUnlockHighlights.delete(id);
      }
    }
  }

  function selectView(next: AchievementViewId): void {
    viewId = next;
    setDropupOpen(false);
    render();
  }

  function renderSummary(): string {
    const recent = recentCompletedAchievements(achievements);
    const overall = overallProgress(achievements);
    const recentHtml =
      recent.length > 0
        ? `<ul class="achievement-panel__list achievement-panel__list--recent">${recent
            .map((a) =>
              renderAchievementRow(a, { showDate: true, clickable: true })
            )
            .join("")}</ul>`
        : `<p class="achievement-panel__empty">Complete achievements to see them here.</p>`;
    const categoryBars = orderedCategories(achievements)
      .map((cat) => {
        const p = categoryProgress(achievements, cat);
        return `<li class="achievement-panel__overview-cat">
          <button type="button" class="achievement-panel__overview-cat-btn" data-achievement-view="${esc(cat)}">
            <span class="achievement-panel__overview-cat-label">${esc(viewTitle(cat))}</span>
            <span class="achievement-panel__overview-cat-count">${p.earned} / ${p.total}</span>
            ${renderProgressBar(p.earned, p.total)}
          </button>
        </li>`;
      })
      .join("");
    return `<div class="achievement-panel__view achievement-panel__view--summary">
      <section class="achievement-panel__section">
        <h3 class="achievement-panel__section-title">Recent achievements</h3>
        ${recentHtml}
      </section>
      <section class="achievement-panel__section">
        <h3 class="achievement-panel__section-title">Progress overview</h3>
        <div class="achievement-panel__overview-total">
          <div class="achievement-panel__overview-total-head">
            <span>Achievements earned</span>
            <span>${overall.earned} / ${overall.total}</span>
          </div>
          ${renderProgressBar(overall.earned, overall.total)}
        </div>
        <ul class="achievement-panel__overview-cats">${categoryBars}</ul>
      </section>
    </div>`;
  }

  function renderCategory(category: string): string {
    const rows = achievementsForCategory(achievements, category);
    return `<div class="achievement-panel__view achievement-panel__view--category">
      <h3 class="achievement-panel__view-heading">${esc(viewTitle(category))}</h3>
      <ul class="achievement-panel__list">${rows.map((a) => renderAchievementRow(a)).join("")}</ul>
    </div>`;
  }

  function renderNavRow(row: AchievementNavRow): string {
    if (row.kind === "group-header") {
      return `<li class="achievement-panel__nav-group"><span class="achievement-panel__nav-group-label">${esc(row.label)}</span></li>`;
    }
    const active = row.id === viewId;
    const nested = row.nested ? " achievement-panel__nav-btn--nested" : "";
    return `<li><button type="button" class="achievement-panel__nav-btn${nested}${active ? " is-active" : ""}" data-achievement-view="${esc(row.id)}" role="option" aria-selected="${active}">
      <span class="achievement-panel__nav-label">${esc(row.label)}</span>
      <span class="achievement-panel__nav-count">${row.earned} / ${row.total}</span>
    </button></li>`;
  }

  function render(): void {
    const rows = navRows(achievements);
    navSidebar.innerHTML = rows.map(renderNavRow).join("");
    dropupTrigger.textContent = viewTitle(viewId);
    dropupMenu.innerHTML = rows.map(renderNavRow).join("");
    contentEl.innerHTML =
      viewId === SUMMARY_VIEW_ID
        ? renderSummary()
        : renderCategory(viewId);
    hydratePresetSwatches(contentEl);
    flushPendingUnlockHighlights();
  }

  function bindContentEvents(): void {
    contentEl.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const viewBtn = t.closest<HTMLElement>("[data-achievement-view]");
      if (viewBtn?.dataset.achievementView) {
        selectView(viewBtn.dataset.achievementView);
        return;
      }
      const catBtn = t.closest<HTMLElement>("[data-achievement-category]");
      if (catBtn?.dataset.achievementCategory) {
        selectView(catBtn.dataset.achievementCategory);
      }
    });
  }

  function bindNavEvents(): void {
    const onNavClick = (e: Event): void => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const btn = t.closest<HTMLButtonElement>("[data-achievement-view]");
      if (!btn?.dataset.achievementView) return;
      selectView(btn.dataset.achievementView);
    };
    navSidebar.addEventListener("click", onNavClick);
    dropupMenu.addEventListener("click", onNavClick);
  }

  bindContentEvents();
  bindNavEvents();

  dropupTrigger.addEventListener("click", () => {
    setDropupOpen(!dropupOpen);
  });

  backdrop.addEventListener("click", () => {
    if (dropupOpen) {
      setDropupOpen(false);
      return;
    }
    close();
  });

  function mergeUnlockOptimistic(unlock: AchievementUnlockMessage): void {
    pointsEl.textContent = `${unlock.totalPoints.toLocaleString()} achievement points`;
    const idx = achievements.findIndex(
      (a) => a.achievementId === unlock.achievementId
    );
    if (idx >= 0) {
      const prev = achievements[idx]!;
      achievements[idx] = {
        ...prev,
        title: unlock.title,
        description: unlock.description,
        points: unlock.points,
        completed: true,
        completedAt: new Date().toISOString(),
        progress: prev.threshold,
        rewardDisplayName:
          unlock.rewardDisplayName ?? prev.rewardDisplayName,
      };
    }
    achievements = syncDerivedAchievementProgress(achievements);
  }

  async function refreshAchievementsWhileOpen(): Promise<void> {
    if (!openState) return;
    const gen = ++refreshGen;
    const payload = await fetchMyAchievements({ force: true });
    if (!openState || gen !== refreshGen) return;
    if (!payload) return;
    achievements = payload.achievements;
    pointsEl.textContent = `${payload.totalPoints.toLocaleString()} achievement points`;
    render();
  }

  function applyUnlock(unlock: AchievementUnlockMessage): void {
    pendingUnlockHighlights.add(unlock.achievementId);
    if (!openState) return;
    mergeUnlockOptimistic(unlock);
    render();
    void refreshAchievementsWhileOpen();
  }

  function close(): void {
    openState = false;
    setDropupOpen(false);
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
  }

  async function open(): Promise<void> {
    openState = true;
    viewId = SUMMARY_VIEW_ID;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    applySheetMode();
    contentEl.innerHTML =
      '<p class="achievement-panel__loading">Loading achievements…</p>';
    pointsEl.textContent = "";
    navSidebar.replaceChildren();
    dropupMenu.replaceChildren();
    const gen = ++loadGen;
    const payload = await fetchMyAchievements();
    if (!openState || gen !== loadGen) return;
    if (!payload) {
      contentEl.innerHTML =
        '<p class="achievement-panel__error">Could not load achievements.</p>';
      return;
    }
    achievements = payload.achievements;
    pointsEl.textContent = `${payload.totalPoints.toLocaleString()} achievement points`;
    render();
    closeBtn.focus({ preventScroll: true });
  }

  closeBtn.addEventListener("click", close);
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (dropupOpen) {
        e.preventDefault();
        setDropupOpen(false);
        return;
      }
      close();
    }
  });

  return {
    root,
    close,
    isOpen: () => openState,
    applyUnlock,
    open: () => {
      void open();
    },
  };
}
