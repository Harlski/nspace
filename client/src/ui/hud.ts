import {
  BLOCK_COLOR_COUNT,
  BLOCK_COLOR_PALETTE,
} from "../game/blockStyle.js";
import type { ObstacleProps } from "../net/ws.js";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../game/constants.js";

function cssHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

/** 0–3 = +X,+Z,−X,−Z (matches server `rampDir`). */
function rampDirLabel(dir: number): string {
  const d = ((dir % 4) + 4) % 4;
  return ["+X", "+Z", "−X", "−Z"][d]!;
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

  const leftStack = document.createElement("div");
  leftStack.className = "hud-left-stack";

  const debugPanel = document.createElement("pre");
  debugPanel.className = "hud-debug";
  debugPanel.setAttribute("aria-hidden", "true");
  debugPanel.hidden = !showDebug;

  const status = document.createElement("div");
  status.className = "hud-status";
  status.textContent = "";

  leftStack.appendChild(debugPanel);
  leftStack.appendChild(status);
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
  const lobbyBtn = document.createElement("button");
  lobbyBtn.type = "button";
  lobbyBtn.className = "hud-lobby";
  lobbyBtn.textContent = "Lobby";
  lobbyBtn.title = "Back to main menu (stay logged in)";
  const fsBtn = document.createElement("button");
  fsBtn.type = "button";
  fsBtn.className = "hud-fs";
  fsBtn.textContent = "Fullscreen";
  topActions.appendChild(lobbyBtn);
  topActions.appendChild(fsBtn);
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

  const buildBlockBar = document.createElement("div");
  buildBlockBar.className = "build-block-bar";
  buildBlockBar.hidden = true;
  buildBlockBar.innerHTML = `
    <div class="build-block-bar__title">New block</div>
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
      <span class="build-block-bar__ramp-dir-label">Ramp toward</span>
      <div class="build-block-bar__ramp-dir-controls">
        <button type="button" class="btn btn-secondary build-block-bar__ramp-rot-l" title="Rotate left" aria-label="Rotate ramp direction left">
          Rotate left
        </button>
        <span class="build-block-bar__ramp-dir-value" aria-live="polite">+X</span>
        <button type="button" class="btn btn-secondary build-block-bar__ramp-rot-r" title="Rotate right" aria-label="Rotate ramp direction right">
          Rotate right
        </button>
      </div>
    </div>
    <div class="build-block-bar__swatches" aria-label="Block color"></div>
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
  const barRampDirValue = buildBlockBar.querySelector(
    ".build-block-bar__ramp-dir-value"
  ) as HTMLSpanElement;
  const barRampRotL = buildBlockBar.querySelector(
    ".build-block-bar__ramp-rot-l"
  ) as HTMLButtonElement;
  const barRampRotR = buildBlockBar.querySelector(
    ".build-block-bar__ramp-rot-r"
  ) as HTMLButtonElement;
  let barRampDir = 0;
  const barSwatches = buildBlockBar.querySelector(
    ".build-block-bar__swatches"
  ) as HTMLDivElement;

  for (let i = 0; i < BLOCK_COLOR_COUNT; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "block-color-swatch";
    b.dataset.colorId = String(i);
    b.style.background = cssHex(BLOCK_COLOR_PALETTE[i]!);
    b.title = `Color ${i + 1}`;
    barSwatches.appendChild(b);
  }

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
  function syncBarRampDirLabel(): void {
    barRampDirValue.textContent = rampDirLabel(barRampDir);
  }

  function rotateBarRamp(delta: -1 | 1): void {
    if (!barRampCb.checked) return;
    barRampDir = (barRampDir + delta + 4) % 4;
    syncBarRampDirLabel();
    placementStyleHandler({ rampDir: barRampDir });
  }

  barRampRotL.addEventListener("click", () => rotateBarRamp(-1));
  barRampRotR.addEventListener("click", () => rotateBarRamp(1));

  barRampCb.addEventListener("change", () => {
    const on = barRampCb.checked;
    barRampDirRow.hidden = !on;
    placementStyleHandler({ ramp: on, hex: on ? false : barHexCb.checked });
    if (on) barHexCb.checked = false;
  });
  barSwatches.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const btn = t.closest(".block-color-swatch") as HTMLButtonElement | null;
    if (!btn || !buildBlockBar.contains(btn)) return;
    const id = Number(btn.dataset.colorId);
    if (!Number.isFinite(id)) return;
    placementStyleHandler({ colorId: id });
  });

  let fsHandler = (): void => {};
  let returnHubHandler = (): void => {};
  let lobbyHandler = (): void => {};
  fsBtn.addEventListener("click", () => fsHandler());
  returnHubBtn.addEventListener("click", () => returnHubHandler());
  lobbyBtn.addEventListener("click", () => lobbyHandler());

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
  let panelRampDirValue: HTMLSpanElement | null = null;
  let panelRampRotL: HTMLButtonElement | null = null;
  let panelRampRotR: HTMLButtonElement | null = null;
  let panelRampDir = 0;
  let panelColorWrap: HTMLDivElement | null = null;
  let panelSelectedColorId = 0;
  let panelOnPropsChange: ((p: ObstacleProps) => void) | null = null;

  function wirePanelColorClicks(): void {
    panelColorWrap?.addEventListener("click", onPanelColorClick);
  }

  function unwirePanelColorClicks(): void {
    panelColorWrap?.removeEventListener("click", onPanelColorClick);
  }

  function onPanelColorClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    const btn = t.closest(".block-color-swatch") as HTMLButtonElement | null;
    if (!btn || !objectPanel?.contains(btn)) return;
    const id = Number(btn.dataset.colorId);
    if (!Number.isFinite(id)) return;
    panelSelectedColorId = id;
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
    if (!panelColorWrap) return;
    const buttons = panelColorWrap.querySelectorAll(".block-color-swatch");
    buttons.forEach((node, i) => {
      const el = node as HTMLButtonElement;
      el.classList.toggle("block-color-swatch--selected", i === panelSelectedColorId);
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
      panelRampDirValue = null;
      panelRampRotL = null;
      panelRampRotR = null;
      panelColorWrap = null;
      panelOnPropsChange = null;
    }
  }

  function refreshBarSwatches(selectedId: number): void {
    const buttons = barSwatches.querySelectorAll(".block-color-swatch");
    buttons.forEach((node, i) => {
      (node as HTMLButtonElement).classList.toggle(
        "block-color-swatch--selected",
        i === selectedId
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
          <span>Ramp toward</span>
          <div class="build-object-panel__ramp-dir-controls">
            <button type="button" class="btn btn-secondary build-object-panel__ramp-rot-l" title="Rotate left" aria-label="Rotate ramp direction left">
              Rotate left
            </button>
            <span class="build-object-panel__ramp-dir-value" aria-live="polite">+X</span>
            <button type="button" class="btn btn-secondary build-object-panel__ramp-rot-r" title="Rotate right" aria-label="Rotate ramp direction right">
              Rotate right
            </button>
          </div>
        </div>
        <div class="build-object-panel__colors">
          <div class="build-object-panel__colors-label">Color</div>
          <div class="build-object-panel__swatches"></div>
        </div>
        <button type="button" class="build-object-panel__btn build-object-panel__move">Move to tile…</button>
        <button type="button" class="build-object-panel__btn build-object-panel__remove">Remove</button>
        <button type="button" class="build-object-panel__btn build-object-panel__close">Close</button>
      `;
      ui.appendChild(objectPanel);
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
      panelRampDirValue = objectPanel.querySelector(
        ".build-object-panel__ramp-dir-value"
      ) as HTMLSpanElement;
      panelRampRotL = objectPanel.querySelector(
        ".build-object-panel__ramp-rot-l"
      ) as HTMLButtonElement;
      panelRampRotR = objectPanel.querySelector(
        ".build-object-panel__ramp-rot-r"
      ) as HTMLButtonElement;
      panelRampDir = Math.max(0, Math.min(3, Math.floor(opts.rampDir)));
      panelRampDirValue.textContent = rampDirLabel(panelRampDir);
      panelColorWrap = objectPanel.querySelector(
        ".build-object-panel__swatches"
      ) as HTMLDivElement;
      passCheckbox.checked = opts.passable;
      quarterCheckbox.checked = opts.quarter;
      halfCheckbox.checked = opts.quarter ? false : opts.half;
      hexCheckbox.checked = opts.ramp ? false : opts.hex;
      rampCheckbox.checked = opts.ramp;
      rampDirRow.hidden = !opts.ramp;
      for (let i = 0; i < BLOCK_COLOR_COUNT; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "block-color-swatch";
        b.dataset.colorId = String(i);
        b.style.background = cssHex(BLOCK_COLOR_PALETTE[i]!);
        b.title = `Color ${i + 1}`;
        panelColorWrap.appendChild(b);
      }
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
      });
      const rotatePanelRamp = (delta: -1 | 1): void => {
        if (!rampCheckbox?.checked) return;
        panelRampDir = (panelRampDir + delta + 4) % 4;
        if (panelRampDirValue) {
          panelRampDirValue.textContent = rampDirLabel(panelRampDir);
        }
        emitPanelProps();
      };
      panelRampRotL!.addEventListener("click", () => rotatePanelRamp(-1));
      panelRampRotR!.addEventListener("click", () => rotatePanelRamp(1));
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
      if (panelRampDirValue)
        panelRampDirValue.textContent = rampDirLabel(panelRampDir);
      if (rampDirRow) rampDirRow.hidden = !p.ramp;
      panelSelectedColorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(p.colorId))
      );
      syncPanelSwatchSelection();
    },
    rotateRampToward(delta: -1 | 1): boolean {
      if (objectPanel) {
        if (
          rampCheckbox?.checked &&
          rampDirRow &&
          !rampDirRow.hidden
        ) {
          panelRampDir = (panelRampDir + delta + 4) % 4;
          if (panelRampDirValue) {
            panelRampDirValue.textContent = rampDirLabel(panelRampDir);
          }
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
      syncBarRampDirLabel();
      barRampDirRow.hidden = !state.ramp;
      refreshBarSwatches(
        Math.max(0, Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(state.colorId)))
      );
    },
    setDebugText(text: string) {
      if (!showDebug) return;
      debugPanel.textContent = text;
    },
    destroy() {
      hideObjectEditPanel();
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
