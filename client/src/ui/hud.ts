import {
  BLOCK_COLOR_COUNT,
  BLOCK_COLOR_PALETTE,
} from "../game/blockStyle.js";
import type { ObstacleProps } from "../net/ws.js";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../game/constants.js";
import { loadRecentColorIds, pushRecentColorId } from "./recentColors.js";

function cssHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function makeColorSwatchButton(id: number): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "block-color-swatch";
  b.dataset.colorId = String(id);
  b.style.background = cssHex(BLOCK_COLOR_PALETTE[id]!);
  b.title = `Color ${id + 1}`;
  return b;
}

export type BuildBlockBarState = {
  visible: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
};

export function createHud(
  root: HTMLElement,
  opts?: { showDebug?: boolean }
): {
  setStatus: (s: string) => void;
  appendChat: (from: string, text: string) => void;
  getChatInput: () => HTMLInputElement;
  onFullscreenToggle: (fn: () => void) => void;
  setReturnToHubVisible: (visible: boolean) => void;
  onReturnToHub: (fn: () => void) => void;
  onReturnToLobby: (fn: () => void) => void;
  /** Walk = move; Build = place blocks; Floor = expand walkable tiles. */
  onPlayModeSelect: (fn: (mode: "walk" | "build" | "floor") => void) => void;
  setPlayModeState: (mode: "walk" | "build" | "floor") => void;
  /** Rotate ramp “toward” (placement bar or object panel when ramp is on). */
  rotateRampToward: (delta: -1 | 1) => boolean;
  showObjectEditPanel: (opts: {
    x: number;
    z: number;
    passable: boolean;
    half: boolean;
    quarter: boolean;
    hex: boolean;
    ramp: boolean;
    rampDir: number;
    colorId: number;
    onPropsChange: (p: ObstacleProps) => void;
    onRemove: () => void;
    onMove: () => void;
    onClose: () => void;
  }) => void;
  hideObjectEditPanel: () => void;
  setObjectPanelProps: (p: ObstacleProps) => void;
  onBuildPlacementStyle: (
    fn: (patch: {
      half?: boolean;
      quarter?: boolean;
      hex?: boolean;
      ramp?: boolean;
      rampDir?: number;
      colorId?: number;
    }) => void
  ) => void;
  setBuildBlockBarState: (state: BuildBlockBarState) => void;
  setDebugText: (text: string) => void;
  setCanvasLeaderboardVisible: (visible: boolean) => void;
  updateCanvasLeaderboard: (leaders: Array<{ address: string; count: number }>) => void;
  destroy: () => void;
} {
  root.innerHTML = "";

  const showDebug = opts?.showDebug ?? false;

  const frame = document.createElement("div");
  frame.className = "game-frame";
  root.appendChild(frame);

  const letter = document.createElement("div");
  letter.className = "letterbox";
  frame.appendChild(letter);

  const canvasHost = document.createElement("div");
  canvasHost.className = "canvas-host";
  letter.appendChild(canvasHost);

  const ui = document.createElement("div");
  ui.className = "hud";
  letter.appendChild(ui);

  const topStrip = document.createElement("div");
  topStrip.className = "hud-top-strip";

  const brand = document.createElement("div");
  brand.className = "hud-brand";
  brand.setAttribute("aria-hidden", "true");
  const nimiqSpan = document.createElement("span");
  nimiqSpan.className = "main-menu__title-nimiq";
  nimiqSpan.textContent = "NIMIQ";
  const spaceSpan = document.createElement("span");
  spaceSpan.className = "main-menu__title-space";
  spaceSpan.textContent = "SPACE";
  brand.appendChild(nimiqSpan);
  brand.appendChild(spaceSpan);

  const status = document.createElement("div");
  status.className = "hud-status";
  status.textContent = "";

  topStrip.appendChild(brand);
  topStrip.appendChild(status);

  const topToolbar = document.createElement("div");
  topToolbar.className = "hud-top-toolbar";
  const lobbyBtn = document.createElement("button");
  lobbyBtn.type = "button";
  lobbyBtn.className = "hud-lobby hud-icon-btn";
  lobbyBtn.textContent = "×";
  lobbyBtn.setAttribute("aria-label", "Lobby");
  lobbyBtn.title = "Lobby — back to main menu (stay logged in)";
  const fsBtn = document.createElement("button");
  fsBtn.type = "button";
  fsBtn.className = "hud-fs hud-icon-btn";
  fsBtn.textContent = "[ ]";
  fsBtn.setAttribute("aria-label", "Fullscreen");
  fsBtn.title = "Fullscreen";
  topToolbar.appendChild(fsBtn);
  topToolbar.appendChild(lobbyBtn);
  topStrip.appendChild(topToolbar);

  const leftStack = document.createElement("div");
  leftStack.className = "hud-left-stack";

  const debugPanel = document.createElement("pre");
  debugPanel.className = "hud-debug";
  debugPanel.setAttribute("aria-hidden", "true");
  debugPanel.hidden = !showDebug;

  const canvasLeaderboard = document.createElement("div");
  canvasLeaderboard.className = "canvas-leaderboard";
  canvasLeaderboard.hidden = true;
  canvasLeaderboard.innerHTML = `
    <div class="canvas-leaderboard__title">Canvas Leaders</div>
    <div class="canvas-leaderboard__list"></div>
  `;

  leftStack.appendChild(debugPanel);
  leftStack.appendChild(canvasLeaderboard);
  ui.appendChild(topStrip);
  ui.appendChild(leftStack);

  const topBar = document.createElement("div");
  topBar.className = "hud-top";
  const returnHubBtn = document.createElement("button");
  returnHubBtn.type = "button";
  returnHubBtn.className = "hud-return-hub";
  returnHubBtn.textContent = "Return to hub";
  returnHubBtn.hidden = true;
  const topActions = document.createElement("div");
  topActions.className = "hud-top-actions";

  const modeSegment = document.createElement("div");
  modeSegment.className = "hud-mode-segment";
  modeSegment.setAttribute("role", "group");
  modeSegment.setAttribute("aria-label", "Play mode");
  const walkModeBtn = document.createElement("button");
  walkModeBtn.type = "button";
  walkModeBtn.className = "hud-mode-segment__btn";
  walkModeBtn.dataset.mode = "walk";
  walkModeBtn.textContent = "Walk";
  walkModeBtn.title = "Move around (default)";
  const buildModeBtn = document.createElement("button");
  buildModeBtn.type = "button";
  buildModeBtn.className = "hud-mode-segment__btn";
  buildModeBtn.dataset.mode = "build";
  buildModeBtn.textContent = "Build";
  buildModeBtn.title = "Place and edit blocks (B)";
  const floorModeBtn = document.createElement("button");
  floorModeBtn.type = "button";
  floorModeBtn.className = "hud-mode-segment__btn";
  floorModeBtn.dataset.mode = "floor";
  floorModeBtn.textContent = "Floor";
  floorModeBtn.title = "Expand walkable floor (F)";
  modeSegment.appendChild(walkModeBtn);
  modeSegment.appendChild(buildModeBtn);
  modeSegment.appendChild(floorModeBtn);

  topActions.appendChild(modeSegment);
  topBar.appendChild(returnHubBtn);
  topBar.appendChild(topActions);
  ui.appendChild(topBar);

  const chatLog = document.createElement("div");
  chatLog.className = "chat-log";
  ui.appendChild(chatLog);

  const chatRow = document.createElement("div");
  chatRow.className = "chat-row";
  const chatInput = document.createElement("input");
  chatInput.type = "text";
  chatInput.className = "chat-input";
  chatInput.placeholder = "Message… (Enter to send)";
  chatInput.autocomplete = "off";
  chatInput.maxLength = 256;
  chatRow.appendChild(chatInput);
  ui.appendChild(chatRow);

  const lobbyConfirm = document.createElement("div");
  lobbyConfirm.className = "hud-lobby-confirm";
  lobbyConfirm.hidden = true;
  lobbyConfirm.setAttribute("aria-hidden", "true");
  const lobbyConfirmBackdrop = document.createElement("div");
  lobbyConfirmBackdrop.className = "hud-lobby-confirm__backdrop";
  const lobbyConfirmDialog = document.createElement("div");
  lobbyConfirmDialog.className = "hud-lobby-confirm__dialog";
  lobbyConfirmDialog.setAttribute("role", "dialog");
  lobbyConfirmDialog.setAttribute("aria-modal", "true");
  lobbyConfirmDialog.setAttribute(
    "aria-labelledby",
    "hud-lobby-confirm-label"
  );
  const lobbyConfirmMsg = document.createElement("p");
  lobbyConfirmMsg.className = "hud-lobby-confirm__msg";
  lobbyConfirmMsg.id = "hud-lobby-confirm-label";
  lobbyConfirmMsg.textContent =
    "Are you sure you want to return to lobby?";
  const lobbyConfirmActions = document.createElement("div");
  lobbyConfirmActions.className = "hud-lobby-confirm__actions";
  const lobbyConfirmCancel = document.createElement("button");
  lobbyConfirmCancel.type = "button";
  lobbyConfirmCancel.className =
    "hud-lobby-confirm__btn hud-lobby-confirm__btn--cancel";
  lobbyConfirmCancel.textContent = "Cancel";
  const lobbyConfirmOk = document.createElement("button");
  lobbyConfirmOk.type = "button";
  lobbyConfirmOk.className =
    "hud-lobby-confirm__btn hud-lobby-confirm__btn--confirm";
  lobbyConfirmOk.textContent = "Go to lobby";
  lobbyConfirmActions.appendChild(lobbyConfirmCancel);
  lobbyConfirmActions.appendChild(lobbyConfirmOk);
  lobbyConfirmDialog.appendChild(lobbyConfirmMsg);
  lobbyConfirmDialog.appendChild(lobbyConfirmActions);
  lobbyConfirm.appendChild(lobbyConfirmBackdrop);
  lobbyConfirm.appendChild(lobbyConfirmDialog);
  letter.appendChild(lobbyConfirm);

  const buildBlockBar = document.createElement("div");
  buildBlockBar.className = "build-block-bar";
  buildBlockBar.hidden = true;
  buildBlockBar.innerHTML = `
    <div class="build-block-bar__title">Blocks</div>
    <div class="build-block-bar__colors" aria-label="Block color">
      <div class="build-block-bar__swatches-recent"></div>
      <button type="button" class="build-block-bar__more-colors">More colors</button>
      <div class="build-block-bar__swatches-all" hidden></div>
    </div>
    <button type="button" class="build-block-bar__advanced-toggle" aria-expanded="false">Advanced</button>
    <div class="build-block-bar__advanced" hidden>
      <label class="build-block-bar__row">
        <input type="checkbox" class="build-block-bar__half" />
        <span>Half height</span>
      </label>
      <label class="build-block-bar__row">
        <input type="checkbox" class="build-block-bar__quarter" />
        <span>Quarter height</span>
      </label>
      <label class="build-block-bar__row">
        <input type="checkbox" class="build-block-bar__hex" />
        <span>Hexagon</span>
      </label>
      <label class="build-block-bar__row">
        <input type="checkbox" class="build-block-bar__ramp" />
        <span>Ramp</span>
      </label>
      <div class="build-block-bar__row build-block-bar__ramp-dir-row" hidden>
        <span class="build-block-bar__ramp-dir-label">Ramp rotation</span>
        <div class="build-block-bar__ramp-dir-controls">
          <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-ccw" title="Rotate counter-clockwise" aria-label="Rotate ramp counter-clockwise">↺</button>
          <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-cw" title="Rotate clockwise" aria-label="Rotate ramp clockwise">↻</button>
        </div>
      </div>
    </div>
  `;
  ui.appendChild(buildBlockBar);

  const barHalfCb = buildBlockBar.querySelector(
    ".build-block-bar__half"
  ) as HTMLInputElement;
  const barQuarterCb = buildBlockBar.querySelector(
    ".build-block-bar__quarter"
  ) as HTMLInputElement;
  const barHexCb = buildBlockBar.querySelector(
    ".build-block-bar__hex"
  ) as HTMLInputElement;
  const barRampCb = buildBlockBar.querySelector(
    ".build-block-bar__ramp"
  ) as HTMLInputElement;
  const barRampDirRow = buildBlockBar.querySelector(
    ".build-block-bar__ramp-dir-row"
  ) as HTMLElement;
  const barRampRotCCW = buildBlockBar.querySelector(
    ".build-block-bar__ramp-ccw"
  ) as HTMLButtonElement;
  const barRampRotCW = buildBlockBar.querySelector(
    ".build-block-bar__ramp-cw"
  ) as HTMLButtonElement;
  let barRampDir = 0;
  const barSwatchesRecent = buildBlockBar.querySelector(
    ".build-block-bar__swatches-recent"
  ) as HTMLDivElement;
  const barSwatchesAll = buildBlockBar.querySelector(
    ".build-block-bar__swatches-all"
  ) as HTMLDivElement;
  const barMoreColorsBtn = buildBlockBar.querySelector(
    ".build-block-bar__more-colors"
  ) as HTMLButtonElement;
  const barAdvancedToggle = buildBlockBar.querySelector(
    ".build-block-bar__advanced-toggle"
  ) as HTMLButtonElement;
  const barAdvancedSection = buildBlockBar.querySelector(
    ".build-block-bar__advanced"
  ) as HTMLElement;

  for (let i = 0; i < BLOCK_COLOR_COUNT; i++) {
    barSwatchesAll.appendChild(makeColorSwatchButton(i));
  }
  function rebuildBarRecentSwatches(ids: readonly number[]): void {
    barSwatchesRecent.replaceChildren();
    for (const id of ids) {
      barSwatchesRecent.appendChild(makeColorSwatchButton(id));
    }
  }
  rebuildBarRecentSwatches(loadRecentColorIds());

  let placementStyleHandler: (patch: {
    half?: boolean;
    quarter?: boolean;
    hex?: boolean;
    ramp?: boolean;
    rampDir?: number;
    colorId?: number;
  }) => void = (): void => {};

  barHalfCb.addEventListener("change", () => {
    if (barHalfCb.checked) {
      barQuarterCb.checked = false;
      placementStyleHandler({ half: true, quarter: false });
    } else {
      placementStyleHandler({ half: false });
    }
  });
  barQuarterCb.addEventListener("change", () => {
    if (barQuarterCb.checked) {
      barHalfCb.checked = false;
      placementStyleHandler({ quarter: true, half: false });
    } else {
      placementStyleHandler({ quarter: false });
    }
  });
  barHexCb.addEventListener("change", () => {
    placementStyleHandler({ hex: barHexCb.checked });
  });

  function rotateBarRamp(delta: -1 | 1): void {
    if (!barRampCb.checked) return;
    barRampDir = (barRampDir + delta + 4) % 4;
    placementStyleHandler({ rampDir: barRampDir });
  }

  barRampRotCCW.addEventListener("click", () => rotateBarRamp(-1));
  barRampRotCW.addEventListener("click", () => rotateBarRamp(1));

  barRampCb.addEventListener("change", () => {
    const on = barRampCb.checked;
    barRampDirRow.hidden = !on;
    placementStyleHandler({ ramp: on, hex: on ? false : barHexCb.checked });
    if (on) barHexCb.checked = false;
  });

  let barColorsExpanded = false;
  barMoreColorsBtn.addEventListener("click", () => {
    barColorsExpanded = !barColorsExpanded;
    barSwatchesAll.hidden = !barColorsExpanded;
    barMoreColorsBtn.textContent = barColorsExpanded
      ? "Hide colors"
      : "More colors";
  });

  barAdvancedToggle.addEventListener("click", () => {
    const open = barAdvancedSection.hidden;
    barAdvancedSection.hidden = !open;
    barAdvancedToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  buildBlockBar.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const btn = t.closest(".block-color-swatch") as HTMLButtonElement | null;
    if (!btn || !buildBlockBar.contains(btn)) return;
    const id = Number(btn.dataset.colorId);
    if (!Number.isFinite(id)) return;
    rebuildBarRecentSwatches(pushRecentColorId(id));
    placementStyleHandler({ colorId: id });
    refreshBarSwatches(id);
  });

  let fsHandler = (): void => {};
  let returnHubHandler = (): void => {};
  let lobbyHandler = (): void => {};
  let playModeHandler: (mode: "walk" | "build" | "floor") => void = (): void => {};
  let lobbyConfirmEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

  const hideLobbyConfirm = (): void => {
    if (lobbyConfirm.hidden) return;
    lobbyConfirm.hidden = true;
    lobbyConfirm.setAttribute("aria-hidden", "true");
    if (lobbyConfirmEscapeHandler) {
      window.removeEventListener("keydown", lobbyConfirmEscapeHandler);
      lobbyConfirmEscapeHandler = null;
    }
  };

  const openLobbyConfirm = (): void => {
    lobbyConfirm.hidden = false;
    lobbyConfirm.setAttribute("aria-hidden", "false");
    lobbyConfirmEscapeHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hideLobbyConfirm();
      }
    };
    window.addEventListener("keydown", lobbyConfirmEscapeHandler);
    lobbyConfirmCancel.focus();
  };

  lobbyConfirmBackdrop.addEventListener("click", () => {
    hideLobbyConfirm();
  });
  lobbyConfirmCancel.addEventListener("click", () => {
    hideLobbyConfirm();
  });
  lobbyConfirmOk.addEventListener("click", () => {
    hideLobbyConfirm();
    lobbyHandler();
  });

  fsBtn.addEventListener("click", () => fsHandler());
  returnHubBtn.addEventListener("click", () => returnHubHandler());
  lobbyBtn.addEventListener("click", () => openLobbyConfirm());
  walkModeBtn.addEventListener("click", () => playModeHandler("walk"));
  buildModeBtn.addEventListener("click", () => playModeHandler("build"));
  floorModeBtn.addEventListener("click", () => playModeHandler("floor"));

  const ro = new ResizeObserver(() => {
    layoutLetterbox(frame, letter);
  });
  ro.observe(frame);

  layoutLetterbox(frame, letter);

  let objectPanel: HTMLDivElement | null = null;
  let passCheckbox: HTMLInputElement | null = null;
  let halfCheckbox: HTMLInputElement | null = null;
  let quarterCheckbox: HTMLInputElement | null = null;
  let hexCheckbox: HTMLInputElement | null = null;
  let rampCheckbox: HTMLInputElement | null = null;
  let rampDirRow: HTMLElement | null = null;
  let panelRampRotCCW: HTMLButtonElement | null = null;
  let panelRampRotCW: HTMLButtonElement | null = null;
  let panelRampDir = 0;
  let panelColorRoot: HTMLElement | null = null;
  let panelSwatchesRecent: HTMLDivElement | null = null;
  let panelSwatchesAll: HTMLDivElement | null = null;
  let panelMoreColorsBtn: HTMLButtonElement | null = null;
  let panelAdvancedToggle: HTMLButtonElement | null = null;
  let panelAdvancedSection: HTMLElement | null = null;
  let panelKeyHintsEl: HTMLElement | null = null;
  let panelSelectedColorId = 0;
  let panelOnPropsChange: ((p: ObstacleProps) => void) | null = null;

  function updatePanelKeyHints(): void {
    if (!panelKeyHintsEl || !rampCheckbox) return;
    const parts: string[] = ["D — Delete"];
    if (rampCheckbox.checked) parts.push("R — Rotate ramp");
    panelKeyHintsEl.textContent = parts.join(" · ");
  }

  function wirePanelColorClicks(): void {
    panelColorRoot?.addEventListener("click", onPanelColorClick);
  }

  function unwirePanelColorClicks(): void {
    panelColorRoot?.removeEventListener("click", onPanelColorClick);
  }

  function onPanelColorClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    const btn = t.closest(".block-color-swatch") as HTMLButtonElement | null;
    if (!btn || !objectPanel?.contains(btn)) return;
    const id = Number(btn.dataset.colorId);
    if (!Number.isFinite(id)) return;
    panelSelectedColorId = id;
    const ids = pushRecentColorId(id);
    if (panelSwatchesRecent) {
      panelSwatchesRecent.replaceChildren();
      for (const rid of ids) {
        panelSwatchesRecent.appendChild(makeColorSwatchButton(rid));
      }
    }
    syncPanelSwatchSelection();
    emitPanelProps();
  }

  function emitPanelProps(): void {
    if (
      !panelOnPropsChange ||
      !passCheckbox ||
      !halfCheckbox ||
      !quarterCheckbox ||
      !hexCheckbox ||
      !rampCheckbox
    ) {
      return;
    }
    const quarter = quarterCheckbox.checked;
    const ramp = rampCheckbox.checked;
    const rampDir = Math.max(0, Math.min(3, Math.floor(panelRampDir)));
    panelOnPropsChange({
      passable: passCheckbox.checked,
      quarter,
      half: quarter ? false : halfCheckbox.checked,
      hex: ramp ? false : hexCheckbox.checked,
      ramp,
      rampDir: ramp ? rampDir : 0,
      colorId: panelSelectedColorId,
    });
  }

  function syncPanelSwatchSelection(): void {
    if (!panelColorRoot) return;
    const buttons = panelColorRoot.querySelectorAll(".block-color-swatch");
    buttons.forEach((node) => {
      const el = node as HTMLButtonElement;
      const id = Number(el.dataset.colorId);
      el.classList.toggle(
        "block-color-swatch--selected",
        id === panelSelectedColorId
      );
    });
  }

  function hideObjectEditPanel(): void {
    unwirePanelColorClicks();
    if (objectPanel) {
      objectPanel.remove();
      objectPanel = null;
      passCheckbox = null;
      halfCheckbox = null;
      quarterCheckbox = null;
      hexCheckbox = null;
      rampCheckbox = null;
      rampDirRow = null;
      panelRampRotCCW = null;
      panelRampRotCW = null;
      panelColorRoot = null;
      panelSwatchesRecent = null;
      panelSwatchesAll = null;
      panelMoreColorsBtn = null;
      panelAdvancedToggle = null;
      panelAdvancedSection = null;
      panelKeyHintsEl = null;
      panelOnPropsChange = null;
    }
  }

  function refreshBarSwatches(selectedId: number): void {
    const buttons = buildBlockBar.querySelectorAll(".block-color-swatch");
    buttons.forEach((node) => {
      const el = node as HTMLButtonElement;
      const id = Number(el.dataset.colorId);
      el.classList.toggle(
        "block-color-swatch--selected",
        id === selectedId
      );
    });
  }

  return {
    setStatus(s: string) {
      status.textContent = s;
    },
    appendChat(from: string, text: string) {
      const line = document.createElement("div");
      line.className = "chat-line";
      line.textContent = `${from}: ${text}`;
      chatLog.appendChild(line);
      chatLog.scrollTop = chatLog.scrollHeight;
    },
    getChatInput: () => chatInput,
    onFullscreenToggle(fn: () => void) {
      fsHandler = fn;
    },
    setReturnToHubVisible(visible: boolean) {
      returnHubBtn.hidden = !visible;
    },
    onReturnToHub(fn: () => void) {
      returnHubHandler = fn;
    },
    onReturnToLobby(fn: () => void) {
      lobbyHandler = fn;
    },
    onPlayModeSelect(fn: (mode: "walk" | "build" | "floor") => void) {
      playModeHandler = fn;
    },
    setPlayModeState(mode: "walk" | "build" | "floor") {
      walkModeBtn.classList.toggle(
        "hud-mode-segment__btn--active-walk",
        mode === "walk"
      );
      buildModeBtn.classList.toggle(
        "hud-mode-segment__btn--active-build",
        mode === "build"
      );
      floorModeBtn.classList.toggle(
        "hud-mode-segment__btn--active-floor",
        mode === "floor"
      );
      walkModeBtn.setAttribute("aria-pressed", mode === "walk" ? "true" : "false");
      buildModeBtn.setAttribute("aria-pressed", mode === "build" ? "true" : "false");
      floorModeBtn.setAttribute("aria-pressed", mode === "floor" ? "true" : "false");
    },
    showObjectEditPanel(opts) {
      hideObjectEditPanel();
      panelOnPropsChange = opts.onPropsChange;
      panelSelectedColorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(opts.colorId))
      );
      objectPanel = document.createElement("div");
      objectPanel.className = "build-object-panel";
      objectPanel.innerHTML = `
        <div class="build-object-panel__title">Block (${opts.x}, ${opts.z})</div>
        <div class="build-object-panel__hints" aria-hidden="true"></div>
        <div class="build-object-panel__colors" aria-label="Block color">
          <div class="build-object-panel__colors-label">Color</div>
          <div class="build-object-panel__swatches-recent"></div>
          <button type="button" class="build-object-panel__more-colors">More colors</button>
          <div class="build-object-panel__swatches-all" hidden></div>
        </div>
        <button type="button" class="build-object-panel__advanced-toggle" aria-expanded="false">Advanced</button>
        <div class="build-object-panel__advanced" hidden>
          <label class="build-object-panel__row">
            <input type="checkbox" class="build-object-panel__cb build-object-panel__cb-pass" />
            <span>Walk through (no collision)</span>
          </label>
          <label class="build-object-panel__row">
            <input type="checkbox" class="build-object-panel__cb build-object-panel__cb-half" />
            <span>Half height</span>
          </label>
          <label class="build-object-panel__row">
            <input type="checkbox" class="build-object-panel__cb build-object-panel__cb-quarter" />
            <span>Quarter height</span>
          </label>
          <label class="build-object-panel__row">
            <input type="checkbox" class="build-object-panel__cb build-object-panel__cb-hex" />
            <span>Hexagon</span>
          </label>
          <label class="build-object-panel__row">
            <input type="checkbox" class="build-object-panel__cb build-object-panel__cb-ramp" />
            <span>Ramp</span>
          </label>
          <div class="build-object-panel__row build-object-panel__ramp-dir-row">
            <span class="build-object-panel__ramp-dir-label">Ramp rotation</span>
            <div class="build-object-panel__ramp-dir-controls">
              <button type="button" class="build-object-panel__ramp-rot build-object-panel__ramp-ccw" title="Rotate counter-clockwise" aria-label="Rotate ramp counter-clockwise">↺</button>
              <button type="button" class="build-object-panel__ramp-rot build-object-panel__ramp-cw" title="Rotate clockwise" aria-label="Rotate ramp clockwise">↻</button>
              <button type="button" class="build-object-panel__ramp-step" title="Rotate ramp (R)">Rotate</button>
            </div>
          </div>
        </div>
        <div class="build-object-panel__footer-actions">
          <button type="button" class="build-object-panel__btn build-object-panel__move">Move</button>
          <button type="button" class="build-object-panel__btn build-object-panel__remove">Delete</button>
          <button type="button" class="build-object-panel__btn build-object-panel__close">Close</button>
        </div>
      `;
      topActions.insertBefore(objectPanel, modeSegment);
      panelKeyHintsEl = objectPanel.querySelector(
        ".build-object-panel__hints"
      ) as HTMLElement;
      passCheckbox = objectPanel.querySelector(
        ".build-object-panel__cb-pass"
      ) as HTMLInputElement;
      halfCheckbox = objectPanel.querySelector(
        ".build-object-panel__cb-half"
      ) as HTMLInputElement;
      quarterCheckbox = objectPanel.querySelector(
        ".build-object-panel__cb-quarter"
      ) as HTMLInputElement;
      hexCheckbox = objectPanel.querySelector(
        ".build-object-panel__cb-hex"
      ) as HTMLInputElement;
      rampCheckbox = objectPanel.querySelector(
        ".build-object-panel__cb-ramp"
      ) as HTMLInputElement;
      rampDirRow = objectPanel.querySelector(
        ".build-object-panel__ramp-dir-row"
      ) as HTMLElement;
      panelRampRotCCW = objectPanel.querySelector(
        ".build-object-panel__ramp-ccw"
      ) as HTMLButtonElement;
      panelRampRotCW = objectPanel.querySelector(
        ".build-object-panel__ramp-cw"
      ) as HTMLButtonElement;
      panelRampDir = Math.max(0, Math.min(3, Math.floor(opts.rampDir)));
      panelColorRoot = objectPanel.querySelector(
        ".build-object-panel__colors"
      ) as HTMLElement;
      panelSwatchesRecent = objectPanel.querySelector(
        ".build-object-panel__swatches-recent"
      ) as HTMLDivElement;
      panelSwatchesAll = objectPanel.querySelector(
        ".build-object-panel__swatches-all"
      ) as HTMLDivElement;
      panelMoreColorsBtn = objectPanel.querySelector(
        ".build-object-panel__more-colors"
      ) as HTMLButtonElement;
      panelAdvancedToggle = objectPanel.querySelector(
        ".build-object-panel__advanced-toggle"
      ) as HTMLButtonElement;
      panelAdvancedSection = objectPanel.querySelector(
        ".build-object-panel__advanced"
      ) as HTMLElement;
      passCheckbox.checked = opts.passable;
      quarterCheckbox.checked = opts.quarter;
      halfCheckbox.checked = opts.quarter ? false : opts.half;
      hexCheckbox.checked = opts.ramp ? false : opts.hex;
      rampCheckbox.checked = opts.ramp;
      rampDirRow.hidden = !opts.ramp;
      updatePanelKeyHints();
      for (let i = 0; i < BLOCK_COLOR_COUNT; i++) {
        panelSwatchesAll!.appendChild(makeColorSwatchButton(i));
      }
      const recentIds = loadRecentColorIds();
      panelSwatchesRecent!.replaceChildren();
      for (const rid of recentIds) {
        panelSwatchesRecent!.appendChild(makeColorSwatchButton(rid));
      }
      let panelColorsExpanded = false;
      panelMoreColorsBtn!.addEventListener("click", () => {
        panelColorsExpanded = !panelColorsExpanded;
        panelSwatchesAll!.hidden = !panelColorsExpanded;
        panelMoreColorsBtn!.textContent = panelColorsExpanded
          ? "Hide colors"
          : "More colors";
      });
      panelAdvancedToggle!.addEventListener("click", () => {
        const open = panelAdvancedSection!.hidden;
        panelAdvancedSection!.hidden = !open;
        panelAdvancedToggle!.setAttribute(
          "aria-expanded",
          open ? "true" : "false"
        );
      });
      syncPanelSwatchSelection();
      wirePanelColorClicks();
      passCheckbox.addEventListener("change", () => emitPanelProps());
      halfCheckbox.addEventListener("change", () => {
        if (halfCheckbox!.checked) quarterCheckbox!.checked = false;
        emitPanelProps();
      });
      quarterCheckbox.addEventListener("change", () => {
        if (quarterCheckbox!.checked) halfCheckbox!.checked = false;
        emitPanelProps();
      });
      hexCheckbox.addEventListener("change", () => emitPanelProps());
      rampCheckbox.addEventListener("change", () => {
        const on = rampCheckbox!.checked;
        rampDirRow!.hidden = !on;
        if (on) hexCheckbox!.checked = false;
        emitPanelProps();
        updatePanelKeyHints();
      });
      const rotatePanelRamp = (delta: -1 | 1): void => {
        if (!rampCheckbox?.checked) return;
        panelRampDir = (panelRampDir + delta + 4) % 4;
        emitPanelProps();
      };
      panelRampRotCCW!.addEventListener("click", () => rotatePanelRamp(-1));
      panelRampRotCW!.addEventListener("click", () => rotatePanelRamp(1));
      objectPanel
        .querySelector(".build-object-panel__ramp-step")
        ?.addEventListener("click", () => rotatePanelRamp(1));
      objectPanel
        .querySelector(".build-object-panel__move")
        ?.addEventListener("click", () => opts.onMove());
      objectPanel
        .querySelector(".build-object-panel__remove")
        ?.addEventListener("click", () => opts.onRemove());
      objectPanel
        .querySelector(".build-object-panel__close")
        ?.addEventListener("click", () => opts.onClose());
    },
    hideObjectEditPanel() {
      hideObjectEditPanel();
    },
    setObjectPanelProps(p: ObstacleProps) {
      if (passCheckbox) passCheckbox.checked = p.passable;
      if (quarterCheckbox) quarterCheckbox.checked = p.quarter;
      if (halfCheckbox) halfCheckbox.checked = p.quarter ? false : p.half;
      if (hexCheckbox) hexCheckbox.checked = p.ramp ? false : p.hex;
      if (rampCheckbox) rampCheckbox.checked = p.ramp;
      panelRampDir = Math.max(0, Math.min(3, Math.floor(p.rampDir)));
      if (rampDirRow) rampDirRow.hidden = !p.ramp;
      panelSelectedColorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(p.colorId))
      );
      syncPanelSwatchSelection();
      updatePanelKeyHints();
    },
    rotateRampToward(delta: -1 | 1): boolean {
      if (objectPanel) {
        if (
          rampCheckbox?.checked &&
          rampDirRow &&
          !rampDirRow.hidden
        ) {
          panelRampDir = (panelRampDir + delta + 4) % 4;
          emitPanelProps();
          return true;
        }
        return false;
      }
      if (barRampCb.checked && !buildBlockBar.hidden) {
        rotateBarRamp(delta);
        return true;
      }
      return false;
    },
    onBuildPlacementStyle(fn) {
      placementStyleHandler = fn;
    },
    setBuildBlockBarState(state) {
      buildBlockBar.hidden = !state.visible;
      barQuarterCb.checked = state.quarter;
      barHalfCb.checked = state.quarter ? false : state.half;
      barHexCb.checked = state.ramp ? false : state.hex;
      barRampCb.checked = state.ramp;
      barRampDir = Math.max(0, Math.min(3, Math.floor(state.rampDir)));
      barRampDirRow.hidden = !state.ramp;
      refreshBarSwatches(
        Math.max(0, Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(state.colorId)))
      );
    },
    setDebugText(text: string) {
      if (!showDebug) return;
      debugPanel.textContent = text;
    },
    setCanvasLeaderboardVisible(visible: boolean) {
      canvasLeaderboard.hidden = !visible;
    },
    updateCanvasLeaderboard(leaders: Array<{ address: string; count: number }>) {
      const list = canvasLeaderboard.querySelector(".canvas-leaderboard__list");
      if (!list) return;
      
      // Clear and create entries synchronously first
      list.innerHTML = "";
      const entries: Array<{ entry: HTMLDivElement; img: HTMLImageElement; address: string }> = [];
      
      for (let i = 0; i < leaders.length; i++) {
        const leader = leaders[i]!;
        const entry = document.createElement("div");
        entry.className = "canvas-leaderboard__entry";
        
        const rank = document.createElement("span");
        rank.className = "canvas-leaderboard__rank";
        rank.textContent = `${i + 1}.`;
        
        const identiconImg = document.createElement("img");
        identiconImg.className = "canvas-leaderboard__identicon";
        
        const addr = document.createElement("span");
        addr.className = "canvas-leaderboard__address";
        // Format: NQ07...ABCD (first 4 + last 4)
        const formatted = leader.address.length >= 8 
          ? `${leader.address.slice(0, 4)}…${leader.address.slice(-4)}`
          : leader.address;
        addr.textContent = formatted;
        addr.title = leader.address;
        
        const count = document.createElement("span");
        count.className = "canvas-leaderboard__count";
        count.textContent = `${leader.count}`;
        
        entry.appendChild(rank);
        entry.appendChild(identiconImg);
        entry.appendChild(addr);
        entry.appendChild(count);
        list.appendChild(entry);
        
        entries.push({ entry, img: identiconImg, address: leader.address });
      }
      
      // Load identicons after DOM is set up
      const loadIdenticons = async () => {
        for (const { img, address } of entries) {
          try {
            const { identiconDataUrl } = await import("../game/identiconTexture.js");
            const dataUrl = await identiconDataUrl(address);
            img.src = dataUrl;
          } catch (err) {
            console.error(`[canvas] Failed to load identicon for leaderboard entry:`, err);
          }
        }
      };
      
      void loadIdenticons();
    },
    destroy() {
      hideObjectEditPanel();
      hideLobbyConfirm();
      ro.disconnect();
    },
  };
}

function layoutLetterbox(frame: HTMLElement, letter: HTMLElement): void {
  const fw = frame.clientWidth;
  const fh = frame.clientHeight;
  if (!fw || !fh) return;
  const targetAspect = DESIGN_WIDTH / DESIGN_HEIGHT;
  const viewAspect = fw / fh;
  let w: number;
  let h: number;
  if (viewAspect > targetAspect) {
    h = fh;
    w = fh * targetAspect;
  } else {
    w = fw;
    h = fw / targetAspect;
  }
  letter.style.width = `${w}px`;
  letter.style.height = `${h}px`;
}
