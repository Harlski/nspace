import {
  BLOCK_COLOR_COUNT,
  BLOCK_COLOR_PALETTE,
  hslToRgb,
  nearestPaletteColorIdFromRgb,
} from "../game/blockStyle.js";
import type { ObstacleProps } from "../net/ws.js";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../game/constants.js";
import { loadRecentColorIds, pushRecentColorId } from "./recentColors.js";

function cssHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function estimateHueDegFromRgb(r255: number, g255: number, b255: number): number {
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = (b - r) / d + 2 / 6;
  else h = (r - g) / d + 4 / 6;
  return (h * 360 + 360) % 360;
}

function estimateHueFromPaletteId(id: number): number {
  const c = BLOCK_COLOR_PALETTE[
    Math.max(0, Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(id)))
  ]!;
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return estimateHueDegFromRgb(r, g, b);
}

function obstacleShapeLabel(ramp: boolean, hex: boolean): string {
  if (ramp) return "Ramp";
  if (hex) return "Hexagon";
  return "Cube";
}

/** Inline SVGs for Walk / Build / Floor mode (circle buttons, labels via aria). */
const HUD_MODE_ICON_WALK = `<svg class="hud-mode-icon" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="9" cy="17" rx="3.2" ry="5" fill="currentColor"/><ellipse cx="15.5" cy="15" rx="2.6" ry="4.2" fill="currentColor"/></svg>`;
const HUD_MODE_ICON_BUILD = `<svg class="hud-mode-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M5 10h14M5 14h8m3 0h6"/></svg>`;
const HUD_MODE_ICON_FLOOR = `<svg class="hud-mode-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="8" height="8" rx="0.5" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 4v3M12 17v3M4 12h3M17 12h3"/></svg>`;

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
  // Experimental features
  claimable?: boolean;
  /** When false, mining / claimable UI is hidden (must match server admin list). */
  placementAdmin?: boolean;
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
  /** Per-room edit caps from server welcome; disables Build / Floor when false. */
  setRoomEditCaps: (caps: {
    allowPlaceBlocks: boolean;
    allowExtraFloor: boolean;
  }) => void;
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
    locked?: boolean;
    isAdmin?: boolean;
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
      claimable?: boolean;
    }) => void
  ) => void;
  setBuildBlockBarState: (state: BuildBlockBarState) => void;
  isSignpostModeActive: () => boolean;
  deactivateSignpostMode: () => void;
  promptSignpostMessage: (x: number, z: number) => void;
  onSignpostPlace: (fn: (x: number, z: number, message: string) => void) => void;
  setSignboardTooltip: (signboard: {
    id: string;
    x: number;
    z: number;
    message: string;
    createdBy: string;
    createdAt: number;
  } | null) => void;
  setDebugText: (text: string) => void;
  setCanvasLeaderboardVisible: (visible: boolean) => void;
  updateCanvasLeaderboard: (leaders: Array<{ address: string; count: number }>) => void;
  setCanvasTimer: (timeRemaining: number) => void;
  setPlayerCount: (count: number, roomCount?: number) => void;
  setNimWalletStatus: (status: string) => void;
  setLoadingVisible: (visible: boolean) => void;
  /** NIM block claim: progress 0–1 while adjacent; null hides the bar. */
  setNimClaimProgress: (
    state: null | { progress: number; adjacent: boolean }
  ) => void;
  /** Show or hide the in-game Reconnect control (e.g. after WebSocket loss). */
  setReconnectOffer: (visible: boolean) => void;
  onReconnect: (fn: () => void) => void;
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

  const statusRow = document.createElement("div");
  statusRow.className = "hud-status-row";
  const status = document.createElement("div");
  status.className = "hud-status";
  status.textContent = "";
  const reconnectBtn = document.createElement("button");
  reconnectBtn.type = "button";
  reconnectBtn.className = "hud-reconnect-btn";
  reconnectBtn.textContent = "Reconnect";
  reconnectBtn.hidden = true;
  reconnectBtn.setAttribute("aria-label", "Reconnect to server");
  reconnectBtn.title = "Try connecting again without leaving the game";
  statusRow.appendChild(status);
  statusRow.appendChild(reconnectBtn);

  topStrip.appendChild(brand);
  topStrip.appendChild(statusRow);

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
  const FS_ENTER_SVG = `<svg class="hud-fs__icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
  const FS_EXIT_SVG = `<svg class="hud-fs__icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
  const setFsBtnVisual = (): void => {
    const on = !!document.fullscreenElement;
    fsBtn.innerHTML = on ? FS_EXIT_SVG : FS_ENTER_SVG;
    fsBtn.classList.toggle("hud-fs--nudge", !on);
    fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Enter fullscreen");
    fsBtn.title = on ? "Exit fullscreen" : "Enter fullscreen";
  };
  setFsBtnVisual();
  const onFullscreenChange = (): void => {
    setFsBtnVisual();
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);

  // Player count indicator
  const playerCount = document.createElement("div");
  playerCount.className = "hud-player-count";
  playerCount.setAttribute("role", "button");
  playerCount.setAttribute("tabindex", "0");
  playerCount.setAttribute("aria-label", "Active players");
  playerCount.innerHTML = `
    <svg class="nq-icon">
      <use xlink:href="/nimiq-style.icons.svg#nq-view"/>
    </svg>
    <span class="hud-player-count__number">0</span>
    <span class="hud-player-count__tooltip" role="tooltip">Online now: 0 total · 0 in this room.</span>
  `;
  const nimBalance = document.createElement("div");
  nimBalance.className = "hud-nim-balance";
  nimBalance.setAttribute("role", "button");
  nimBalance.setAttribute("tabindex", "0");
  nimBalance.setAttribute("aria-label", "Nimiq reward balance info");
  nimBalance.innerHTML = `
    <svg class="nq-icon">
      <use xlink:href="/nimiq-style.icons.svg#nq-hexagon"/>
    </svg>
    <span class="hud-nim-balance__value">…</span>
    <span class="hud-nim-balance__tooltip" role="tooltip">
      This NIM can be earned by playing Nimiq Space
    </span>
  `;
  const nimBalanceValue = nimBalance.querySelector(
    ".hud-nim-balance__value"
  ) as HTMLElement | null;
  const toggleNimHint = (show: boolean): void => {
    nimBalance.classList.toggle("hud-nim-balance--show-tip", show);
  };
  const togglePlayerTip = (show: boolean): void => {
    playerCount.classList.toggle("hud-player-count--show-tip", show);
  };
  const closeHudTooltips = (): void => {
    toggleNimHint(false);
    togglePlayerTip(false);
  };
  nimBalance.addEventListener("mouseenter", () => toggleNimHint(true));
  nimBalance.addEventListener("mouseleave", () => toggleNimHint(false));
  nimBalance.addEventListener("focus", () => toggleNimHint(true));
  nimBalance.addEventListener("blur", () => toggleNimHint(false));
  nimBalance.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNimHint(!nimBalance.classList.contains("hud-nim-balance--show-tip"));
  });
  playerCount.addEventListener("mouseenter", () => togglePlayerTip(true));
  playerCount.addEventListener("mouseleave", () => togglePlayerTip(false));
  playerCount.addEventListener("focus", () => togglePlayerTip(true));
  playerCount.addEventListener("blur", () => togglePlayerTip(false));
  playerCount.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlayerTip(
      !playerCount.classList.contains("hud-player-count--show-tip")
    );
  });
  playerCount.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePlayerTip(
        !playerCount.classList.contains("hud-player-count--show-tip")
      );
    }
  });
  document.addEventListener("click", closeHudTooltips);
  
  topToolbar.appendChild(fsBtn);
  topToolbar.appendChild(playerCount);
  topToolbar.appendChild(nimBalance);
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
    <div class="canvas-leaderboard__title">The Maze - Leaders</div>
    <div class="canvas-leaderboard__timer" hidden></div>
    <div class="canvas-leaderboard__list"></div>
  `;

  const signboardTooltip = document.createElement("div");
  signboardTooltip.className = "signboard-tooltip";
  signboardTooltip.hidden = true;
  signboardTooltip.innerHTML = `
    <div class="signboard-tooltip__header">
      <span class="signboard-tooltip__icon">📋</span>
      <span class="signboard-tooltip__title">Signboard</span>
      <button type="button" class="signboard-tooltip__close" aria-label="Close">✕</button>
    </div>
    <div class="signboard-tooltip__message"></div>
    <div class="signboard-tooltip__footer">
      <img class="signboard-tooltip__identicon" alt="" width="18" height="18" hidden />
      <span class="signboard-tooltip__author"></span>
    </div>
  `;

  // Signpost message input overlay
  const signpostOverlay = document.createElement("div");
  signpostOverlay.className = "signpost-overlay";
  signpostOverlay.hidden = true;
  const signpostDialog = document.createElement("div");
  signpostDialog.className = "signpost-overlay__dialog";
  const SIGNPOST_MESSAGE_MAX = 64;
  signpostDialog.innerHTML = `
    <div class="signpost-overlay__header">
      <span class="signpost-overlay__title">Create Signpost</span>
      <div class="signpost-overlay__header-actions">
        <button type="button" class="signpost-overlay__btn signpost-overlay__btn--cancel">Cancel</button>
        <button type="button" class="signpost-overlay__btn signpost-overlay__btn--create">Create</button>
      </div>
    </div>
    <div class="signpost-overlay__body">
      <label class="signpost-overlay__label">Message (max ${SIGNPOST_MESSAGE_MAX} characters):</label>
      <textarea class="signpost-overlay__textarea" maxlength="${SIGNPOST_MESSAGE_MAX}" placeholder="Enter your message..." rows="4"></textarea>
      <div class="signpost-overlay__char-count">0 / ${SIGNPOST_MESSAGE_MAX}</div>
    </div>
  `;
  signpostOverlay.appendChild(signpostDialog);

  leftStack.appendChild(debugPanel);
  leftStack.appendChild(canvasLeaderboard);
  
  // Close button for signboard tooltip
  const signboardCloseBtn = signboardTooltip.querySelector(".signboard-tooltip__close");
  if (signboardCloseBtn) {
    signboardCloseBtn.addEventListener("click", () => {
      signboardTooltip.hidden = true;
    });
  }
  
  ui.appendChild(topStrip);
  ui.appendChild(leftStack);
  letter.appendChild(signpostOverlay);

  // Loading overlay for room transitions
  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.hidden = true;
  loadingOverlay.innerHTML = `
    <div class="loading-overlay__content">
      <div class="loading-overlay__spinner"></div>
      <div class="loading-overlay__text">Loading room...</div>
    </div>
  `;
  letter.appendChild(loadingOverlay);

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
  walkModeBtn.innerHTML = HUD_MODE_ICON_WALK;
  walkModeBtn.setAttribute("aria-label", "Walk — move around");
  walkModeBtn.title = "Walk — move around (default)";
  const buildModeBtn = document.createElement("button");
  buildModeBtn.type = "button";
  buildModeBtn.className = "hud-mode-segment__btn";
  buildModeBtn.dataset.mode = "build";
  buildModeBtn.innerHTML = HUD_MODE_ICON_BUILD;
  buildModeBtn.setAttribute("aria-label", "Build — place and edit blocks");
  buildModeBtn.title = "Build — place and edit blocks (B)";
  const floorModeBtn = document.createElement("button");
  floorModeBtn.type = "button";
  floorModeBtn.className = "hud-mode-segment__btn";
  floorModeBtn.dataset.mode = "floor";
  floorModeBtn.innerHTML = HUD_MODE_ICON_FLOOR;
  floorModeBtn.setAttribute("aria-label", "Floor — expand walkable tiles");
  floorModeBtn.title = "Floor — expand walkable floor (F)";
  modeSegment.appendChild(walkModeBtn);
  modeSegment.appendChild(buildModeBtn);
  modeSegment.appendChild(floorModeBtn);

  let roomAllowPlaceBlocks = true;
  let roomAllowExtraFloor = true;
  function applyRoomEditCaps(): void {
    buildModeBtn.disabled = !roomAllowPlaceBlocks;
    floorModeBtn.disabled = !roomAllowExtraFloor;
    buildModeBtn.title = roomAllowPlaceBlocks
      ? "Build — place and edit blocks (B)"
      : "Building is disabled in this room";
    floorModeBtn.title = roomAllowExtraFloor
      ? "Floor — expand walkable floor (F)"
      : "Floor editing is disabled in this room";
  }

  topActions.appendChild(modeSegment);
  // Keep signboard reading in the same top-right action stack as object edit.
  topActions.appendChild(signboardTooltip);
  topBar.appendChild(returnHubBtn);
  topBar.appendChild(topActions);
  ui.appendChild(topBar);

  const chatPanel = document.createElement("div");
  chatPanel.className = "chat-panel";
  const chatHoverZone = document.createElement("div");
  chatHoverZone.className = "chat-panel__hover-zone";
  const chatTabs = document.createElement("div");
  chatTabs.className = "chat-tabs";
  const worldTabBtn = document.createElement("button");
  worldTabBtn.type = "button";
  worldTabBtn.className = "chat-tabs__btn chat-tabs__btn--active";
  worldTabBtn.textContent = "World";
  const systemTabBtn = document.createElement("button");
  systemTabBtn.type = "button";
  systemTabBtn.className = "chat-tabs__btn";
  systemTabBtn.textContent = "System";
  chatTabs.appendChild(worldTabBtn);
  chatTabs.appendChild(systemTabBtn);
  const worldChatLog = document.createElement("div");
  worldChatLog.className = "chat-log chat-log--world";
  const systemChatLog = document.createElement("div");
  systemChatLog.className = "chat-log chat-log--system";
  systemChatLog.hidden = true;
  chatHoverZone.appendChild(chatTabs);
  chatHoverZone.appendChild(worldChatLog);
  chatHoverZone.appendChild(systemChatLog);
  chatPanel.appendChild(chatHoverZone);

  const CHAT_LOG_IDLE_MS = 45_000;
  const CHAT_LOG_LEAVE_HIDE_MS = 1800;
  let chatLogIdleTimer: ReturnType<typeof setTimeout> | null = null;
  let chatLogLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastChatLineAt = Date.now();
  let pointerInChatHoverZone = false;
  const finePointerMql =
    typeof window !== "undefined"
      ? window.matchMedia("(pointer: fine)")
      : null;

  function clearChatLogCollapseTimers(): void {
    if (chatLogIdleTimer) {
      clearTimeout(chatLogIdleTimer);
      chatLogIdleTimer = null;
    }
    if (chatLogLeaveTimer) {
      clearTimeout(chatLogLeaveTimer);
      chatLogLeaveTimer = null;
    }
  }

  function updateChatLogCollapsed(): void {
    if (!finePointerMql?.matches) return;
    if (document.activeElement === chatInput || pointerInChatHoverZone) {
      chatPanel.classList.remove("chat-panel--log-collapsed");
      return;
    }
    if (Date.now() - lastChatLineAt >= CHAT_LOG_IDLE_MS) {
      chatPanel.classList.add("chat-panel--log-collapsed");
    }
  }

  function armChatLogIdleCollapse(): void {
    if (!finePointerMql?.matches) return;
    if (chatLogIdleTimer) clearTimeout(chatLogIdleTimer);
    chatLogIdleTimer = setTimeout(() => {
      chatLogIdleTimer = null;
      updateChatLogCollapsed();
    }, CHAT_LOG_IDLE_MS);
  }

  function onChatPointerEnter(): void {
    if (!finePointerMql?.matches) return;
    pointerInChatHoverZone = true;
    if (chatLogLeaveTimer) {
      clearTimeout(chatLogLeaveTimer);
      chatLogLeaveTimer = null;
    }
    chatPanel.classList.remove("chat-panel--log-collapsed");
  }

  function onChatPointerLeave(): void {
    if (!finePointerMql?.matches) return;
    pointerInChatHoverZone = false;
    if (chatLogLeaveTimer) clearTimeout(chatLogLeaveTimer);
    chatLogLeaveTimer = setTimeout(() => {
      chatLogLeaveTimer = null;
      updateChatLogCollapsed();
    }, CHAT_LOG_LEAVE_HIDE_MS);
  }

  chatHoverZone.addEventListener("pointerenter", onChatPointerEnter);
  chatHoverZone.addEventListener("pointerleave", onChatPointerLeave);

  let activeChatTab: "world" | "system" = "world";
  const setChatTab = (tab: "world" | "system"): void => {
    activeChatTab = tab;
    const isWorld = tab === "world";
    worldTabBtn.classList.toggle("chat-tabs__btn--active", isWorld);
    systemTabBtn.classList.toggle("chat-tabs__btn--active", !isWorld);
    if (!isWorld) {
      systemTabBtn.classList.remove("chat-tabs__btn--has-unread");
    }
    worldChatLog.hidden = !isWorld;
    systemChatLog.hidden = isWorld;
  };
  worldTabBtn.addEventListener("click", () => setChatTab("world"));
  systemTabBtn.addEventListener("click", () => setChatTab("system"));

  const nimClaimBar = document.createElement("div");
  nimClaimBar.className = "nim-claim-bar";
  nimClaimBar.hidden = true;
  nimClaimBar.setAttribute("aria-live", "polite");
  nimClaimBar.innerHTML = `
    <div class="nim-claim-bar__label">NIM reward</div>
    <div class="nim-claim-bar__track">
      <div class="nim-claim-bar__fill"></div>
    </div>
    <div class="nim-claim-bar__hint"></div>
  `;
  const nimClaimFill = nimClaimBar.querySelector(
    ".nim-claim-bar__fill"
  ) as HTMLElement | null;
  const nimClaimHint = nimClaimBar.querySelector(
    ".nim-claim-bar__hint"
  ) as HTMLElement | null;
  ui.appendChild(nimClaimBar);

  const chatRow = document.createElement("div");
  chatRow.className = "chat-row";
  const chatInput = document.createElement("input");
  chatInput.type = "text";
  chatInput.className = "chat-input";
  chatInput.placeholder =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
      ? "Message…"
      : "Message… (Enter to send)";
  chatInput.autocomplete = "off";
  chatInput.maxLength = 256;
  chatRow.appendChild(chatInput);

  chatInput.addEventListener("focus", () => {
    if (!finePointerMql?.matches) return;
    chatPanel.classList.remove("chat-panel--log-collapsed");
    clearChatLogCollapseTimers();
  });
  chatInput.addEventListener("blur", () => {
    if (!finePointerMql?.matches) return;
    armChatLogIdleCollapse();
    queueMicrotask(() => updateChatLogCollapsed());
  });
  if (finePointerMql?.matches) {
    armChatLogIdleCollapse();
  }

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
    <div class="build-block-bar__surface">
      <div class="build-block-bar__surface-header">
        <div class="build-block-bar__title">Blocks</div>
        <button type="button" class="build-block-bar__advanced-toggle" aria-expanded="false" aria-controls="build-block-bar-advanced">Advanced</button>
      </div>
      <div class="build-block-bar__main-row">
        <div class="build-block-bar__quick" aria-label="Block shape and color">
          <div class="build-block-bar__shape-row" role="group" aria-label="Block shape">
            <button type="button" class="build-block-bar__shape-btn build-block-bar__shape-btn--active" data-shape="cube" aria-pressed="true" aria-label="Cube" title="Cube">C</button>
            <button type="button" class="build-block-bar__shape-btn" data-shape="hex" aria-pressed="false" aria-label="Hexagon" title="Hexagon">H</button>
            <button type="button" class="build-block-bar__shape-btn" data-shape="ramp" aria-pressed="false" aria-label="Ramp" title="Ramp">R</button>
          </div>
          <div class="build-block-bar__hue-ring-wrap" title="Color — drag on ring (snaps to nearest preset)">
            <div class="build-block-bar__hue-ring" role="slider" tabindex="0" aria-label="Block color" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0"></div>
            <div class="build-block-bar__hue-core" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <input type="checkbox" class="build-block-bar__hex" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
      <input type="checkbox" class="build-block-bar__ramp" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
      <div class="build-block-bar__tool-row" role="group" aria-label="Placement tool">
        <button type="button" class="build-block-bar__tool-btn build-block-bar__tool-btn--active" data-tool="block">Block</button>
        <button type="button" class="build-block-bar__tool-btn" data-tool="signpost">Signpost</button>
      </div>
    </div>
  `;

  const barAdvancedPopover = document.createElement("div");
  barAdvancedPopover.id = "build-block-bar-advanced";
  barAdvancedPopover.className = "build-block-bar-advanced";
  barAdvancedPopover.setAttribute("role", "dialog");
  barAdvancedPopover.setAttribute("aria-label", "More block options");
  barAdvancedPopover.hidden = true;
  barAdvancedPopover.innerHTML = `
    <div class="build-block-bar-advanced__inner">
      <div class="build-block-bar__popover-heading">Height</div>
      <div class="build-block-bar__height-segment" role="radiogroup" aria-label="Block height">
        <button type="button" class="build-block-bar__height-btn build-block-bar__height-btn--active" data-height="full" role="radio" aria-checked="true">Full</button>
        <button type="button" class="build-block-bar__height-btn" data-height="half" role="radio" aria-checked="false">Half</button>
        <button type="button" class="build-block-bar__height-btn" data-height="quarter" role="radio" aria-checked="false" title="Quarter height">¼</button>
      </div>
      <div class="build-block-bar__ramp-dir-row build-block-bar__ramp-dir-row--popover" hidden>
        <span class="build-block-bar__ramp-dir-label">Ramp rotation</span>
        <div class="build-block-bar__ramp-dir-controls">
          <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-ccw" title="Rotate counter-clockwise" aria-label="Rotate ramp counter-clockwise">↺</button>
          <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-cw" title="Rotate clockwise" aria-label="Rotate ramp clockwise">↻</button>
        </div>
      </div>
      <div class="build-block-bar__palette-label">Palette</div>
      <div class="build-block-bar__colors" aria-label="Preset colors">
        <div class="build-block-bar__swatches-recent"></div>
        <button type="button" class="build-block-bar__more-colors">More colors</button>
        <div class="build-block-bar__swatches-all" hidden></div>
      </div>
      <div class="build-block-bar__experimental-only" hidden>
        <div class="build-block-bar__popover-divider" aria-hidden="true"></div>
        <div class="build-block-bar__popover-heading">Experimental</div>
        <button type="button" class="build-block-bar__claim-toggle" aria-pressed="false">Claimable (mining)</button>
        <p class="build-block-bar__experimental-hint">When on, players can mine this block for rewards.</p>
      </div>
    </div>
  `;

  const bottomLeftStack = document.createElement("div");
  bottomLeftStack.className = "hud-bottom-left";
  /* column-reverse: bottom = chat input, then chat log + tabs (build bar is bottom-right) */
  bottomLeftStack.appendChild(chatRow);
  bottomLeftStack.appendChild(chatPanel);
  ui.appendChild(bottomLeftStack);
  ui.appendChild(buildBlockBar);
  ui.appendChild(barAdvancedPopover);

  const objectPanelAdvancedPopover = document.createElement("div");
  objectPanelAdvancedPopover.id = "build-object-panel-advanced";
  objectPanelAdvancedPopover.className = "build-object-panel-advanced";
  objectPanelAdvancedPopover.setAttribute("role", "dialog");
  objectPanelAdvancedPopover.setAttribute("aria-label", "More block options");
  objectPanelAdvancedPopover.hidden = true;
  ui.appendChild(objectPanelAdvancedPopover);

  const barHeightBtns = Array.from(
    barAdvancedPopover.querySelectorAll(".build-block-bar__height-btn")
  ) as HTMLButtonElement[];
  const barClaimToggle = barAdvancedPopover.querySelector(
    ".build-block-bar__claim-toggle"
  ) as HTMLButtonElement;
  const barExperimentalOnly = barAdvancedPopover.querySelector(
    ".build-block-bar__experimental-only"
  ) as HTMLElement;
  const barHexCb = buildBlockBar.querySelector(
    ".build-block-bar__hex"
  ) as HTMLInputElement;
  const barRampCb = buildBlockBar.querySelector(
    ".build-block-bar__ramp"
  ) as HTMLInputElement;
  const barRampDirRow = barAdvancedPopover.querySelector(
    ".build-block-bar__ramp-dir-row"
  ) as HTMLElement;
  const barRampRotCCW = barAdvancedPopover.querySelector(
    ".build-block-bar__ramp-ccw"
  ) as HTMLButtonElement;
  const barRampRotCW = barAdvancedPopover.querySelector(
    ".build-block-bar__ramp-cw"
  ) as HTMLButtonElement;
  let barRampDir = 0;
  const barSwatchesRecent = barAdvancedPopover.querySelector(
    ".build-block-bar__swatches-recent"
  ) as HTMLDivElement;
  const barSwatchesAll = barAdvancedPopover.querySelector(
    ".build-block-bar__swatches-all"
  ) as HTMLDivElement;
  const barMoreColorsBtn = barAdvancedPopover.querySelector(
    ".build-block-bar__more-colors"
  ) as HTMLButtonElement;
  const barAdvancedToggle = buildBlockBar.querySelector(
    ".build-block-bar__advanced-toggle"
  ) as HTMLButtonElement;
  const barToolButtons = Array.from(buildBlockBar.querySelectorAll(".build-block-bar__tool-btn")) as HTMLButtonElement[];
  const barShapeBtns = Array.from(
    buildBlockBar.querySelectorAll(".build-block-bar__shape-btn")
  ) as HTMLButtonElement[];
  const barHueRingWrap = buildBlockBar.querySelector(
    ".build-block-bar__hue-ring-wrap"
  ) as HTMLElement;
  const barHueRing = buildBlockBar.querySelector(
    ".build-block-bar__hue-ring"
  ) as HTMLElement;
  const barHueCore = buildBlockBar.querySelector(
    ".build-block-bar__hue-core"
  ) as HTMLElement;
  const barTitleEl = buildBlockBar.querySelector(
    ".build-block-bar__title"
  ) as HTMLElement;

  let lastHueDeg = 0;

  function refreshBuildBarTitle(): void {
    if (!barTitleEl) return;
    if (signpostModeActive) {
      barTitleEl.textContent = "Place Signpost";
      return;
    }
    if (barRampCb.checked) barTitleEl.textContent = "Ramp";
    else if (barHexCb.checked) barTitleEl.textContent = "Hexagon";
    else barTitleEl.textContent = "Cube";
  }

  const signpostTextarea = signpostOverlay.querySelector(".signpost-overlay__textarea") as HTMLTextAreaElement;
  const signpostCharCount = signpostOverlay.querySelector(".signpost-overlay__char-count") as HTMLElement;
  const signpostCancelBtn = signpostOverlay.querySelector(".signpost-overlay__btn--cancel") as HTMLButtonElement;
  const signpostCreateBtn = signpostOverlay.querySelector(".signpost-overlay__btn--create") as HTMLButtonElement;
  
  let signpostPendingTile: { x: number; z: number } | null = null;
  let signpostPlaceHandler: ((x: number, z: number, message: string) => void) | null = null;

  // Signpost mode (non-admin, for everyone)
  let signpostModeActive = false;

  // Signpost textarea character counter
  if (signpostTextarea && signpostCharCount) {
    signpostTextarea.addEventListener("input", () => {
      const len = signpostTextarea.value.length;
      signpostCharCount.textContent = `${len} / ${SIGNPOST_MESSAGE_MAX}`;
    });
  }

  if (signpostCancelBtn) {
    signpostCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      signpostOverlay.hidden = true;
      if (signpostTextarea) signpostTextarea.value = "";
      if (signpostCharCount) signpostCharCount.textContent = `0 / ${SIGNPOST_MESSAGE_MAX}`;
      signpostPendingTile = null;
    });
  }

  if (signpostCreateBtn) {
    signpostCreateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!signpostTextarea || !signpostPendingTile) return;
      const message = signpostTextarea.value.trim();
      if (!message) return;
      
      signpostPlaceHandler?.(signpostPendingTile.x, signpostPendingTile.z, message);
      signpostOverlay.hidden = true;
      signpostTextarea.value = "";
      if (signpostCharCount) signpostCharCount.textContent = `0 / ${SIGNPOST_MESSAGE_MAX}`;
      signpostPendingTile = null;
    });
  }

  if (signpostTextarea) {
    signpostTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        signpostCreateBtn?.click();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        signpostCancelBtn?.click();
      }
      e.stopPropagation();
    });
  }

  // Tool selector (block vs signpost)
  barToolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool as string | undefined;
      if (tool === "signpost") {
        signpostModeActive = true;
        barToolButtons.forEach((b) => b.classList.remove("build-block-bar__tool-btn--active"));
        btn.classList.add("build-block-bar__tool-btn--active");
      } else {
        signpostModeActive = false;
        barToolButtons.forEach((b) => b.classList.remove("build-block-bar__tool-btn--active"));
        btn.classList.add("build-block-bar__tool-btn--active");
      }
      refreshBuildBarTitle();
    });
  });

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
    claimable?: boolean;
  }) => void = (): void => {};

  function syncBarHeightButtons(quarter: boolean, half: boolean): void {
    barHeightBtns.forEach((b) => {
      const h = b.dataset.height;
      const on =
        (h === "quarter" && quarter) ||
        (h === "half" && !quarter && half) ||
        (h === "full" && !quarter && !half);
      b.classList.toggle("build-block-bar__height-btn--active", !!on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function layoutBarAdvancedPopover(): void {
    if (barAdvancedPopover.hidden || buildBlockBar.hidden) return;
    const br = buildBlockBar.getBoundingClientRect();
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const w = Math.min(260, Math.max(180, br.width));
    barAdvancedPopover.style.width = `${w}px`;
    barAdvancedPopover.style.maxWidth = `${Math.max(120, vw - 16)}px`;
    const right = Math.max(0, vw - br.right);
    barAdvancedPopover.style.right = `${right}px`;
    barAdvancedPopover.style.left = "auto";
    const pr = barAdvancedPopover.getBoundingClientRect();
    let top = br.top - pr.height - margin;
    const minTop = 52;
    if (top < minTop) top = minTop;
    if (top + pr.height > vh - margin) {
      top = Math.max(minTop, vh - margin - pr.height);
    }
    barAdvancedPopover.style.top = `${top}px`;
    barAdvancedPopover.style.bottom = "auto";
  }

  function setBarPopoverOpen(open: boolean): void {
    barAdvancedPopover.hidden = !open;
    barAdvancedToggle.setAttribute("aria-expanded", open ? "true" : "false");
    barAdvancedToggle.classList.toggle(
      "build-block-bar__advanced-toggle--open",
      open
    );
    if (open) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => layoutBarAdvancedPopover());
      });
    }
  }

  barHeightBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const h = btn.dataset.height;
      if (h === "full") {
        placementStyleHandler({ quarter: false, half: false });
        syncBarHeightButtons(false, false);
      } else if (h === "half") {
        placementStyleHandler({ quarter: false, half: true });
        syncBarHeightButtons(false, true);
      } else if (h === "quarter") {
        placementStyleHandler({ quarter: true, half: false });
        syncBarHeightButtons(true, false);
      }
    });
  });

  barHexCb.addEventListener("change", () => {
    placementStyleHandler({ hex: barHexCb.checked });
    syncBarShapeButtons();
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
    syncBarShapeButtons();
  });

  function syncBarShapeButtons(): void {
    const ramp = barRampCb.checked;
    const hex = barHexCb.checked && !ramp;
    const cube = !hex && !ramp;
    barShapeBtns.forEach((b) => {
      const shape = b.dataset.shape;
      const on =
        (shape === "cube" && cube) ||
        (shape === "hex" && hex) ||
        (shape === "ramp" && ramp);
      b.classList.toggle("build-block-bar__shape-btn--active", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    refreshBuildBarTitle();
  }

  function applyHueDegrees(hueDeg: number): void {
    const h = ((hueDeg % 360) + 360) % 360;
    lastHueDeg = Math.round(h);
    barHueRing.setAttribute("aria-valuenow", String(lastHueDeg));
    const { r, g, b } = hslToRgb(h / 360, 0.92, 0.48);
    const id = nearestPaletteColorIdFromRgb(r, g, b);
    rebuildBarRecentSwatches(pushRecentColorId(id));
    placementStyleHandler({ colorId: id });
    refreshBarSwatches(id);
  }

  function ringHueFromClient(
    ringEl: HTMLElement,
    clientX: number,
    clientY: number
  ): number | null {
    const ringRect = ringEl.getBoundingClientRect();
    const cx = ringRect.left + ringRect.width / 2;
    const cy = ringRect.top + ringRect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const outer = ringRect.width * 0.5;
    const inner = ringRect.width * 0.22;
    if (dist < inner || dist === 0) return null;
    if (dist > outer) {
      const ang = Math.atan2(dy, dx);
      let deg = (ang * 180) / Math.PI;
      return (deg + 90 + 360) % 360;
    }
    const ang = Math.atan2(dy, dx);
    let deg = (ang * 180) / Math.PI;
    return (deg + 90 + 360) % 360;
  }

  function onHuePointer(ev: PointerEvent): void {
    const hue = ringHueFromClient(barHueRing, ev.clientX, ev.clientY);
    if (hue === null) return;
    applyHueDegrees(hue);
  }

  barHueRingWrap.addEventListener("pointerdown", (e) => {
    barHueRingWrap.setPointerCapture(e.pointerId);
    onHuePointer(e);
  });
  barHueRingWrap.addEventListener("pointermove", (e) => {
    if (!barHueRingWrap.hasPointerCapture(e.pointerId)) return;
    onHuePointer(e);
  });
  barHueRingWrap.addEventListener("pointerup", (e) => {
    if (barHueRingWrap.hasPointerCapture(e.pointerId)) {
      try {
        barHueRingWrap.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  });
  barHueRingWrap.addEventListener("pointercancel", (ev) => {
    try {
      barHueRingWrap.releasePointerCapture(ev.pointerId);
    } catch {
      /* */
    }
  });

  barHueRing.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      applyHueDegrees(lastHueDeg - 12);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      applyHueDegrees(lastHueDeg + 12);
    }
  });

  barShapeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const shape = btn.dataset.shape;
      if (shape === "cube") {
        barHexCb.checked = false;
        barRampCb.checked = false;
        barRampDirRow.hidden = true;
        placementStyleHandler({ hex: false, ramp: false });
      } else if (shape === "hex") {
        barHexCb.checked = true;
        barRampCb.checked = false;
        barRampDirRow.hidden = true;
        placementStyleHandler({ hex: true, ramp: false });
      } else if (shape === "ramp") {
        barRampCb.checked = true;
        barHexCb.checked = false;
        barRampDirRow.hidden = false;
        placementStyleHandler({ ramp: true, hex: false });
      }
      syncBarShapeButtons();
    });
  });

  syncBarShapeButtons();

  let barColorsExpanded = false;
  barMoreColorsBtn.addEventListener("click", () => {
    barColorsExpanded = !barColorsExpanded;
    barSwatchesAll.hidden = !barColorsExpanded;
    barMoreColorsBtn.textContent = barColorsExpanded
      ? "Hide colors"
      : "More colors";
    if (!barAdvancedPopover.hidden) {
      requestAnimationFrame(() => layoutBarAdvancedPopover());
    }
  });

  barAdvancedToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setBarPopoverOpen(barAdvancedPopover.hidden);
  });

  barAdvancedToggle.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !barAdvancedPopover.hidden) {
      e.preventDefault();
      setBarPopoverOpen(false);
    }
  });

  barClaimToggle.addEventListener("click", () => {
    const next = barClaimToggle.getAttribute("aria-pressed") !== "true";
    barClaimToggle.setAttribute("aria-pressed", next ? "true" : "false");
    barClaimToggle.classList.toggle("build-block-bar__claim-toggle--active", next);
    placementStyleHandler({ claimable: next });
  });

  function onBarColorSwatchClick(ev: Event): void {
    const t = ev.target as HTMLElement;
    const btn = t.closest(".block-color-swatch") as HTMLButtonElement | null;
    if (!btn) return;
    if (!buildBlockBar.contains(btn) && !barAdvancedPopover.contains(btn)) {
      return;
    }
    const id = Number(btn.dataset.colorId);
    if (!Number.isFinite(id)) return;
    rebuildBarRecentSwatches(pushRecentColorId(id));
    placementStyleHandler({ colorId: id });
    refreshBarSwatches(id);
  }
  buildBlockBar.addEventListener("click", onBarColorSwatchClick);
  barAdvancedPopover.addEventListener("click", onBarColorSwatchClick);

  let fsHandler = (): void => {};
  let reconnectHandler = (): void => {};
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
  reconnectBtn.addEventListener("click", () => reconnectHandler());
  returnHubBtn.addEventListener("click", () => returnHubHandler());
  lobbyBtn.addEventListener("click", () => openLobbyConfirm());
  walkModeBtn.addEventListener("click", () => playModeHandler("walk"));
  buildModeBtn.addEventListener("click", () => playModeHandler("build"));
  floorModeBtn.addEventListener("click", () => playModeHandler("floor"));

  const ro = new ResizeObserver(() => {
    layoutLetterbox(frame, letter);
    layoutBarAdvancedPopover();
    layoutObjectPanelAdvancedPopover();
  });
  ro.observe(frame);

  layoutLetterbox(frame, letter);

  let objectPanel: HTMLDivElement | null = null;
  let panelPassBtns: HTMLButtonElement[] = [];
  let panelLockBtns: HTMLButtonElement[] = [];
  let lockOptionBlock: HTMLElement | null = null;
  /** When lock UI is hidden (non-admin), server lock state for emit. */
  let panelLockedState = false;
  let panelHexCb: HTMLInputElement | null = null;
  let panelRampCb: HTMLInputElement | null = null;
  let panelHeightBtns: HTMLButtonElement[] = [];
  let panelShapeBtns: HTMLButtonElement[] = [];
  let rampDirRow: HTMLElement | null = null;
  let panelRampRotCCW: HTMLButtonElement | null = null;
  let panelRampRotCW: HTMLButtonElement | null = null;
  let panelRampDir = 0;
  let panelColorRoot: HTMLElement | null = null;
  let panelSwatchesRecent: HTMLDivElement | null = null;
  let panelSwatchesAll: HTMLDivElement | null = null;
  let panelMoreColorsBtn: HTMLButtonElement | null = null;
  let panelAdvancedToggle: HTMLButtonElement | null = null;
  let panelSelectedColorId = 0;
  let panelOnPropsChange: ((p: ObstacleProps) => void) | null = null;
  let panelLastHueDeg = 0;
  let panelHueRingWrap: HTMLElement | null = null;
  let panelHueRing: HTMLElement | null = null;
  let panelHueCore: HTMLElement | null = null;
  let panelTitleTextEl: HTMLElement | null = null;
  let panelEditX = 0;
  let panelEditZ = 0;

  function layoutObjectPanelAdvancedPopover(): void {
    if (objectPanelAdvancedPopover.hidden) return;
    if (!objectPanel || !panelAdvancedToggle) return;
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const panelBr = objectPanel.getBoundingClientRect();
    const w = Math.min(260, Math.max(200, Math.min(panelBr.width + 40, 280)));
    objectPanelAdvancedPopover.style.width = `${w}px`;
    objectPanelAdvancedPopover.style.maxWidth = `${Math.max(120, vw - 16)}px`;
    const right = Math.max(0, vw - panelBr.right);
    objectPanelAdvancedPopover.style.right = `${right}px`;
    objectPanelAdvancedPopover.style.left = "auto";
    const minTop = 52;
    /* Prefer below the object card; measure after width so height is stable */
    objectPanelAdvancedPopover.style.top = `${panelBr.bottom + margin}px`;
    objectPanelAdvancedPopover.style.bottom = "auto";
    let top = panelBr.bottom + margin;
    let pr = objectPanelAdvancedPopover.getBoundingClientRect();
    if (pr.bottom > vh - margin) {
      top = panelBr.top - pr.height - margin;
      objectPanelAdvancedPopover.style.top = `${top}px`;
      pr = objectPanelAdvancedPopover.getBoundingClientRect();
    }
    if (top < minTop) {
      top = minTop;
      objectPanelAdvancedPopover.style.top = `${top}px`;
      pr = objectPanelAdvancedPopover.getBoundingClientRect();
    }
    if (pr.bottom > vh - margin) {
      top = Math.max(minTop, vh - margin - pr.height);
      objectPanelAdvancedPopover.style.top = `${top}px`;
    }
  }

  function setPanelAdvancedOpen(open: boolean): void {
    objectPanelAdvancedPopover.hidden = !open;
    if (panelAdvancedToggle) {
      panelAdvancedToggle.setAttribute("aria-expanded", open ? "true" : "false");
      panelAdvancedToggle.classList.toggle(
        "build-object-panel__advanced-toggle--open",
        open
      );
    }
    if (open) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => layoutObjectPanelAdvancedPopover());
      });
    }
  }

  const closeHudAdvancedPopoversOnOutside = (ev: PointerEvent): void => {
    const t = ev.target as Node;
    if (!barAdvancedPopover.hidden) {
      if (buildBlockBar.contains(t) || barAdvancedPopover.contains(t)) return;
      setBarPopoverOpen(false);
    }
    if (!objectPanelAdvancedPopover.hidden) {
      if (
        (objectPanel && objectPanel.contains(t)) ||
        objectPanelAdvancedPopover.contains(t)
      ) {
        return;
      }
      setPanelAdvancedOpen(false);
    }
  };
  document.addEventListener("pointerdown", closeHudAdvancedPopoversOnOutside);

  function refreshObjectPanelTitle(): void {
    if (!panelTitleTextEl || !panelRampCb || !panelHexCb) return;
    const ramp = panelRampCb.checked;
    const hex = ramp ? false : panelHexCb.checked;
    panelTitleTextEl.textContent = `${obstacleShapeLabel(ramp, hex)} (${panelEditX}, ${panelEditZ})`;
  }

  function syncPanelHeightButtons(quarter: boolean, half: boolean): void {
    panelHeightBtns.forEach((b) => {
      const h = b.dataset.height;
      const on =
        (h === "quarter" && quarter) ||
        (h === "half" && !quarter && half) ||
        (h === "full" && !quarter && !half);
      b.classList.toggle("build-block-bar__height-btn--active", !!on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function syncPanelShapeButtons(): void {
    if (!panelShapeBtns.length || !panelRampCb || !panelHexCb) return;
    const ramp = panelRampCb.checked;
    const hex = panelHexCb.checked && !ramp;
    const cube = !hex && !ramp;
    panelShapeBtns.forEach((b) => {
      const shape = b.dataset.shape;
      const on =
        (shape === "cube" && cube) ||
        (shape === "hex" && hex) ||
        (shape === "ramp" && ramp);
      b.classList.toggle("build-block-bar__shape-btn--active", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    refreshObjectPanelTitle();
  }

  function syncPanelPassButtons(passable: boolean): void {
    panelPassBtns.forEach((b) => {
      const on =
        (b.dataset.collision === "pass" && passable) ||
        (b.dataset.collision === "solid" && !passable);
      b.classList.toggle("build-block-bar__height-btn--active", !!on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function syncPanelLockButtons(locked: boolean): void {
    panelLockBtns.forEach((b) => {
      const on =
        (b.dataset.lock === "true" && locked) ||
        (b.dataset.lock === "false" && !locked);
      b.classList.toggle("build-block-bar__height-btn--active", !!on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function getPanelPassable(): boolean {
    return panelPassBtns.some(
      (b) =>
        b.dataset.collision === "pass" &&
        b.classList.contains("build-block-bar__height-btn--active")
    );
  }

  function getPanelLocked(): boolean {
    if (lockOptionBlock?.hidden) return panelLockedState;
    return panelLockBtns.some(
      (b) =>
        b.dataset.lock === "true" &&
        b.classList.contains("build-block-bar__height-btn--active")
    );
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
    if (
      !btn ||
      (!objectPanel?.contains(btn) &&
        !objectPanelAdvancedPopover.contains(btn))
    ) {
      return;
    }
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
    syncPanelHueVisualFromColorId(panelSelectedColorId);
    emitPanelProps();
  }

  function emitPanelProps(): void {
    if (
      !panelOnPropsChange ||
      panelPassBtns.length === 0 ||
      !panelHexCb ||
      !panelRampCb ||
      panelHeightBtns.length === 0
    ) {
      return;
    }
    const quarter = panelHeightBtns.some(
      (b) =>
        b.dataset.height === "quarter" &&
        b.classList.contains("build-block-bar__height-btn--active")
    );
    const halfMode = panelHeightBtns.some(
      (b) =>
        b.dataset.height === "half" &&
        b.classList.contains("build-block-bar__height-btn--active")
    );
    const half = quarter ? false : halfMode;
    const ramp = panelRampCb.checked;
    const rampDir = Math.max(0, Math.min(3, Math.floor(panelRampDir)));
    const locked = getPanelLocked();

    panelOnPropsChange({
      passable: getPanelPassable(),
      quarter,
      half,
      hex: ramp ? false : panelHexCb.checked,
      ramp,
      rampDir: ramp ? rampDir : 0,
      colorId: panelSelectedColorId,
      locked,
    });
    refreshObjectPanelTitle();
  }

  function applyPanelHueDegrees(hueDeg: number): void {
    if (!panelHueRing || !panelHueCore) return;
    const h = ((hueDeg % 360) + 360) % 360;
    panelLastHueDeg = Math.round(h);
    panelHueRing.setAttribute("aria-valuenow", String(panelLastHueDeg));
    const { r, g, b } = hslToRgb(h / 360, 0.92, 0.48);
    const id = nearestPaletteColorIdFromRgb(r, g, b);
    panelSelectedColorId = id;
    if (panelSwatchesRecent) {
      const ids = pushRecentColorId(id);
      panelSwatchesRecent.replaceChildren();
      for (const rid of ids) {
        panelSwatchesRecent.appendChild(makeColorSwatchButton(rid));
      }
    }
    syncPanelSwatchSelection();
    const sid = Math.max(
      0,
      Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(id))
    );
    panelHueCore.style.background = cssHex(BLOCK_COLOR_PALETTE[sid]!);
    emitPanelProps();
  }

  function syncPanelHueVisualFromColorId(colorId: number): void {
    if (!panelHueRing || !panelHueCore) return;
    const sid = Math.max(
      0,
      Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(colorId))
    );
    panelLastHueDeg = Math.round(estimateHueFromPaletteId(sid));
    panelHueRing.setAttribute("aria-valuenow", String(panelLastHueDeg));
    panelHueCore.style.background = cssHex(BLOCK_COLOR_PALETTE[sid]!);
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
    setPanelAdvancedOpen(false);
    objectPanelAdvancedPopover.replaceChildren();
    objectPanelAdvancedPopover.hidden = true;
    if (objectPanel) {
      objectPanel.remove();
      objectPanel = null;
      panelPassBtns = [];
      panelLockBtns = [];
      lockOptionBlock = null;
      panelHexCb = null;
      panelRampCb = null;
      panelHeightBtns = [];
      panelShapeBtns = [];
      rampDirRow = null;
      panelRampRotCCW = null;
      panelRampRotCW = null;
      panelColorRoot = null;
      panelSwatchesRecent = null;
      panelSwatchesAll = null;
      panelMoreColorsBtn = null;
      panelAdvancedToggle = null;
      panelHueRingWrap = null;
      panelHueRing = null;
      panelHueCore = null;
      panelTitleTextEl = null;
      panelOnPropsChange = null;
      panelLockedState = false;
    }
  }

  function refreshBarSwatches(selectedId: number): void {
    const buttons = barAdvancedPopover.querySelectorAll(".block-color-swatch");
    buttons.forEach((node) => {
      const el = node as HTMLButtonElement;
      const id = Number(el.dataset.colorId);
      el.classList.toggle(
        "block-color-swatch--selected",
        id === selectedId
      );
    });
    const sid = Math.max(
      0,
      Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(selectedId))
    );
    barHueCore.style.background = cssHex(BLOCK_COLOR_PALETTE[sid]!);
  }

  const lastSystemChatAtByText = new Map<string, number>();

  return {
    setStatus(s: string) {
      status.textContent = s;
    },
    appendChat(from: string, text: string) {
      const isSystem = from.trim().toLowerCase() === "system";
      if (isSystem) {
        const now = Date.now();
        const key = text.trim();
        const lastAt = lastSystemChatAtByText.get(key) ?? 0;
        // Suppress rapid duplicate system messages (e.g. claim retry spam).
        if (now - lastAt < 2500) {
          return;
        }
        lastSystemChatAtByText.set(key, now);
      }
      const line = document.createElement("div");
      line.className = "chat-line";
      line.textContent = `${from}: ${text}`;
      const targetLog = isSystem ? systemChatLog : worldChatLog;
      targetLog.appendChild(line);
      targetLog.scrollTop = targetLog.scrollHeight;
      if (isSystem && activeChatTab !== "system") {
        systemTabBtn.classList.add("chat-tabs__btn--has-unread");
      }
      lastChatLineAt = Date.now();
      chatPanel.classList.remove("chat-panel--log-collapsed");
      clearChatLogCollapseTimers();
      armChatLogIdleCollapse();
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
    setRoomEditCaps(caps: {
      allowPlaceBlocks: boolean;
      allowExtraFloor: boolean;
    }) {
      roomAllowPlaceBlocks = caps.allowPlaceBlocks;
      roomAllowExtraFloor = caps.allowExtraFloor;
      applyRoomEditCaps();
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
      panelEditX = opts.x;
      panelEditZ = opts.z;
      const lockIcon = opts.locked
        ? '<span class="nq-icon nq-lock-locked build-object-panel__lock-icon" title="This object is locked"></span>'
        : "";
      objectPanel.innerHTML = `
        <div class="build-object-panel__surface">
          <div class="build-object-panel__surface-header">
            <div class="build-object-panel__title">
              <span class="build-object-panel__title-text"></span>${lockIcon}
            </div>
            <div class="build-object-panel__header-actions">
              <button type="button" class="build-object-panel__btn build-object-panel__move">Move</button>
              <button type="button" class="build-object-panel__btn build-object-panel__remove">Delete</button>
              <button type="button" class="build-object-panel__dismiss" aria-label="Close block editor">✕</button>
            </div>
          </div>
          <div class="build-object-panel__main-row">
            <div class="build-object-panel__quick" aria-label="Block shape and color">
              <div class="build-block-bar__shape-row" role="group" aria-label="Block shape">
                <button type="button" class="build-block-bar__shape-btn build-block-bar__shape-btn--active" data-shape="cube" aria-pressed="true" aria-label="Cube" title="Cube">C</button>
                <button type="button" class="build-block-bar__shape-btn" data-shape="hex" aria-pressed="false" aria-label="Hexagon" title="Hexagon">H</button>
                <button type="button" class="build-block-bar__shape-btn" data-shape="ramp" aria-pressed="false" aria-label="Ramp" title="Ramp">R</button>
              </div>
              <div class="build-object-panel__hue-ring-wrap" title="Color — drag on ring (snaps to nearest preset)">
                <div class="build-object-panel__hue-ring" role="slider" tabindex="0" aria-label="Block color" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0"></div>
                <div class="build-object-panel__hue-core" aria-hidden="true"></div>
              </div>
            </div>
          </div>
          <input type="checkbox" class="build-object-panel__hex" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
          <input type="checkbox" class="build-object-panel__ramp" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
          <button type="button" class="build-object-panel__advanced-toggle" aria-expanded="false" aria-controls="build-object-panel-advanced">Advanced</button>
        </div>
      `;
      objectPanelAdvancedPopover.innerHTML = `
        <div class="build-object-panel-advanced__inner">
          <div class="build-block-bar__popover-heading">Collision</div>
          <div class="build-block-bar__height-segment" role="radiogroup" aria-label="Collision">
            <button type="button" class="build-block-bar__height-btn build-block-bar__height-btn--active" data-collision="solid" role="radio" aria-checked="true">Solid</button>
            <button type="button" class="build-block-bar__height-btn" data-collision="pass" role="radio" aria-checked="false">No collision</button>
          </div>
          <div class="build-object-panel-adv__lock-block" hidden>
            <div class="build-block-bar__popover-heading">Lock</div>
            <div class="build-block-bar__height-segment" role="radiogroup" aria-label="Lock block">
              <button type="button" class="build-block-bar__height-btn build-block-bar__height-btn--active" data-lock="false" role="radio" aria-checked="true">Unlocked</button>
              <button type="button" class="build-block-bar__height-btn" data-lock="true" role="radio" aria-checked="false">Locked</button>
            </div>
          </div>
          <div class="build-block-bar__popover-heading">Height</div>
          <div class="build-block-bar__height-segment" role="radiogroup" aria-label="Block height">
            <button type="button" class="build-block-bar__height-btn build-block-bar__height-btn--active" data-height="full" role="radio" aria-checked="true">Full</button>
            <button type="button" class="build-block-bar__height-btn" data-height="half" role="radio" aria-checked="false">Half</button>
            <button type="button" class="build-block-bar__height-btn" data-height="quarter" role="radio" aria-checked="false" title="Quarter height">¼</button>
          </div>
          <div class="build-block-bar__ramp-dir-row build-block-bar__ramp-dir-row--popover" hidden>
            <span class="build-block-bar__ramp-dir-label">Ramp rotation</span>
            <div class="build-block-bar__ramp-dir-controls">
              <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-ccw" title="Rotate counter-clockwise" aria-label="Rotate ramp counter-clockwise">↺</button>
              <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-cw" title="Rotate clockwise" aria-label="Rotate ramp clockwise">↻</button>
            </div>
          </div>
          <div class="build-block-bar__palette-label">Palette</div>
          <div class="build-block-bar__colors" aria-label="Preset colors">
            <div class="build-object-panel-adv__swatches-recent"></div>
            <button type="button" class="build-block-bar__more-colors">More colors</button>
            <div class="build-object-panel-adv__swatches-all" hidden></div>
          </div>
        </div>
      `;
      topActions.appendChild(objectPanel);
      panelTitleTextEl = objectPanel.querySelector(
        ".build-object-panel__title-text"
      ) as HTMLElement;
      panelPassBtns = Array.from(
        objectPanelAdvancedPopover.querySelectorAll(
          ".build-block-bar__height-btn[data-collision]"
        )
      ) as HTMLButtonElement[];
      panelLockBtns = Array.from(
        objectPanelAdvancedPopover.querySelectorAll(
          ".build-block-bar__height-btn[data-lock]"
        )
      ) as HTMLButtonElement[];
      lockOptionBlock = objectPanelAdvancedPopover.querySelector(
        ".build-object-panel-adv__lock-block"
      ) as HTMLElement | null;
      rampDirRow = objectPanelAdvancedPopover.querySelector(
        ".build-block-bar__ramp-dir-row"
      ) as HTMLElement;
      panelRampRotCCW = objectPanelAdvancedPopover.querySelector(
        ".build-block-bar__ramp-ccw"
      ) as HTMLButtonElement;
      panelRampRotCW = objectPanelAdvancedPopover.querySelector(
        ".build-block-bar__ramp-cw"
      ) as HTMLButtonElement;
      panelRampDir = Math.max(0, Math.min(3, Math.floor(opts.rampDir)));
      panelHeightBtns = Array.from(
        objectPanelAdvancedPopover.querySelectorAll(
          ".build-block-bar__height-btn[data-height]"
        )
      ) as HTMLButtonElement[];
      panelShapeBtns = Array.from(
        objectPanel.querySelectorAll(".build-block-bar__shape-btn")
      ) as HTMLButtonElement[];
      panelHexCb = objectPanel.querySelector(
        ".build-object-panel__hex"
      ) as HTMLInputElement;
      panelRampCb = objectPanel.querySelector(
        ".build-object-panel__ramp"
      ) as HTMLInputElement;
      panelColorRoot = objectPanelAdvancedPopover.querySelector(
        ".build-block-bar__colors"
      ) as HTMLElement;
      panelSwatchesRecent = objectPanelAdvancedPopover.querySelector(
        ".build-object-panel-adv__swatches-recent"
      ) as HTMLDivElement;
      panelSwatchesAll = objectPanelAdvancedPopover.querySelector(
        ".build-object-panel-adv__swatches-all"
      ) as HTMLDivElement;
      panelMoreColorsBtn = objectPanelAdvancedPopover.querySelector(
        ".build-block-bar__more-colors"
      ) as HTMLButtonElement;
      panelAdvancedToggle = objectPanel.querySelector(
        ".build-object-panel__advanced-toggle"
      ) as HTMLButtonElement;
      panelHueRingWrap = objectPanel.querySelector(
        ".build-object-panel__hue-ring-wrap"
      ) as HTMLElement;
      panelHueRing = objectPanel.querySelector(
        ".build-object-panel__hue-ring"
      ) as HTMLElement;
      panelHueCore = objectPanel.querySelector(
        ".build-object-panel__hue-core"
      ) as HTMLElement;
      syncPanelPassButtons(opts.passable);
      panelLockedState = opts.locked || false;
      syncPanelLockButtons(panelLockedState);
      if (lockOptionBlock) {
        lockOptionBlock.hidden = !opts.isAdmin;
      }
      syncPanelHeightButtons(opts.quarter, opts.quarter ? false : opts.half);
      panelHexCb.checked = opts.ramp ? false : opts.hex;
      panelRampCb.checked = opts.ramp;
      rampDirRow.hidden = !opts.ramp;
      syncPanelShapeButtons();

      refreshObjectPanelTitle();
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
        if (!objectPanelAdvancedPopover.hidden) {
          requestAnimationFrame(() => layoutObjectPanelAdvancedPopover());
        }
      });
      panelAdvancedToggle!.addEventListener("click", (e) => {
        e.stopPropagation();
        setPanelAdvancedOpen(objectPanelAdvancedPopover.hidden);
      });
      panelAdvancedToggle!.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !objectPanelAdvancedPopover.hidden) {
          e.preventDefault();
          setPanelAdvancedOpen(false);
        }
      });
      syncPanelSwatchSelection();
      syncPanelHueVisualFromColorId(panelSelectedColorId);
      wirePanelColorClicks();

      function onPanelHuePointer(ev: PointerEvent): void {
        if (!panelHueRing) return;
        const hue = ringHueFromClient(panelHueRing, ev.clientX, ev.clientY);
        if (hue === null) return;
        applyPanelHueDegrees(hue);
      }
      panelHueRingWrap!.addEventListener("pointerdown", (e) => {
        panelHueRingWrap!.setPointerCapture(e.pointerId);
        onPanelHuePointer(e);
      });
      panelHueRingWrap!.addEventListener("pointermove", (e) => {
        if (!panelHueRingWrap!.hasPointerCapture(e.pointerId)) return;
        onPanelHuePointer(e);
      });
      panelHueRingWrap!.addEventListener("pointerup", (e) => {
        if (panelHueRingWrap!.hasPointerCapture(e.pointerId)) {
          try {
            panelHueRingWrap!.releasePointerCapture(e.pointerId);
          } catch {
            /* already released */
          }
        }
      });
      panelHueRingWrap!.addEventListener("pointercancel", (ev) => {
        try {
          panelHueRingWrap!.releasePointerCapture(ev.pointerId);
        } catch {
          /* */
        }
      });
      panelHueRing!.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          applyPanelHueDegrees(panelLastHueDeg - 12);
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          applyPanelHueDegrees(panelLastHueDeg + 12);
        }
      });

      panelPassBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          syncPanelPassButtons(btn.dataset.collision === "pass");
          emitPanelProps();
        });
      });
      panelLockBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const locked = btn.dataset.lock === "true";
          panelLockedState = locked;
          syncPanelLockButtons(locked);
          emitPanelProps();
        });
      });
      panelHeightBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const h = btn.dataset.height;
          if (h === "full") {
            syncPanelHeightButtons(false, false);
            emitPanelProps();
          } else if (h === "half") {
            syncPanelHeightButtons(false, true);
            emitPanelProps();
          } else if (h === "quarter") {
            syncPanelHeightButtons(true, false);
            emitPanelProps();
          }
        });
      });
      panelShapeBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const shape = btn.dataset.shape;
          if (shape === "cube") {
            panelHexCb.checked = false;
            panelRampCb.checked = false;
            rampDirRow!.hidden = true;
            emitPanelProps();
          } else if (shape === "hex") {
            panelHexCb.checked = true;
            panelRampCb.checked = false;
            rampDirRow!.hidden = true;
            emitPanelProps();
          } else if (shape === "ramp") {
            panelRampCb.checked = true;
            panelHexCb.checked = false;
            rampDirRow!.hidden = false;
            emitPanelProps();
          }
          syncPanelShapeButtons();
        });
      });
      const rotatePanelRamp = (delta: -1 | 1): void => {
        if (!panelRampCb?.checked) return;
        panelRampDir = (panelRampDir + delta + 4) % 4;
        emitPanelProps();
      };
      panelRampRotCCW!.addEventListener("click", () => rotatePanelRamp(-1));
      panelRampRotCW!.addEventListener("click", () => rotatePanelRamp(1));
      objectPanel
        .querySelector(".build-object-panel__move")
        ?.addEventListener("click", () => opts.onMove());
      objectPanel
        .querySelector(".build-object-panel__remove")
        ?.addEventListener("click", () => opts.onRemove());
      const dismissPanel = (): void => {
        setPanelAdvancedOpen(false);
        opts.onClose();
      };
      objectPanel
        .querySelector(".build-object-panel__dismiss")
        ?.addEventListener("click", () => dismissPanel());
    },
    hideObjectEditPanel() {
      hideObjectEditPanel();
    },
    setObjectPanelProps(p: ObstacleProps) {
      syncPanelPassButtons(p.passable);
      panelLockedState = p.locked || false;
      syncPanelLockButtons(panelLockedState);
      syncPanelHeightButtons(p.quarter, p.quarter ? false : p.half);
      if (panelHexCb) panelHexCb.checked = p.ramp ? false : p.hex;
      if (panelRampCb) panelRampCb.checked = p.ramp;
      panelRampDir = Math.max(0, Math.min(3, Math.floor(p.rampDir)));
      if (rampDirRow) rampDirRow.hidden = !p.ramp;
      syncPanelShapeButtons();
      panelSelectedColorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(p.colorId))
      );
      syncPanelSwatchSelection();
      syncPanelHueVisualFromColorId(panelSelectedColorId);
      refreshObjectPanelTitle();
    },
    rotateRampToward(delta: -1 | 1): boolean {
      if (objectPanel) {
        if (
          panelRampCb?.checked &&
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
      const hideBarForObjectPanel =
        objectPanel !== null &&
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches;
      buildBlockBar.hidden = !state.visible || hideBarForObjectPanel;
      if (buildBlockBar.hidden) setBarPopoverOpen(false);
      if (state.placementAdmin !== undefined) {
        barExperimentalOnly.hidden = !state.placementAdmin;
      }
      syncBarHeightButtons(state.quarter, state.quarter ? false : state.half);
      barHexCb.checked = state.ramp ? false : state.hex;
      barRampCb.checked = state.ramp;
      barRampDir = Math.max(0, Math.min(3, Math.floor(state.rampDir)));
      barRampDirRow.hidden = !state.ramp;
      const claim = state.claimable ?? false;
      barClaimToggle.setAttribute("aria-pressed", claim ? "true" : "false");
      barClaimToggle.classList.toggle("build-block-bar__claim-toggle--active", claim);
      refreshBarSwatches(
        Math.max(0, Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(state.colorId)))
      );
      lastHueDeg = Math.round(estimateHueFromPaletteId(state.colorId));
      barHueRing.setAttribute("aria-valuenow", String(lastHueDeg));
      syncBarShapeButtons();
    },
    isSignpostModeActive(): boolean {
      return signpostModeActive;
    },
    deactivateSignpostMode() {
      signpostModeActive = false;
      // Reset to block tool
      barToolButtons.forEach((btn) => {
        if (btn.dataset.tool === "block") {
          btn.classList.add("build-block-bar__tool-btn--active");
        } else {
          btn.classList.remove("build-block-bar__tool-btn--active");
        }
      });
      refreshBuildBarTitle();
    },
    promptSignpostMessage(x: number, z: number): void {
      signpostPendingTile = { x, z };
      signpostOverlay.hidden = false;
      signpostTextarea.value = "";
      signpostCharCount.textContent = `0 / ${SIGNPOST_MESSAGE_MAX}`;
      // Focus the textarea after a brief delay to ensure the overlay is visible
      setTimeout(() => signpostTextarea.focus(), 100);
    },
    onSignpostPlace(fn: (x: number, z: number, message: string) => void) {
      signpostPlaceHandler = fn;
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
      
      // Get existing entries by address for reuse
      const existingEntries = new Map<string, HTMLDivElement>();
      for (const child of Array.from(list.children)) {
        const entry = child as HTMLDivElement;
        const addr = entry.querySelector(".canvas-leaderboard__address");
        if (addr) {
          const fullAddress = addr.getAttribute("title") || "";
          if (fullAddress) {
            existingEntries.set(fullAddress, entry);
          }
        }
      }
      
      // Clear list but keep a reference to existing entries
      list.innerHTML = "";
      
      // Create or reuse entries
      for (let i = 0; i < leaders.length; i++) {
        const leader = leaders[i]!;
        let entry = existingEntries.get(leader.address);
        let isNew = false;
        
        if (entry) {
          // Reuse existing entry - just update rank and count
          const rank = entry.querySelector(".canvas-leaderboard__rank");
          const count = entry.querySelector(".canvas-leaderboard__count");
          if (rank) rank.textContent = `${i + 1}.`;
          if (count) count.textContent = `${leader.count}`;
        } else {
          // Create new entry
          isNew = true;
          entry = document.createElement("div");
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
          
          // Load identicon for new entry
          const loadIdenticon = async () => {
            try {
              const { identiconDataUrl } = await import("../game/identiconTexture.js");
              const dataUrl = await identiconDataUrl(leader.address);
              identiconImg.src = dataUrl;
            } catch (err) {
              console.error(`[canvas] Failed to load identicon for leaderboard entry:`, err);
            }
          };
          void loadIdenticon();
        }
        
        list.appendChild(entry);
      }
    },
    setLoadingVisible(visible: boolean) {
      loadingOverlay.hidden = !visible;
    },
    setPlayerCount(count: number, roomCount?: number) {
      const countEl = playerCount.querySelector(".hud-player-count__number");
      const tipEl = playerCount.querySelector(
        ".hud-player-count__tooltip"
      ) as HTMLElement | null;
      if (countEl) {
        countEl.textContent = String(count);
      }
      if (tipEl) {
        const room = Number.isFinite(roomCount as number)
          ? Math.max(0, Math.floor(roomCount as number))
          : count;
        tipEl.textContent = `Online now: ${count} total · ${room} in this room.`;
      }
    },
    setNimWalletStatus(status: string) {
      if (nimBalanceValue) {
        nimBalanceValue.textContent = status;
      }
    },
    setReconnectOffer(visible: boolean) {
      reconnectBtn.hidden = !visible;
    },
    onReconnect(fn: () => void) {
      reconnectHandler = fn;
    },
    setNimClaimProgress(
      state: null | { progress: number; adjacent: boolean }
    ) {
      if (!state) {
        nimClaimBar.hidden = true;
        nimClaimBar.classList.remove("nim-claim-bar--adjacent");
        return;
      }
      nimClaimBar.hidden = false;
      const p = Math.max(0, Math.min(1, state.progress));
      if (nimClaimFill) {
        nimClaimFill.style.width = `${(p * 100).toFixed(2)}%`;
      }
      if (nimClaimHint) {
        nimClaimHint.textContent = state.adjacent
          ? "Hold position beside the block…"
          : "Move to a tile directly beside the block (edge, not corner).";
      }
      nimClaimBar.classList.toggle("nim-claim-bar--adjacent", state.adjacent);
    },
    setCanvasTimer(timeRemaining: number) {
      const timerEl = canvasLeaderboard.querySelector(".canvas-leaderboard__timer") as HTMLElement | null;
      if (!timerEl) return;
      
      if (timeRemaining <= 0) {
        timerEl.hidden = true;
        return;
      }
      
      const seconds = Math.ceil(timeRemaining / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;
      
      timerEl.textContent = `⏱ ${timeStr}`;
      timerEl.hidden = false;
    },
    setSignboardTooltip(
      signboard: {
        id: string;
        x: number;
        z: number;
        message: string;
        createdBy: string;
        createdAt: number;
      } | null
    ) {
      if (!signboard) {
        signboardTooltip.hidden = true;
        return;
      }
      const messageEl = signboardTooltip.querySelector(".signboard-tooltip__message");
      const identiconEl = signboardTooltip.querySelector(
        ".signboard-tooltip__identicon"
      ) as HTMLImageElement | null;
      const authorEl = signboardTooltip.querySelector(".signboard-tooltip__author");
      if (messageEl) {
        messageEl.textContent = signboard.message;
      }
      if (authorEl) {
        const addr = signboard.createdBy;
        const formatted = addr.length >= 8 
          ? `${addr.slice(0, 4)}…${addr.slice(-4)}`
          : addr;
        authorEl.textContent = `— ${formatted}`;
        (authorEl as HTMLElement).title = addr;
      }
      if (identiconEl) {
        const addr = signboard.createdBy;
        identiconEl.hidden = false;
        identiconEl.removeAttribute("src");
        identiconEl.dataset.address = addr;
        void (async () => {
          try {
            const { identiconDataUrl } = await import("../game/identiconTexture.js");
            const dataUrl = await identiconDataUrl(addr);
            // Drop stale async result if tooltip changed to another signboard.
            if (identiconEl.dataset.address !== addr) return;
            identiconEl.src = dataUrl;
          } catch {
            if (identiconEl.dataset.address === addr) {
              identiconEl.hidden = true;
            }
          }
        })();
      }
      signboardTooltip.hidden = false;
    },
    destroy() {
      clearChatLogCollapseTimers();
      chatHoverZone.removeEventListener("pointerenter", onChatPointerEnter);
      chatHoverZone.removeEventListener("pointerleave", onChatPointerLeave);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("click", closeHudTooltips);
      document.removeEventListener("pointerdown", closeHudAdvancedPopoversOnOutside);
      hideObjectEditPanel();
      hideLobbyConfirm();
      nimClaimBar.hidden = true;
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
