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

  const signboardTooltip = document.createElement("div");
  signboardTooltip.className = "signboard-tooltip";
  signboardTooltip.hidden = true;
  signboardTooltip.innerHTML = `
    <div class="signboard-tooltip__header">
      <span class="signboard-tooltip__icon">📋</span>
      <span class="signboard-tooltip__title">Signboard</span>
    </div>
    <div class="signboard-tooltip__message"></div>
    <div class="signboard-tooltip__footer">
      <span class="signboard-tooltip__author"></span>
    </div>
  `;

  // Signpost message input overlay
  const signpostOverlay = document.createElement("div");
  signpostOverlay.className = "signpost-overlay";
  signpostOverlay.hidden = true;
  const signpostDialog = document.createElement("div");
  signpostDialog.className = "signpost-overlay__dialog";
  signpostDialog.innerHTML = `
    <div class="signpost-overlay__header">
      <span class="signpost-overlay__icon">📍</span>
      <span class="signpost-overlay__title">Create Signpost</span>
    </div>
    <div class="signpost-overlay__body">
      <label class="signpost-overlay__label">Message (max 500 characters):</label>
      <textarea class="signpost-overlay__textarea" maxlength="500" placeholder="Enter your message..." rows="5"></textarea>
      <div class="signpost-overlay__char-count">0 / 500</div>
    </div>
    <div class="signpost-overlay__actions">
      <button type="button" class="signpost-overlay__btn signpost-overlay__btn--cancel">Cancel</button>
      <button type="button" class="signpost-overlay__btn signpost-overlay__btn--create">Create</button>
    </div>
  `;
  signpostOverlay.appendChild(signpostDialog);

  leftStack.appendChild(debugPanel);
  leftStack.appendChild(canvasLeaderboard);
  leftStack.appendChild(signboardTooltip);
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
    <div class="build-block-bar__tools">
      <div class="build-block-bar__title" style="margin-top: 1rem;">Tools</div>
      <div class="build-block-bar__tool-selector">
        <button type="button" class="build-block-bar__tool-btn build-block-bar__tool-btn--active" data-tool="block">
          <div class="build-block-bar__tool-icon">🧱</div>
          <div class="build-block-bar__tool-label">Block</div>
        </button>
        <button type="button" class="build-block-bar__tool-btn" data-tool="signpost">
          <div class="build-block-bar__tool-icon">📍</div>
          <div class="build-block-bar__tool-label">Signpost</div>
        </button>
      </div>
      <div class="build-block-bar__preview">
        <div class="build-block-bar__preview-label">Preview:</div>
        <div class="build-block-bar__preview-box">
          <canvas class="build-block-bar__preview-canvas" width="120" height="120"></canvas>
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
  const barToolButtons = Array.from(buildBlockBar.querySelectorAll(".build-block-bar__tool-btn")) as HTMLButtonElement[];
  const barPreviewCanvas = buildBlockBar.querySelector(".build-block-bar__preview-canvas") as HTMLCanvasElement;

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
      signpostCharCount.textContent = `${len} / 500`;
    });
  }

  if (signpostCancelBtn) {
    signpostCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      signpostOverlay.hidden = true;
      if (signpostTextarea) signpostTextarea.value = "";
      if (signpostCharCount) signpostCharCount.textContent = "0 / 500";
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
      if (signpostCharCount) signpostCharCount.textContent = "0 / 500";
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
    });
  });

  // 3D Block preview rendering - shows a 1x1 tile with block on top (isometric view)
  function updateBlockPreview(state: {
    colorId: number;
    half: boolean;
    quarter: boolean;
    hex: boolean;
    ramp: boolean;
  }): void {
    const ctx = barPreviewCanvas.getContext("2d");
    if (!ctx) return;

    const w = barPreviewCanvas.width;
    const h = barPreviewCanvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Color palette matching game blocks
    const colors = [
      "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", 
      "#3b82f6", "#ef4444", "#6366f1", "#14b8a6",
      "#f3f4f6", "#1f2937"
    ];
    const baseColor = colors[state.colorId] || colors[0];
    
    if (!baseColor) return;

    // Parse hex color
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    // Create shaded colors for 3D effect
    const topColor = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
    const sideColor = `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`;
    const frontColor = baseColor;

    // Isometric tile dimensions
    const tileW = 50;  // Tile width in isometric view
    const tileH = 25;  // Tile height in isometric view
    const centerX = w / 2;
    const centerY = h / 2 + 15;
    
    // Draw floor tile (1x1 grid square)
    const floorColor = "#3a4456";
    const floorLight = "#4a5566";
    const floorDark = "#2a3446";
    
    // Floor tile top (diamond shape in isometric)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - tileH);  // Top
    ctx.lineTo(centerX + tileW, centerY);  // Right
    ctx.lineTo(centerX, centerY + tileH);  // Bottom
    ctx.lineTo(centerX - tileW, centerY);  // Left
    ctx.closePath();
    
    ctx.fillStyle = floorColor;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Grid lines on floor for reference
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - tileH);
    ctx.lineTo(centerX, centerY + tileH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - tileW, centerY);
    ctx.lineTo(centerX + tileW, centerY);
    ctx.stroke();

    // Calculate block dimensions
    const blockW = 40;  // Block width
    const blockD = 40;  // Block depth
    let blockH = 45;    // Block height
    if (state.quarter) blockH = 12;
    else if (state.half) blockH = 23;

    // Block sits on top of the floor
    const blockBaseY = centerY - tileH - 2;

    if (state.hex) {
      // Hexagonal block - show from isometric angle
      const hexSize = 18;
      const hexCenterY = blockBaseY - blockH / 2;
      
      // Draw hexagon top
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = centerX + Math.cos(angle) * hexSize;
        const y = hexCenterY - 10 + Math.sin(angle) * (hexSize * 0.5);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = topColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Draw visible sides
      ctx.beginPath();
      ctx.moveTo(centerX + hexSize * 0.87, hexCenterY - 10 + hexSize * 0.25);
      ctx.lineTo(centerX + hexSize * 0.87, blockBaseY);
      ctx.lineTo(centerX, blockBaseY);
      ctx.lineTo(centerX, hexCenterY - 10 + hexSize * 0.5);
      ctx.closePath();
      ctx.fillStyle = sideColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.stroke();
      
    } else if (state.ramp) {
      // Ramp - isometric view showing slope
      const rampW = blockW * 0.4;
      const rampD = blockD * 0.4;
      
      // Right face (sloped)
      ctx.beginPath();
      ctx.moveTo(centerX, blockBaseY - blockH);
      ctx.lineTo(centerX + rampW, blockBaseY - blockH + rampD * 0.5);
      ctx.lineTo(centerX + rampW, blockBaseY + rampD * 0.5);
      ctx.lineTo(centerX, blockBaseY);
      ctx.closePath();
      ctx.fillStyle = sideColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Front sloped surface
      ctx.beginPath();
      ctx.moveTo(centerX, blockBaseY);
      ctx.lineTo(centerX - rampW, blockBaseY - rampD * 0.5);
      ctx.lineTo(centerX - rampW, blockBaseY - blockH - rampD * 0.5);
      ctx.lineTo(centerX, blockBaseY - blockH);
      ctx.closePath();
      ctx.fillStyle = frontColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.stroke();
      
      // Top sloped face
      ctx.beginPath();
      ctx.moveTo(centerX, blockBaseY - blockH);
      ctx.lineTo(centerX + rampW, blockBaseY - blockH + rampD * 0.5);
      ctx.lineTo(centerX, blockBaseY + rampD * 0.5);
      ctx.lineTo(centerX - rampW, blockBaseY - rampD * 0.5);
      ctx.closePath();
      ctx.fillStyle = topColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.stroke();
      
    } else {
      // Regular cubic block - isometric view
      const isoW = blockW * 0.4;
      const isoD = blockD * 0.4;
      
      // Left face
      ctx.beginPath();
      ctx.moveTo(centerX, blockBaseY - blockH);
      ctx.lineTo(centerX - isoW, blockBaseY - blockH - isoD * 0.5);
      ctx.lineTo(centerX - isoW, blockBaseY - isoD * 0.5);
      ctx.lineTo(centerX, blockBaseY);
      ctx.closePath();
      ctx.fillStyle = frontColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Right face
      ctx.beginPath();
      ctx.moveTo(centerX, blockBaseY - blockH);
      ctx.lineTo(centerX + isoW, blockBaseY - blockH + isoD * 0.5);
      ctx.lineTo(centerX + isoW, blockBaseY + isoD * 0.5);
      ctx.lineTo(centerX, blockBaseY);
      ctx.closePath();
      ctx.fillStyle = sideColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.stroke();

      // Top face
      ctx.beginPath();
      ctx.moveTo(centerX, blockBaseY - blockH);
      ctx.lineTo(centerX - isoW, blockBaseY - blockH - isoD * 0.5);
      ctx.lineTo(centerX, blockBaseY - blockH - isoD);
      ctx.lineTo(centerX + isoW, blockBaseY - blockH - isoD * 0.5);
      ctx.closePath();
      ctx.fillStyle = topColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.stroke();
    }
  }

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
  let lockCheckbox: HTMLInputElement | null = null;
  let lockRow: HTMLElement | null = null;
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
    const locked = lockCheckbox?.checked || false;
    
    console.log(`[HUD emitPanelProps] Emitting props with locked=${locked}`);
    
    panelOnPropsChange({
      passable: passCheckbox.checked,
      quarter,
      half: quarter ? false : halfCheckbox.checked,
      hex: ramp ? false : hexCheckbox.checked,
      ramp,
      rampDir: ramp ? rampDir : 0,
      colorId: panelSelectedColorId,
      locked,
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
      lockCheckbox = null;
      lockRow = null;
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
      const lockIcon = opts.locked ? '<span class="nq-icon nq-lock-locked" style="font-size: 0.9em; margin-left: 4px;" title="This object is locked"></span>' : '';
      objectPanel.innerHTML = `
        <div class="build-object-panel__title">Block (${opts.x}, ${opts.z})${lockIcon}</div>
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
          <label class="build-object-panel__row build-object-panel__lock-row" hidden>
            <input type="checkbox" class="build-object-panel__cb build-object-panel__cb-lock" />
            <span>🔒 Lock</span>
          </label>
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
      lockCheckbox = objectPanel.querySelector(
        ".build-object-panel__cb-lock"
      ) as HTMLInputElement | null;
      lockRow = objectPanel.querySelector(
        ".build-object-panel__lock-row"
      ) as HTMLElement | null;
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
      
      // Set up lock checkbox (admin only)
      if (lockCheckbox && lockRow) {
        lockCheckbox.checked = opts.locked || false;
        console.log(`[HUD] Setting lockRow visibility: isAdmin=${opts.isAdmin}, hidden=${!opts.isAdmin}`);
        lockRow.hidden = !opts.isAdmin; // Show only for admins
      } else {
        console.log(`[HUD] lockCheckbox or lockRow is null:`, { lockCheckbox: !!lockCheckbox, lockRow: !!lockRow });
      }
      
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
      if (lockCheckbox) {
        lockCheckbox.addEventListener("change", () => emitPanelProps());
      }
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
      console.log(`[HUD setObjectPanelProps] Received props with locked=${p.locked}`);
      if (passCheckbox) passCheckbox.checked = p.passable;
      if (quarterCheckbox) quarterCheckbox.checked = p.quarter;
      if (halfCheckbox) halfCheckbox.checked = p.quarter ? false : p.half;
      if (hexCheckbox) hexCheckbox.checked = p.ramp ? false : p.hex;
      if (rampCheckbox) rampCheckbox.checked = p.ramp;
      if (lockCheckbox) {
        const newLocked = p.locked || false;
        console.log(`[HUD setObjectPanelProps] Setting lockCheckbox.checked to ${newLocked}`);
        lockCheckbox.checked = newLocked;
      }
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
      updateBlockPreview(state);
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
    },
    promptSignpostMessage(x: number, z: number): void {
      signpostPendingTile = { x, z };
      signpostOverlay.hidden = false;
      signpostTextarea.value = "";
      signpostCharCount.textContent = "0 / 500";
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
      signboardTooltip.hidden = false;
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
