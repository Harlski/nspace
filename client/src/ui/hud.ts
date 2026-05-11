import {
  BLOCK_COLOR_COUNT,
  BLOCK_COLOR_PALETTE,
  clampPyramidBaseScale,
  hslToRgb,
  nearestPaletteColorIdFromRgb,
  normalizeBlockPrismParts,
} from "../game/blockStyle.js";
import type { Game } from "../game/Game.js";
import { GATE_AUTH_MAX } from "../game/gateAuth.js";
import { normalizeWalletKey, type FloorTile } from "../game/grid.js";
import type { PlayerState } from "../types.js";
import {
  BILLBOARD_ADVERTS_CATALOG,
  BILLBOARD_MAX_ADVERT_SLOTS,
} from "../game/billboardAdvertsCatalog.js";
import { BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED } from "../game/billboardPlacementFlags.js";
import {
  DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID,
} from "../game/billboardAdvertsCatalog.js";
import {
  drawNimBillboardCandles,
  ensureNimChartFontsLoaded,
  fetchNimBillboardOhlc,
  nimChartTitleForRange,
  NIM_BILLBOARD_CHART_H,
  NIM_BILLBOARD_CHART_W,
  type NimBillboardChartRange,
} from "../game/billboardNimChart.js";
import type {
  BillboardState,
  ObstacleProps,
  RoomBackgroundNeutral,
} from "../net/ws.js";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../game/constants.js";
import { HUB_ROOM_ID, normalizeRoomId } from "../game/roomLayouts.js";
import telegramIconUrl from "../assets/social/telegram.svg?url";
import xIconUrl from "../assets/social/x.svg?url";
import {
  formatWalletAddressConnectAs,
  formatWalletAddressGap4,
} from "../formatWalletAddress.js";
import { walletDisplayName } from "../walletDisplayName.js";
import {
  NIMIQ_WALLET_URL,
  TELEGRAM_URL,
  X_URL,
  nimiqWalletRecipientDeepLink,
} from "../socialLinks.js";
import { nimiqIconUseMarkup, nimiqIconifyMarkup } from "./nimiqIcons.js";
import { nimiqHexLoaderSvg } from "./nimiqHexLoader.js";
import { isVisualFullscreenActive } from "./pseudoFullscreen.js";
import { loadRecentColorIds, pushRecentColorId } from "./recentColors.js";
import { ringHueFromClient } from "./ringHuePick.js";
import { mountHeaderMarquee } from "./headerMarquee.js";

const LS_HUD_CHAT_MINIMIZED = "nspace_hud_chat_minimized";

/** Shape picker list (placement + object-edit popovers). Add new shapes here. */
const SHAPE_PICKER_OPTIONS_HTML = `
  <div class="build-block-bar-shape-popover__inner">
    <div class="build-block-bar__popover-heading">Shape</div>
    <div class="build-block-bar-shape-popover__options" role="group" aria-label="Block shape">
      <button type="button" class="tile-inspector__shape-btn tile-inspector__shape-btn--active" data-shape="cube" aria-pressed="true" aria-label="Cube">
        <svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M6 12l10-5 10 5v10l-10 5-10-5V12zm0 0l10 5 10-5m-10 5v10"/></svg>
        <span class="tile-inspector__shape-label">Cube</span>
      </button>
      <button type="button" class="tile-inspector__shape-btn" data-shape="hex" aria-pressed="false" aria-label="Hexagon">
        <svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11L16 5z"/></svg>
        <span class="tile-inspector__shape-label">Hex</span>
      </button>
      <button type="button" class="tile-inspector__shape-btn" data-shape="pyramid" aria-pressed="false" aria-label="Pyramid">
        <svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M16 6L6 26h20L16 6zm0 0v8m-6 10h12"/></svg>
        <span class="tile-inspector__shape-label">Pyramid</span>
      </button>
      <button type="button" class="tile-inspector__shape-btn" data-shape="sphere" aria-pressed="false" aria-label="Sphere">
        <svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true"><ellipse fill="none" stroke="currentColor" stroke-width="1.6" cx="16" cy="16" rx="9" ry="9"/><path fill="none" stroke="currentColor" stroke-width="1.2" d="M7 16h18M16 7c-5 3-5 15 0 18M16 7c5 3 5 15 0 18"/></svg>
        <span class="tile-inspector__shape-label">Sphere</span>
      </button>
      <button type="button" class="tile-inspector__shape-btn" data-shape="ramp" aria-pressed="false" aria-label="Ramp">
        <svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M6 24h20l-8-16H6v16z"/></svg>
        <span class="tile-inspector__shape-label">Ramp</span>
      </button>
    </div>
  </div>`;

const SHAPE_TRIG_SVG: Record<
  "cube" | "hex" | "pyramid" | "sphere" | "ramp",
  string
> = {
  cube: `<svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M6 12l10-5 10 5v10l-10 5-10-5V12zm0 0l10 5 10-5m-10 5v10"/></svg>`,
  hex: `<svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11L16 5z"/></svg>`,
  pyramid: `<svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M16 5L7 25h18L16 5z"/></svg>`,
  sphere: `<svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true" width="20" height="20"><ellipse fill="none" stroke="currentColor" stroke-width="1.5" cx="16" cy="16" rx="8" ry="8"/><path fill="none" stroke="currentColor" stroke-width="1.1" d="M8 16h16M16 8a12 12 0 000 16"/></svg>`,
  ramp: `<svg class="tile-inspector__shape-icon" viewBox="0 0 32 32" aria-hidden="true" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M6 24h20l-8-16H6v16z"/></svg>`,
};

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

/** Inline SVG for Build mode toggle (label via text). */
const HUD_MODE_ICON_BUILD = `<svg class="hud-mode-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M5 10h14M5 14h8m3 0h6"/></svg>`;

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
  pyramid: boolean;
  /** Pyramid only; base radius multiplier (1–1.65). */
  pyramidBaseScale: number;
  sphere: boolean;
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
  opts?: {
    showDebug?: boolean;
    /** Fires synchronously before opening the wallet URL in a new tab (e.g. notify server). */
    onNimRecipientDeepLinkOpen?: (url: string) => void;
    /** Popup blocked or `window.open` returned null. */
    onNimRecipientDeepLinkPopupBlocked?: () => void;
    /** Bearer JWT for the signed-in player (e.g. saving public profile message). */
    getGameAuthToken?: () => string | null;
    /** Same wallet list as server `ADMIN_ADDRESSES`; in-game profile moderation. */
    isGameAdmin?: () => boolean;
    /** True when this game session was authenticated via Nimiq Pay (server verify), not `window.nimiqPay`. */
    didSessionUseNimiqPay?: () => boolean;
    /**
     * Latest room `PlayerState` for this wallet (compact, spaces stripped, uppercased).
     * Used to show the Nimiq Pay badge on *other* players’ profiles.
     */
    playerUsesNimiqPayInRoom?: (compactWalletKey: string) => boolean;
    /** Secret FPS / latency HUD toggled from the brand modal (five taps on the title). */
    onPerfHudEnabledChange?: (enabled: boolean) => void;
  }
): {
  setStatus: (s: string) => void;
  appendChat: (
    from: string,
    text: string,
    opts?: {
      fromAddress?: string | null;
      profileIsSelf?: boolean;
      /** Slightly muted styling (e.g. server backlog on welcome). */
      historical?: boolean;
      /** When true, skip rapid duplicate suppression for system lines (backlog replay). */
      skipSystemDedup?: boolean;
    }
  ) => void;
  /** Clears world + system chat panels; call before applying server `chatBacklog` on `welcome`. */
  resetRoomChatDom: () => void;
  getChatInput: () => HTMLInputElement;
  /** Player hid the chat via minimize; persisted in localStorage until cleared. */
  isChatMinimized: () => boolean;
  setChatMinimized: (minimized: boolean) => void;
  onFullscreenToggle: (fn: () => void) => void;
  setReturnHomeVisible: (visible: boolean) => void;
  setPortalEnterVisible: (visible: boolean) => void;
  setPortalEnterScreenPosition: (x: number, y: number) => void;
  /** Same pill as portal Enter; use for “Visit …” on billboard tiles. */
  setPortalEnterLabel: (text: string) => void;
  /** Quick emoji strip above the player (right-click / long-press self in game). */
  showSelfEmojiMenu: (
    anchorX: number,
    anchorY: number,
    onPick: (emoji: string) => void,
    /** Snapped floor tile when opened; menu closes after the player walks to another tile. */
    openedAtFloor?: FloorTile | null
  ) => void;
  hideSelfEmojiMenu: () => void;
  setSelfEmojiMenuAnchor: (
    x: number | null,
    y: number | null,
    /** Current snapped floor tile (same frame as screen coords); closes menu if tile changed. */
    currentFloor?: FloorTile | null
  ) => void;
  isSelfEmojiMenuOpen: () => boolean;
  /** Context menu on another human player (right-click / long-press avatar). */
  showOtherPlayerContextMenu: (
    clientX: number,
    clientY: number,
    targets: Array<{ address: string; displayName: string }>,
    opts?: {
      emoteRowFirst?: boolean;
      onEmote?: () => void;
    }
  ) => void;
  hideOtherPlayerContextMenu: () => void;
  /** Close other-player context menu and profile overlay (e.g. before local move). */
  dismissOtherPlayerOverlays: () => void;
  /** Open the in-game profile card for the signed-in wallet (top bar identicon / address). */
  openOwnPlayerProfile: () => void;
  onReturnHome: (fn: () => void) => void;
  onPortalEnter: (fn: () => void) => void;
  isTeleporterModeActive: () => boolean;
  onBuildToolSelect: (
    fn: (
      tool: "block" | "signpost" | "teleporter" | "billboard" | "gate"
    ) => void
  ) => void;
  deactivateTeleporterMode: () => void;
  isGateModeActive: () => boolean;
  deactivateGateMode: () => void;
  setRoomEntrySpawnPanelVisible: (visible: boolean) => void;
  onRoomEntrySpawnPickState: (fn: ((armed: boolean) => void) | null) => void;
  onRoomEntrySpawnUseCenter: (fn: (() => void) | null) => void;
  clearRoomEntrySpawnPickUi: () => void;
  isRoomEntrySpawnPickArmed: () => boolean;
  showGateContextMenu: (
    clientX: number,
    clientY: number,
    opts: { onOpen: () => void }
  ) => void;
  hideGateContextMenu: () => void;
  onReturnToLobby: (fn: () => void) => void;
  /** Open the large Rooms browser (list / join / create). */
  onRoomsOpen: (fn: () => void) => void;
  /** Confirmed from a room listed on a player profile. */
  onProfileRoomJoin: (fn: (roomId: string) => void) => void;
  /** Build toggle: walk off / on; on + Objects vs Room (dropdown) maps to build vs floor. */
  onPlayModeSelect: (fn: (mode: "walk" | "build" | "floor") => void) => void;
  setPlayModeState: (mode: "walk" | "build" | "floor") => void;
  /** Per-room edit caps from server welcome; disables Build / Floor when false. */
  setRoomEditCaps: (caps: {
    allowPlaceBlocks: boolean;
    allowExtraFloor: boolean;
  }) => void;
  setRoomBackgroundHuePanelVisible: (visible: boolean) => void;
  syncRoomBackgroundHueRing: (
    hueDeg: number | null,
    neutral: RoomBackgroundNeutral | null
  ) => void;
  onRoomBackgroundHueAdjust: (handlers: {
    onHueDeg: (deg: number) => void;
    onPointerUp: () => void;
  }) => void;
  onRoomBackgroundNeutralPick: (
    fn: (neutral: RoomBackgroundNeutral) => void
  ) => void;
  /** Rotate ramp “toward” (placement bar or object panel when ramp is on). */
  rotateRampToward: (delta: -1 | 1) => boolean;
  showObjectEditPanel: (
    opts:
      | {
          x: number;
          z: number;
          /** Block stack Y (used for gate inspector + wire). */
          y?: number;
          passable: boolean;
          half: boolean;
          quarter: boolean;
          hex: boolean;
          pyramid: boolean;
          pyramidBaseScale: number;
          sphere: boolean;
          ramp: boolean;
          rampDir: number;
          colorId: number;
          locked?: boolean;
          isAdmin?: boolean;
          /** When set, panel edits opening direction for an existing gate. */
          gate?: {
            adminAddress: string;
            authorizedAddresses: string[];
            exitX: number;
            exitZ: number;
          };
          gateExitDir?: number;
          /** Gate owner or room admin: opens ACL modal. */
          onEditGateAcl?: () => void;
          onPropsChange: (p: ObstacleProps) => void;
          onRemove: () => void;
          onMove: () => void;
          onClose: () => void;
        }
      | {
          x: number;
          z: number;
          teleporterEdit: {
            pending: boolean;
            destRoomId: string;
            destX: number;
            destZ: number;
            /** Room the player is standing in; pick-by-click only applies when destination room matches. */
            currentRoomId: string;
            roomOptions: Array<{
              id: string;
              displayName: string;
              isPublic: boolean;
              playerCount: number;
              isOfficial: boolean;
              isBuiltin: boolean;
            }>;
            onPickTileInCurrentRoom: () => void;
            onPickCancel: () => void;
            onConfigure: (
              destRoomId: string,
              destX: number,
              destZ: number
            ) => void;
          };
          onRemove: () => void;
          onMove: () => void;
          onClose: () => void;
        }
      | {
          x: number;
          z: number;
          billboardSelection: {
            id: string;
            /** False for viewers who are not the placer and not admin (server enforces too). */
            canModify: boolean;
            onEdit: () => void;
            onMove: () => void;
            onRemove: () => void;
            onClose: () => void;
          };
        }
  ) => void;
  hideObjectEditPanel: () => void;
  /** Standalone modal: edit up to {@link GATE_AUTH_MAX} wallets allowed to open a gate. */
  showGateAclEditor: (opts: {
    x: number;
    z: number;
    y: number;
    adminAddress: string;
    addresses: string[];
    players: readonly PlayerState[];
    onSave: (addresses: string[]) => void;
  }) => void;
  hideGateAclEditor: () => void;
  setTeleporterEditFields: (p: {
    destRoomId: string;
    destX: number;
    destZ: number;
  }) => void;
  setObjectPanelProps: (p: ObstacleProps) => void;
  onBuildPlacementStyle: (
    fn: (patch: {
      half?: boolean;
      quarter?: boolean;
      hex?: boolean;
      pyramid?: boolean;
      pyramidBaseScale?: number;
      sphere?: boolean;
      ramp?: boolean;
      rampDir?: number;
      colorId?: number;
      claimable?: boolean;
    }) => void
  ) => void;
  setBuildBlockBarState: (state: BuildBlockBarState) => void;
  isSignpostModeActive: () => boolean;
  isBillboardModeActive: () => boolean;
  deactivateSignpostMode: () => void;
  promptSignpostMessage: (x: number, z: number) => void;
  onSignpostPlace: (fn: (x: number, z: number, message: string) => void) => void;
  promptBillboardPlace: (
    x: number,
    z: number,
    draft?: {
      orientation: "horizontal" | "vertical";
      yawSteps: number;
      advertId: string;
      advertIds: string[];
      intervalSec: number;
      liveChartRange?: NimBillboardChartRange;
      liveChartFallbackAdvertId?: string;
      liveChartRangeCycle?: boolean;
      liveChartCycleIntervalSec?: number;
      billboardSourceTab?: "images" | "other";
    }
  ) => void;
  applyBillboardModalDraft: (draft: {
    orientation: "horizontal" | "vertical";
    yawSteps: number;
    advertId: string;
    advertIds: string[];
    intervalSec: number;
    liveChartRange?: NimBillboardChartRange;
    liveChartFallbackAdvertId?: string;
    liveChartRangeCycle?: boolean;
    liveChartCycleIntervalSec?: number;
    billboardSourceTab?: "images" | "other";
  }) => void;
  onBillboardDraftChange: (
    fn: ((
      d: {
        orientation: "horizontal" | "vertical";
        yawSteps: number;
        advertId: string;
        advertIds: string[];
        intervalSec: number;
        liveChartRange: NimBillboardChartRange;
        liveChartFallbackAdvertId: string;
        liveChartRangeCycle: boolean;
        liveChartCycleIntervalSec: number;
        billboardSourceTab: "images" | "other";
      }
    ) => void) | null
  ) => void;
  onBillboardPlace: (
    fn: (
      x: number,
      z: number,
      opts:
        | {
            orientation: "horizontal" | "vertical";
            advertId: string;
            advertIds: string[];
            intervalSec: number;
          }
        | {
            orientation: "horizontal" | "vertical";
            advertId: string;
            advertIds: string[];
            intervalSec: number;
            liveChart: {
              range: NimBillboardChartRange;
              fallbackAdvertId: string;
              rangeCycle?: boolean;
              cycleIntervalSec?: number;
            };
          }
    ) => void
  ) => void;
  promptBillboardEdit: (
    id: string,
    spec: Pick<
      BillboardState,
      "orientation" | "advertId" | "advertIds" | "intervalMs" | "liveChart"
    >
  ) => void;
  onBillboardUpdate: (
    fn: (
      id: string,
      opts:
        | {
            orientation: "horizontal" | "vertical";
            advertId: string;
            advertIds: string[];
            intervalSec: number;
          }
        | {
            orientation: "horizontal" | "vertical";
            advertId: string;
            advertIds: string[];
            intervalSec: number;
            liveChart: {
              range: NimBillboardChartRange;
              fallbackAdvertId: string;
              rangeCycle?: boolean;
              cycleIntervalSec?: number;
            };
          }
    ) => void
  ) => void;
  showBillboardExternalVisitConfirm: (p: {
    url: string;
    displayName: string;
    onConfirm: () => void;
  }) => void;
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
  updateCanvasLeaderboard: (leaders: Array<{ address: string; bestMs: number }>) => void;
  setCanvasTimer: (timeRemaining: number) => void;
  setCanvasCountdown: (text: string | null, msRemaining?: number) => void;
  setPlayerCount: (count: number, roomCount?: number) => void;
  showPlayerJoinedToast: (address: string) => void;
  /** Submit feedback text; return ok + optional user-facing error message. */
  onFeedbackSubmit: (
    fn: (
      message: string
    ) => Promise<{ ok: boolean; error?: string }>
  ) => void;
  setNimWalletStatus: (status: string) => void;
  /** Wallet identicon in the brand links modal; call when entering the game. */
  setBrandLinksPlayerAddress: (address: string) => void;
  setLoadingVisible: (
    visible: boolean,
    opts?: { skipMinWait?: boolean }
  ) => void;
  /** Shown under the spinner while the loading overlay is visible. */
  setLoadingLabel: (text: string) => void;
  /** NIM block claim: progress 0–1 while adjacent; null hides the bar. */
  setNimClaimProgress: (
    state: null | { progress: number; adjacent: boolean },
    opts?: { fadeOutMs?: number }
  ) => void;
  /** Show or hide the in-game Reconnect control (e.g. after WebSocket loss). */
  setReconnectOffer: (visible: boolean) => void;
  /** Operator-scheduled maintenance: orange countdown strip + friendlier disconnect copy. */
  setServerRestartPendingNotice: (p: {
    etaSeconds: number;
    message?: string;
    seq: number;
  }) => void;
  /** If a restart notice was shown, next disconnect status line uses maintenance wording once. */
  consumeRestartDisconnectForStatus: () => boolean;
  onReconnect: (fn: () => void) => void;
  /** Wire WebGL 1×1 tile previews; call after `new Game()` with the same instance (or `null` on teardown). */
  bindTileInspectorPreviewGame: (game: Game | null) => void;
  /** FPS + server RTT overlay (easter egg: five taps on “NIMIQ SPACE” in the brand modal). */
  isPerfHudEnabled: () => boolean;
  feedPerfHudFrame: (now: number) => void;
  setPerfHudLatencyMs: (ms: number | null) => void;
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

  const topWrap = document.createElement("div");
  topWrap.className = "hud-top-wrap";

  const restartBanner = document.createElement("div");
  restartBanner.className = "hud-restart-banner";
  restartBanner.hidden = true;
  restartBanner.setAttribute("role", "status");
  restartBanner.setAttribute("aria-live", "assertive");
  const restartBannerLine = document.createElement("div");
  restartBannerLine.className = "hud-restart-banner__line";
  const restartBannerDetail = document.createElement("div");
  restartBannerDetail.className = "hud-restart-banner__detail";
  restartBannerDetail.hidden = true;
  restartBanner.append(restartBannerLine, restartBannerDetail);

  const headerMarqueeHost = document.createElement("div");
  headerMarqueeHost.className = "hud-header-marquee-host";
  const disposeHeaderMarquee = mountHeaderMarquee(headerMarqueeHost, {
    onPlayerProfileOpen: (walletId, displayName) => {
      const compact = walletKeyForProfile(walletId);
      const self = walletKeyForProfile(brandLinksPlayerAddress);
      if (compact && self && compact === self) {
        openOwnPlayerProfileFromBar();
        return;
      }
      void showPlayerProfileView(walletId, displayName, "other");
    },
  });

  const topStrip = document.createElement("div");
  topStrip.className = "hud-top-strip";

  const topStripMain = document.createElement("div");
  topStripMain.className = "hud-top-strip__main";

  const brand = document.createElement("button");
  brand.type = "button";
  brand.className = "hud-brand";
  brand.setAttribute("aria-label", "Nimiq Space, community links and wallet");
  const nimiqSpan = document.createElement("span");
  nimiqSpan.className = "main-menu__title-nimiq";
  nimiqSpan.textContent = "NIMIQ";
  const spaceSpan = document.createElement("span");
  spaceSpan.className = "main-menu__title-space";
  spaceSpan.textContent = "SPACE";
  brand.appendChild(nimiqSpan);
  brand.appendChild(spaceSpan);

  const playerBar = document.createElement("div");
  playerBar.className = "hud-player-bar";
  playerBar.setAttribute("aria-label", "Your wallet");
  const playerBarIdenticon = document.createElement("img");
  playerBarIdenticon.className = "hud-player-bar__identicon";
  playerBarIdenticon.alt = "";
  playerBarIdenticon.width = 22;
  playerBarIdenticon.height = 22;
  playerBarIdenticon.decoding = "async";
  playerBarIdenticon.hidden = true;
  const playerBarAddr = document.createElement("span");
  playerBarAddr.className = "hud-player-bar__addr";
  playerBar.appendChild(playerBarIdenticon);
  playerBar.appendChild(playerBarAddr);

  const topStripMid = document.createElement("div");
  topStripMid.className = "hud-top-strip__mid";
  const reconnectBtn = document.createElement("button");
  reconnectBtn.type = "button";
  reconnectBtn.className = "hud-reconnect-btn nq-button-pill light-blue";
  reconnectBtn.textContent = "Reconnect";
  reconnectBtn.hidden = true;
  reconnectBtn.setAttribute("aria-label", "Reconnect to server");
  reconnectBtn.title = "Try connecting again without leaving the game";
  topStripMid.appendChild(reconnectBtn);

  const statusSub = document.createElement("div");
  statusSub.className = "hud-status-sub hud-status-sub--empty";
  statusSub.setAttribute("role", "status");
  statusSub.setAttribute("aria-live", "polite");
  statusSub.textContent = "";

  topStripMain.appendChild(brand);
  topStripMain.appendChild(playerBar);
  topStripMain.appendChild(topStripMid);

  const topToolbar = document.createElement("div");
  topToolbar.className = "hud-top-toolbar";
  const lobbyBtn = document.createElement("button");
  lobbyBtn.type = "button";
  lobbyBtn.className = "hud-lobby hud-icon-btn";
  lobbyBtn.innerHTML = nimiqIconUseMarkup("nq-cross", {
    width: 14,
    height: 14,
    class: "hud-toolbar-nq-icon",
  });
  lobbyBtn.setAttribute("aria-label", "Lobby");
  lobbyBtn.title = "Return to the lobby and stay signed in.";
  const fsBtn = document.createElement("button");
  fsBtn.type = "button";
  fsBtn.className = "hud-fs hud-icon-btn";
  const FS_ENTER_SVG = `<svg class="hud-fs__icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
  const FS_EXIT_SVG = `<svg class="hud-fs__icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
  const setFsBtnVisual = (): void => {
    const on = isVisualFullscreenActive();
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
  document.addEventListener("nspace-pseudo-fullscreen-change", onFullscreenChange);

  // Player count indicator
  const playerCount = document.createElement("div");
  playerCount.className = "hud-player-count";
  playerCount.setAttribute("role", "button");
  playerCount.setAttribute("tabindex", "0");
  playerCount.setAttribute("aria-label", "Active players");
  playerCount.innerHTML = `
    <svg class="nq-icon">
      <use href="/nimiq-style.icons.svg#nq-view"/>
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
      <use href="/nimiq-style.icons.svg#nq-hexagon"/>
    </svg>
    <span class="hud-nim-balance__value">…</span>
    <span class="hud-nim-balance__tooltip" role="tooltip">
      <span class="hud-nim-balance__tip-inline">
        This NIM can be earned by
        <a class="hud-nim-balance__payouts-link" href="/payouts" target="_blank" rel="noopener noreferrer">
          playing Nimiq Space<span class="hud-nim-balance__tip-arrow" aria-hidden="true"> →</span>
        </a>
      </span>
    </span>
  `;
  const nimBalanceValue = nimBalance.querySelector(
    ".hud-nim-balance__value"
  ) as HTMLElement | null;
  const playerCountTip = playerCount.querySelector(
    ".hud-player-count__tooltip"
  ) as HTMLElement;
  const nimBalanceTip = nimBalance.querySelector(
    ".hud-nim-balance__tooltip"
  ) as HTMLElement;
  nimBalanceTip.addEventListener("click", (e) => e.stopPropagation());

  /** Toolbar uses horizontal scroll + overflow-y hidden; abs tooltips are clipped, so dock to viewport here. */
  const HUD_STAT_TIP_VIEWPORT_MQ = window.matchMedia(
    "(pointer: coarse) and (max-width: 960px)"
  );

  function syncHudStatTooltipViewport(
    anchor: HTMLElement,
    tip: HTMLElement,
    visible: boolean,
    opts?: { dockViewport?: boolean }
  ): void {
    const dockViewport = opts?.dockViewport !== false;
    if (!visible) {
      tip.classList.remove("hud-stat-tooltip--viewport");
      tip.style.removeProperty("left");
      tip.style.removeProperty("top");
      tip.style.removeProperty("max-width");
      return;
    }
    if (!dockViewport || !HUD_STAT_TIP_VIEWPORT_MQ.matches) {
      tip.classList.remove("hud-stat-tooltip--viewport");
      tip.style.removeProperty("left");
      tip.style.removeProperty("top");
      tip.style.removeProperty("max-width");
      return;
    }
    tip.classList.add("hud-stat-tooltip--viewport");
    requestAnimationFrame(() => {
      const ar = anchor.getBoundingClientRect();
      const margin = 8;
      const maxW = Math.min(280, window.innerWidth - 2 * margin);
      tip.style.maxWidth = `${maxW}px`;
      const w = tip.getBoundingClientRect().width;
      let left = ar.right - w;
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - w));
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(ar.bottom + margin)}px`;
    });
  }

  /** In-game profile Nimiq Pay badge, wired after `other-player-profile` DOM is built. */
  let profileNimiqPayTipAnchor: HTMLElement | null = null;
  let profileNimiqPayTipEl: HTMLElement | null = null;
  let profileAliasTipAnchor: HTMLElement | null = null;
  let profileAliasTipEl: HTMLElement | null = null;

  function setProfileAliasTipVisible(show: boolean): void {
    if (!profileAliasTipAnchor || !profileAliasTipEl) return;
    profileAliasTipAnchor.classList.toggle("hud-player-count--show-tip", show);
    syncHudStatTooltipViewport(profileAliasTipAnchor, profileAliasTipEl, show, {
      dockViewport: false,
    });
  }

  function setProfileNimiqPayTipVisible(show: boolean): void {
    if (!profileNimiqPayTipAnchor || !profileNimiqPayTipEl) return;
    profileNimiqPayTipAnchor.classList.toggle("hud-player-count--show-tip", show);
    /* Profile lives under nested `position: fixed` / letterbox; viewport `left`/`top` px are wrong on mobile, so keep abs like desktop. */
    syncHudStatTooltipViewport(profileNimiqPayTipAnchor, profileNimiqPayTipEl, show, {
      dockViewport: false,
    });
  }

  function repositionOpenHudStatTips(): void {
    if (playerCount.classList.contains("hud-player-count--show-tip")) {
      syncHudStatTooltipViewport(playerCount, playerCountTip, true);
    }
    if (nimBalance.classList.contains("hud-nim-balance--show-tip")) {
      syncHudStatTooltipViewport(nimBalance, nimBalanceTip, true);
    }
    if (
      profileNimiqPayTipAnchor &&
      profileNimiqPayTipEl &&
      profileNimiqPayTipAnchor.classList.contains("hud-player-count--show-tip")
    ) {
      syncHudStatTooltipViewport(profileNimiqPayTipAnchor, profileNimiqPayTipEl, true, {
        dockViewport: false,
      });
    }
    if (
      profileAliasTipAnchor &&
      profileAliasTipEl &&
      profileAliasTipAnchor.classList.contains("hud-player-count--show-tip")
    ) {
      syncHudStatTooltipViewport(profileAliasTipAnchor, profileAliasTipEl, true, {
        dockViewport: false,
      });
    }
  }

  const playerJoinToast = document.createElement("div");
  playerJoinToast.className = "hud-player-join-toast";
  playerJoinToast.hidden = true;
  playerJoinToast.innerHTML = `
    <img class="hud-player-join-toast__identicon" alt="" width="18" height="18" hidden />
    <span class="hud-player-join-toast__text"></span>
  `;
  const playerJoinToastText = playerJoinToast.querySelector(
    ".hud-player-join-toast__text"
  ) as HTMLElement | null;
  const playerJoinToastIdenticon = playerJoinToast.querySelector(
    ".hud-player-join-toast__identicon"
  ) as HTMLImageElement | null;
  let playerJoinToastTimer: ReturnType<typeof setTimeout> | null = null;

  const roomsBtn = document.createElement("button");
  roomsBtn.type = "button";
  roomsBtn.className = "hud-rooms";
  roomsBtn.innerHTML = `<span class="hud-rooms__inner"><span class="hud-rooms__text">Rooms</span>${nimiqIconUseMarkup("nq-caret-right-small", { width: 10, height: 10, class: "hud-rooms__caret" })}</span>`;
  roomsBtn.setAttribute("aria-label", "Rooms");
  roomsBtn.title = "Browse, join, or create rooms.";

  const setNimTipVisible = (show: boolean): void => {
    nimBalance.classList.toggle("hud-nim-balance--show-tip", show);
    syncHudStatTooltipViewport(nimBalance, nimBalanceTip, show);
  };
  const setPlayerTipVisible = (show: boolean): void => {
    playerCount.classList.toggle("hud-player-count--show-tip", show);
    syncHudStatTooltipViewport(playerCount, playerCountTip, show);
  };
  const closeHudTooltips = (): void => {
    setNimTipVisible(false);
    setPlayerTipVisible(false);
    setProfileNimiqPayTipVisible(false);
    setProfileAliasTipVisible(false);
  };
  nimBalance.addEventListener("mouseenter", () => setNimTipVisible(true));
  nimBalance.addEventListener("mouseleave", () => setNimTipVisible(false));
  nimBalance.addEventListener("focus", () => setNimTipVisible(true));
  nimBalance.addEventListener("blur", () => setNimTipVisible(false));
  nimBalance.addEventListener("click", (e) => {
    e.stopPropagation();
    setNimTipVisible(!nimBalance.classList.contains("hud-nim-balance--show-tip"));
  });
  playerCount.addEventListener("mouseenter", () => setPlayerTipVisible(true));
  playerCount.addEventListener("mouseleave", () => setPlayerTipVisible(false));
  playerCount.addEventListener("focus", () => setPlayerTipVisible(true));
  playerCount.addEventListener("blur", () => setPlayerTipVisible(false));
  playerCount.addEventListener("click", (e) => {
    e.stopPropagation();
    setPlayerTipVisible(
      !playerCount.classList.contains("hud-player-count--show-tip")
    );
  });
  playerCount.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPlayerTipVisible(
        !playerCount.classList.contains("hud-player-count--show-tip")
      );
    }
  });
  document.addEventListener("click", closeHudTooltips);
  topToolbar.addEventListener("scroll", repositionOpenHudStatTips, {
    passive: true,
  });
  window.addEventListener("resize", repositionOpenHudStatTips);
  HUD_STAT_TIP_VIEWPORT_MQ.addEventListener("change", repositionOpenHudStatTips);
  
  topToolbar.appendChild(playerJoinToast);

  const translateClipboardHintToast = document.createElement("div");
  translateClipboardHintToast.className =
    "hud-player-join-toast hud-translate-clipboard-hint";
  translateClipboardHintToast.hidden = true;
  translateClipboardHintToast.setAttribute("role", "status");
  translateClipboardHintToast.setAttribute("aria-live", "polite");
  translateClipboardHintToast.textContent =
    "Message copied. Paste it into Google Translate if the page opens empty.";
  let translateClipboardHintTimer: ReturnType<typeof setTimeout> | null = null;

  function showTranslateClipboardHintToast(): void {
    translateClipboardHintToast.hidden = false;
    translateClipboardHintToast.classList.add("hud-player-join-toast--visible");
    if (translateClipboardHintTimer) clearTimeout(translateClipboardHintTimer);
    translateClipboardHintTimer = setTimeout(() => {
      translateClipboardHintToast.classList.remove(
        "hud-player-join-toast--visible"
      );
      translateClipboardHintToast.hidden = true;
      translateClipboardHintTimer = null;
    }, 4000);
  }

  function prefersTranslateClipboardAssist(): boolean {
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(
      navigator.userAgent
    );
    return coarse || mobileUa;
  }

  topToolbar.appendChild(roomsBtn);
  topToolbar.appendChild(playerCount);
  topToolbar.appendChild(nimBalance);
  topToolbar.appendChild(fsBtn);
  topToolbar.appendChild(lobbyBtn);
  topStripMain.appendChild(topToolbar);
  topStrip.appendChild(topStripMain);
  topStrip.appendChild(headerMarqueeHost);

  const leftStack = document.createElement("div");
  leftStack.className = "hud-left-stack";

  const debugPanel = document.createElement("pre");
  debugPanel.className = "hud-debug";
  debugPanel.setAttribute("aria-hidden", "true");
  debugPanel.hidden = !showDebug;

  const perfHud = document.createElement("div");
  perfHud.className = "hud-perf-hud";
  perfHud.hidden = true;
  perfHud.setAttribute("aria-hidden", "true");
  perfHud.innerHTML = `<span class="hud-perf-hud__fps">—</span><span class="hud-perf-hud__sep"> · </span><span class="hud-perf-hud__ms">—</span>`;
  const perfHudFpsEl = perfHud.querySelector(
    ".hud-perf-hud__fps"
  ) as HTMLSpanElement | null;
  const perfHudMsEl = perfHud.querySelector(
    ".hud-perf-hud__ms"
  ) as HTMLSpanElement | null;
  let perfHudEnabled = false;
  let perfHudLastNow = 0;
  let perfHudFpsSmoothed = 60;
  let brandLinksTitleSecretClicks = 0;

  function setPerfHudEnabled(on: boolean): void {
    if (perfHudEnabled === on) return;
    perfHudEnabled = on;
    perfHud.hidden = !on;
    perfHud.setAttribute("aria-hidden", on ? "false" : "true");
    if (!on) {
      perfHudLastNow = 0;
      if (perfHudFpsEl) perfHudFpsEl.textContent = "—";
      if (perfHudMsEl) perfHudMsEl.textContent = "—";
    }
    opts?.onPerfHudEnabledChange?.(on);
  }

  const canvasLeaderboard = document.createElement("div");
  canvasLeaderboard.className = "canvas-leaderboard";
  canvasLeaderboard.hidden = true;
  canvasLeaderboard.innerHTML = `
    <div class="canvas-leaderboard__title">The Maze - Leaders</div>
    <div class="canvas-leaderboard__timer" hidden></div>
    <div class="canvas-leaderboard__subtitle">Fastest completions</div>
    <div class="canvas-leaderboard__list"></div>
  `;

  const signboardTooltip = document.createElement("div");
  signboardTooltip.className = "signboard-tooltip";
  signboardTooltip.hidden = true;
  signboardTooltip.innerHTML = `
    <div class="signboard-tooltip__header">
      <span class="signboard-tooltip__icon" aria-hidden="true">${nimiqIconUseMarkup("nq-copy", { width: 14, height: 14, class: "signboard-tooltip__nq-icon" })}</span>
      <span class="signboard-tooltip__title">Signboard</span>
      <button type="button" class="signboard-tooltip__close" aria-label="Close">${nimiqIconUseMarkup("nq-cross", { width: 12, height: 12, class: "signboard-tooltip__close-icon" })}</button>
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

  const billboardOverlay = document.createElement("div");
  billboardOverlay.className = "billboard-modal";
  billboardOverlay.hidden = true;
  const billboardDialog = document.createElement("div");
  billboardDialog.className = "billboard-modal__dialog";
  billboardDialog.setAttribute("role", "dialog");
  billboardDialog.setAttribute("aria-modal", "true");
  billboardDialog.setAttribute("aria-labelledby", "billboard-modal-title");
  billboardDialog.innerHTML = `
    <div class="billboard-modal__header">
      <h2 id="billboard-modal-title" class="billboard-modal__title">Place billboard</h2>
      <div class="billboard-modal__header-actions">
        <button type="button" class="billboard-modal__btn billboard-modal__btn--ghost billboard-modal__btn--cancel">Cancel</button>
        <button type="button" class="billboard-modal__btn billboard-modal__btn--primary billboard-modal__btn--place">Place</button>
      </div>
    </div>
    <div class="billboard-modal__body">
      <div class="billboard-modal__field">
        <span class="billboard-modal__label" id="billboard-size-label">Size</span>
        <div class="billboard-modal__size-row" role="group" aria-labelledby="billboard-size-label">
          <button type="button" id="billboard-size-4x1" class="billboard-modal__size-btn billboard-modal__size-btn--active" aria-pressed="true">4×1</button>
          <button type="button" id="billboard-size-2x1" class="billboard-modal__size-btn" aria-pressed="false">2×1</button>
        </div>
        <p id="billboard-size-hint" class="billboard-modal__hint">4×1 is horizontal along the grid; 2×1 is vertical (tall).</p>
      </div>
      <div class="billboard-modal__tabs" role="tablist" aria-label="Billboard content">
        <button type="button" id="billboard-tab-images" class="billboard-modal__tab billboard-modal__tab--active" role="tab" aria-selected="true">Images</button>
        <button type="button" id="billboard-tab-other" class="billboard-modal__tab" role="tab" aria-selected="false">Other</button>
      </div>
      <div id="billboard-panel-images" class="billboard-modal__source-panel">
        <div class="billboard-modal__field">
          <span class="billboard-modal__label" id="billboard-rotation-label">Rotation</span>
          <ul id="billboard-rotation-list" class="billboard-modal__slides-list" aria-labelledby="billboard-rotation-label"></ul>
          <div class="billboard-modal__add-slide-row">
            <select id="billboard-rotation-add" class="billboard-modal__select" aria-label="Advert to add to rotation"></select>
            <button type="button" id="billboard-rotation-add-btn" class="billboard-modal__btn billboard-modal__btn--ghost">Add</button>
          </div>
          <p id="billboard-rotation-hint" class="billboard-modal__hint"></p>
        </div>
        <div class="billboard-modal__field">
          <label class="billboard-modal__label" for="billboard-rotation-interval">Seconds per slide</label>
          <input type="number" id="billboard-rotation-interval" class="billboard-modal__input billboard-modal__input--number" min="1" max="300" step="1" value="8" />
        </div>
        <div class="billboard-modal__preview" aria-hidden="true">
          <img id="billboard-preview-img" class="billboard-modal__preview-img" alt="" decoding="async" />
        </div>
      </div>
      <div id="billboard-panel-other" class="billboard-modal__source-panel" hidden>
        <div class="billboard-modal__field">
          <label class="billboard-modal__label" for="billboard-chart-range">NIM price chart</label>
          <select id="billboard-chart-range" class="billboard-modal__select" aria-label="Chart time range">
            <option value="24h">24 hours (candles)</option>
            <option value="7d">7 days (candles)</option>
          </select>
          <p class="billboard-modal__hint">USD OHLC from CoinGecko (nim-chart-service). “Visit” opens CoinGecko while you stand on the board.</p>
        </div>
        <div class="billboard-modal__field">
          <label class="billboard-modal__label billboard-modal__label--inline">
            <input type="checkbox" id="billboard-chart-range-cycle" class="billboard-modal__checkbox" />
            Cycle views: 24h → 7d
          </label>
          <p class="billboard-modal__hint">When on, the board rotates these ranges. The range menu is used when cycling is off.</p>
        </div>
        <div id="billboard-chart-cycle-interval-wrap" class="billboard-modal__field" hidden>
          <label class="billboard-modal__label" for="billboard-chart-cycle-interval">Seconds per view</label>
          <input type="number" id="billboard-chart-cycle-interval" class="billboard-modal__input billboard-modal__input--number" min="5" max="300" step="1" value="20" />
        </div>
        <div class="billboard-modal__field">
          <label class="billboard-modal__label" for="billboard-chart-fallback">If chart unavailable, show</label>
          <select id="billboard-chart-fallback" class="billboard-modal__select" aria-label="Fallback image when chart cannot load"></select>
          <p class="billboard-modal__hint">Uses a preset billboard image until the chart loads again.</p>
        </div>
        <div class="billboard-modal__chart-preview-wrap" aria-hidden="true">
          <canvas id="billboard-chart-preview" class="billboard-modal__chart-preview" width="${NIM_BILLBOARD_CHART_W}" height="${NIM_BILLBOARD_CHART_H}"></canvas>
        </div>
      </div>
    </div>
  `;
  billboardOverlay.appendChild(billboardDialog);

  const billboardRotationAddSelect = billboardDialog.querySelector(
    "#billboard-rotation-add"
  ) as HTMLSelectElement | null;
  if (billboardRotationAddSelect) {
    for (const a of BILLBOARD_ADVERTS_CATALOG) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      billboardRotationAddSelect.appendChild(opt);
    }
  }
  const billboardRotationListEl = billboardDialog.querySelector(
    "#billboard-rotation-list"
  ) as HTMLUListElement | null;
  const billboardRotationHintEl = billboardDialog.querySelector(
    "#billboard-rotation-hint"
  ) as HTMLElement | null;
  const billboardRotationIntervalInput = billboardDialog.querySelector(
    "#billboard-rotation-interval"
  ) as HTMLInputElement | null;
  const billboardRotationAddBtn = billboardDialog.querySelector(
    "#billboard-rotation-add-btn"
  ) as HTMLButtonElement | null;
  const billboardTabImagesBtn = billboardDialog.querySelector(
    "#billboard-tab-images"
  ) as HTMLButtonElement | null;
  const billboardTabOtherBtn = billboardDialog.querySelector(
    "#billboard-tab-other"
  ) as HTMLButtonElement | null;
  const billboardPanelImagesEl = billboardDialog.querySelector(
    "#billboard-panel-images"
  ) as HTMLElement | null;
  const billboardPanelOtherEl = billboardDialog.querySelector(
    "#billboard-panel-other"
  ) as HTMLElement | null;
  const billboardChartRangeSelect = billboardDialog.querySelector(
    "#billboard-chart-range"
  ) as HTMLSelectElement | null;
  const billboardChartFallbackSelect = billboardDialog.querySelector(
    "#billboard-chart-fallback"
  ) as HTMLSelectElement | null;
  const billboardChartRangeCycleInput = billboardDialog.querySelector(
    "#billboard-chart-range-cycle"
  ) as HTMLInputElement | null;
  const billboardChartCycleIntervalInput = billboardDialog.querySelector(
    "#billboard-chart-cycle-interval"
  ) as HTMLInputElement | null;
  const billboardChartCycleIntervalWrap = billboardDialog.querySelector(
    "#billboard-chart-cycle-interval-wrap"
  ) as HTMLElement | null;
  if (billboardChartFallbackSelect) {
    for (const a of BILLBOARD_ADVERTS_CATALOG) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      billboardChartFallbackSelect.appendChild(opt);
    }
    billboardChartFallbackSelect.value = DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID;
  }

  const externalVisitConfirmOverlay = document.createElement("div");
  externalVisitConfirmOverlay.className = "external-visit-confirm";
  externalVisitConfirmOverlay.hidden = true;
  externalVisitConfirmOverlay.setAttribute("aria-hidden", "true");
  externalVisitConfirmOverlay.innerHTML = `
    <div class="external-visit-confirm__backdrop" aria-hidden="true"></div>
    <div class="external-visit-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="external-visit-title">
      <h2 id="external-visit-title" class="external-visit-confirm__title">Open external website?</h2>
      <p class="external-visit-confirm__lead">You are about to leave Nimiq Space and open a link in a new tab.</p>
      <p class="external-visit-confirm__url" id="external-visit-url"></p>
      <p class="external-visit-confirm__disclaimer"><em>Nimiq Space does not control the content or safety of external sites.</em></p>
      <div class="external-visit-confirm__actions">
        <button type="button" class="external-visit-confirm__btn external-visit-confirm__btn--cancel">Cancel</button>
        <button type="button" class="external-visit-confirm__btn external-visit-confirm__btn--confirm">Continue</button>
      </div>
    </div>
  `;

  const FEEDBACK_MESSAGE_MAX = 700;
  const feedbackOverlay = document.createElement("div");
  feedbackOverlay.className = "signpost-overlay feedback-overlay";
  feedbackOverlay.hidden = true;
  feedbackOverlay.setAttribute("aria-hidden", "true");
  feedbackOverlay.innerHTML = `
    <div class="feedback-overlay__backdrop" aria-hidden="true"></div>
    <div class="signpost-overlay__dialog" role="dialog" aria-modal="true" aria-labelledby="hud-feedback-title">
      <div class="signpost-overlay__header">
        <span id="hud-feedback-title" class="signpost-overlay__title">Send feedback</span>
        <div class="signpost-overlay__header-actions">
          <button type="button" class="signpost-overlay__btn signpost-overlay__btn--cancel">Cancel</button>
          <button type="button" class="signpost-overlay__btn signpost-overlay__btn--create">Send</button>
        </div>
      </div>
      <div class="signpost-overlay__body">
        <label class="signpost-overlay__label" for="hud-feedback-textarea">We appreciate your feedback. Please share issue details and what you'd like improved (max ${FEEDBACK_MESSAGE_MAX} characters)</label>
        <textarea id="hud-feedback-textarea" class="signpost-overlay__textarea" maxlength="${FEEDBACK_MESSAGE_MAX}" placeholder="Thank you for your feedback. Please describe what happened, where it occurred, and what should be improved." rows="6"></textarea>
        <p class="feedback-overlay__error" hidden></p>
        <div class="signpost-overlay__char-count">0 / ${FEEDBACK_MESSAGE_MAX}</div>
      </div>
    </div>
  `;

  const brandLinksOverlay = document.createElement("div");
  brandLinksOverlay.className = "brand-links-overlay";
  brandLinksOverlay.hidden = true;
  brandLinksOverlay.setAttribute("aria-hidden", "true");
  brandLinksOverlay.innerHTML = `
    <div class="brand-links-overlay__backdrop" aria-hidden="true"></div>
    <div class="brand-links-overlay__dialog" role="dialog" aria-modal="true" aria-labelledby="brand-links-title">
      <div class="brand-links-overlay__header">
        <button type="button" class="brand-links-overlay__close" aria-label="Close">${nimiqIconUseMarkup("nq-close", { width: 20, height: 20, class: "brand-links-overlay__close-icon" })}</button>
        <h2 class="main-menu__title brand-links-overlay__brand-title" id="brand-links-title">
          <span class="main-menu__title-nimiq">NIMIQ</span>
          <span class="main-menu__title-space">SPACE</span>
        </h2>
      </div>
      <div class="brand-links-overlay__body">
        <div class="brand-links-overlay__social">
          <a class="brand-links-overlay__social-tile" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">
            <img class="brand-links-overlay__social-icon" src="${telegramIconUrl}" alt="" width="36" height="36" aria-hidden="true" />
            <span class="brand-links-overlay__social-label">Telegram</span>
          </a>
          <a class="brand-links-overlay__social-tile" href="${X_URL}" target="_blank" rel="noopener noreferrer">
            <img class="brand-links-overlay__social-icon" src="${xIconUrl}" alt="" width="36" height="36" aria-hidden="true" />
            <span class="brand-links-overlay__social-label">X (Twitter)</span>
          </a>
        </div>
        <div class="brand-links-overlay__wallet-stack">
          <img class="brand-links-overlay__wallet-identicon" alt="" hidden />
          <div class="brand-links-overlay__address-row">
            <button type="button" class="brand-links-overlay__address-copy" hidden aria-label="Copy wallet address to clipboard"></button>
            <span class="brand-links-overlay__copy-feedback" hidden aria-live="polite"></span>
          </div>
          <a class="brand-links-overlay__wallet nq-button-pill light-blue" href="${NIMIQ_WALLET_URL}" target="_blank" rel="noopener noreferrer">
            <span>Open Wallet</span>
          </a>
        </div>
        <div
          class="brand-links-overlay__qr-view"
          hidden
          aria-hidden="true"
          tabindex="0"
          role="button"
          aria-label="Return to links and wallet"
        >
          <div class="brand-links-overlay__qr-canvas-host"></div>
        </div>
      </div>
    </div>
  `;

  leftStack.appendChild(debugPanel);
  leftStack.appendChild(canvasLeaderboard);
  
  // Close button for signboard tooltip
  const signboardCloseBtn = signboardTooltip.querySelector(".signboard-tooltip__close");
  if (signboardCloseBtn) {
    signboardCloseBtn.addEventListener("click", () => {
      signboardTooltip.hidden = true;
    });
  }
  
  topWrap.appendChild(restartBanner);
  topWrap.appendChild(topStrip);
  topWrap.appendChild(statusSub);
  ui.appendChild(topWrap);
  ui.appendChild(translateClipboardHintToast);
  ui.appendChild(leftStack);
  ui.appendChild(perfHud);
  letter.appendChild(signpostOverlay);
  letter.appendChild(billboardOverlay);
  letter.appendChild(externalVisitConfirmOverlay);
  letter.appendChild(feedbackOverlay);
  letter.appendChild(brandLinksOverlay);

  // Loading overlay for room transitions
  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.hidden = true;
  loadingOverlay.innerHTML = `
    <div class="loading-overlay__content">
      ${nimiqHexLoaderSvg("loading-overlay__spinner")}
      <div class="loading-overlay__text">Loading room...</div>
    </div>
  `;
  const loadingOverlayText = loadingOverlay.querySelector(
    ".loading-overlay__text"
  ) as HTMLDivElement | null;
  letter.appendChild(loadingOverlay);

  const LOADING_MIN_MS = 2000;
  const LOADING_FADE_FALLBACK_MS = 550;
  let loadingShownAt: number | null = null;
  let loadingHideWaitTimer: ReturnType<typeof setTimeout> | null = null;
  let loadingFadeUnsub: (() => void) | null = null;

  function clearLoadingOverlayTimers(): void {
    if (loadingHideWaitTimer !== null) {
      clearTimeout(loadingHideWaitTimer);
      loadingHideWaitTimer = null;
    }
    if (loadingFadeUnsub) {
      loadingFadeUnsub();
      loadingFadeUnsub = null;
    }
  }

  function finishLoadingOverlayDismiss(): void {
    loadingOverlay.classList.remove("loading-overlay--fade-out");
    loadingOverlay.hidden = true;
    loadingShownAt = null;
  }

  const topBar = document.createElement("div");
  topBar.className = "hud-top";
  const returnHomeBtn = document.createElement("button");
  returnHomeBtn.type = "button";
  returnHomeBtn.className = "hud-return-home";
  returnHomeBtn.textContent = "Return Home";
  returnHomeBtn.hidden = true;
  const portalEnterBtn = document.createElement("button");
  portalEnterBtn.type = "button";
  portalEnterBtn.className = "hud-portal-enter nq-button-pill light-blue";
  portalEnterBtn.textContent = "Enter";
  portalEnterBtn.hidden = true;
  const topActions = document.createElement("div");
  topActions.className = "hud-top-actions";

  const modeSidebar = document.createElement("aside");
  modeSidebar.className = "hud-mode-sidebar";
  modeSidebar.setAttribute("aria-label", "Play mode");

  const modeTablist = document.createElement("div");
  modeTablist.className = "hud-mode-sidebar__tabs";
  modeTablist.setAttribute("aria-label", "Build mode");

  const buildEditKindLabel = document.createElement("div");
  buildEditKindLabel.className = "hud-mode-sidebar__edit-label";
  buildEditKindLabel.textContent = "Edit";
  buildEditKindLabel.hidden = true;

  const buildEditKindWrap = document.createElement("div");
  buildEditKindWrap.className = "hud-mode-sidebar__edit-kind-wrap";
  buildEditKindWrap.hidden = true;
  const buildEditKindSelect = document.createElement("select");
  buildEditKindSelect.className = "hud-mode-sidebar__edit-kind-select";
  buildEditKindSelect.id = "hud-build-edit-kind";
  buildEditKindSelect.setAttribute("aria-label", "What to edit");
  const buildEditOptObjects = document.createElement("option");
  buildEditOptObjects.value = "objects";
  buildEditOptObjects.textContent = "Objects";
  const buildEditOptRoom = document.createElement("option");
  buildEditOptRoom.value = "room";
  buildEditOptRoom.textContent = "Room";
  buildEditKindSelect.appendChild(buildEditOptObjects);
  buildEditKindSelect.appendChild(buildEditOptRoom);
  buildEditKindWrap.appendChild(buildEditKindSelect);

  const buildToggleBtn = document.createElement("button");
  buildToggleBtn.type = "button";
  buildToggleBtn.className = "hud-mode-sidebar__tab hud-mode-sidebar__build-toggle";
  buildToggleBtn.id = "hud-mode-tab-build";
  buildToggleBtn.setAttribute("role", "button");
  buildToggleBtn.setAttribute("aria-pressed", "false");
  buildToggleBtn.innerHTML = `${HUD_MODE_ICON_BUILD}<span class="hud-mode-sidebar__tab-label">Build</span>`;
  buildToggleBtn.setAttribute(
    "aria-label",
    "Build. Turn on to edit objects or rooms; turn off to move."
  );
  buildToggleBtn.title = "Build. Turn on to edit; turn off to move. Shortcut: B.";

  const modeSidebarBody = document.createElement("div");
  modeSidebarBody.className = "hud-mode-sidebar__body";
  modeSidebarBody.id = "hud-mode-sidebar-panel";
  modeSidebarBody.setAttribute("role", "tabpanel");
  modeSidebarBody.setAttribute("aria-labelledby", "hud-mode-tab-build");
  modeSidebarBody.setAttribute("aria-label", "Mode tools");

  const modeSidebarBuildMount = document.createElement("div");
  modeSidebarBuildMount.className = "hud-mode-sidebar__build-mount";
  const hueDock = document.createElement("div");
  hueDock.className = "hud-mode-sidebar__hue-dock";

  const ROOM_BG_HUE_DEFAULT_RING = 198;
  const roomBgHuePanel = document.createElement("div");
  roomBgHuePanel.className = "hud-mode-sidebar__room-bg";
  roomBgHuePanel.hidden = true;
  const roomBgHueWrap = document.createElement("div");
  roomBgHueWrap.className =
    "build-block-bar__hue-ring-wrap hud-mode-sidebar__room-bg-hue-wrap";
  const roomBgHueRing = document.createElement("div");
  roomBgHueRing.className = "build-block-bar__hue-ring";
  roomBgHueRing.setAttribute("role", "slider");
  roomBgHueRing.setAttribute("tabindex", "0");
  roomBgHueRing.setAttribute("aria-valuemin", "0");
  roomBgHueRing.setAttribute("aria-valuemax", "359");
  roomBgHueRing.setAttribute("aria-valuenow", String(ROOM_BG_HUE_DEFAULT_RING));
  roomBgHueRing.setAttribute("aria-label", "Background hue");
  const roomBgHueCore = document.createElement("div");
  roomBgHueCore.className = "build-block-bar__hue-core";
  roomBgHueCore.setAttribute("aria-hidden", "true");
  roomBgHueWrap.appendChild(roomBgHueRing);
  roomBgHueWrap.appendChild(roomBgHueCore);
  roomBgHuePanel.appendChild(roomBgHueWrap);

  const roomBgNeutralRow = document.createElement("div");
  roomBgNeutralRow.className = "hud-mode-sidebar__room-bg-neutrals";
  roomBgNeutralRow.setAttribute("role", "group");
  roomBgNeutralRow.setAttribute("aria-label", "Solid background");
  const roomBgNeutralBtns: Partial<
    Record<RoomBackgroundNeutral, HTMLButtonElement>
  > = {};
  const neutralDefs: Array<{ id: RoomBackgroundNeutral; label: string }> = [
    { id: "black", label: "Black" },
    { id: "white", label: "White" },
    { id: "gray", label: "Gray" },
  ];
  let roomBgNeutralPickHandler: ((n: RoomBackgroundNeutral) => void) | null =
    null;
  for (const { id, label } of neutralDefs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `hud-mode-sidebar__room-bg-neutral hud-mode-sidebar__room-bg-neutral--${id}`;
    b.setAttribute("aria-label", `${label} background`);
    b.title = label;
    b.dataset.neutral = id;
    b.addEventListener("click", () => {
      if (roomBgHuePanel.hidden) return;
      roomBgNeutralPickHandler?.(id);
    });
    roomBgNeutralBtns[id] = b;
    roomBgNeutralRow.appendChild(b);
  }
  roomBgHuePanel.appendChild(roomBgNeutralRow);

  hueDock.appendChild(roomBgHuePanel);

  const roomEntrySpawnPanel = document.createElement("div");
  roomEntrySpawnPanel.className = "hud-mode-sidebar__room-entry-spawn";
  roomEntrySpawnPanel.id = "hud-room-entry-spawn-panel";
  roomEntrySpawnPanel.hidden = true;
  const roomEntrySpawnHead = document.createElement("div");
  roomEntrySpawnHead.className = "hud-mode-sidebar__room-entry-spawn-head";
  roomEntrySpawnHead.textContent = "Guest entry";
  const roomEntrySpawnHintEl = document.createElement("p");
  roomEntrySpawnHintEl.className = "hud-mode-sidebar__room-entry-spawn-hint";
  roomEntrySpawnHintEl.textContent =
    "Where visitors appear when they have no saved position in this room.";
  const roomEntrySpawnPickBtn = document.createElement("button");
  roomEntrySpawnPickBtn.type = "button";
  roomEntrySpawnPickBtn.className = "tile-inspector__reset-btn";
  roomEntrySpawnPickBtn.id = "hud-room-entry-spawn-pick";
  roomEntrySpawnPickBtn.textContent = "Pick tile on map…";
  roomEntrySpawnPickBtn.setAttribute("aria-pressed", "false");
  const roomEntrySpawnCenterBtn = document.createElement("button");
  roomEntrySpawnCenterBtn.type = "button";
  roomEntrySpawnCenterBtn.className = "tile-inspector__reset-btn";
  roomEntrySpawnCenterBtn.id = "hud-room-entry-spawn-center";
  roomEntrySpawnCenterBtn.textContent = "Use room center";
  roomEntrySpawnPanel.appendChild(roomEntrySpawnHead);
  roomEntrySpawnPanel.appendChild(roomEntrySpawnHintEl);
  roomEntrySpawnPanel.appendChild(roomEntrySpawnPickBtn);
  roomEntrySpawnPanel.appendChild(roomEntrySpawnCenterBtn);
  hueDock.appendChild(roomEntrySpawnPanel);

  let roomEntrySpawnPickArmed = false;
  let roomEntrySpawnPickStateHandler: ((armed: boolean) => void) | null = null;
  let roomEntrySpawnUseCenterHandler: (() => void) | null = null;

  roomEntrySpawnPickBtn.addEventListener("click", (e) => {
    e.preventDefault();
    roomEntrySpawnPickArmed = !roomEntrySpawnPickArmed;
    roomEntrySpawnPickBtn.setAttribute(
      "aria-pressed",
      roomEntrySpawnPickArmed ? "true" : "false"
    );
    roomEntrySpawnPickStateHandler?.(roomEntrySpawnPickArmed);
  });
  roomEntrySpawnCenterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    roomEntrySpawnUseCenterHandler?.();
  });

  function clearRoomEntrySpawnPickUi(): void {
    if (roomEntrySpawnPickArmed) {
      roomEntrySpawnPickArmed = false;
      roomEntrySpawnPickBtn.setAttribute("aria-pressed", "false");
      roomEntrySpawnPickStateHandler?.(false);
    }
  }

  modeSidebarBody.appendChild(modeSidebarBuildMount);
  modeSidebarBody.appendChild(hueDock);

  let roomBgHueDragging = false;
  let roomBgHueInputHandler: ((deg: number) => void) | null = null;
  let roomBgHueUpHandler: (() => void) | null = null;

  function syncRoomBgHueCoreVisual(deg: number): void {
    const ringDeg = Math.round(((deg % 360) + 360) % 360);
    roomBgHueRing.setAttribute("aria-valuenow", String(ringDeg));
    roomBgHueCore.style.background = `hsl(${ringDeg} 42% 11%)`;
    for (const nd of neutralDefs) {
      const btn = roomBgNeutralBtns[nd.id];
      if (btn) {
        btn.classList.remove("hud-mode-sidebar__room-bg-neutral--active");
        btn.setAttribute("aria-pressed", "false");
      }
    }
  }

  function applyRoomBgPointerHue(ev: PointerEvent): void {
    const hue = ringHueFromClient(roomBgHueRing, ev.clientX, ev.clientY);
    if (hue === null) return;
    const deg = Math.round(hue);
    syncRoomBgHueCoreVisual(deg);
    roomBgHueInputHandler?.(deg);
  }

  roomBgHueWrap.addEventListener("pointerdown", (e) => {
    if (roomBgHuePanel.hidden) return;
    roomBgHueDragging = true;
    roomBgHueWrap.setPointerCapture(e.pointerId);
    applyRoomBgPointerHue(e);
  });
  roomBgHueWrap.addEventListener("pointermove", (e) => {
    if (!roomBgHueWrap.hasPointerCapture(e.pointerId)) return;
    applyRoomBgPointerHue(e);
  });
  const releaseRoomBgCapture = (e: PointerEvent): void => {
    if (!roomBgHueWrap.hasPointerCapture(e.pointerId)) return;
    try {
      roomBgHueWrap.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    roomBgHueDragging = false;
    roomBgHueUpHandler?.();
  };
  roomBgHueWrap.addEventListener("pointerup", releaseRoomBgCapture);
  roomBgHueWrap.addEventListener("pointercancel", releaseRoomBgCapture);

  const modeSidebarHeader = document.createElement("div");
  modeSidebarHeader.className = "hud-mode-sidebar__header";

  const modeSidebarCollapseTab = document.createElement("button");
  modeSidebarCollapseTab.type = "button";
  modeSidebarCollapseTab.className =
    "hud-mode-sidebar-edge-tab hud-mode-sidebar-collapse-tab";
  modeSidebarCollapseTab.setAttribute("aria-label", "Hide play tools");
  modeSidebarCollapseTab.title = "Hide play tools panel";
  modeSidebarCollapseTab.innerHTML = nimiqIconUseMarkup("nq-caret-right-small", {
    width: 14,
    height: 14,
    class: "hud-mode-sidebar-collapse-tab__icon",
  });

  const feedbackBtn = document.createElement("button");
  feedbackBtn.type = "button";
  feedbackBtn.className = "nq-button-pill light-blue hud-mode-feedback";
  feedbackBtn.textContent = "Feedback";
  feedbackBtn.setAttribute("aria-label", "Send feedback");
  feedbackBtn.title = "Send feedback";
  modeSidebarHeader.appendChild(feedbackBtn);

  const modeSidebarReopenBtn = document.createElement("button");
  modeSidebarReopenBtn.type = "button";
  modeSidebarReopenBtn.className =
    "hud-mode-sidebar-edge-tab hud-mode-sidebar-reopen";
  modeSidebarReopenBtn.hidden = true;
  modeSidebarReopenBtn.setAttribute("aria-label", "Show play tools");
  modeSidebarReopenBtn.title = "Build tools";
  modeSidebarReopenBtn.innerHTML = nimiqIconUseMarkup("nq-caret-right-small", {
    width: 14,
    height: 14,
    class: "hud-mode-sidebar-reopen__icon",
  });

  function applyModeSidebarCollapsed(collapsed: boolean): void {
    ui.classList.toggle("hud--mode-sidebar-collapsed", collapsed);
    modeSidebarReopenBtn.hidden = !collapsed;
  }

  modeSidebarCollapseTab.addEventListener("click", () => {
    applyModeSidebarCollapsed(true);
    if (buildToggleBtn.getAttribute("aria-pressed") === "true") {
      if (document.activeElement === chatInput) {
        chatInput.blur();
      }
      queueMicrotask(() => {
        playModeHandler("walk");
      });
    }
  });
  modeSidebarReopenBtn.addEventListener("click", () => {
    applyModeSidebarCollapsed(false);
  });

  modeTablist.appendChild(buildEditKindLabel);
  modeTablist.appendChild(buildEditKindWrap);
  modeTablist.appendChild(buildToggleBtn);
  modeSidebar.appendChild(modeSidebarCollapseTab);
  modeSidebar.appendChild(modeSidebarHeader);
  modeSidebar.appendChild(modeSidebarBody);
  modeSidebar.appendChild(modeTablist);

  let roomAllowPlaceBlocks = true;
  let roomAllowExtraFloor = true;
  function applyRoomEditCaps(): void {
    const showRail = roomAllowPlaceBlocks || roomAllowExtraFloor;
    modeTablist.hidden = !showRail;
    buildEditOptObjects.disabled = !roomAllowPlaceBlocks;
    buildEditOptRoom.disabled = !roomAllowExtraFloor;
    if (roomAllowPlaceBlocks && !roomAllowExtraFloor) {
      buildEditKindSelect.value = "objects";
    } else if (!roomAllowPlaceBlocks && roomAllowExtraFloor) {
      buildEditKindSelect.value = "room";
    }
    buildToggleBtn.title = showRail
      ? "Build. Turn on to edit objects or rooms; turn off to move. Shortcut: B."
      : "Editing is disabled in this room";
  }

  // Keep signboard reading in the same top-right action stack as object edit.
  topActions.appendChild(signboardTooltip);
  topBar.appendChild(returnHomeBtn);
  topBar.appendChild(topActions);
  ui.appendChild(topBar);
  ui.appendChild(modeSidebar);
  ui.appendChild(modeSidebarReopenBtn);
  letter.appendChild(portalEnterBtn);

  const SELF_QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮"] as const;
  const selfEmojiMenu = document.createElement("div");
  selfEmojiMenu.className = "self-emoji-menu";
  selfEmojiMenu.hidden = true;
  selfEmojiMenu.setAttribute("role", "menu");
  selfEmojiMenu.setAttribute("aria-label", "Quick emoji to chat");
  let selfEmojiPickHandler: ((emoji: string) => void) | null = null;
  let selfEmojiOpenedFloor: FloorTile | null = null;
  let selfEmojiAutoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  let selfEmojiFadeFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  const SELF_EMOJI_AUTO_CLOSE_MS = 5000;
  const SELF_EMOJI_FADE_FALLBACK_MS = 700;
  let selfEmojiOutsideBound = false;
  const selfEmojiOutsideCapture = true;
  const onSelfEmojiOutsidePointerDown = (e: PointerEvent): void => {
    if (selfEmojiMenu.hidden) return;
    if (selfEmojiMenu.contains(e.target as Node)) return;
    closeSelfEmojiMenu();
  };
  const onSelfEmojiEscape = (e: KeyboardEvent): void => {
    if (e.key === "Escape") closeSelfEmojiMenu();
  };
  const onSelfEmojiFadeTransitionEnd = (ev: TransitionEvent): void => {
    if (ev.propertyName !== "opacity") return;
    if (!selfEmojiMenu.classList.contains("self-emoji-menu--auto-hiding")) return;
    if (selfEmojiFadeFallbackTimer !== null) {
      clearTimeout(selfEmojiFadeFallbackTimer);
      selfEmojiFadeFallbackTimer = null;
    }
    selfEmojiMenu.removeEventListener("transitionend", onSelfEmojiFadeTransitionEnd);
    selfEmojiMenu.classList.remove("self-emoji-menu--auto-hiding");
    selfEmojiMenu.hidden = true;
    selfEmojiPickHandler = null;
    selfEmojiOpenedFloor = null;
    unbindSelfEmojiOutside();
  };
  function clearSelfEmojiAutoCloseTimer(): void {
    if (selfEmojiAutoCloseTimer !== null) {
      clearTimeout(selfEmojiAutoCloseTimer);
      selfEmojiAutoCloseTimer = null;
    }
  }
  function clearSelfEmojiFadeFallbackTimer(): void {
    if (selfEmojiFadeFallbackTimer !== null) {
      clearTimeout(selfEmojiFadeFallbackTimer);
      selfEmojiFadeFallbackTimer = null;
    }
  }
  function armSelfEmojiAutoCloseFade(): void {
    clearSelfEmojiAutoCloseTimer();
    selfEmojiAutoCloseTimer = window.setTimeout(() => {
      selfEmojiAutoCloseTimer = null;
      if (selfEmojiMenu.hidden) return;
      selfEmojiMenu.addEventListener("transitionend", onSelfEmojiFadeTransitionEnd);
      clearSelfEmojiFadeFallbackTimer();
      selfEmojiFadeFallbackTimer = window.setTimeout(() => {
        selfEmojiFadeFallbackTimer = null;
        if (selfEmojiMenu.hidden) return;
        if (!selfEmojiMenu.classList.contains("self-emoji-menu--auto-hiding")) return;
        selfEmojiMenu.removeEventListener("transitionend", onSelfEmojiFadeTransitionEnd);
        selfEmojiMenu.classList.remove("self-emoji-menu--auto-hiding");
        selfEmojiMenu.hidden = true;
        selfEmojiPickHandler = null;
        selfEmojiOpenedFloor = null;
        unbindSelfEmojiOutside();
      }, SELF_EMOJI_FADE_FALLBACK_MS);
      selfEmojiMenu.classList.add("self-emoji-menu--auto-hiding");
    }, SELF_EMOJI_AUTO_CLOSE_MS);
  }
  function bindSelfEmojiOutside(): void {
    if (selfEmojiOutsideBound) return;
    selfEmojiOutsideBound = true;
    window.addEventListener("pointerdown", onSelfEmojiOutsidePointerDown, {
      capture: selfEmojiOutsideCapture,
    });
    window.addEventListener("keydown", onSelfEmojiEscape);
  }
  function unbindSelfEmojiOutside(): void {
    if (!selfEmojiOutsideBound) return;
    selfEmojiOutsideBound = false;
    window.removeEventListener("pointerdown", onSelfEmojiOutsidePointerDown, {
      capture: selfEmojiOutsideCapture,
    });
    window.removeEventListener("keydown", onSelfEmojiEscape);
  }
  function closeSelfEmojiMenu(): void {
    clearSelfEmojiAutoCloseTimer();
    clearSelfEmojiFadeFallbackTimer();
    selfEmojiMenu.removeEventListener("transitionend", onSelfEmojiFadeTransitionEnd);
    selfEmojiMenu.classList.remove("self-emoji-menu--auto-hiding");
    selfEmojiMenu.hidden = true;
    selfEmojiPickHandler = null;
    selfEmojiOpenedFloor = null;
    unbindSelfEmojiOutside();
  }
  for (const em of SELF_QUICK_EMOJIS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "self-emoji-menu__btn";
    btn.textContent = em;
    btn.setAttribute("role", "menuitem");
    btn.setAttribute("aria-label", `Send ${em} to chat`);
    btn.addEventListener("click", () => {
      selfEmojiPickHandler?.(em);
      closeSelfEmojiMenu();
    });
    selfEmojiMenu.appendChild(btn);
  }
  letter.appendChild(selfEmojiMenu);

  const otherPlayerCtx = document.createElement("div");
  otherPlayerCtx.className = "other-player-ctx";
  otherPlayerCtx.hidden = true;
  otherPlayerCtx.setAttribute("role", "menu");
  otherPlayerCtx.setAttribute("aria-label", "Player actions");
  const otherPlayerCtxMulti = document.createElement("div");
  otherPlayerCtxMulti.className = "other-player-ctx__multi";
  otherPlayerCtxMulti.hidden = true;
  otherPlayerCtxMulti.setAttribute("role", "group");
  otherPlayerCtxMulti.setAttribute("aria-label", "Players here");
  const otherPlayerCtxSingle = document.createElement("div");
  otherPlayerCtxSingle.className = "other-player-ctx__single";
  const otherPlayerCtxViewBtn = document.createElement("button");
  otherPlayerCtxViewBtn.type = "button";
  otherPlayerCtxViewBtn.className =
    "other-player-ctx__item other-player-ctx__item--row";
  otherPlayerCtxViewBtn.setAttribute("role", "menuitem");
  const otherPlayerCtxIdent = document.createElement("img");
  otherPlayerCtxIdent.className = "other-player-ctx__ident";
  otherPlayerCtxIdent.alt = "";
  otherPlayerCtxIdent.width = 22;
  otherPlayerCtxIdent.height = 22;
  const otherPlayerCtxViewLabel = document.createElement("span");
  otherPlayerCtxViewLabel.className = "other-player-ctx__view-label";
  otherPlayerCtxViewLabel.textContent = "View profile";
  const otherPlayerCtxViewCol = document.createElement("div");
  otherPlayerCtxViewCol.className = "other-player-ctx__view-col";
  otherPlayerCtxViewCol.appendChild(otherPlayerCtxViewLabel);
  otherPlayerCtxViewBtn.append(otherPlayerCtxIdent, otherPlayerCtxViewCol);
  otherPlayerCtxSingle.appendChild(otherPlayerCtxViewBtn);
  /*
   * Copy wallet sits next to View profile so the most common identity actions are one
   * click away; the wallet copy on the profile card is otherwise two clicks away. Idiomatic
   * single verb per row per the in-world UI principle in `docs/THE-LARGER-SYSTEM.md`.
   */
  const otherPlayerCtxCopyAddressBtn = document.createElement("button");
  otherPlayerCtxCopyAddressBtn.type = "button";
  otherPlayerCtxCopyAddressBtn.className = "other-player-ctx__item";
  otherPlayerCtxCopyAddressBtn.setAttribute("role", "menuitem");
  otherPlayerCtxCopyAddressBtn.textContent = "Copy wallet";
  otherPlayerCtxSingle.appendChild(otherPlayerCtxCopyAddressBtn);
  otherPlayerCtx.append(otherPlayerCtxMulti, otherPlayerCtxSingle);

  const otherPlayerProfile = document.createElement("div");
  otherPlayerProfile.className = "other-player-profile";
  otherPlayerProfile.hidden = true;
  otherPlayerProfile.setAttribute("aria-hidden", "true");
  const oppBackdrop = document.createElement("button");
  oppBackdrop.type = "button";
  oppBackdrop.className = "other-player-profile__backdrop";
  oppBackdrop.setAttribute("aria-label", "Dismiss profile");
  const oppDialog = document.createElement("div");
  oppDialog.className = "other-player-profile__dialog";
  oppDialog.setAttribute("role", "dialog");
  oppDialog.setAttribute("aria-modal", "true");
  oppDialog.setAttribute("aria-labelledby", "other-player-profile-title");
  const oppClose = document.createElement("button");
  oppClose.type = "button";
  oppClose.className = "other-player-profile__close";
  oppClose.setAttribute("aria-label", "Close");
  oppClose.textContent = "×";
  const oppCard = document.createElement("div");
  oppCard.className = "other-player-profile__card";
  const oppCardMain = document.createElement("div");
  oppCardMain.className = "other-player-profile__card-main";
  const oppIdent = document.createElement("img");
  oppIdent.className = "other-player-profile__identicon";
  oppIdent.alt = "";
  oppIdent.width = 76;
  oppIdent.height = 76;
  oppIdent.hidden = true;
  const oppNimiqPayHost = document.createElement("div");
  oppNimiqPayHost.className = "other-player-profile__nimiq-pay-inline";
  oppNimiqPayHost.hidden = true;
  oppNimiqPayHost.setAttribute("role", "button");
  oppNimiqPayHost.setAttribute("tabindex", "0");
  oppNimiqPayHost.setAttribute(
    "aria-label",
    "Nimiq Pay. Select for details about this session."
  );
  oppNimiqPayHost.innerHTML = `${nimiqIconUseMarkup("nq-logos-fm-mono", {
    width: 16,
    height: 15,
    class: "other-player-profile__nimiq-pay-icon",
  })}<span class="hud-player-count__tooltip" role="tooltip">This user is playing from the Nimiq Pay application.</span>`;
  const oppNimiqPayTip = oppNimiqPayHost.querySelector(
    ".hud-player-count__tooltip"
  ) as HTMLElement;
  profileNimiqPayTipAnchor = oppNimiqPayHost;
  profileNimiqPayTipEl = oppNimiqPayTip;
  oppNimiqPayHost.addEventListener("mouseenter", () =>
    setProfileNimiqPayTipVisible(true)
  );
  oppNimiqPayHost.addEventListener("mouseleave", () =>
    setProfileNimiqPayTipVisible(false)
  );
  oppNimiqPayHost.addEventListener("focus", () => setProfileNimiqPayTipVisible(true));
  oppNimiqPayHost.addEventListener("blur", () => setProfileNimiqPayTipVisible(false));
  oppNimiqPayHost.addEventListener("click", (e) => {
    e.stopPropagation();
    setProfileNimiqPayTipVisible(
      !oppNimiqPayHost.classList.contains("hud-player-count--show-tip")
    );
  });
  oppNimiqPayHost.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setProfileNimiqPayTipVisible(
        !oppNimiqPayHost.classList.contains("hud-player-count--show-tip")
      );
    }
  });
  const oppCardBody = document.createElement("div");
  oppCardBody.className = "other-player-profile__card-body";
  const oppNamePrimaryWrap = document.createElement("div");
  oppNamePrimaryWrap.className = "other-player-profile__name-primary-wrap";
  const oppDisplayNameEl = document.createElement("span");
  oppDisplayNameEl.className = "other-player-profile__display-name";
  const oppUsernameInput = document.createElement("input");
  oppUsernameInput.type = "text";
  oppUsernameInput.className =
    "other-player-profile__username-input other-player-profile__username-input--inline";
  oppUsernameInput.maxLength = 12;
  oppUsernameInput.autocomplete = "off";
  oppUsernameInput.setAttribute("aria-label", "Username");
  oppUsernameInput.hidden = true;
  oppUsernameInput.addEventListener("input", () => {
    const t = oppUsernameInput.value.replace(/[^a-zA-Z0-9]/g, "");
    if (t !== oppUsernameInput.value) oppUsernameInput.value = t;
  });
  const oppUsernameCommitBtn = document.createElement("button");
  oppUsernameCommitBtn.type = "button";
  oppUsernameCommitBtn.className = "other-player-profile__username-commit";
  oppUsernameCommitBtn.setAttribute("aria-label", "Save username");
  oppUsernameCommitBtn.hidden = true;
  oppUsernameCommitBtn.innerHTML = nimiqIconifyMarkup("check", {
    width: 16,
    height: 16,
    class: "other-player-profile__username-commit-icon",
  });
  oppNamePrimaryWrap.append(oppDisplayNameEl, oppUsernameInput, oppUsernameCommitBtn);
  const oppWalletShortEl = document.createElement("span");
  oppWalletShortEl.className = "other-player-profile__wallet-short";
  oppWalletShortEl.hidden = true;
  const oppAliasHost = document.createElement("div");
  oppAliasHost.className =
    "other-player-profile__alias-icon-wrap other-player-profile__nimiq-pay-inline";
  oppAliasHost.setAttribute("role", "button");
  oppAliasHost.setAttribute("tabindex", "0");
  oppAliasHost.setAttribute("aria-label", "Previously known as");
  oppAliasHost.hidden = true;
  oppAliasHost.innerHTML = `${nimiqIconUseMarkup("nq-contacts", {
    width: 16,
    height: 16,
    class: "other-player-profile__alias-nq-icon",
  })}<span class="hud-player-count__tooltip other-player-profile__alias-tooltip" role="tooltip"></span>`;
  const oppAliasTip = oppAliasHost.querySelector(
    ".hud-player-count__tooltip"
  ) as HTMLElement;
  profileAliasTipAnchor = oppAliasHost;
  profileAliasTipEl = oppAliasTip;
  oppAliasHost.addEventListener("mouseenter", () => setProfileAliasTipVisible(true));
  oppAliasHost.addEventListener("mouseleave", () => setProfileAliasTipVisible(false));
  oppAliasHost.addEventListener("focus", () => setProfileAliasTipVisible(true));
  oppAliasHost.addEventListener("blur", () => setProfileAliasTipVisible(false));
  oppAliasHost.addEventListener("click", (e) => {
    e.stopPropagation();
    setProfileAliasTipVisible(
      !oppAliasHost.classList.contains("hud-player-count--show-tip")
    );
  });
  oppAliasHost.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setProfileAliasTipVisible(
        !oppAliasHost.classList.contains("hud-player-count--show-tip")
      );
    }
  });
  oppDisplayNameEl.id = "other-player-profile-title";
  const oppAddrRow = document.createElement("div");
  oppAddrRow.className = "other-player-profile__addr-row";
  const oppCopyAddressBtn = document.createElement("button");
  oppCopyAddressBtn.type = "button";
  oppCopyAddressBtn.className = "other-player-profile__copy-address";
  oppCopyAddressBtn.setAttribute("aria-label", "Copy address");
  oppCopyAddressBtn.innerHTML = nimiqIconUseMarkup("nq-copy", {
    width: 14,
    height: 14,
    class: "other-player-profile__copy-address-icon",
  });
  oppAddrRow.append(
    oppNamePrimaryWrap,
    oppWalletShortEl,
    oppAliasHost,
    oppCopyAddressBtn,
    oppNimiqPayHost
  );
  const oppAdminRow = document.createElement("div");
  oppAdminRow.className = "other-player-profile__admin-mod";
  oppAdminRow.hidden = true;
  const oppAdminActions = document.createElement("select");
  oppAdminActions.className = "other-player-profile__admin-actions";
  oppAdminActions.setAttribute("aria-label", "Admin actions");
  oppAdminRow.append(oppAdminActions);
  async function adminModerationPost(
    action: string,
    extra?: Record<string, unknown>
  ): Promise<boolean> {
    const tok = opts?.getGameAuthToken?.() ?? null;
    const target = profileOpenCompact;
    if (!tok || !target) return false;
    const r = await fetch("/api/admin/moderation", {
      method: "POST",
      headers: {
        authorization: `Bearer ${tok}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, target, ...extra }),
    });
    if (!r.ok && action === "set_username") {
      const errBody = (await r.json().catch(() => ({}))) as { error?: string };
      const map: Record<string, string> = {
        username_taken: "Taken.",
        invalid_username: "Invalid.",
        username_set_banned: "Banned.",
      };
      oppProfileNote.textContent = map[errBody.error ?? ""] ?? "Error.";
      oppProfileNote.hidden = false;
      return false;
    }
    if (!r.ok) {
      oppProfileNote.textContent = "Error.";
      oppProfileNote.hidden = false;
      return false;
    }
    void showPlayerProfileView(
      target,
      oppDisplayNameEl.textContent || walletDisplayName(target),
      "other"
    );
    return true;
  }
  function syncAdminActions(banned: boolean, muted: boolean): void {
    oppAdminActions.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Actions";
    oppAdminActions.appendChild(placeholder);
    const actions = [
      ["clear_username", "Clear"],
      [banned ? "allow_name" : "ban_name", banned ? "Allow name" : "Ban name"],
      [muted ? "unmute" : "mute", muted ? "Unmute" : "Mute"],
    ] as const;
    for (const [value, label] of actions) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      oppAdminActions.appendChild(opt);
    }
    oppAdminActions.value = "";
  }
  oppAdminActions.addEventListener("change", () => {
    const v = oppAdminActions.value;
    oppAdminActions.value = "";
    if (v === "clear_username") void adminModerationPost("clear_username");
    else if (v === "ban_name") void adminModerationPost("username_ban", { banned: true });
    else if (v === "allow_name") void adminModerationPost("username_ban", { banned: false });
    else if (v === "mute") void adminModerationPost("channel_mute", { muted: true });
    else if (v === "unmute") void adminModerationPost("channel_mute", { muted: false });
  });
  const oppProfileMessage = document.createElement("div");
  oppProfileMessage.className = "other-player-profile__message-wrap";
  const oppProfileRooms = document.createElement("div");
  oppProfileRooms.className = "other-player-profile__rooms";
  const oppProfileNote = document.createElement("p");
  oppProfileNote.className = "other-player-profile__message-note";
  oppProfileNote.hidden = true;
  const oppSendNim = document.createElement("button");
  oppSendNim.type = "button";
  oppSendNim.className = "other-player-profile__send-nim";
  oppSendNim.textContent = "Send NIM";
  const oppCardFooter = document.createElement("div");
  oppCardFooter.className = "other-player-profile__card-footer";
  oppCardFooter.appendChild(oppSendNim);
  oppCardBody.append(
    oppAddrRow,
    oppAdminRow,
    oppProfileMessage,
    oppProfileRooms,
    oppProfileNote
  );
  oppCardMain.append(oppIdent, oppCardBody);
  oppCard.append(oppCardMain, oppCardFooter);
  oppDialog.appendChild(oppClose);
  oppDialog.appendChild(oppCard);
  otherPlayerProfile.appendChild(oppBackdrop);
  otherPlayerProfile.appendChild(oppDialog);
  letter.appendChild(otherPlayerCtx);
  const profileRoomConfirm = document.createElement("div");
  profileRoomConfirm.className = "other-player-profile-room-confirm";
  profileRoomConfirm.hidden = true;
  profileRoomConfirm.setAttribute("aria-hidden", "true");
  const profileRoomConfirmBackdrop = document.createElement("button");
  profileRoomConfirmBackdrop.type = "button";
  profileRoomConfirmBackdrop.className =
    "other-player-profile-room-confirm__backdrop";
  profileRoomConfirmBackdrop.setAttribute("aria-label", "Cancel room join");
  const profileRoomConfirmDialog = document.createElement("div");
  profileRoomConfirmDialog.className = "other-player-profile-room-confirm__dialog";
  profileRoomConfirmDialog.setAttribute("role", "dialog");
  profileRoomConfirmDialog.setAttribute("aria-modal", "true");
  profileRoomConfirmDialog.setAttribute(
    "aria-labelledby",
    "other-player-profile-room-confirm-title"
  );
  const profileRoomConfirmTitle = document.createElement("h2");
  profileRoomConfirmTitle.id = "other-player-profile-room-confirm-title";
  profileRoomConfirmTitle.className = "other-player-profile-room-confirm__title";
  const profileRoomConfirmLead = document.createElement("p");
  profileRoomConfirmLead.className = "other-player-profile-room-confirm__lead";
  profileRoomConfirmLead.textContent = "Join this room?";
  const profileRoomConfirmActions = document.createElement("div");
  profileRoomConfirmActions.className = "other-player-profile-room-confirm__actions";
  const profileRoomConfirmCancel = document.createElement("button");
  profileRoomConfirmCancel.type = "button";
  profileRoomConfirmCancel.className =
    "other-player-profile-room-confirm__btn other-player-profile-room-confirm__btn--cancel";
  profileRoomConfirmCancel.textContent = "Cancel";
  const profileRoomConfirmJoin = document.createElement("button");
  profileRoomConfirmJoin.type = "button";
  profileRoomConfirmJoin.className =
    "other-player-profile-room-confirm__btn other-player-profile-room-confirm__btn--join";
  profileRoomConfirmJoin.textContent = "Join room";
  profileRoomConfirmActions.append(profileRoomConfirmCancel, profileRoomConfirmJoin);
  profileRoomConfirmDialog.append(
    profileRoomConfirmTitle,
    profileRoomConfirmLead,
    profileRoomConfirmActions
  );
  profileRoomConfirm.append(profileRoomConfirmBackdrop, profileRoomConfirmDialog);
  letter.appendChild(profileRoomConfirm);
  const chatLineCtx = document.createElement("div");
  chatLineCtx.className = "other-player-ctx";
  chatLineCtx.hidden = true;
  chatLineCtx.setAttribute("role", "menu");
  chatLineCtx.setAttribute("aria-label", "Chat message actions");
  const chatLineCtxViewProfileBtn = document.createElement("button");
  chatLineCtxViewProfileBtn.type = "button";
  chatLineCtxViewProfileBtn.className = "other-player-ctx__item";
  chatLineCtxViewProfileBtn.setAttribute("role", "menuitem");
  chatLineCtxViewProfileBtn.textContent = "View profile";
  const chatLineCtxCopyBtn = document.createElement("button");
  chatLineCtxCopyBtn.type = "button";
  chatLineCtxCopyBtn.className = "other-player-ctx__item";
  chatLineCtxCopyBtn.setAttribute("role", "menuitem");
  chatLineCtxCopyBtn.textContent = "Copy message";
  const chatLineCtxTranslateBtn = document.createElement("button");
  chatLineCtxTranslateBtn.type = "button";
  chatLineCtxTranslateBtn.className = "other-player-ctx__item";
  chatLineCtxTranslateBtn.setAttribute("role", "menuitem");
  chatLineCtxTranslateBtn.textContent = "Translate";
  chatLineCtx.append(
    chatLineCtxViewProfileBtn,
    chatLineCtxCopyBtn,
    chatLineCtxTranslateBtn
  );
  letter.appendChild(chatLineCtx);

  const gateCtx = document.createElement("div");
  gateCtx.className = "other-player-ctx";
  gateCtx.hidden = true;
  gateCtx.setAttribute("role", "menu");
  gateCtx.setAttribute("aria-label", "Gate");
  const gateCtxOpenBtn = document.createElement("button");
  gateCtxOpenBtn.type = "button";
  gateCtxOpenBtn.className = "other-player-ctx__item";
  gateCtxOpenBtn.setAttribute("role", "menuitem");
  gateCtxOpenBtn.textContent = "Open gate";
  gateCtx.append(gateCtxOpenBtn);
  letter.appendChild(gateCtx);

  let gateCtxOutsideBound = false;
  let gateCtxEsc: ((e: KeyboardEvent) => void) | null = null;
  function closeGateContextMenu(): void {
    gateCtx.hidden = true;
    gateCtxOpenBtn.onclick = null;
    if (gateCtxEsc) {
      window.removeEventListener("keydown", gateCtxEsc);
      gateCtxEsc = null;
    }
    if (gateCtxOutsideBound) {
      window.removeEventListener("pointerdown", onGateCtxOutside, true);
      gateCtxOutsideBound = false;
    }
  }
  function onGateCtxOutside(ev: PointerEvent): void {
    if (!gateCtx.hidden && !gateCtx.contains(ev.target as Node)) {
      closeGateContextMenu();
    }
  }

  letter.appendChild(otherPlayerProfile);

  let chatLineCtxOutsideBound = false;
  let chatLineCtxEsc: ((e: KeyboardEvent) => void) | null = null;
  type ChatLineCtxPayload = {
    fromAddress: string;
    displayName: string;
    profileIsSelf: boolean;
    translateText: string;
  };
  let chatLineCtxPayload: ChatLineCtxPayload | null = null;

  function closeChatLineContextMenu(): void {
    chatLineCtx.hidden = true;
    chatLineCtxPayload = null;
    if (chatLineCtxEsc) {
      window.removeEventListener("keydown", chatLineCtxEsc);
      chatLineCtxEsc = null;
    }
    if (!chatLineCtxOutsideBound) return;
    chatLineCtxOutsideBound = false;
    window.removeEventListener("pointerdown", onChatLineCtxOutsidePointerDown);
  }

  function onChatLineCtxOutsidePointerDown(e: PointerEvent): void {
    if (chatLineCtx.hidden) return;
    if (chatLineCtx.contains(e.target as Node)) return;
    closeChatLineContextMenu();
  }

  function onChatLineCtxEscape(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    closeChatLineContextMenu();
  }

  function bindChatLineCtxOutside(): void {
    if (chatLineCtxOutsideBound) return;
    chatLineCtxOutsideBound = true;
    window.addEventListener("pointerdown", onChatLineCtxOutsidePointerDown);
  }

  function googleTranslateUrlForText(message: string): string {
    const raw = message.trim();
    const q = encodeURIComponent(raw);
    const tlRaw = (navigator.language || "en").split("-")[0]?.trim() || "en";
    const tl = /^[a-zA-Z]{2,3}$/.test(tlRaw) ? tlRaw : "en";
    const mobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    const mobileUa = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const base =
      mobile || mobileUa
        ? "https://translate.google.com/m"
        : "https://translate.google.com/";
    return `${base}?sl=auto&tl=${tl}&q=${q}`;
  }

  function openChatLineContextMenu(
    clientX: number,
    clientY: number,
    payload: ChatLineCtxPayload
  ): void {
    closeChatLineContextMenu();
    closeOtherPlayerContextMenu();
    closeSelfEmojiMenu();
    chatLineCtxPayload = payload;
    const hasProfile = !!payload.fromAddress;
    chatLineCtxViewProfileBtn.hidden = !hasProfile;
    chatLineCtx.hidden = false;
    chatLineCtx.style.position = "fixed";
    chatLineCtxEsc = onChatLineCtxEscape;
    window.addEventListener("keydown", chatLineCtxEsc);
    requestAnimationFrame(() => {
      const w = chatLineCtx.offsetWidth || 160;
      const h = chatLineCtx.offsetHeight || 44;
      const pad = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = Math.min(Math.max(pad, clientX), vw - w - pad);
      const y = Math.min(Math.max(pad, clientY), vh - h - pad);
      chatLineCtx.style.left = `${x}px`;
      chatLineCtx.style.top = `${y}px`;
      bindChatLineCtxOutside();
      chatLineCtxTranslateBtn.focus();
    });
  }

  chatLineCtxViewProfileBtn.addEventListener("click", () => {
    const p = chatLineCtxPayload;
    closeChatLineContextMenu();
    if (!p?.fromAddress) return;
    if (p.profileIsSelf) {
      openOwnPlayerProfileFromBar();
    } else {
      void showPlayerProfileView(p.fromAddress, p.displayName, "other");
    }
  });

  chatLineCtxCopyBtn.addEventListener("click", () => {
    const p = chatLineCtxPayload;
    closeChatLineContextMenu();
    const text = p?.translateText.trim() ?? "";
    if (!text) return;
    /* Idiomatic silent copy, matches `oppCopyAddressBtn` pattern. */
    void navigator.clipboard?.writeText(text).catch(() => {
      /* ignore */
    });
  });

  chatLineCtxTranslateBtn.addEventListener("click", () => {
    const p = chatLineCtxPayload;
    closeChatLineContextMenu();
    if (!p?.translateText.trim()) return;
    const text = p.translateText.trim();
    const url = googleTranslateUrlForText(text);
    presentExternalVisitConfirm({
      url,
      displayName: "Google Translate",
      onConfirm: () => {
        const assist = prefersTranslateClipboardAssist();
        if (assist && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(text).then(
            () => showTranslateClipboardHintToast(),
            () => {}
          );
        }
        window.open(url, "_blank", "noopener,noreferrer");
      },
    });
  });

  let otherCtxOutsideBound = false;
  let profileOpenCompact = "";
  let profileMessageEditor: HTMLElement | null = null;
  let profileDescEditBlurHandler: (() => void) | null = null;
  let profileMessageKindOpen: "self" | "other" | null = null;
  let profileMessageLastSaved = "";
  let profileUsernameEditing = false;
  let profileUsernameSavedCustom = "";
  let profileUsernameEditBaseline = "";
  let profileRoomJoinPending: { id: string; displayName: string } | null = null;
  let profileRoomConfirmEsc: ((e: KeyboardEvent) => void) | null = null;

  function hideProfileRoomJoinConfirm(): void {
    profileRoomJoinPending = null;
    profileRoomConfirm.hidden = true;
    profileRoomConfirm.setAttribute("aria-hidden", "true");
    if (profileRoomConfirmEsc) {
      window.removeEventListener("keydown", profileRoomConfirmEsc);
      profileRoomConfirmEsc = null;
    }
  }

  function presentProfileRoomJoinConfirm(room: {
    id: string;
    displayName: string;
  }): void {
    profileRoomJoinPending = room;
    profileRoomConfirmTitle.textContent =
      room.displayName || `Room ${room.id.toUpperCase()}`;
    profileRoomConfirm.hidden = false;
    profileRoomConfirm.setAttribute("aria-hidden", "false");
    profileRoomConfirmEsc = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      hideProfileRoomJoinConfirm();
    };
    window.addEventListener("keydown", profileRoomConfirmEsc);
    profileRoomConfirmJoin.focus({ preventScroll: true });
  }
  profileRoomConfirmBackdrop.addEventListener("click", hideProfileRoomJoinConfirm);
  profileRoomConfirmCancel.addEventListener("click", hideProfileRoomJoinConfirm);
  profileRoomConfirmJoin.addEventListener("click", () => {
    const pending = profileRoomJoinPending;
    hideProfileRoomJoinConfirm();
    if (!pending) return;
    profileRoomJoinHandler(pending.id);
    closeOtherPlayerProfile();
  });

  function endUsernameEditVisual(): void {
    profileUsernameEditing = false;
    profileUsernameEditBaseline = "";
    oppUsernameInput.hidden = true;
    oppUsernameCommitBtn.hidden = true;
    oppDisplayNameEl.hidden = false;
  }

  function beginUsernameEdit(): void {
    const adminOther =
      profileMessageKindOpen === "other" && opts?.isGameAdmin?.() === true;
    if (profileMessageKindOpen !== "self" && !adminOther) return;
    if (profileMessageKindOpen === "self" && oppUsernameInput.readOnly) return;
    if (profileUsernameEditing) return;
    profileUsernameEditing = true;
    oppDisplayNameEl.hidden = true;
    oppUsernameInput.hidden = false;
    oppUsernameCommitBtn.hidden = false;
    profileUsernameEditBaseline =
      profileUsernameSavedCustom || oppDisplayNameEl.textContent?.trim() || "";
    oppUsernameInput.value = profileUsernameEditBaseline;
    requestAnimationFrame(() => {
      oppUsernameInput.focus();
      oppUsernameInput.select();
    });
  }

  function updateProfileNameHitInteractivity(kind: "self" | "other"): void {
    const adminOther = kind === "other" && opts?.isGameAdmin?.() === true;
    if (kind !== "self" && !adminOther) {
      oppDisplayNameEl.classList.remove("other-player-profile__display-name--editable");
      oppDisplayNameEl.removeAttribute("role");
      oppDisplayNameEl.removeAttribute("tabindex");
      return;
    }
    const locked = kind === "self" && oppUsernameInput.readOnly;
    if (locked) {
      oppDisplayNameEl.classList.remove("other-player-profile__display-name--editable");
      oppDisplayNameEl.removeAttribute("role");
      oppDisplayNameEl.removeAttribute("tabindex");
    } else {
      oppDisplayNameEl.classList.add("other-player-profile__display-name--editable");
      oppDisplayNameEl.setAttribute("role", "button");
      oppDisplayNameEl.tabIndex = 0;
    }
  }

  async function maybeCommitUsernameBlur(): Promise<void> {
    if (!profileUsernameEditing) return;
    const v = oppUsernameInput.value.trim();
    if (v === profileUsernameEditBaseline) {
      endUsernameEditVisual();
      return;
    }
    const ok =
      profileMessageKindOpen === "self"
        ? await commitSelfUsername()
        : await commitAdminUsername();
    if (ok) endUsernameEditVisual();
    else requestAnimationFrame(() => oppUsernameInput.focus());
  }

  /** Same length as two-line sample: THISISONETHISITHISISONETHISITHISISONETHISITHISISONETHISITHISISO */
  const PROFILE_DESC_MAX_CHARS =
    "THISISONETHISITHISISONETHISITHISISONETHISITHISISONETHISITHISISO".length;

  function normalizeProfileDescForSave(raw: string): string {
    let t = raw.replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
    if (t.length > PROFILE_DESC_MAX_CHARS) t = t.slice(0, PROFILE_DESC_MAX_CHARS);
    return t;
  }

  function placeCaretAtEnd(el: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function syncDescEditLength(el: HTMLElement): void {
    const raw = el.textContent ?? "";
    const flat = raw.replace(/\r?\n/g, " ");
    if (flat.length > PROFILE_DESC_MAX_CHARS) {
      el.textContent = flat.slice(0, PROFILE_DESC_MAX_CHARS);
      placeCaretAtEnd(el);
    } else if (raw !== flat) {
      el.textContent = flat;
      placeCaretAtEnd(el);
    }
  }

  function clearProfileMessageNote(): void {
    oppProfileNote.hidden = true;
    oppProfileNote.textContent = "";
  }

  function cancelSelfProfileMessageEdit(): void {
    const el = profileMessageEditor;
    if (!el) return;
    if (profileDescEditBlurHandler) {
      el.removeEventListener("blur", profileDescEditBlurHandler);
      profileDescEditBlurHandler = null;
    }
    profileMessageEditor = null;
    if (profileMessageKindOpen === "self") {
      renderProfileMessageDisplay("self", profileMessageLastSaved);
    }
  }

  function renderProfileMessageDisplay(
    kind: "self" | "other",
    message: string
  ): void {
    oppProfileMessage.replaceChildren();
    const trimmed = message.trim();
    if (kind === "other") {
      const box = document.createElement("div");
      box.className = "other-player-profile__message-text";
      if (trimmed) {
        box.textContent = message;
      } else {
        const ph = document.createElement("span");
        ph.className = "other-player-profile__message-placeholder";
        ph.textContent = "No description yet.";
        box.appendChild(ph);
      }
      oppProfileMessage.appendChild(box);
      return;
    }
    const box = document.createElement("div");
    box.className =
      "other-player-profile__message-text other-player-profile__message-text--editable";
    box.tabIndex = 0;
    box.contentEditable = "false";
    box.setAttribute("role", "button");
    box.setAttribute(
      "aria-label",
      "Your profile description. Click to edit."
    );
    if (trimmed) {
      box.textContent = message;
    } else {
      const ph = document.createElement("span");
      ph.className = "other-player-profile__message-placeholder";
      ph.textContent = "No description yet.";
      box.appendChild(ph);
    }
    const beginDescEdit = (): void => {
      if (profileMessageKindOpen !== "self" || profileMessageEditor) return;
      clearProfileMessageNote();
      profileMessageEditor = box;
      box.contentEditable = "true";
      box.classList.add("other-player-profile__message-text--editing");
      box.setAttribute("role", "textbox");
      box.setAttribute("aria-multiline", "true");
      const seed = profileMessageLastSaved.replace(/\r?\n/g, " ");
      box.textContent = seed.slice(0, PROFILE_DESC_MAX_CHARS);
      box.focus();
      placeCaretAtEnd(box);
      profileDescEditBlurHandler = () => {
        void commitSelfProfileMessageEdit();
      };
      box.addEventListener("blur", profileDescEditBlurHandler);
      box.addEventListener("input", () => syncDescEditLength(box));
    };
    box.addEventListener("click", () => {
      if (box.contentEditable !== "true") beginDescEdit();
    });
    box.addEventListener("keydown", (e) => {
      if (box.contentEditable !== "true") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          beginDescEdit();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelSelfProfileMessageEdit();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
    oppProfileMessage.appendChild(box);
  }

  function renderProfileRooms(
    kind: "self" | "other",
    rooms: Array<{
      id: string;
      displayName: string;
      isPublic?: boolean;
      playerCount?: number;
    }>
  ): void {
    oppProfileRooms.replaceChildren();
    const title = document.createElement("div");
    title.className = "other-player-profile__rooms-title";
    title.textContent = "Rooms";
    oppProfileRooms.appendChild(title);
    if (rooms.length === 0) {
      const empty = document.createElement("div");
      empty.className = "other-player-profile__rooms-empty";
      empty.textContent =
        kind === "self" ? "No rooms yet." : "No public rooms yet.";
      oppProfileRooms.appendChild(empty);
      return;
    }
    const list = document.createElement("div");
    list.className = "other-player-profile__rooms-list";
    for (const room of rooms) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "other-player-profile__room";
      const n = Math.max(0, Math.floor(room.playerCount ?? 0));
      const disp = room.displayName || `Room ${room.id.toUpperCase()}`;
      const pub = room.isPublic === true;
      row.setAttribute(
        "aria-label",
        `Join ${disp} — ${n} ${n === 1 ? "player" : "players"}${pub ? "" : ", private"}`
      );
      const name = document.createElement("span");
      name.className = "other-player-profile__room-name";
      name.textContent = disp;
      const meta = document.createElement("span");
      meta.className = "other-player-profile__room-meta";
      if (!pub) {
        const prv = document.createElement("span");
        prv.className = "other-player-profile__room-meta-private";
        prv.textContent = "Private · ";
        meta.appendChild(prv);
      }
      const countEl = document.createElement("span");
      countEl.className = "other-player-profile__room-meta-count";
      countEl.textContent = String(n);
      meta.appendChild(countEl);
      const iconWrap = document.createElement("span");
      iconWrap.className = "other-player-profile__room-meta-icon-wrap";
      iconWrap.setAttribute("aria-hidden", "true");
      iconWrap.innerHTML = nimiqIconifyMarkup("person-1", {
        class: "other-player-profile__room-meta-icon",
        width: 14,
        height: 14,
      });
      meta.appendChild(iconWrap);
      row.append(name, meta);
      row.addEventListener("click", () => {
        presentProfileRoomJoinConfirm({
          id: room.id,
          displayName: disp,
        });
      });
      list.appendChild(row);
    }
    oppProfileRooms.appendChild(list);
  }

  async function commitSelfProfileMessageEdit(): Promise<void> {
    const el = profileMessageEditor;
    if (!el || profileMessageKindOpen !== "self" || el.contentEditable !== "true")
      return;
    if (profileDescEditBlurHandler) {
      el.removeEventListener("blur", profileDescEditBlurHandler);
      profileDescEditBlurHandler = null;
    }
    const nextRaw = el.textContent ?? "";
    const next = normalizeProfileDescForSave(nextRaw);
    const prev = normalizeProfileDescForSave(profileMessageLastSaved);
    profileMessageEditor = null;
    el.contentEditable = "false";
    el.classList.remove("other-player-profile__message-text--editing");
    if (next === prev) {
      renderProfileMessageDisplay("self", profileMessageLastSaved);
      return;
    }
    const tok = opts?.getGameAuthToken?.() ?? null;
    if (!tok) {
      oppProfileNote.textContent = "Session missing. Rejoin from the lobby.";
      oppProfileNote.hidden = false;
      renderProfileMessageDisplay("self", profileMessageLastSaved);
      return;
    }
    try {
      const r = await fetch("/api/player-profile/message", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${tok}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: next }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!r.ok) {
        oppProfileNote.textContent =
          j.error === "unauthorized"
            ? "Session expired. Rejoin from the lobby."
            : "Could not save.";
        oppProfileNote.hidden = false;
        renderProfileMessageDisplay("self", profileMessageLastSaved);
        return;
      }
      profileMessageLastSaved = String(j.message ?? "");
      clearProfileMessageNote();
      renderProfileMessageDisplay("self", profileMessageLastSaved);
    } catch {
      oppProfileNote.textContent = "Network error.";
      oppProfileNote.hidden = false;
      renderProfileMessageDisplay("self", profileMessageLastSaved);
    }
  }

  async function commitSelfUsername(): Promise<boolean> {
    if (profileMessageKindOpen !== "self") return false;
    clearProfileMessageNote();
    const tok = opts?.getGameAuthToken?.() ?? null;
    if (!tok) {
      oppProfileNote.textContent = "Session missing.";
      oppProfileNote.hidden = false;
      return false;
    }
    const raw = oppUsernameInput.value.trim();
    try {
      const r = await fetch("/api/player-profile/username", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${tok}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ username: raw }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        usernameLockedUntil?: number;
        effectiveDisplayName?: string;
        customUsername?: string;
      };
      if (!r.ok) {
        const map: Record<string, string> = {
          username_cooldown: "Wait 24h.",
          username_taken: "Taken.",
          invalid_username: "Invalid.",
          username_set_banned: "Blocked.",
          username_self_service_disabled: "Admins only.",
        };
        oppProfileNote.textContent = map[j.error ?? ""] ?? "Error.";
        oppProfileNote.hidden = false;
        return false;
      }
      if (typeof j.usernameLockedUntil === "number") {
        oppUsernameInput.dataset.lockedUntil = String(j.usernameLockedUntil);
      }
      profileUsernameSavedCustom = String(j.customUsername ?? "").trim();
      if (typeof j.effectiveDisplayName === "string") {
        oppDisplayNameEl.textContent = j.effectiveDisplayName.trim();
      }
      const compact = profileOpenCompact;
      if (compact) {
        oppWalletShortEl.textContent = walletDisplayName(compact);
        oppWalletShortEl.hidden = !profileUsernameSavedCustom;
      }
      const until = Number(oppUsernameInput.dataset.lockedUntil);
      oppUsernameInput.readOnly =
        Number.isFinite(until) && until > Date.now();
      updateProfileNameHitInteractivity("self");
      return true;
    } catch {
      oppProfileNote.textContent = "Network.";
      oppProfileNote.hidden = false;
      return false;
    }
  }

  async function commitAdminUsername(): Promise<boolean> {
    if (profileMessageKindOpen !== "other" || opts?.isGameAdmin?.() !== true) {
      return false;
    }
    const raw = oppUsernameInput.value.trim();
    const ok = await adminModerationPost("set_username", { username: raw });
    if (ok) {
      profileUsernameSavedCustom = raw;
    }
    return ok;
  }

  oppDisplayNameEl.addEventListener("click", () => {
    const adminOther =
      profileMessageKindOpen === "other" && opts?.isGameAdmin?.() === true;
    if (profileMessageKindOpen !== "self" && !adminOther) return;
    if (profileMessageKindOpen === "self" && oppUsernameInput.readOnly) return;
    beginUsernameEdit();
  });
  oppDisplayNameEl.addEventListener("keydown", (e) => {
    const adminOther =
      profileMessageKindOpen === "other" && opts?.isGameAdmin?.() === true;
    if (profileMessageKindOpen !== "self" && !adminOther) return;
    if (profileMessageKindOpen === "self" && oppUsernameInput.readOnly) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      beginUsernameEdit();
    }
  });
  oppUsernameInput.addEventListener("blur", () => {
    void maybeCommitUsernameBlur();
  });
  oppUsernameInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (!profileUsernameEditing) return;
    e.preventDefault();
    void (async () => {
      const ok =
        profileMessageKindOpen === "self"
          ? await commitSelfUsername()
          : await commitAdminUsername();
      if (ok) endUsernameEditVisual();
    })();
  });
  oppUsernameCommitBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  oppUsernameCommitBtn.addEventListener("click", (e) => {
    e.preventDefault();
    void (async () => {
      const ok =
        profileMessageKindOpen === "self"
          ? await commitSelfUsername()
          : await commitAdminUsername();
      if (ok) endUsernameEditVisual();
    })();
  });

  function closeOtherPlayerProfile(): void {
    hideProfileRoomJoinConfirm();
    setProfileNimiqPayTipVisible(false);
    setProfileAliasTipVisible(false);
    detachProfileEscape();
    profileOpenCompact = "";
    profileMessageKindOpen = null;
    if (profileMessageEditor && profileDescEditBlurHandler) {
      profileMessageEditor.removeEventListener("blur", profileDescEditBlurHandler);
    }
    profileDescEditBlurHandler = null;
    profileMessageEditor = null;
    oppProfileMessage.replaceChildren();
    oppProfileRooms.replaceChildren();
    clearProfileMessageNote();
    oppSendNim.textContent = "Send NIM";
    endUsernameEditVisual();
    oppDisplayNameEl.textContent = "";
    oppAliasTip.textContent = "";
    oppAliasHost.hidden = true;
    oppWalletShortEl.textContent = "";
    oppWalletShortEl.hidden = true;
    profileUsernameSavedCustom = "";
    oppUsernameInput.value = "";
    oppUsernameInput.readOnly = false;
    oppAdminRow.hidden = true;
    oppAdminActions.replaceChildren();
    otherPlayerProfile.hidden = true;
    otherPlayerProfile.setAttribute("aria-hidden", "true");
    oppIdent.hidden = true;
    oppIdent.removeAttribute("src");
    delete oppIdent.dataset.address;
    oppNimiqPayHost.hidden = true;
    delete oppCopyAddressBtn.dataset.fullAddress;
    oppCopyAddressBtn.removeAttribute("title");
  }

  function closeOtherPlayerContextMenu(): void {
    otherPlayerCtx.hidden = true;
    otherPlayerCtxMulti.replaceChildren();
    otherPlayerCtxMulti.hidden = true;
    otherPlayerCtxSingle.hidden = false;
    otherPlayerCtxIdent.hidden = true;
    otherPlayerCtxIdent.removeAttribute("src");
    delete otherPlayerCtxIdent.dataset.address;
    if (!otherCtxOutsideBound) return;
    otherCtxOutsideBound = false;
    window.removeEventListener("pointerdown", onOtherCtxOutsidePointerDown);
    window.removeEventListener("keydown", onOtherCtxEscape);
  }

  function closeOtherPlayerUiOverlays(): void {
    closeOtherPlayerProfile();
    closeOtherPlayerContextMenu();
    closeChatLineContextMenu();
    closeGateContextMenu();
  }

  async function loadCtxIdenticon(
    img: HTMLImageElement,
    compact: string
  ): Promise<void> {
    img.hidden = false;
    img.removeAttribute("src");
    img.dataset.address = compact;
    try {
      const { identiconDataUrl } = await import("../game/identiconTexture.js");
      const url = await identiconDataUrl(compact);
      if (img.dataset.address !== compact) return;
      img.src = url;
    } catch {
      if (img.dataset.address === compact) {
        img.hidden = true;
      }
    }
  }

  function setSingleCtxTarget(address: string, displayName: string): void {
    const compact = address.replace(/\s+/g, "").trim();
    otherPlayerCtxViewBtn.dataset.address = compact;
    otherPlayerCtxViewBtn.dataset.displayName = displayName;
    void loadCtxIdenticon(otherPlayerCtxIdent, compact);
  }

  function openOtherPlayerMultiPicker(
    targets: Array<{ address: string; displayName: string }>,
    emote?: { onEmote: () => void }
  ): void {
    otherPlayerCtxMulti.replaceChildren();
    if (emote) {
      otherPlayerCtxMulti.setAttribute(
        "aria-label",
        "Emote and nearby players"
      );
      const emoteBtn = document.createElement("button");
      emoteBtn.type = "button";
      emoteBtn.className =
        "other-player-ctx__pick other-player-ctx__pick--emote";
      emoteBtn.setAttribute("role", "menuitem");
      emoteBtn.textContent = "Emote";
      emoteBtn.addEventListener("click", () => {
        closeOtherPlayerContextMenu();
        emote.onEmote();
      });
      otherPlayerCtxMulti.appendChild(emoteBtn);
    } else {
      otherPlayerCtxMulti.setAttribute("aria-label", "Players here");
    }
    for (const t of targets) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "other-player-ctx__pick";
      row.setAttribute("role", "menuitem");
      const compact = t.address.replace(/\s+/g, "").trim();
      const label = t.displayName.trim() || walletDisplayName(compact);
      const img = document.createElement("img");
      img.className = "other-player-ctx__ident";
      img.alt = "";
      img.width = 22;
      img.height = 22;
      const sp = document.createElement("span");
      sp.className = "other-player-ctx__pick-label";
      sp.textContent = label;
      row.append(img, sp);
      void loadCtxIdenticon(img, compact);
      row.addEventListener("click", () => {
        otherPlayerCtxMulti.hidden = true;
        otherPlayerCtxSingle.hidden = false;
        setSingleCtxTarget(t.address, t.displayName);
      });
      otherPlayerCtxMulti.appendChild(row);
    }
    otherPlayerCtxMulti.hidden = false;
    otherPlayerCtxSingle.hidden = true;
  }

  function onOtherCtxOutsidePointerDown(e: PointerEvent): void {
    if (otherPlayerCtx.hidden) return;
    if (otherPlayerCtx.contains(e.target as Node)) return;
    closeOtherPlayerContextMenu();
  }

  function onOtherCtxEscape(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    closeOtherPlayerContextMenu();
  }

  let profileEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
  function detachProfileEscape(): void {
    if (!profileEscapeHandler) return;
    window.removeEventListener("keydown", profileEscapeHandler);
    profileEscapeHandler = null;
  }
  function attachProfileEscape(): void {
    if (profileEscapeHandler) return;
    profileEscapeHandler = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (profileMessageEditor) {
        e.preventDefault();
        cancelSelfProfileMessageEdit();
        return;
      }
      if (profileUsernameEditing) {
        e.preventDefault();
        oppUsernameInput.value = profileUsernameEditBaseline;
        endUsernameEditVisual();
        return;
      }
      closeOtherPlayerProfile();
    };
    window.addEventListener("keydown", profileEscapeHandler);
  }

  function bindOtherCtxOutside(): void {
    if (otherCtxOutsideBound) return;
    otherCtxOutsideBound = true;
    window.addEventListener("pointerdown", onOtherCtxOutsidePointerDown);
    window.addEventListener("keydown", onOtherCtxEscape);
  }

  function walletKeyForProfile(a: string): string {
    return a.replace(/\s+/g, "").trim().toUpperCase();
  }

  async function showPlayerProfileView(
    address: string,
    _displayName: string,
    kind: "self" | "other"
  ): Promise<void> {
    const compact = walletKeyForProfile(address);
    if (!compact) return;
    profileOpenCompact = compact;
    profileMessageKindOpen = kind;
    profileMessageLastSaved = "";
    clearProfileMessageNote();
    setProfileNimiqPayTipVisible(false);
    setProfileAliasTipVisible(false);
    endUsernameEditVisual();
    oppDisplayNameEl.textContent =
      _displayName.trim() || walletDisplayName(compact);
    oppWalletShortEl.hidden = true;
    profileUsernameSavedCustom = "";
    const showNimiqPayBadge =
      kind === "self"
        ? opts?.didSessionUseNimiqPay?.() === true
        : opts?.playerUsesNimiqPayInRoom?.(compact) === true;
    oppNimiqPayHost.hidden = !showNimiqPayBadge;
    if (profileMessageEditor && profileDescEditBlurHandler) {
      profileMessageEditor.removeEventListener("blur", profileDescEditBlurHandler);
    }
    profileDescEditBlurHandler = null;
    profileMessageEditor = null;
    oppProfileMessage.replaceChildren();
    oppProfileRooms.replaceChildren();
    const loading = document.createElement("div");
    loading.className =
      "other-player-profile__message-text other-player-profile__message-text--loading";
    loading.textContent = "Loading…";
    oppProfileMessage.appendChild(loading);

    oppCopyAddressBtn.title = compact;
    oppCopyAddressBtn.dataset.fullAddress = compact;
    if (kind === "self") {
      oppSendNim.textContent = "Open Wallet";
      oppSendNim.dataset.walletUrl = NIMIQ_WALLET_URL;
    } else {
      oppSendNim.textContent = "Send NIM";
      oppSendNim.dataset.walletUrl = nimiqWalletRecipientDeepLink(compact);
    }
    oppIdent.hidden = false;
    oppIdent.removeAttribute("src");
    oppIdent.dataset.address = compact;
    void (async (): Promise<void> => {
      try {
        const { identiconDataUrl } = await import("../game/identiconTexture.js");
        const url = await identiconDataUrl(compact);
        if (oppIdent.dataset.address !== compact) return;
        oppIdent.src = url;
      } catch {
        if (oppIdent.dataset.address === compact) {
          oppIdent.hidden = true;
        }
      }
    })();
    otherPlayerProfile.hidden = false;
    otherPlayerProfile.setAttribute("aria-hidden", "false");
    attachProfileEscape();
    oppClose.focus({ preventScroll: true });

    const openFor = compact;
    const tok = opts?.getGameAuthToken?.() ?? null;
    const headers: Record<string, string> = {};
    if (tok) headers.authorization = `Bearer ${tok}`;
    try {
      const r = await fetch(
        `/api/player-profile/${encodeURIComponent(openFor)}`,
        { headers }
      );
      const j = (await r.json().catch(() => ({}))) as {
        message?: string;
        effectiveDisplayName?: string;
        recentAliases?: string[];
        customUsername?: string | null;
        usernameLockedUntil?: number | null;
        usernameSetBanned?: boolean;
        subjectUsernameBanned?: boolean;
        subjectChannelMuted?: boolean;
        usernameSelfServiceEnabled?: boolean;
        rooms?: Array<{
          id?: unknown;
          displayName?: unknown;
          isPublic?: unknown;
          playerCount?: unknown;
        }>;
      };
      if (profileOpenCompact !== openFor) return;
      if (typeof j.effectiveDisplayName === "string" && j.effectiveDisplayName.trim()) {
        oppDisplayNameEl.textContent = j.effectiveDisplayName.trim();
      }
      const aliases = Array.isArray(j.recentAliases)
        ? j.recentAliases.map((x) => String(x).trim()).filter(Boolean)
        : [];
      oppAliasTip.textContent =
        aliases.length > 0 ? `Previously known as\n${aliases.join("\n")}` : "";
      oppAliasHost.hidden = aliases.length === 0;
      const adminOther =
        kind === "other" && opts?.isGameAdmin?.() === true;
      oppAdminRow.hidden = !adminOther;
      if (adminOther) {
        const banned = j.subjectUsernameBanned === true;
        const muted = j.subjectChannelMuted === true;
        syncAdminActions(banned, muted);
      }
      profileUsernameSavedCustom = j.customUsername?.trim() ?? "";
      const hasCustom = Boolean(profileUsernameSavedCustom);
      if (compact) {
        oppWalletShortEl.textContent = walletDisplayName(compact);
        oppWalletShortEl.hidden = !hasCustom;
      }
      if (kind === "self") {
        oppUsernameInput.value = profileUsernameSavedCustom;
        const bannedSelf = j.usernameSetBanned === true;
        const until = j.usernameLockedUntil ?? 0;
        const allowByPolicy =
          j.usernameSelfServiceEnabled === true ||
          opts?.isGameAdmin?.() === true;
        oppUsernameInput.readOnly =
          !allowByPolicy ||
          bannedSelf ||
          (typeof until === "number" && until > Date.now());
        if (typeof until === "number" && until > 0) {
          oppUsernameInput.dataset.lockedUntil = String(until);
        } else {
          delete oppUsernameInput.dataset.lockedUntil;
        }
        updateProfileNameHitInteractivity("self");
      } else {
        oppUsernameInput.value = "";
        oppUsernameInput.readOnly = false;
        updateProfileNameHitInteractivity("other");
      }
      const msg = typeof j.message === "string" ? j.message : "";
      profileMessageLastSaved = msg;
      renderProfileMessageDisplay(kind, msg);
      const rooms = Array.isArray(j.rooms)
        ? j.rooms
            .map((room) => {
              const id = String(room.id ?? "").trim();
              const displayName = String(room.displayName ?? "").trim();
              const rawPub = room.isPublic;
              const isPublicKnown = typeof rawPub === "boolean";
              const isPublic =
                isPublicKnown
                  ? rawPub
                  : kind === "self" || adminOther
                    ? true
                    : false;
              const playerCount =
                typeof room.playerCount === "number" &&
                Number.isFinite(room.playerCount)
                  ? Math.max(0, Math.floor(room.playerCount))
                  : 0;
              return { id, displayName, isPublic, playerCount };
            })
            .filter((room) => room.id)
            .filter((room) => {
              if (kind === "self" || adminOther) return true;
              return room.isPublic === true;
            })
        : [];
      rooms.sort(
        (a, b) =>
          b.playerCount - a.playerCount ||
          a.displayName.localeCompare(b.displayName) ||
          a.id.localeCompare(b.id)
      );
      renderProfileRooms(kind, rooms.slice(0, 3));
    } catch {
      if (profileOpenCompact !== openFor) return;
      profileMessageLastSaved = "";
      oppProfileRooms.replaceChildren();
      if (kind === "self") {
        renderProfileMessageDisplay("self", "");
      } else {
        oppProfileMessage.replaceChildren();
        const err = document.createElement("div");
        err.className =
          "other-player-profile__message-text other-player-profile__message-text--loading";
        err.textContent = "Could not load profile.";
        oppProfileMessage.appendChild(err);
      }
    }
  }

  oppClose.addEventListener("click", () => {
    closeOtherPlayerProfile();
  });
  oppBackdrop.addEventListener("click", () => {
    closeOtherPlayerProfile();
  });
  oppSendNim.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const url = oppSendNim.dataset.walletUrl?.trim() ?? "";
    if (!url) return;
    opts?.onNimRecipientDeepLinkOpen?.(url);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) opts?.onNimRecipientDeepLinkPopupBlocked?.();
  });
  oppCopyAddressBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const full = oppCopyAddressBtn.dataset.fullAddress?.trim() ?? "";
    if (!full) return;
    void navigator.clipboard.writeText(full).catch(() => {
      /* idiomatic silent copy; no toast */
    });
  });

  otherPlayerCtxViewBtn.addEventListener("click", () => {
    const addr = otherPlayerCtxViewBtn.dataset.address ?? "";
    const disp = otherPlayerCtxViewBtn.dataset.displayName ?? "";
    closeOtherPlayerContextMenu();
    if (addr) void showPlayerProfileView(addr, disp, "other");
  });

  otherPlayerCtxCopyAddressBtn.addEventListener("click", () => {
    /* Single source of truth: the address stamped on the View row when the menu opened. */
    const addr = (otherPlayerCtxViewBtn.dataset.address ?? "").trim();
    closeOtherPlayerContextMenu();
    if (!addr) return;
    /* Idiomatic silent copy, matches `oppCopyAddressBtn` pattern. */
    void navigator.clipboard?.writeText(addr).catch(() => {
      /* ignore */
    });
  });

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

  let chatMinimized = false;
  try {
    chatMinimized = localStorage.getItem(LS_HUD_CHAT_MINIMIZED) === "1";
  } catch {
    /* ignore */
  }

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
    if (chatMinimized) return;
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

  function onChatHoverZoneContextMenu(e: MouseEvent): void {
    const rawTarget = e.target;
    if (!(rawTarget instanceof Node)) return;
    const el =
      rawTarget instanceof Element ? rawTarget : rawTarget.parentElement;
    if (!el) return;
    const line = el.closest(".chat-line");
    if (!(line instanceof HTMLElement)) return;
    if (!worldChatLog.contains(line) && !systemChatLog.contains(line)) return;
    e.preventDefault();
    e.stopPropagation();
    const translateText = line.dataset.chatTranslateText ?? "";
    const fromAddress = (line.dataset.chatFromAddress ?? "").trim();
    const displayName = (line.dataset.chatDisplayName ?? "").trim();
    const profileIsSelf = line.dataset.chatProfileSelf === "1";
    openChatLineContextMenu(e.clientX, e.clientY, {
      fromAddress,
      displayName,
      profileIsSelf,
      translateText,
    });
  }

  chatHoverZone.addEventListener("contextmenu", onChatHoverZoneContextMenu);

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
  let nimClaimFadeTimer: ReturnType<typeof setTimeout> | null = null;
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
  const canvasCountdown = document.createElement("div");
  canvasCountdown.className = "canvas-countdown";
  canvasCountdown.hidden = true;
  canvasCountdown.setAttribute("aria-live", "assertive");
  ui.appendChild(canvasCountdown);

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

  const chatMinimizeBtn = document.createElement("button");
  chatMinimizeBtn.type = "button";
  chatMinimizeBtn.className = "chat-row__minimize";
  chatMinimizeBtn.title = "Hide chat";
  chatMinimizeBtn.setAttribute("aria-label", "Hide chat");
  chatMinimizeBtn.textContent = "−";
  chatRow.appendChild(chatMinimizeBtn);

  const chatRestoreBtn = document.createElement("button");
  chatRestoreBtn.type = "button";
  chatRestoreBtn.className = "chat-row__restore";
  chatRestoreBtn.title = "Show chat";
  chatRestoreBtn.setAttribute("aria-label", "Show chat");
  chatRestoreBtn.textContent = "Chat";
  chatRestoreBtn.hidden = true;
  chatRow.appendChild(chatRestoreBtn);

  function applyChatMinimizedUi(min: boolean): void {
    chatMinimized = min;
    chatPanel.hidden = min;
    chatInput.hidden = min;
    chatMinimizeBtn.hidden = min;
    chatRestoreBtn.hidden = !min;
    if (min && document.activeElement === chatInput) {
      chatInput.blur();
    }
  }

  function setChatMinimizedState(min: boolean, persist: boolean): void {
    applyChatMinimizedUi(min);
    if (!persist) return;
    try {
      if (min) {
        localStorage.setItem(LS_HUD_CHAT_MINIMIZED, "1");
      } else {
        localStorage.removeItem(LS_HUD_CHAT_MINIMIZED);
      }
    } catch {
      /* ignore */
    }
  }

  applyChatMinimizedUi(chatMinimized);

  chatMinimizeBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setChatMinimizedState(true, true);
  });
  chatRestoreBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setChatMinimizedState(false, true);
    chatInput.focus();
  });

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
      <div class="tile-inspector" id="tile-inspector-placement">
        <p class="tile-inspector__head-hint" id="tile-inspector-head-hint" hidden></p>
        <div class="tile-inspector__tool-row tile-inspector__toolbar">
          <label class="tile-inspector__tool-label" for="tile-inspector-tool">Tool</label>
          <select id="tile-inspector-tool" class="tile-inspector__tool-select" aria-label="Placement tool">
            <option value="block" selected>Block</option>
            <option value="signpost">Signpost</option>
            <option value="billboard">Billboard</option>
            <option value="teleporter">Teleporter</option>
            <option value="gate">Gate</option>
          </select>
        </div>
        <div class="tile-inspector__section tile-inspector__section--block-only">
          <div class="tile-inspector__section-head">Parameters</div>
          <label class="tile-inspector__param" for="tile-inspector-height">
            <span class="tile-inspector__param-label">Height</span>
            <input type="range" id="tile-inspector-height" class="tile-inspector__slider" min="0" max="2" step="1" value="2" aria-valuetext="Full" />
            <span class="tile-inspector__param-value" id="tile-inspector-height-val">1.0 m</span>
          </label>
        </div>
        <div class="tile-inspector__section tile-inspector__section--block-only" id="tile-inspector-pyramid-base-section" hidden>
          <label class="tile-inspector__param" for="tile-inspector-pyramid-base">
            <span class="tile-inspector__param-label">Pyramid base</span>
            <input type="range" id="tile-inspector-pyramid-base" class="tile-inspector__slider" min="100" max="165" step="5" value="100" aria-valuetext="100%" />
            <span class="tile-inspector__param-value" id="tile-inspector-pyramid-base-val">100%</span>
          </label>
        </div>
        <div class="tile-inspector__section tile-inspector__section--block-only">
          <button type="button" class="build-block-bar__advanced-toggle tile-inspector__advanced-link" aria-expanded="false" aria-controls="build-block-bar-advanced">Advanced…</button>
        </div>
        <button type="button" class="tile-inspector__reset-btn" id="tile-inspector-reset">Reset to defaults</button>
      </div>
      <input type="checkbox" class="build-block-bar__hex" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
      <input type="checkbox" class="build-block-bar__pyramid" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
      <input type="checkbox" class="build-block-bar__sphere" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
      <input type="checkbox" class="build-block-bar__ramp" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
      <div class="build-block-bar__teleporter" id="build-block-bar-teleporter" hidden>
        <p class="build-block-bar__teleporter-hint">Click an empty walkable floor tile to place. Select the teleporter to set its destination (room and X/Z).</p>
      </div>
      <div class="build-block-bar__teleporter" id="build-block-bar-gate" hidden>
        <p class="build-block-bar__teleporter-hint">Click an empty walkable floor tile for the gate. Green/red shows whether each side is clear to walk through. You can still place a decorative or blocked doorway.</p>
        <div class="build-block-bar__ramp-dir-row build-block-bar__gate-tool-row">
          <span class="build-block-bar__ramp-dir-label">Opening direction</span>
          <div class="build-block-bar__ramp-dir-controls">
            <button type="button" class="build-block-bar__ramp-rot build-block-bar__gate-exit-ccw" title="Rotate opening direction counter-clockwise" aria-label="Rotate gate opening direction counter-clockwise">↺</button>
            <button type="button" class="build-block-bar__ramp-rot build-block-bar__gate-exit-cw" title="Rotate opening direction clockwise" aria-label="Rotate gate opening direction clockwise">↻</button>
          </div>
        </div>
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
  /* column-reverse: bottom = chat input, then chat log + tabs */
  bottomLeftStack.appendChild(chatRow);
  bottomLeftStack.appendChild(chatPanel);
  ui.appendChild(bottomLeftStack);
  ui.appendChild(barAdvancedPopover);

  const barShapePopover = document.createElement("div");
  barShapePopover.id = "build-block-bar-shape-popover";
  barShapePopover.className = "build-block-bar-shape-popover";
  barShapePopover.hidden = true;
  barShapePopover.setAttribute("role", "dialog");
  barShapePopover.setAttribute("aria-label", "Block shape");
  barShapePopover.innerHTML = SHAPE_PICKER_OPTIONS_HTML;
  ui.appendChild(barShapePopover);

  const panelShapePopover = document.createElement("div");
  panelShapePopover.id = "build-object-panel-shape-popover";
  panelShapePopover.className =
    "build-block-bar-shape-popover build-block-bar-shape-popover--dock-trigger";
  panelShapePopover.hidden = true;
  panelShapePopover.setAttribute("role", "dialog");
  panelShapePopover.setAttribute("aria-label", "Block shape");
  panelShapePopover.innerHTML = SHAPE_PICKER_OPTIONS_HTML;
  ui.appendChild(panelShapePopover);

  const barShapeColorRow = document.createElement("div");
  barShapeColorRow.className =
    "hud-mode-sidebar__shape-color-row hud-mode-sidebar__shape-color-row--placement";
  barShapeColorRow.hidden = true;
  const barShapeTrigger = document.createElement("button");
  barShapeTrigger.type = "button";
  barShapeTrigger.className = "hud-mode-sidebar__shape-trigger";
  barShapeTrigger.title = "Block shape";
  barShapeTrigger.setAttribute("aria-haspopup", "dialog");
  barShapeTrigger.setAttribute("aria-expanded", "false");
  barShapeTrigger.setAttribute("aria-controls", "build-block-bar-shape-popover");
  barShapeTrigger.innerHTML = `<span class="hud-mode-sidebar__shape-trigger-icon" aria-hidden="true">${SHAPE_TRIG_SVG.cube}</span><span class="hud-mode-sidebar__shape-trigger-label">Cube</span>`;

  const barHueRingWrap = document.createElement("div");
  barHueRingWrap.className =
    "build-block-bar__hue-ring-wrap hud-mode-sidebar__room-bg-hue-wrap";
  barHueRingWrap.title = "Color. Drag on the ring; selection snaps to the nearest preset.";
  barHueRingWrap.innerHTML = `
            <div class="build-block-bar__hue-ring" role="slider" tabindex="0" aria-label="Block color" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0"></div>
            <div class="build-block-bar__hue-core" aria-hidden="true"></div>
          `;
  barShapeColorRow.appendChild(barShapeTrigger);
  barShapeColorRow.appendChild(barHueRingWrap);
  hueDock.appendChild(barShapeColorRow);

  const hueDockBlockPreview = document.createElement("div");
  hueDockBlockPreview.className = "hud-mode-sidebar__block-preview-dock";
  hueDockBlockPreview.innerHTML = `
    <div class="tile-inspector__section-head tile-inspector__section-head--dock">Preview</div>
    <div id="tile-inspector-preview-placement-slot" class="hud-mode-sidebar__block-preview-slot">
      <div class="tile-inspector__preview-box tile-inspector__preview-box--tile tile-inspector__preview-box--dock">
        <canvas id="tile-inspector-preview-canvas" class="tile-inspector__preview-canvas" width="120" height="120" aria-hidden="true"></canvas>
      </div>
    </div>
    <div id="tile-inspector-preview-selection-slot" class="hud-mode-sidebar__block-preview-slot" hidden>
      <div class="tile-inspector__preview-box tile-inspector__preview-box--tile tile-inspector__preview-box--dock">
        <canvas id="panel-tile-inspector-preview-canvas" class="tile-inspector__preview-canvas" width="120" height="120" aria-hidden="true"></canvas>
      </div>
    </div>
  `;
  hueDock.appendChild(hueDockBlockPreview);

  /** Declared before build-bar init runs `syncBlockPreviewDockSlots` (avoids TDZ on `objectPanel`). */
  let objectPanel: HTMLDivElement | null = null;
  /** Block color ring docked in `.hud-mode-sidebar__hue-dock` while editing a placed tile. */
  let panelDockHueWrap: HTMLElement | null = null;
  /** Row: shape trigger + hue ring while editing a placed block. */
  let panelShapeColorRow: HTMLElement | null = null;
  let panelShapeTriggerEl: HTMLButtonElement | null = null;
  let panelShapePopoverAbort: AbortController | null = null;

  function syncBlockPreviewDockSlots(): void {
    const pSlot = hueDockBlockPreview.querySelector(
      "#tile-inspector-preview-placement-slot"
    ) as HTMLElement | null;
    const sSlot = hueDockBlockPreview.querySelector(
      "#tile-inspector-preview-selection-slot"
    ) as HTMLElement | null;
    if (!pSlot || !sSlot) return;
    const selectionOn =
      objectPanel !== null &&
      objectPanel.querySelector("#tile-inspector-selection") !== null;
    const blockToolRail =
      hudPlayMode === "build" &&
      !buildBlockBar.hidden &&
      !signpostModeActive &&
      !billboardModeActive &&
      !teleporterModeActive &&
      !gateModeActive;
    pSlot.hidden = !blockToolRail || selectionOn;
    sSlot.hidden = !selectionOn;
    hueDockBlockPreview.hidden = pSlot.hidden && sSlot.hidden;
  }

  modeSidebarBuildMount.appendChild(buildBlockBar);
  buildBlockBar.classList.add("build-block-bar--rail");

  const teleporterSection = buildBlockBar.querySelector(
    "#build-block-bar-teleporter"
  ) as HTMLElement | null;
  const gateSection = buildBlockBar.querySelector(
    "#build-block-bar-gate"
  ) as HTMLElement | null;

  let buildToolChangeHandler:
    | ((
        tool: "block" | "signpost" | "teleporter" | "billboard" | "gate"
      ) => void)
    | null = null;

  const objectPanelAdvancedPopover = document.createElement("div");
  objectPanelAdvancedPopover.id = "build-object-panel-advanced";
  objectPanelAdvancedPopover.className = "build-object-panel-advanced";
  objectPanelAdvancedPopover.setAttribute("role", "dialog");
  objectPanelAdvancedPopover.setAttribute("aria-label", "More block options");
  objectPanelAdvancedPopover.hidden = true;
  ui.appendChild(objectPanelAdvancedPopover);

  const objectPanelContextPopover = document.createElement("div");
  objectPanelContextPopover.id = "build-object-panel-context";
  objectPanelContextPopover.className = "build-object-panel-context";
  objectPanelContextPopover.hidden = true;
  objectPanelContextPopover.setAttribute("role", "dialog");
  objectPanelContextPopover.setAttribute(
    "aria-label",
    "Selected object"
  );
  ui.appendChild(objectPanelContextPopover);

  const barClaimToggle = barAdvancedPopover.querySelector(
    ".build-block-bar__claim-toggle"
  ) as HTMLButtonElement;
  const barExperimentalOnly = barAdvancedPopover.querySelector(
    ".build-block-bar__experimental-only"
  ) as HTMLElement;
  const barHexCb = buildBlockBar.querySelector(
    ".build-block-bar__hex"
  ) as HTMLInputElement;
  const barPyramidCb = buildBlockBar.querySelector(
    ".build-block-bar__pyramid"
  ) as HTMLInputElement;
  const barSphereCb = buildBlockBar.querySelector(
    ".build-block-bar__sphere"
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
  const barGateExitCCW = gateSection?.querySelector(
    ".build-block-bar__gate-exit-ccw"
  ) as HTMLButtonElement | null;
  const barGateExitCW = gateSection?.querySelector(
    ".build-block-bar__gate-exit-cw"
  ) as HTMLButtonElement | null;
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
  const tileInspectorToolSelect = buildBlockBar.querySelector(
    "#tile-inspector-tool"
  ) as HTMLSelectElement;
  const barShapeBtns = Array.from(
    barShapePopover.querySelectorAll(".tile-inspector__shape-btn")
  ) as HTMLButtonElement[];
  const barHueRing = barHueRingWrap.querySelector(
    ".build-block-bar__hue-ring"
  ) as HTMLElement;
  const barHueCore = barHueRingWrap.querySelector(
    ".build-block-bar__hue-core"
  ) as HTMLElement;
  const tileInspectorRoot = buildBlockBar.querySelector(
    ".tile-inspector"
  ) as HTMLElement;
  const tileInspectorHeadHint = buildBlockBar.querySelector(
    "#tile-inspector-head-hint"
  ) as HTMLElement;
  const tileInspectorHeightInput = buildBlockBar.querySelector(
    "#tile-inspector-height"
  ) as HTMLInputElement;
  const tileInspectorHeightVal = buildBlockBar.querySelector(
    "#tile-inspector-height-val"
  ) as HTMLElement;
  const tileInspectorResetBtn = buildBlockBar.querySelector(
    "#tile-inspector-reset"
  ) as HTMLButtonElement;
  let signpostModeActive = false;
  /** Teleporter tool: place pending tiles; configure destination via object panel. */
  let teleporterModeActive = false;
  /** Gate tool: solid block with authorized opener and exit neighbor. */
  let gateModeActive = false;
  let billboardModeActive = false;
  const tileInspectorPyramidBaseSection = buildBlockBar.querySelector(
    "#tile-inspector-pyramid-base-section"
  ) as HTMLElement | null;
  const tileInspectorPyramidBaseInput = buildBlockBar.querySelector(
    "#tile-inspector-pyramid-base"
  ) as HTMLInputElement | null;
  const tileInspectorPyramidBaseVal = buildBlockBar.querySelector(
    "#tile-inspector-pyramid-base-val"
  ) as HTMLElement | null;

  function pyramidBasePercentFromScale(scale: number): number {
    return Math.round(clampPyramidBaseScale(scale) * 100);
  }

  function syncBarPyramidBaseSliderFromScale(scale: number): void {
    if (!tileInspectorPyramidBaseInput || !tileInspectorPyramidBaseVal) return;
    const pct = pyramidBasePercentFromScale(scale);
    const stepped = Math.round((pct - 100) / 5) * 5 + 100;
    const v = Math.min(165, Math.max(100, stepped));
    tileInspectorPyramidBaseInput.value = String(v);
    tileInspectorPyramidBaseVal.textContent = `${v}%`;
    tileInspectorPyramidBaseInput.setAttribute("aria-valuetext", `${v}%`);
  }

  function syncPlacementPyramidBaseSectionVisibility(): void {
    if (!tileInspectorPyramidBaseSection) return;
    const show =
      !signpostModeActive &&
      !billboardModeActive &&
      !teleporterModeActive &&
      !gateModeActive &&
      barPyramidCb.checked &&
      !barRampCb.checked;
    tileInspectorPyramidBaseSection.hidden = !show;
  }

  let inspectorPreviewGameRef: Game | null = null;

  const barTitleEl = tileInspectorHeadHint;
  /** Matches the mode passed to `setPlayModeState`; keeps placement shape+hue hidden in floor (room) edit. */
  let hudPlayMode: "walk" | "build" | "floor" = "walk";

  function syncModeSidebarBodyInteractive(): void {
    modeSidebarBody.classList.toggle(
      "hud-mode-sidebar__body--interactive",
      !roomBgHuePanel.hidden ||
        !roomEntrySpawnPanel.hidden ||
        !buildBlockBar.hidden ||
        objectPanel !== null
    );
  }

  function syncHueDockVisibility(): void {
    /* Placement row = next block to paint; selection row = selected tile. Only one at a time. */
    const editRoomTab =
      hudPlayMode === "floor" ||
      (buildToggleBtn.getAttribute("aria-pressed") === "true" &&
        buildEditKindSelect.value === "room");
    if (panelShapeColorRow !== null) {
      barShapeColorRow.hidden = true;
    } else {
      barShapeColorRow.hidden = buildBlockBar.hidden || editRoomTab;
    }
    const panelHueDocked =
      panelShapeColorRow !== null && !panelShapeColorRow.hidden;
    hueDock.hidden =
      roomBgHuePanel.hidden &&
      roomEntrySpawnPanel.hidden &&
      barShapeColorRow.hidden &&
      !panelHueDocked;
    syncBlockPreviewDockSlots();
  }

  let lastHueDeg = 0;

  function refreshBuildBarTitle(): void {
    if (!tileInspectorHeadHint) return;
    if (teleporterModeActive) {
      tileInspectorHeadHint.textContent =
        "Teleporter. Choose an empty floor tile to place.";
      tileInspectorHeadHint.hidden = false;
      return;
    }
    if (gateModeActive) {
      tileInspectorHeadHint.textContent =
        "Gate. R rotates the opening direction. Green/red on neighbors shows clearance. Pick a color, then click an empty floor tile.";
      tileInspectorHeadHint.hidden = false;
      return;
    }
    if (signpostModeActive) {
      tileInspectorHeadHint.textContent =
        "Signpost. Tap a tile to add your message.";
      tileInspectorHeadHint.hidden = false;
      return;
    }
    if (billboardModeActive) {
      tileInspectorHeadHint.textContent =
        "Billboard. Hover for footprint and preview. Press M to move the selection, or press M again to cancel. Tap the anchor to place.";
      tileInspectorHeadHint.hidden = false;
      return;
    }
    tileInspectorHeadHint.hidden = true;
  }

  const signpostTextarea = signpostOverlay.querySelector(".signpost-overlay__textarea") as HTMLTextAreaElement;
  const signpostCharCount = signpostOverlay.querySelector(".signpost-overlay__char-count") as HTMLElement;
  const signpostCancelBtn = signpostOverlay.querySelector(".signpost-overlay__btn--cancel") as HTMLButtonElement;
  const signpostCreateBtn = signpostOverlay.querySelector(".signpost-overlay__btn--create") as HTMLButtonElement;
  
  let signpostPendingTile: { x: number; z: number } | null = null;
  let signpostPlaceHandler: ((x: number, z: number, message: string) => void) | null = null;

  function activateBuildTool(
    tool: "block" | "signpost" | "teleporter" | "billboard" | "gate"
  ): void {
    setBarShapePopoverOpen(false);
    signpostModeActive = tool === "signpost";
    teleporterModeActive = tool === "teleporter";
    gateModeActive = tool === "gate";
    billboardModeActive = tool === "billboard";
    if (teleporterSection) {
      teleporterSection.hidden = !teleporterModeActive;
    }
    if (gateSection) {
      gateSection.hidden = !gateModeActive;
    }
    if (tileInspectorToolSelect && tileInspectorToolSelect.value !== tool) {
      tileInspectorToolSelect.value = tool;
    }
    refreshBuildBarTitle();
    if (tileInspectorRoot) {
      tileInspectorRoot.classList.toggle(
        "tile-inspector--minimal",
        signpostModeActive ||
          teleporterModeActive ||
          gateModeActive ||
          billboardModeActive
      );
    }
    if (tileInspectorResetBtn) {
      tileInspectorResetBtn.hidden =
        signpostModeActive ||
        teleporterModeActive ||
        gateModeActive ||
        billboardModeActive;
    }
    buildToolChangeHandler?.(tool);
    syncBlockPreviewDockSlots();
  }

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

  const billboardSize4x1Btn = billboardDialog.querySelector(
    "#billboard-size-4x1"
  ) as HTMLButtonElement | null;
  const billboardSize2x1Btn = billboardDialog.querySelector(
    "#billboard-size-2x1"
  ) as HTMLButtonElement | null;
  const billboardSizeHintEl = billboardDialog.querySelector(
    "#billboard-size-hint"
  ) as HTMLElement | null;
  const billboardPreviewImg = billboardOverlay.querySelector(
    "#billboard-preview-img"
  ) as HTMLImageElement | null;
  const billboardCancelBtn = billboardOverlay.querySelector(
    ".billboard-modal__btn--cancel"
  ) as HTMLButtonElement | null;
  const billboardCreateBtn = billboardOverlay.querySelector(
    ".billboard-modal__btn--place"
  ) as HTMLButtonElement | null;

  let billboardPendingTile: { x: number; z: number } | null = null;
  let billboardPlaceHandler:
    | ((
        x: number,
        z: number,
        opts:
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
            }
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
              liveChart: {
                range: NimBillboardChartRange;
                fallbackAdvertId: string;
                rangeCycle?: boolean;
                cycleIntervalSec?: number;
              };
            }
      ) => void)
    | null = null;

  let billboardEditTargetId: string | null = null;

  let billboardUpdateHandler:
    | ((
        id: string,
        opts:
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
            }
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
              liveChart: {
                range: NimBillboardChartRange;
                fallbackAdvertId: string;
                rangeCycle?: boolean;
                cycleIntervalSec?: number;
              };
            }
      ) => void)
    | null = null;

  const billboardModalTitleEl = billboardOverlay.querySelector(
    "#billboard-modal-title"
  ) as HTMLElement | null;

  let billboardDraftChangeHandler:
    | ((
        d: {
          orientation: "horizontal" | "vertical";
          yawSteps: number;
          advertId: string;
          advertIds: string[];
          intervalSec: number;
          liveChartRange: NimBillboardChartRange;
          liveChartFallbackAdvertId: string;
          liveChartRangeCycle: boolean;
          liveChartCycleIntervalSec: number;
          billboardSourceTab: "images" | "other";
        }
      ) => void)
    | null = null;

  let billboardRotationAdvertIds: string[] = [];
  let billboardSourceTab: "images" | "other" = "images";

  function chartRangeFromSelect(): NimBillboardChartRange {
    const v = String(billboardChartRangeSelect?.value ?? "24h").trim();
    if (v === "7d") return "7d";
    return "24h";
  }

  function chartFallbackFromSelect(): string {
    const v = String(billboardChartFallbackSelect?.value ?? "").trim();
    return BILLBOARD_ADVERTS_CATALOG.some((a) => a.id === v)
      ? v
      : DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID;
  }

  function chartCycleIntervalFromInput(): number {
    const n = Math.floor(Number(billboardChartCycleIntervalInput?.value ?? 20));
    if (!Number.isFinite(n)) return 20;
    return Math.max(5, Math.min(300, n));
  }

  function syncBillboardChartCycleUi(): void {
    const on = Boolean(billboardChartRangeCycleInput?.checked);
    if (billboardChartCycleIntervalWrap) {
      billboardChartCycleIntervalWrap.hidden = !on;
    }
    if (billboardChartRangeSelect) {
      billboardChartRangeSelect.disabled = on;
    }
  }

  function syncBillboardSourceTabUi(): void {
    const img = billboardSourceTab === "images";
    billboardTabImagesBtn?.classList.toggle("billboard-modal__tab--active", img);
    billboardTabOtherBtn?.classList.toggle("billboard-modal__tab--active", !img);
    billboardTabImagesBtn?.setAttribute("aria-selected", img ? "true" : "false");
    billboardTabOtherBtn?.setAttribute("aria-selected", img ? "false" : "true");
    if (billboardPanelImagesEl) billboardPanelImagesEl.hidden = !img;
    if (billboardPanelOtherEl) billboardPanelOtherEl.hidden = img;
  }

  let chartPreviewBusy = false;
  async function refreshBillboardChartPreview(): Promise<void> {
    const cv = billboardDialog.querySelector(
      "#billboard-chart-preview"
    ) as HTMLCanvasElement | null;
    if (!cv) return;
    cv.width = NIM_BILLBOARD_CHART_W;
    cv.height = NIM_BILLBOARD_CHART_H;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const range = billboardChartRangeCycleInput?.checked
      ? ("24h" as NimBillboardChartRange)
      : chartRangeFromSelect();
    const title = nimChartTitleForRange(range);
    if (chartPreviewBusy) return;
    chartPreviewBusy = true;
    try {
      const data = await fetchNimBillboardOhlc(range);
      await ensureNimChartFontsLoaded();
      drawNimBillboardCandles(ctx, data.candles, cv.width, cv.height, title);
    } catch {
      ctx.fillStyle = "#0b0f14";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "22px system-ui,Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Preview unavailable. The chart API is unreachable or the OHLC fetch failed.",
        cv.width / 2,
        cv.height / 2
      );
    } finally {
      chartPreviewBusy = false;
    }
  }

  function defaultBillboardAdvertId(): string {
    return BILLBOARD_ADVERTS_CATALOG[0]?.id ?? "";
  }

  function getBillboardRotationIntervalSec(): number {
    const raw = Math.floor(Number(billboardRotationIntervalInput?.value ?? "8"));
    if (!Number.isFinite(raw)) return 8;
    return Math.max(1, Math.min(300, raw));
  }

  function syncBillboardRotationHint(): void {
    if (!billboardRotationHintEl) return;
    const n = billboardRotationAdvertIds.length;
    const sec = getBillboardRotationIntervalSec();
    billboardRotationHintEl.textContent =
      n > 1
        ? `${n} adverts · ${sec}s per slide · “Visit” follows the active slide`
        : `Add more adverts to rotate (max ${BILLBOARD_MAX_ADVERT_SLOTS}). Seconds per slide applies when there are 2+.`;
  }

  function syncBillboardPreviewFromRotation(): void {
    if (!billboardPreviewImg) return;
    const id = billboardRotationAdvertIds[0] ?? defaultBillboardAdvertId();
    const a = BILLBOARD_ADVERTS_CATALOG.find((x) => x.id === id);
    billboardPreviewImg.src = a?.slides[0] ?? "";
  }

  function renderBillboardRotationList(): void {
    const ul = billboardRotationListEl;
    if (!ul) return;
    ul.innerHTML = "";
    for (let i = 0; i < billboardRotationAdvertIds.length; i++) {
      const id = billboardRotationAdvertIds[i]!;
      const name =
        BILLBOARD_ADVERTS_CATALOG.find((a) => a.id === id)?.name ?? id;
      const li = document.createElement("li");
      li.className = "billboard-modal__slide-item";
      const lab = document.createElement("span");
      lab.className = "billboard-modal__slide-label";
      lab.textContent = `${i + 1}. ${name}`;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "billboard-modal__slide-remove";
      rm.textContent = "Remove";
      rm.disabled = billboardRotationAdvertIds.length <= 1;
      rm.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (billboardRotationAdvertIds.length <= 1) return;
        billboardRotationAdvertIds.splice(i, 1);
        renderBillboardRotationList();
        syncBillboardRotationHint();
        syncBillboardPreviewFromRotation();
        emitBillboardDraftFromForm();
      });
      li.appendChild(lab);
      li.appendChild(rm);
      ul.appendChild(li);
    }
    syncBillboardRotationHint();
  }

  function resetBillboardRotationFromDraft(draft?: {
    orientation?: "horizontal" | "vertical";
    advertIds?: string[];
    advertId?: string;
    intervalSec?: number;
    intervalMs?: number;
  }): void {
    let ids: string[] = [];
    if (draft?.advertIds?.length) {
      ids = draft.advertIds
        .map((x) => String(x ?? "").trim())
        .filter((id) => BILLBOARD_ADVERTS_CATALOG.some((a) => a.id === id))
        .slice(0, BILLBOARD_MAX_ADVERT_SLOTS);
    } else {
      const one = String(draft?.advertId ?? "").trim();
      const ok = one && BILLBOARD_ADVERTS_CATALOG.some((a) => a.id === one);
      ids = [ok ? one : defaultBillboardAdvertId()];
    }
    if (ids.length === 0) ids = [defaultBillboardAdvertId()];
    billboardRotationAdvertIds = ids;
    let sec = 8;
    if (draft?.intervalSec !== undefined) {
      const s = Math.floor(Number(draft.intervalSec));
      if (Number.isFinite(s)) sec = Math.max(1, Math.min(300, s));
    } else if (draft?.intervalMs !== undefined) {
      const s = Math.round(Number(draft.intervalMs) / 1000);
      if (Number.isFinite(s)) sec = Math.max(1, Math.min(300, s));
    }
    if (billboardRotationIntervalInput) {
      billboardRotationIntervalInput.value = String(sec);
    }
    renderBillboardRotationList();
    syncBillboardPreviewFromRotation();
  }

  function setBillboardSizeUi(orientation: "horizontal" | "vertical"): void {
    const horiz = orientation !== "vertical";
    billboardSize4x1Btn?.classList.toggle(
      "billboard-modal__size-btn--active",
      horiz
    );
    billboardSize2x1Btn?.classList.toggle(
      "billboard-modal__size-btn--active",
      !horiz
    );
    billboardSize4x1Btn?.setAttribute("aria-pressed", horiz ? "true" : "false");
    billboardSize2x1Btn?.setAttribute("aria-pressed", horiz ? "false" : "true");
  }

  function emitBillboardDraftFromForm(): void {
    const orientation: "horizontal" | "vertical" =
      billboardSize2x1Btn?.classList.contains(
        "billboard-modal__size-btn--active"
      )
        ? "vertical"
        : "horizontal";
    const fallback = defaultBillboardAdvertId();
    const advertIds =
      billboardRotationAdvertIds.length > 0
        ? [...billboardRotationAdvertIds]
        : [fallback];
    const advertId = advertIds[0] ?? fallback;
    const intervalSec = getBillboardRotationIntervalSec();
    const liveChartRange = chartRangeFromSelect();
    const liveChartFallbackAdvertId = chartFallbackFromSelect();
    const liveChartRangeCycle = Boolean(billboardChartRangeCycleInput?.checked);
    const liveChartCycleIntervalSec = chartCycleIntervalFromInput();
    billboardDraftChangeHandler?.({
      orientation,
      yawSteps: 0,
      advertId,
      advertIds,
      intervalSec,
      liveChartRange,
      liveChartFallbackAdvertId,
      liveChartRangeCycle,
      liveChartCycleIntervalSec,
      billboardSourceTab: billboardSourceTab,
    });
  }

  billboardSize4x1Btn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBillboardSizeUi("horizontal");
    emitBillboardDraftFromForm();
  });
  billboardSize2x1Btn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBillboardSizeUi("vertical");
    emitBillboardDraftFromForm();
  });
  billboardRotationAddBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = String(billboardRotationAddSelect?.value ?? "").trim();
    const id = BILLBOARD_ADVERTS_CATALOG.some((a) => a.id === raw)
      ? raw
      : defaultBillboardAdvertId();
    if (billboardRotationAdvertIds.length >= BILLBOARD_MAX_ADVERT_SLOTS) {
      return;
    }
    billboardRotationAdvertIds.push(id);
    renderBillboardRotationList();
    syncBillboardPreviewFromRotation();
    emitBillboardDraftFromForm();
  });
  billboardRotationIntervalInput?.addEventListener("input", () => {
    syncBillboardRotationHint();
    emitBillboardDraftFromForm();
  });

  billboardTabImagesBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    billboardSourceTab = "images";
    syncBillboardSourceTabUi();
    emitBillboardDraftFromForm();
  });
  billboardTabOtherBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    billboardSourceTab = "other";
    syncBillboardSourceTabUi();
    emitBillboardDraftFromForm();
    void refreshBillboardChartPreview();
  });
  billboardChartRangeSelect?.addEventListener("change", () => {
    emitBillboardDraftFromForm();
    if (billboardSourceTab === "other") void refreshBillboardChartPreview();
  });
  billboardChartFallbackSelect?.addEventListener("change", () => {
    emitBillboardDraftFromForm();
  });
  billboardChartRangeCycleInput?.addEventListener("change", () => {
    syncBillboardChartCycleUi();
    emitBillboardDraftFromForm();
    if (billboardSourceTab === "other") void refreshBillboardChartPreview();
  });
  billboardChartCycleIntervalInput?.addEventListener("input", () => {
    emitBillboardDraftFromForm();
  });

  if (billboardCancelBtn) {
    billboardCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      billboardOverlay.hidden = true;
      billboardPendingTile = null;
      billboardEditTargetId = null;
      billboardSourceTab = "images";
      syncBillboardSourceTabUi();
      if (billboardChartRangeCycleInput) {
        billboardChartRangeCycleInput.checked = false;
      }
      if (billboardChartCycleIntervalInput) {
        billboardChartCycleIntervalInput.value = "20";
      }
      syncBillboardChartCycleUi();
      if (billboardModalTitleEl) {
        billboardModalTitleEl.textContent = "Place billboard";
      }
      if (billboardCreateBtn) billboardCreateBtn.textContent = "Place";
    });
  }

  if (billboardCreateBtn) {
    billboardCreateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const orientation: "horizontal" | "vertical" =
        billboardSize2x1Btn?.classList.contains(
          "billboard-modal__size-btn--active"
        )
          ? "vertical"
          : "horizontal";
      const fallback = defaultBillboardAdvertId();
      const advertIds =
        billboardRotationAdvertIds.length > 0
          ? [...billboardRotationAdvertIds]
          : [fallback];
      const advertId = advertIds[0] ?? fallback;
      if (!advertId) return;
      const intervalSec = getBillboardRotationIntervalSec();
      const opts =
        billboardSourceTab === "other"
          ? {
              orientation,
              advertId: fallback,
              advertIds: [fallback],
              intervalSec: 8,
              liveChart: {
                range: chartRangeFromSelect(),
                fallbackAdvertId: chartFallbackFromSelect(),
                ...(billboardChartRangeCycleInput?.checked
                  ? {
                      rangeCycle: true as const,
                      cycleIntervalSec: chartCycleIntervalFromInput(),
                    }
                  : {}),
              } as const,
            }
          : { orientation, advertId, advertIds, intervalSec };
      if (billboardEditTargetId) {
        billboardUpdateHandler?.(billboardEditTargetId, opts);
      } else {
        if (!billboardPendingTile) return;
        billboardPlaceHandler?.(
          billboardPendingTile.x,
          billboardPendingTile.z,
          opts
        );
      }
      billboardOverlay.hidden = true;
      billboardPendingTile = null;
      billboardEditTargetId = null;
      billboardSourceTab = "images";
      syncBillboardSourceTabUi();
      if (billboardModalTitleEl) {
        billboardModalTitleEl.textContent = "Place billboard";
      }
      if (billboardCreateBtn) billboardCreateBtn.textContent = "Place";
    });
  }

  if (BILLBOARD_VERTICAL_PLACEMENT_TEMP_DISABLED) {
    if (billboardSize2x1Btn) {
      billboardSize2x1Btn.disabled = true;
      billboardSize2x1Btn.title = "2×1 billboards are temporarily unavailable.";
    }
    if (billboardSizeHintEl) {
      billboardSizeHintEl.innerHTML =
        "<i>2x1 temporarily unavailable</i>";
    }
  }

  resetBillboardRotationFromDraft({});

  const extVisitBackdrop = externalVisitConfirmOverlay.querySelector(
    ".external-visit-confirm__backdrop"
  ) as HTMLElement | null;
  const extVisitUrlEl = externalVisitConfirmOverlay.querySelector(
    "#external-visit-url"
  ) as HTMLElement | null;
  const extVisitCancel = externalVisitConfirmOverlay.querySelector(
    ".external-visit-confirm__btn--cancel"
  ) as HTMLButtonElement | null;
  const extVisitConfirm = externalVisitConfirmOverlay.querySelector(
    ".external-visit-confirm__btn--confirm"
  ) as HTMLButtonElement | null;

  let extVisitPending: { onConfirm: () => void } | null = null;
  let extVisitEsc: ((e: KeyboardEvent) => void) | null = null;

  function hideExternalVisitConfirm(): void {
    extVisitPending = null;
    externalVisitConfirmOverlay.hidden = true;
    externalVisitConfirmOverlay.setAttribute("aria-hidden", "true");
    if (extVisitEsc) {
      window.removeEventListener("keydown", extVisitEsc);
      extVisitEsc = null;
    }
  }

  function presentExternalVisitConfirm(p: {
    url: string;
    displayName: string;
    onConfirm: () => void;
  }): void {
    extVisitPending = { onConfirm: p.onConfirm };
    if (extVisitUrlEl) extVisitUrlEl.textContent = p.url;
    externalVisitConfirmOverlay.hidden = false;
    externalVisitConfirmOverlay.setAttribute("aria-hidden", "false");
    extVisitEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hideExternalVisitConfirm();
      }
    };
    window.addEventListener("keydown", extVisitEsc);
    extVisitConfirm?.focus();
  }

  extVisitBackdrop?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideExternalVisitConfirm();
  });
  extVisitCancel?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideExternalVisitConfirm();
  });
  extVisitConfirm?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const pending = extVisitPending;
    hideExternalVisitConfirm();
    pending?.onConfirm();
  });

  const feedbackBackdropEl = feedbackOverlay.querySelector(
    ".feedback-overlay__backdrop"
  ) as HTMLElement | null;
  const feedbackTextarea = feedbackOverlay.querySelector(
    "#hud-feedback-textarea"
  ) as HTMLTextAreaElement | null;
  const feedbackCharCount = feedbackOverlay.querySelector(
    ".signpost-overlay__char-count"
  ) as HTMLElement | null;
  const feedbackCancelBtn = feedbackOverlay.querySelector(
    ".signpost-overlay__btn--cancel"
  ) as HTMLButtonElement | null;
  const feedbackSendBtn = feedbackOverlay.querySelector(
    ".signpost-overlay__btn--create"
  ) as HTMLButtonElement | null;
  const feedbackErrorEl = feedbackOverlay.querySelector(
    ".feedback-overlay__error"
  ) as HTMLElement | null;

  let feedbackSubmitHandler: (
    message: string
  ) => Promise<{ ok: boolean; error?: string }> = async () => ({
    ok: false,
    error: "Feedback is not available.",
  });

  let feedbackEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
  let feedbackSending = false;

  function setFeedbackError(msg: string | null): void {
    if (!feedbackErrorEl) return;
    if (msg) {
      feedbackErrorEl.textContent = msg;
      feedbackErrorEl.hidden = false;
    } else {
      feedbackErrorEl.textContent = "";
      feedbackErrorEl.hidden = true;
    }
  }

  function hideFeedbackOverlay(): void {
    feedbackOverlay.hidden = true;
    feedbackOverlay.setAttribute("aria-hidden", "true");
    if (feedbackTextarea) feedbackTextarea.value = "";
    if (feedbackCharCount) {
      feedbackCharCount.textContent = `0 / ${FEEDBACK_MESSAGE_MAX}`;
    }
    setFeedbackError(null);
    if (feedbackEscapeHandler) {
      window.removeEventListener("keydown", feedbackEscapeHandler);
      feedbackEscapeHandler = null;
    }
    feedbackSending = false;
    if (feedbackSendBtn) feedbackSendBtn.disabled = false;
    if (feedbackCancelBtn) feedbackCancelBtn.disabled = false;
  }

  function showFeedbackOverlay(): void {
    if (!feedbackOverlay.hidden) return;
    setFeedbackError(null);
    feedbackOverlay.hidden = false;
    feedbackOverlay.setAttribute("aria-hidden", "false");
    feedbackEscapeHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hideFeedbackOverlay();
      }
    };
    window.addEventListener("keydown", feedbackEscapeHandler);
    feedbackTextarea?.focus();
  }

  const dismissFeedbackFromBackdrop = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    hideFeedbackOverlay();
  };
  if (feedbackBackdropEl) {
    feedbackBackdropEl.addEventListener("click", dismissFeedbackFromBackdrop);
  }

  if (feedbackTextarea && feedbackCharCount) {
    feedbackTextarea.addEventListener("input", () => {
      const len = feedbackTextarea.value.length;
      feedbackCharCount.textContent = `${len} / ${FEEDBACK_MESSAGE_MAX}`;
      setFeedbackError(null);
    });
  }

  if (feedbackCancelBtn) {
    feedbackCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideFeedbackOverlay();
    });
  }

  if (feedbackSendBtn && feedbackTextarea) {
    feedbackSendBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        if (feedbackSending) return;
        const text = feedbackTextarea.value.trim();
        if (!text) {
          setFeedbackError("Please enter a message.");
          return;
        }
        feedbackSending = true;
        feedbackSendBtn.disabled = true;
        setFeedbackError(null);
        try {
          const result = await feedbackSubmitHandler(text);
          if (result.ok) {
            hideFeedbackOverlay();
          } else {
            setFeedbackError(result.error ?? "Could not send feedback.");
          }
        } catch {
          setFeedbackError("Could not send feedback.");
        } finally {
          feedbackSending = false;
          feedbackSendBtn.disabled = false;
        }
      })();
    });
  }

  if (feedbackTextarea) {
    feedbackTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        feedbackSendBtn?.click();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        hideFeedbackOverlay();
      }
      e.stopPropagation();
    });
  }

  let brandLinksPlayerAddress = "";

  function openOwnPlayerProfileFromBar(): void {
    const compact = brandLinksPlayerAddress.trim();
    if (!compact) return;
    closeOtherPlayerUiOverlays();
    const label = walletDisplayName(compact);
    void showPlayerProfileView(compact, label, "self");
  }

  playerBar.addEventListener("click", openOwnPlayerProfileFromBar);
  playerBar.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openOwnPlayerProfileFromBar();
    }
  });

  function syncTopBarPlayerIdentity(): void {
    const raw = brandLinksPlayerAddress.trim();
    if (!raw) {
      playerBarAddr.textContent = "";
      playerBarIdenticon.hidden = true;
      playerBarIdenticon.removeAttribute("src");
      delete playerBarIdenticon.dataset.address;
      playerBar.classList.remove("hud-player-bar--interactive");
      playerBar.removeAttribute("tabindex");
      playerBar.removeAttribute("role");
      playerBar.style.cursor = "";
      return;
    }
    const compact = raw.replace(/\s+/g, "").trim();
    playerBarAddr.textContent = formatWalletAddressConnectAs(compact);
    playerBarIdenticon.hidden = false;
    playerBarIdenticon.removeAttribute("src");
    playerBarIdenticon.dataset.address = compact;
    playerBar.classList.add("hud-player-bar--interactive");
    playerBar.tabIndex = 0;
    playerBar.setAttribute("role", "button");
    playerBar.setAttribute(
      "aria-label",
      "Your wallet. Open your player profile."
    );
    playerBar.style.cursor = "pointer";
    void (async (): Promise<void> => {
      try {
        const { identiconDataUrl } = await import("../game/identiconTexture.js");
        const url = await identiconDataUrl(compact);
        if (playerBarIdenticon.dataset.address !== compact) return;
        playerBarIdenticon.src = url;
      } catch {
        if (playerBarIdenticon.dataset.address === compact) {
          playerBarIdenticon.hidden = true;
        }
      }
    })();
  }

  const brandLinksBackdrop = brandLinksOverlay.querySelector(
    ".brand-links-overlay__backdrop"
  ) as HTMLElement | null;
  const brandLinksCloseBtn = brandLinksOverlay.querySelector(
    ".brand-links-overlay__close"
  ) as HTMLButtonElement | null;
  const brandLinksBody = brandLinksOverlay.querySelector(
    ".brand-links-overlay__body"
  ) as HTMLElement | null;
  const brandLinksWalletImg = brandLinksOverlay.querySelector(
    ".brand-links-overlay__wallet-identicon"
  ) as HTMLImageElement | null;
  const brandLinksAddressCopyBtn = brandLinksOverlay.querySelector(
    ".brand-links-overlay__address-copy"
  ) as HTMLButtonElement | null;
  const brandLinksCopyFeedback = brandLinksOverlay.querySelector(
    ".brand-links-overlay__copy-feedback"
  ) as HTMLSpanElement | null;
  const brandLinksQrView = brandLinksOverlay.querySelector(
    ".brand-links-overlay__qr-view"
  ) as HTMLElement | null;
  const brandLinksQrCanvasHost = brandLinksOverlay.querySelector(
    ".brand-links-overlay__qr-canvas-host"
  ) as HTMLElement | null;
  const brandLinksTitleEl = brandLinksOverlay.querySelector(
    "#brand-links-title"
  ) as HTMLElement | null;

  const onBrandLinksTitleSecretClick = (e: MouseEvent): void => {
    e.stopPropagation();
    brandLinksTitleSecretClicks += 1;
    if (brandLinksTitleSecretClicks >= 5) {
      brandLinksTitleSecretClicks = 0;
      setPerfHudEnabled(!perfHudEnabled);
    }
  };

  let brandLinksEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
  let brandLinksCopyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  function closeBrandQrFullscreen(): void {
    if (!brandLinksQrView) return;
    const wasQrOpen = !brandLinksQrView.hidden;
    brandLinksQrView.hidden = true;
    brandLinksQrView.setAttribute("aria-hidden", "true");
    brandLinksBody?.classList.remove("brand-links-overlay__body--qr-open");
    if (brandLinksQrCanvasHost) {
      brandLinksQrCanvasHost.replaceChildren();
    }
    if (wasQrOpen) {
      if (brandLinksWalletImg && !brandLinksWalletImg.hidden) {
        brandLinksWalletImg.focus({ preventScroll: true });
      } else if (brandLinksCloseBtn) {
        brandLinksCloseBtn.focus({ preventScroll: true });
      }
    }
  }

  function syncBrandLinksWalletAddressDisplay(): void {
    if (!brandLinksAddressCopyBtn) return;
    if (brandLinksCopyFeedbackTimer) {
      clearTimeout(brandLinksCopyFeedbackTimer);
      brandLinksCopyFeedbackTimer = null;
    }
    if (brandLinksCopyFeedback) {
      brandLinksCopyFeedback.hidden = true;
      brandLinksCopyFeedback.textContent = "";
    }
    const raw = brandLinksPlayerAddress.trim();
    if (!raw) {
      brandLinksAddressCopyBtn.hidden = true;
      brandLinksAddressCopyBtn.textContent = "";
      brandLinksAddressCopyBtn.removeAttribute("title");
      return;
    }
    const normalized = raw.replace(/\s+/g, "").trim();
    brandLinksAddressCopyBtn.hidden = false;
    brandLinksAddressCopyBtn.textContent = formatWalletAddressGap4(raw);
    brandLinksAddressCopyBtn.title = normalized;
  }

  function hideBrandLinksOverlay(): void {
    closeBrandQrFullscreen();
    brandLinksTitleSecretClicks = 0;
    if (brandLinksCopyFeedbackTimer) {
      clearTimeout(brandLinksCopyFeedbackTimer);
      brandLinksCopyFeedbackTimer = null;
    }
    if (brandLinksCopyFeedback) {
      brandLinksCopyFeedback.hidden = true;
      brandLinksCopyFeedback.textContent = "";
    }
    brandLinksOverlay.hidden = true;
    brandLinksOverlay.setAttribute("aria-hidden", "true");
    if (brandLinksEscapeHandler) {
      window.removeEventListener("keydown", brandLinksEscapeHandler);
      brandLinksEscapeHandler = null;
    }
  }

  function syncBrandLinksWalletIdenticon(): void {
    syncBrandLinksWalletAddressDisplay();
    if (!brandLinksWalletImg) return;
    const addr = brandLinksPlayerAddress.trim();
    if (!addr) {
      brandLinksWalletImg.hidden = true;
      brandLinksWalletImg.removeAttribute("src");
      brandLinksWalletImg.removeAttribute("tabindex");
      brandLinksWalletImg.removeAttribute("role");
      brandLinksWalletImg.removeAttribute("aria-label");
      return;
    }
    brandLinksWalletImg.hidden = false;
    brandLinksWalletImg.tabIndex = 0;
    brandLinksWalletImg.setAttribute("role", "button");
    brandLinksWalletImg.setAttribute("aria-label", "Show payment QR in modal");
    brandLinksWalletImg.removeAttribute("src");
    brandLinksWalletImg.dataset.address = addr;
    void (async (): Promise<void> => {
      try {
        const { identiconDataUrl } = await import("../game/identiconTexture.js");
        const url = await identiconDataUrl(addr);
        if (brandLinksWalletImg.dataset.address !== addr) return;
        brandLinksWalletImg.src = url;
      } catch {
        if (brandLinksWalletImg.dataset.address === addr) {
          brandLinksWalletImg.hidden = true;
        }
      }
    })();
  }

  async function openBrandQrFullscreen(): Promise<void> {
    const normalized = brandLinksPlayerAddress.replace(/\s+/g, "").trim().toUpperCase();
    if (!normalized || !brandLinksQrCanvasHost || !brandLinksQrView) return;
    const qrUrl = nimiqWalletRecipientDeepLink(brandLinksPlayerAddress);
    brandLinksBody?.classList.add("brand-links-overlay__body--qr-open");
    brandLinksQrView.hidden = false;
    brandLinksQrView.setAttribute("aria-hidden", "false");
    brandLinksQrCanvasHost.replaceChildren();
    const bodyEl = brandLinksQrView.closest(
      ".brand-links-overlay__body"
    ) as HTMLElement | null;
    const inset = 28;
    const bw = bodyEl?.clientWidth ?? 300;
    const bh = bodyEl?.clientHeight ?? 300;
    const size = Math.max(120, Math.min(260, Math.floor(Math.min(bw, bh) - inset)));
    try {
      const { default: QrCreator } = await import("qr-creator");
      QrCreator.render(
        {
          text: qrUrl,
          radius: 0.45,
          ecLevel: "M",
          fill: "#e8eaef",
          background: "rgba(5, 7, 12, 0.98)",
          size,
        },
        brandLinksQrCanvasHost
      );
      brandLinksQrView.focus({ preventScroll: true });
    } catch {
      closeBrandQrFullscreen();
    }
  }

  if (brandLinksAddressCopyBtn) {
    brandLinksAddressCopyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const full = brandLinksPlayerAddress.replace(/\s+/g, "").trim();
      if (!full) return;
      void (async (): Promise<void> => {
        try {
          await navigator.clipboard.writeText(full);
          if (brandLinksCopyFeedback) {
            brandLinksCopyFeedback.textContent = "✓ Copied to clipboard";
            brandLinksCopyFeedback.hidden = false;
          }
          if (brandLinksCopyFeedbackTimer) clearTimeout(brandLinksCopyFeedbackTimer);
          brandLinksCopyFeedbackTimer = setTimeout(() => {
            if (brandLinksCopyFeedback) {
              brandLinksCopyFeedback.hidden = true;
              brandLinksCopyFeedback.textContent = "";
            }
            brandLinksCopyFeedbackTimer = null;
          }, 2200);
        } catch {
          /* ignore */
        }
      })();
    });
  }

  if (brandLinksWalletImg) {
    brandLinksWalletImg.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void openBrandQrFullscreen();
    });
    brandLinksWalletImg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        void openBrandQrFullscreen();
      }
    });
  }

  if (brandLinksQrView) {
    brandLinksQrView.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeBrandQrFullscreen();
    });
    brandLinksQrView.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        closeBrandQrFullscreen();
      }
    });
  }

  function showBrandLinksOverlay(): void {
    if (!brandLinksOverlay.hidden) return;
    closeBrandQrFullscreen();
    syncBrandLinksWalletIdenticon();
    brandLinksOverlay.hidden = false;
    brandLinksOverlay.setAttribute("aria-hidden", "false");
    brandLinksEscapeHandler = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (brandLinksQrView && !brandLinksQrView.hidden) {
        closeBrandQrFullscreen();
        return;
      }
      hideBrandLinksOverlay();
    };
    window.addEventListener("keydown", brandLinksEscapeHandler);
  }

  brand.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showBrandLinksOverlay();
  });

  if (brandLinksBackdrop) {
    brandLinksBackdrop.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBrandLinksOverlay();
    });
  }
  if (brandLinksCloseBtn) {
    brandLinksCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBrandLinksOverlay();
    });
  }
  if (brandLinksTitleEl) {
    brandLinksTitleEl.addEventListener("click", onBrandLinksTitleSecretClick);
  }

  tileInspectorToolSelect.addEventListener("change", () => {
    const raw = tileInspectorToolSelect.value;
    const tool: "block" | "signpost" | "teleporter" | "billboard" | "gate" =
      raw === "signpost"
        ? "signpost"
        : raw === "teleporter"
          ? "teleporter"
          : raw === "gate"
            ? "gate"
            : raw === "billboard"
              ? "billboard"
              : "block";
    activateBuildTool(tool);
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
    pyramid?: boolean;
    pyramidBaseScale?: number;
    sphere?: boolean;
    ramp?: boolean;
    rampDir?: number;
    colorId?: number;
    claimable?: boolean;
  }) => void = (): void => {};

  function syncTileInspectorHeightLabel(): void {
    if (!tileInspectorHeightInput || !tileInspectorHeightVal) return;
    const v = Math.min(2, Math.max(0, Math.floor(Number(tileInspectorHeightInput.value))));
    /* Slider left = low slab, right = full height. */
    const labelsM = ["0.25 m", "0.5 m", "1.0 m"] as const;
    const labelsShort = ["¼", "Half", "Full"] as const;
    tileInspectorHeightVal.textContent = labelsM[v] ?? "1.0 m";
    tileInspectorHeightInput.setAttribute("aria-valuetext", labelsShort[v] ?? "Full");
  }

  function syncBarHeightButtons(quarter: boolean, half: boolean): void {
    if (!tileInspectorHeightInput) return;
    const v = quarter ? 0 : half ? 1 : 2;
    tileInspectorHeightInput.value = String(v);
    syncTileInspectorHeightLabel();
  }

  function layoutBarAdvancedPopover(): void {
    if (barAdvancedPopover.hidden || buildBlockBar.hidden) return;
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const sb = modeSidebar.getBoundingClientRect();
    const rightPx = Math.max(margin, vw - sb.left + margin);
    const br = buildBlockBar.getBoundingClientRect();
    const w = Math.min(260, Math.max(180, br.width));
    barAdvancedPopover.style.width = `${w}px`;
    barAdvancedPopover.style.maxWidth = `${Math.max(120, vw - 16)}px`;
    barAdvancedPopover.style.right = `${rightPx}px`;
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

  function layoutBarShapePopover(): void {
    if (barShapePopover.hidden) return;
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const minTop = 52;
    const sb = modeSidebar.getBoundingClientRect();
    const rightPx = Math.max(margin, vw - sb.left + margin);
    barShapePopover.style.width = `${Math.min(200, Math.max(160, 180))}px`;
    barShapePopover.style.maxWidth = `${Math.max(120, vw - 16)}px`;
    barShapePopover.style.right = `${rightPx}px`;
    barShapePopover.style.left = "auto";
    barShapePopover.style.bottom = "auto";
    const tr = barShapeTrigger.getBoundingClientRect();
    let top = tr.bottom + margin;
    barShapePopover.style.top = `${top}px`;
    let pr = barShapePopover.getBoundingClientRect();
    if (pr.bottom > vh - margin) {
      top = tr.top - pr.height - margin;
      barShapePopover.style.top = `${top}px`;
      pr = barShapePopover.getBoundingClientRect();
    }
    if (top < minTop) {
      top = minTop;
      barShapePopover.style.top = `${top}px`;
      pr = barShapePopover.getBoundingClientRect();
    }
    if (pr.bottom > vh - margin) {
      top = Math.max(minTop, vh - margin - pr.height);
      barShapePopover.style.top = `${top}px`;
    }
  }

  function layoutPanelShapePopover(): void {
    if (panelShapePopover.hidden || !panelShapeTriggerEl) return;
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const minTop = 52;
    const sb = modeSidebar.getBoundingClientRect();
    const rightPx = Math.max(margin, vw - sb.left + margin);
    /* Match hue-dock shape trigger width (~44px) + chrome */
    const tw = panelShapeTriggerEl.getBoundingClientRect().width || 44;
    const compactW = Math.round(Math.min(56, Math.max(48, tw + 8)));
    panelShapePopover.style.width = `${compactW}px`;
    panelShapePopover.style.maxWidth = `${Math.min(compactW, vw - 16)}px`;
    panelShapePopover.style.right = `${rightPx}px`;
    panelShapePopover.style.left = "auto";
    panelShapePopover.style.bottom = "auto";
    const tr = panelShapeTriggerEl.getBoundingClientRect();
    let top = tr.bottom + margin;
    panelShapePopover.style.top = `${top}px`;
    let pr = panelShapePopover.getBoundingClientRect();
    if (pr.bottom > vh - margin) {
      top = tr.top - pr.height - margin;
      panelShapePopover.style.top = `${top}px`;
      pr = panelShapePopover.getBoundingClientRect();
    }
    if (top < minTop) {
      top = minTop;
      panelShapePopover.style.top = `${top}px`;
      pr = panelShapePopover.getBoundingClientRect();
    }
    if (pr.bottom > vh - margin) {
      top = Math.max(minTop, vh - margin - pr.height);
      panelShapePopover.style.top = `${top}px`;
    }
  }

  function setBarShapePopoverOpen(open: boolean): void {
    barShapePopover.hidden = !open;
    barShapeTrigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      if (!barAdvancedPopover.hidden) setBarPopoverOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => layoutBarShapePopover());
      });
    }
  }

  function setPanelShapePopoverOpen(open: boolean): void {
    panelShapePopover.hidden = !open;
    panelShapeTriggerEl?.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      if (!objectPanelAdvancedPopover.hidden) setPanelAdvancedOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => layoutPanelShapePopover());
      });
    }
  }

  function setBarPopoverOpen(open: boolean): void {
    barAdvancedPopover.hidden = !open;
    barAdvancedToggle.setAttribute("aria-expanded", open ? "true" : "false");
    barAdvancedToggle.classList.toggle(
      "build-block-bar__advanced-toggle--open",
      open
    );
    if (open) {
      setBarShapePopoverOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => layoutBarAdvancedPopover());
      });
    }
  }

  tileInspectorHeightInput.addEventListener("input", () => {
    const v = Math.min(2, Math.max(0, Math.floor(Number(tileInspectorHeightInput.value))));
    if (v <= 0) {
      placementStyleHandler({ quarter: true, half: false });
      syncBarHeightButtons(true, false);
    } else if (v === 1) {
      placementStyleHandler({ quarter: false, half: true });
      syncBarHeightButtons(false, true);
    } else {
      placementStyleHandler({ quarter: false, half: false });
      syncBarHeightButtons(false, false);
    }
    syncTileInspectorHeightLabel();
  });

  tileInspectorPyramidBaseInput?.addEventListener("input", () => {
    if (!tileInspectorPyramidBaseInput || !tileInspectorPyramidBaseVal) return;
    const raw = Math.min(
      165,
      Math.max(100, Math.floor(Number(tileInspectorPyramidBaseInput.value)))
    );
    tileInspectorPyramidBaseInput.value = String(raw);
    tileInspectorPyramidBaseVal.textContent = `${raw}%`;
    tileInspectorPyramidBaseInput.setAttribute("aria-valuetext", `${raw}%`);
    placementStyleHandler({ pyramidBaseScale: raw / 100 });
  });

  barHexCb.addEventListener("change", () => {
    placementStyleHandler({
      hex: barHexCb.checked,
      pyramid: barHexCb.checked ? false : barPyramidCb.checked,
      sphere: barHexCb.checked ? false : barSphereCb.checked,
    });
    syncBarShapeButtons();
  });
  barPyramidCb.addEventListener("change", () => {
    placementStyleHandler({
      pyramid: barPyramidCb.checked,
      hex: barPyramidCb.checked ? false : barHexCb.checked,
      sphere: barPyramidCb.checked ? false : barSphereCb.checked,
    });
    syncBarShapeButtons();
  });
  barSphereCb.addEventListener("change", () => {
    placementStyleHandler({
      sphere: barSphereCb.checked,
      hex: barSphereCb.checked ? false : barHexCb.checked,
      pyramid: barSphereCb.checked ? false : barPyramidCb.checked,
    });
    syncBarShapeButtons();
  });

  function rotateBarRamp(delta: -1 | 1): void {
    if (!barRampCb.checked && !gateModeActive) return;
    barRampDir = (barRampDir + delta + 4) % 4;
    placementStyleHandler({ rampDir: barRampDir });
  }

  barRampRotCCW.addEventListener("click", () => rotateBarRamp(-1));
  barRampRotCW.addEventListener("click", () => rotateBarRamp(1));
  barGateExitCCW?.addEventListener("click", () => rotateBarRamp(-1));
  barGateExitCW?.addEventListener("click", () => rotateBarRamp(1));

  barRampCb.addEventListener("change", () => {
    const on = barRampCb.checked;
    barRampDirRow.hidden = !on && !gateModeActive;
    placementStyleHandler({
      ramp: on,
      hex: on ? false : barHexCb.checked,
      pyramid: on ? false : barPyramidCb.checked,
      sphere: on ? false : barSphereCb.checked,
    });
    if (on) {
      barHexCb.checked = false;
      barPyramidCb.checked = false;
      barSphereCb.checked = false;
    }
    syncBarShapeButtons();
  });

  function syncBarShapeTriggerVisual(): void {
    const ramp = barRampCb.checked;
    const pyramid = !ramp && barPyramidCb.checked;
    const sphere = !ramp && barSphereCb.checked;
    const hex = barHexCb.checked && !ramp && !pyramid && !sphere;
    const shape: "cube" | "hex" | "pyramid" | "sphere" | "ramp" = ramp
      ? "ramp"
      : sphere
        ? "sphere"
        : pyramid
          ? "pyramid"
          : hex
            ? "hex"
            : "cube";
    const label = ramp
      ? "Ramp"
      : sphere
        ? "Sphere"
        : pyramid
          ? "Pyramid"
          : hex
            ? "Hex"
            : "Cube";
    const lab = barShapeTrigger.querySelector(".hud-mode-sidebar__shape-trigger-label");
    if (lab) lab.textContent = label;
    const icon = barShapeTrigger.querySelector(".hud-mode-sidebar__shape-trigger-icon");
    if (icon) icon.innerHTML = SHAPE_TRIG_SVG[shape];
  }

  function syncPanelShapeTriggerVisual(): void {
    if (!panelShapeTriggerEl || !panelRampCb || !panelHexCb) return;
    const ramp = panelRampCb.checked;
    const pyramid = !ramp && (panelPyramidCb?.checked ?? false);
    const sphere = !ramp && (panelSphereCb?.checked ?? false);
    const hex = !ramp && panelHexCb.checked && !pyramid && !sphere;
    const shape: "cube" | "hex" | "pyramid" | "sphere" | "ramp" = ramp
      ? "ramp"
      : sphere
        ? "sphere"
        : pyramid
          ? "pyramid"
          : hex
            ? "hex"
            : "cube";
    const label = ramp
      ? "Ramp"
      : sphere
        ? "Sphere"
        : pyramid
          ? "Pyramid"
          : hex
            ? "Hex"
            : "Cube";
    const lab = panelShapeTriggerEl.querySelector(".hud-mode-sidebar__shape-trigger-label");
    if (lab) lab.textContent = label;
    const icon = panelShapeTriggerEl.querySelector(".hud-mode-sidebar__shape-trigger-icon");
    if (icon) icon.innerHTML = SHAPE_TRIG_SVG[shape];
  }

  function syncBarShapeButtons(): void {
    const ramp = barRampCb.checked;
    const pyramid = !ramp && barPyramidCb.checked;
    const sphere = !ramp && barSphereCb.checked;
    const hex = barHexCb.checked && !ramp && !pyramid && !sphere;
    const cube = !hex && !ramp && !pyramid && !sphere;
    barShapeBtns.forEach((b) => {
      const shape = b.dataset.shape;
      const on =
        (shape === "cube" && cube) ||
        (shape === "hex" && hex) ||
        (shape === "pyramid" && pyramid) ||
        (shape === "sphere" && sphere) ||
        (shape === "ramp" && ramp);
      b.classList.toggle("tile-inspector__shape-btn--active", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    refreshBuildBarTitle();
    if (tileInspectorRoot) {
      tileInspectorRoot.classList.toggle(
        "tile-inspector--minimal",
        signpostModeActive ||
          teleporterModeActive ||
          gateModeActive ||
          billboardModeActive
      );
    }
    if (tileInspectorResetBtn) {
      tileInspectorResetBtn.hidden =
        signpostModeActive ||
        teleporterModeActive ||
        gateModeActive ||
        billboardModeActive;
    }
    syncBarShapeTriggerVisual();
    syncPlacementPyramidBaseSectionVisibility();
    syncBlockPreviewDockSlots();
  }

  function applyHueDegrees(hueDeg: number): void {
    const h = ((hueDeg % 360) + 360) % 360;
    lastHueDeg = Math.round(h);
    barHueRing.setAttribute("aria-valuenow", String(lastHueDeg));
    const { r, g, b } = hslToRgb(h / 360, 1, 0.52);
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
        barPyramidCb.checked = false;
        barSphereCb.checked = false;
        barRampCb.checked = false;
        barRampDirRow.hidden = true;
        placementStyleHandler({
          hex: false,
          pyramid: false,
          sphere: false,
          ramp: false,
        });
      } else if (shape === "hex") {
        barHexCb.checked = true;
        barPyramidCb.checked = false;
        barSphereCb.checked = false;
        barRampCb.checked = false;
        barRampDirRow.hidden = true;
        placementStyleHandler({
          hex: true,
          pyramid: false,
          sphere: false,
          ramp: false,
        });
      } else if (shape === "pyramid") {
        barPyramidCb.checked = true;
        barHexCb.checked = false;
        barSphereCb.checked = false;
        barRampCb.checked = false;
        barRampDirRow.hidden = true;
        placementStyleHandler({
          pyramid: true,
          hex: false,
          sphere: false,
          ramp: false,
        });
      } else if (shape === "sphere") {
        barSphereCb.checked = true;
        barHexCb.checked = false;
        barPyramidCb.checked = false;
        barRampCb.checked = false;
        barRampDirRow.hidden = true;
        placementStyleHandler({
          sphere: true,
          hex: false,
          pyramid: false,
          ramp: false,
        });
      } else if (shape === "ramp") {
        barRampCb.checked = true;
        barHexCb.checked = false;
        barPyramidCb.checked = false;
        barSphereCb.checked = false;
        barRampDirRow.hidden = false;
        placementStyleHandler({
          ramp: true,
          hex: false,
          pyramid: false,
          sphere: false,
        });
      }
      syncBarShapeButtons();
      setBarShapePopoverOpen(false);
    });
  });

  barShapeTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    setBarShapePopoverOpen(barShapePopover.hidden);
  });
  barShapeTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !barShapePopover.hidden) {
      e.preventDefault();
      setBarShapePopoverOpen(false);
    }
  });

  syncBarShapeButtons();
  syncBlockPreviewDockSlots();

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
    if (!barShapePopover.hidden) {
      requestAnimationFrame(() => layoutBarShapePopover());
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

  tileInspectorResetBtn.addEventListener("click", () => {
    barHexCb.checked = false;
    barPyramidCb.checked = false;
    barSphereCb.checked = false;
    barRampCb.checked = false;
    barRampDir = 0;
    barRampDirRow.hidden = true;
    placementStyleHandler({
      quarter: false,
      half: false,
      hex: false,
      pyramid: false,
      sphere: false,
      ramp: false,
      rampDir: 0,
      colorId: 0,
      pyramidBaseScale: 1,
    });
    syncBarHeightButtons(false, false);
    syncBarPyramidBaseSliderFromScale(1);
    syncBarShapeButtons();
    applyHueDegrees(estimateHueFromPaletteId(0));
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
  let returnHomeHandler = (): void => {};
  let portalEnterHandler = (): void => {};
  let lobbyHandler = (): void => {};
  let roomsOpenHandler = (): void => {};
  let profileRoomJoinHandler: (roomId: string) => void = (): void => {};
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
  roomsBtn.addEventListener("click", () => roomsOpenHandler());
  reconnectBtn.addEventListener("click", () => reconnectHandler());
  feedbackBtn.addEventListener("click", () => showFeedbackOverlay());
  returnHomeBtn.addEventListener("click", () => returnHomeHandler());
  portalEnterBtn.addEventListener("click", () => portalEnterHandler());
  lobbyBtn.addEventListener("click", () => openLobbyConfirm());
  buildToggleBtn.addEventListener("click", () => {
    const editOn = buildToggleBtn.getAttribute("aria-pressed") === "true";
    if (editOn) {
      playModeHandler("walk");
      return;
    }
    const both = roomAllowPlaceBlocks && roomAllowExtraFloor;
    if (both) {
      playModeHandler(
        buildEditKindSelect.value === "room" ? "floor" : "build"
      );
    } else if (roomAllowPlaceBlocks) {
      playModeHandler("build");
    } else {
      playModeHandler("floor");
    }
  });

  buildEditKindSelect.addEventListener("change", () => {
    if (buildToggleBtn.getAttribute("aria-pressed") !== "true") return;
    if (!roomAllowPlaceBlocks || !roomAllowExtraFloor) return;
    playModeHandler(
      buildEditKindSelect.value === "room" ? "floor" : "build"
    );
    syncHueDockVisibility();
    syncBlockPreviewDockSlots();
  });

  /** Pixel height of `.hud-top-wrap` (strip + status); drives `--hud-below-top-wrap` so the mode rail meets the chrome. */
  function syncHudBelowTopWrap(): void {
    const h = topWrap.offsetHeight;
    if (h > 0) {
      ui.style.setProperty("--hud-below-top-wrap", `${h}px`);
    }
  }

  const ro = new ResizeObserver(() => {
    layoutLetterbox(frame, letter);
    syncHudBelowTopWrap();
    layoutBarAdvancedPopover();
    layoutBarShapePopover();
    layoutPanelShapePopover();
    layoutObjectPanelSatellites();
  });
  ro.observe(frame);
  ro.observe(topWrap);
  ro.observe(modeSidebar);

  layoutLetterbox(frame, letter);
  syncHudBelowTopWrap();
  requestAnimationFrame(() => {
    syncHudBelowTopWrap();
    requestAnimationFrame(() => {
      syncHudBelowTopWrap();
    });
  });

  let panelCollisionToggle: HTMLButtonElement | null = null;
  let panelLockToggle: HTMLButtonElement | null = null;
  let lockOptionBlock: HTMLElement | null = null;
  /** When lock UI is hidden (non-admin), server lock state for emit. */
  let panelLockedState = false;
  let panelHexCb: HTMLInputElement | null = null;
  let panelPyramidCb: HTMLInputElement | null = null;
  let panelSphereCb: HTMLInputElement | null = null;
  let panelRampCb: HTMLInputElement | null = null;
  let panelHeightBtns: HTMLButtonElement[] = [];
  let panelShapeBtns: HTMLButtonElement[] = [];
  let rampDirRow: HTMLElement | null = null;
  let panelRampRotCCW: HTMLButtonElement | null = null;
  let panelRampRotCW: HTMLButtonElement | null = null;
  let panelRampDir = 0;
  /** Object panel: editing a placed gate (opening direction, not generic prism). */
  let panelObjectEditGate = false;
  let panelGateExitDir = 0;
  let panelGateAdminAddress = "";
  let panelGateAuthorizedAddresses: string[] = [];
  let panelObjectTileX = 0;
  let panelObjectTileY = 0;
  let panelObjectTileZ = 0;
  let panelGateEditBlock: HTMLElement | null = null;
  let panelGateAclBar: HTMLElement | null = null;
  let panelGateAclSummaryEl: HTMLElement | null = null;
  let panelGateAclBtn: HTMLButtonElement | null = null;
  let panelOnEditGateAcl: (() => void) | null = null;
  let gateAclBackdrop: HTMLDivElement | null = null;
  let gateAclKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  let panelGateExitCCW: HTMLButtonElement | null = null;
  let panelGateExitCW: HTMLButtonElement | null = null;
  let panelContextHeightRow: HTMLElement | null = null;
  let panelAdvancedToggle: HTMLButtonElement | null = null;
  let panelSelectedColorId = 0;
  let panelOnPropsChange: ((p: ObstacleProps) => void) | null = null;
  let panelLastHueDeg = 0;
  let panelHueRingWrap: HTMLElement | null = null;
  let panelHueRing: HTMLElement | null = null;
  let panelHueCore: HTMLElement | null = null;
  let panelTileInspectorHeightInput: HTMLInputElement | null = null;
  let panelTileInspectorHeightVal: HTMLElement | null = null;
  let panelTileInspectorResetBtn: HTMLButtonElement | null = null;
  let panelPyramidBaseRow: HTMLElement | null = null;
  let panelPyramidBaseInput: HTMLInputElement | null = null;
  let panelPyramidBaseVal: HTMLElement | null = null;
  /** Debounced commit so `change` + `pointerup` + `blur` do not race or duplicate spam. */
  let panelPyramidBaseCommitTimer: ReturnType<typeof setTimeout> | null = null;
  let teleporterPanelCleanup: (() => void) | null = null;
  type TeleporterRoomPickerRow = {
    id: string;
    displayName: string;
    isPublic: boolean;
    playerCount: number;
    isOfficial: boolean;
    isBuiltin: boolean;
  };
  let panelTeleporterRoomRows: TeleporterRoomPickerRow[] | null = null;
  let panelTeleporterSelectedRoomId: string | null = null;
  let panelTeleporterRoomNameEl: HTMLElement | null = null;
  let panelTeleporterRoomPicker: HTMLElement | null = null;
  let panelTeleporterRoomPickerDocDown: ((ev: MouseEvent) => void) | null =
    null;
  let panelTeleporterRoomPickerKeydown: ((ev: KeyboardEvent) => void) | null =
    null;
  let panelTeleporterX: HTMLInputElement | null = null;
  let panelTeleporterZ: HTMLInputElement | null = null;
  let applyTeleporterHubUi: (() => void) | null = null;
  let teleporterPanelSyncRoomTrigger: (() => void) | null = null;
  let teleporterPanelEnsureRowForId: ((id: string) => void) | null = null;
  let teleporterPanelRenderPickerList: (() => void) | null = null;

  function hideGateAclEditor(): void {
    if (gateAclKeyHandler) {
      window.removeEventListener("keydown", gateAclKeyHandler, true);
      gateAclKeyHandler = null;
    }
    gateAclBackdrop?.remove();
    gateAclBackdrop = null;
  }

  function showGateAclEditor(opts: {
    x: number;
    z: number;
    y: number;
    adminAddress: string;
    addresses: string[];
    players: readonly PlayerState[];
    onSave: (addresses: string[]) => void;
  }): void {
    hideGateAclEditor();
    const backdrop = document.createElement("div");
    backdrop.className = "gate-acl-overlay";
    backdrop.setAttribute("role", "presentation");
    const dlg = document.createElement("div");
    dlg.className = "gate-acl-dialog";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-labelledby", "gate-acl-title");
    dlg.innerHTML = `
      <div class="gate-acl-dialog__head">
        <h2 class="gate-acl-dialog__title" id="gate-acl-title">Gate access</h2>
        <p class="gate-acl-dialog__coords">Tile (${opts.x}, ${opts.z}, stack ${opts.y})</p>
        <button type="button" class="gate-acl-dialog__close" aria-label="Close">×</button>
      </div>
      <p class="gate-acl-dialog__hint">These wallets can use <strong>Open gate</strong> from the context menu. The owner stays on the list.</p>
      <div class="gate-acl-table-wrap">
        <table class="gate-acl-table" aria-label="Authorized openers">
          <tbody id="gate-acl-tbody"></tbody>
        </table>
      </div>
      <div class="gate-acl-add-row">
        <span class="gate-acl-add-label" id="gate-acl-add-label">Add someone in this room</span>
        <div id="gate-acl-add-picker" class="gate-acl-add-picker" role="list" aria-labelledby="gate-acl-add-label"></div>
      </div>
      <div class="gate-acl-dialog__actions">
        <button type="button" class="gate-acl-btn gate-acl-btn--secondary" id="gate-acl-cancel">Cancel</button>
        <button type="button" class="gate-acl-btn gate-acl-btn--primary" id="gate-acl-save">Save</button>
      </div>`;
    backdrop.appendChild(dlg);
    letter.appendChild(backdrop);
    gateAclBackdrop = backdrop;

    const adminC = normalizeWalletKey(opts.adminAddress);
    let local = [...opts.addresses]
      .map((a) => normalizeWalletKey(String(a)))
      .filter(Boolean);
    local = [...new Set(local)].slice(0, GATE_AUTH_MAX);
    if (!local.includes(adminC)) {
      local = [adminC, ...local.filter((a) => a !== adminC)].slice(0, GATE_AUTH_MAX);
    }

    const tbody = dlg.querySelector("#gate-acl-tbody") as HTMLTableSectionElement;
    const addPicker = dlg.querySelector("#gate-acl-add-picker") as HTMLDivElement;
    const closeBtn = dlg.querySelector(".gate-acl-dialog__close") as HTMLButtonElement;
    const cancelBtn = dlg.querySelector("#gate-acl-cancel") as HTMLButtonElement;
    const saveBtn = dlg.querySelector("#gate-acl-save") as HTMLButtonElement;

    function displayForAddress(addr: string): string {
      const c = normalizeWalletKey(addr);
      const p = opts.players.find((pl) => normalizeWalletKey(pl.address) === c);
      if (p) return p.displayName.trim() || walletDisplayName(p.address);
      return formatWalletAddressGap4(addr);
    }

    async function rebuildAddPickerList(): Promise<void> {
      addPicker.replaceChildren();
      if (local.length >= GATE_AUTH_MAX) {
        const empty = document.createElement("p");
        empty.className = "gate-acl-add-picker-empty";
        empty.textContent = "Maximum authorized wallets reached.";
        addPicker.appendChild(empty);
        return;
      }
      const localSet = new Set(local.map((a) => normalizeWalletKey(a)));
      const available = opts.players.filter((pl) => {
        const c = normalizeWalletKey(pl.address);
        return !localSet.has(c);
      });
      if (available.length === 0) {
        const empty = document.createElement("p");
        empty.className = "gate-acl-add-picker-empty";
        empty.textContent = "No other room players to add.";
        addPicker.appendChild(empty);
        return;
      }
      const { identiconDataUrl } = await import("../game/identiconTexture.js");
      if (!addPicker.isConnected) return;
      for (const pl of available) {
        const c = normalizeWalletKey(pl.address);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gate-acl-add-option";
        btn.setAttribute(
          "aria-label",
          `Add ${pl.displayName.trim() || walletDisplayName(pl.address)}`
        );
        const img = document.createElement("img");
        img.className = "gate-acl-add-option-ident";
        img.alt = "";
        img.width = 24;
        img.height = 24;
        void identiconDataUrl(pl.address).then((url) => {
          if (img.isConnected) img.src = url;
        });
        const span = document.createElement("span");
        span.className = "gate-acl-add-option-name";
        span.textContent =
          pl.displayName.trim() || walletDisplayName(pl.address);
        btn.appendChild(img);
        btn.appendChild(span);
        btn.addEventListener("click", () => {
          if (local.some((a) => normalizeWalletKey(a) === c)) return;
          if (local.length >= GATE_AUTH_MAX) return;
          local.push(c);
          void renderRows();
          void rebuildAddPickerList();
        });
        addPicker.appendChild(btn);
      }
    }

    async function renderRows(): Promise<void> {
      tbody.replaceChildren();
      const { identiconDataUrl } = await import("../game/identiconTexture.js");
      for (const addr of local) {
        const tr = document.createElement("tr");
        tr.className = "gate-acl-row";
        const k = normalizeWalletKey(addr);
        const isOwner = k === adminC;
        const tdIcon = document.createElement("td");
        tdIcon.className = "gate-acl-cell gate-acl-cell--icon";
        const img = document.createElement("img");
        img.className = "gate-acl-ident";
        img.alt = "";
        img.width = 28;
        img.height = 28;
        tdIcon.appendChild(img);
        void identiconDataUrl(addr).then((url) => {
          if (img.isConnected) img.src = url;
        });
        const tdMain = document.createElement("td");
        tdMain.className = "gate-acl-cell gate-acl-cell--main";
        const nameDiv = document.createElement("div");
        nameDiv.className = "gate-acl-name";
        nameDiv.textContent = displayForAddress(addr);
        const monoDiv = document.createElement("div");
        monoDiv.className = "gate-acl-mono";
        monoDiv.textContent = formatWalletAddressGap4(addr);
        tdMain.appendChild(nameDiv);
        tdMain.appendChild(monoDiv);
        const rmCell = document.createElement("td");
        rmCell.className = "gate-acl-cell gate-acl-cell--rm";
        if (!isOwner) {
          const rm = document.createElement("button");
          rm.type = "button";
          rm.className = "gate-acl-remove";
          rm.setAttribute(
            "aria-label",
            `Remove ${formatWalletAddressGap4(addr)}`
          );
          rm.title = "Remove access";
          rm.textContent = "×";
          rm.addEventListener("click", () => {
            local = local.filter((a) => normalizeWalletKey(a) !== k);
            void renderRows();
            void rebuildAddPickerList();
          });
          rmCell.appendChild(rm);
        } else {
          const sp = document.createElement("span");
          sp.className = "gate-acl-owner-mark";
          sp.textContent = "Owner";
          rmCell.appendChild(sp);
        }
        tr.appendChild(tdIcon);
        tr.appendChild(tdMain);
        tr.appendChild(rmCell);
        tbody.appendChild(tr);
      }
    }

    const closeAll = (): void => {
      hideGateAclEditor();
    };

    closeBtn.addEventListener("click", closeAll);
    cancelBtn.addEventListener("click", closeAll);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeAll();
    });
    saveBtn.addEventListener("click", () => {
      if (!local.includes(adminC)) return;
      opts.onSave([...local]);
      closeAll();
    });

    gateAclKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAll();
      }
    };
    window.addEventListener("keydown", gateAclKeyHandler, true);

    void renderRows();
    void rebuildAddPickerList();
  }

  /** Context card + object Advanced popover, fixed just left of the mode sidebar rail. */
  function layoutObjectPanelSatellites(): void {
    if (!objectPanel) return;
    const margin = 8;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const minTop = 52;
    const sb = modeSidebar.getBoundingClientRect();
    const rightPx = Math.max(margin, vw - sb.left + margin);

    if (!objectPanelContextPopover.hidden) {
      objectPanelContextPopover.style.right = `${rightPx}px`;
      objectPanelContextPopover.style.left = "auto";
      objectPanelContextPopover.style.top = "auto";
      const letterBr = letter.getBoundingClientRect();
      /* Align bottom edge with letterbox (game area); min gap from viewport when flush. */
      const bottomPx = Math.max(6, vh - letterBr.bottom);
      objectPanelContextPopover.style.bottom = `${bottomPx}px`;
    }

    if (!objectPanelAdvancedPopover.hidden && panelAdvancedToggle) {
      const panelBr = objectPanel.getBoundingClientRect();
      const w = Math.min(260, Math.max(200, Math.min(panelBr.width + 40, 280)));
      objectPanelAdvancedPopover.style.width = `${w}px`;
      objectPanelAdvancedPopover.style.maxWidth = `${Math.max(120, vw - 16)}px`;
      objectPanelAdvancedPopover.style.right = `${rightPx}px`;
      objectPanelAdvancedPopover.style.left = "auto";
      const advBr = panelAdvancedToggle.getBoundingClientRect();
      /* Prefer opening above the Advanced control (bottom of popover just under toggle top). */
      const gap = margin;
      const bottomFromViewportBottom = vh - advBr.top + gap;
      objectPanelAdvancedPopover.style.bottom = `${bottomFromViewportBottom}px`;
      objectPanelAdvancedPopover.style.top = "auto";
      let pr = objectPanelAdvancedPopover.getBoundingClientRect();
      if (pr.top < minTop) {
        objectPanelAdvancedPopover.style.bottom = "auto";
        let top = advBr.bottom + gap;
        if (!objectPanelContextPopover.hidden) {
          const cbr = objectPanelContextPopover.getBoundingClientRect();
          if (top < cbr.bottom + gap) top = cbr.bottom + gap;
        }
        if (top < minTop) top = minTop;
        objectPanelAdvancedPopover.style.top = `${top}px`;
        pr = objectPanelAdvancedPopover.getBoundingClientRect();
        if (pr.bottom > vh - margin) {
          top = Math.max(minTop, vh - margin - pr.height);
          objectPanelAdvancedPopover.style.top = `${top}px`;
        }
      }
    }
  }

  function layoutObjectPanelAdvancedPopover(): void {
    if (objectPanelAdvancedPopover.hidden) return;
    if (!objectPanel || !panelAdvancedToggle) return;
    layoutObjectPanelSatellites();
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
      setPanelShapePopoverOpen(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => layoutObjectPanelAdvancedPopover());
      });
    }
  }

  const closeHudAdvancedPopoversOnOutside = (ev: PointerEvent): void => {
    const t = ev.target as Node;
    if (!barAdvancedPopover.hidden) {
      if (
        buildBlockBar.contains(t) ||
        barAdvancedPopover.contains(t) ||
        hueDock.contains(t) ||
        modeSidebarBuildMount.contains(t)
      ) {
        return;
      }
      setBarPopoverOpen(false);
    }
    if (!barShapePopover.hidden) {
      if (
        barShapeColorRow.contains(t) ||
        barShapePopover.contains(t) ||
        buildBlockBar.contains(t) ||
        barAdvancedPopover.contains(t) ||
        hueDock.contains(t) ||
        modeSidebarBuildMount.contains(t)
      ) {
        return;
      }
      setBarShapePopoverOpen(false);
    }
    if (!panelShapePopover.hidden) {
      if (
        (panelShapeColorRow && panelShapeColorRow.contains(t)) ||
        panelShapePopover.contains(t) ||
        (objectPanel && objectPanel.contains(t)) ||
        objectPanelContextPopover.contains(t) ||
        objectPanelAdvancedPopover.contains(t) ||
        hueDock.contains(t) ||
        modeSidebarBuildMount.contains(t)
      ) {
        return;
      }
      setPanelShapePopoverOpen(false);
    }
    if (!objectPanelAdvancedPopover.hidden) {
      if (
        (objectPanel && objectPanel.contains(t)) ||
        objectPanelContextPopover.contains(t) ||
        objectPanelAdvancedPopover.contains(t)
      ) {
        return;
      }
      setPanelAdvancedOpen(false);
    }
  };
  document.addEventListener("pointerdown", closeHudAdvancedPopoversOnOutside);

  function syncPanelPyramidBaseSliderFromScale(scale: number): void {
    if (!panelPyramidBaseInput || !panelPyramidBaseVal) return;
    const pct = pyramidBasePercentFromScale(scale);
    const stepped = Math.round((pct - 100) / 5) * 5 + 100;
    const v = Math.min(165, Math.max(100, stepped));
    panelPyramidBaseInput.value = String(v);
    panelPyramidBaseVal.textContent = `${v}%`;
    panelPyramidBaseInput.setAttribute("aria-valuetext", `${v}%`);
  }

  function syncPanelPyramidBaseRowVisibility(): void {
    if (!panelPyramidBaseRow || !panelRampCb || !panelPyramidCb) return;
    panelPyramidBaseRow.hidden = !(
      panelPyramidCb.checked && !panelRampCb.checked
    );
  }

  function syncPanelTileHeightLabel(): void {
    if (!panelTileInspectorHeightInput || !panelTileInspectorHeightVal) return;
    const v = Math.min(
      2,
      Math.max(0, Math.floor(Number(panelTileInspectorHeightInput.value)))
    );
    const labelsM = ["0.25 m", "0.5 m", "1.0 m"] as const;
    const labelsShort = ["¼", "Half", "Full"] as const;
    panelTileInspectorHeightVal.textContent = labelsM[v] ?? "1.0 m";
    panelTileInspectorHeightInput.setAttribute(
      "aria-valuetext",
      labelsShort[v] ?? "Full"
    );
  }

  function syncPanelHeightButtons(quarter: boolean, half: boolean): void {
    for (const b of panelHeightBtns) {
      const h = b.dataset.height;
      const on =
        (h === "quarter" && quarter) ||
        (h === "half" && !quarter && half) ||
        (h === "full" && !quarter && !half);
      b.classList.toggle("build-block-bar__height-btn--active", !!on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    }
    if (panelTileInspectorHeightInput) {
      const v = quarter ? 0 : half ? 1 : 2;
      panelTileInspectorHeightInput.value = String(v);
      syncPanelTileHeightLabel();
    }
  }

  function refreshPanelWireframe(): void {
    const next = buildLivePanelObstacleProps();
    if (next) inspectorPreviewGameRef?.syncInspectorSelectionTilePreview(next);
  }

  function syncPanelShapeButtons(): void {
    if (panelObjectEditGate) {
      refreshPanelWireframe();
      if (panelShapeTriggerEl) {
        const lab = panelShapeTriggerEl.querySelector(
          ".hud-mode-sidebar__shape-trigger-label"
        );
        if (lab) lab.textContent = "Gate";
        const icon = panelShapeTriggerEl.querySelector(
          ".hud-mode-sidebar__shape-trigger-icon"
        );
        if (icon) icon.innerHTML = SHAPE_TRIG_SVG.cube;
      }
      return;
    }
    if (
      !panelShapeBtns.length ||
      !panelRampCb ||
      !panelHexCb ||
      !panelPyramidCb ||
      !panelSphereCb
    ) {
      return;
    }
    const ramp = panelRampCb.checked;
    const pyramid = !ramp && panelPyramidCb.checked;
    const sphere = !ramp && panelSphereCb.checked;
    const hex = panelHexCb.checked && !ramp && !pyramid && !sphere;
    const cube = !hex && !ramp && !pyramid && !sphere;
    panelShapeBtns.forEach((b) => {
      const shape = b.dataset.shape;
      const on =
        (shape === "cube" && cube) ||
        (shape === "hex" && hex) ||
        (shape === "pyramid" && pyramid) ||
        (shape === "sphere" && sphere) ||
        (shape === "ramp" && ramp);
      b.classList.toggle("tile-inspector__shape-btn--active", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    refreshPanelWireframe();
    syncPanelShapeTriggerVisual();
    syncPanelPyramidBaseRowVisibility();
  }

  function panelCollisionToggleIconMarkup(passable: boolean): string {
    return passable
      ? nimiqIconUseMarkup("nq-view-off", {
          width: 18,
          height: 18,
          class: "build-object-panel-adv__icon-toggle-svg",
        })
      : nimiqIconUseMarkup("nq-hexagon", {
          width: 18,
          height: 18,
          class: "build-object-panel-adv__icon-toggle-svg",
        });
  }

  function panelLockToggleIconMarkup(locked: boolean): string {
    return locked
      ? nimiqIconUseMarkup("nq-lock-locked", {
          width: 18,
          height: 18,
          class: "build-object-panel-adv__icon-toggle-svg",
        })
      : nimiqIconUseMarkup("nq-lock-unlocked", {
          width: 18,
          height: 18,
          class: "build-object-panel-adv__icon-toggle-svg",
        });
  }

  function syncPanelCollisionToggle(passable: boolean): void {
    if (!panelCollisionToggle) return;
    panelCollisionToggle.setAttribute("aria-pressed", passable ? "true" : "false");
    panelCollisionToggle.classList.toggle(
      "build-object-panel-adv__icon-toggle--passable",
      passable
    );
    panelCollisionToggle.innerHTML = panelCollisionToggleIconMarkup(passable);
    panelCollisionToggle.title = passable
      ? "Walk-through. Select to make solid with collision."
      : "Solid. Select to make walk-through with no collision.";
    panelCollisionToggle.setAttribute(
      "aria-label",
      passable
        ? "No collision, walk-through. Activate for solid collision."
        : "Solid collision. Activate for walk-through."
    );
  }

  function syncPanelLockToggle(locked: boolean): void {
    if (!panelLockToggle) return;
    panelLockToggle.setAttribute("aria-pressed", locked ? "true" : "false");
    panelLockToggle.classList.toggle(
      "build-object-panel-adv__icon-toggle--locked",
      locked
    );
    panelLockToggle.innerHTML = panelLockToggleIconMarkup(locked);
    panelLockToggle.title = locked
      ? "Locked. Select to unlock."
      : "Unlocked. Select to lock.";
    panelLockToggle.setAttribute(
      "aria-label",
      locked ? "Locked for players. Activate to unlock." : "Unlocked. Activate to lock."
    );
  }

  function getPanelPassable(): boolean {
    return panelCollisionToggle?.getAttribute("aria-pressed") === "true";
  }

  function getPanelLocked(): boolean {
    if (!panelLockToggle || lockOptionBlock?.hidden) return panelLockedState;
    return panelLockToggle.getAttribute("aria-pressed") === "true";
  }

  function gateExitDirFromTile(
    gx: number,
    gz: number,
    gate: { exitX: number; exitZ: number }
  ): number {
    const dx = gate.exitX - gx;
    const dz = gate.exitZ - gz;
    const dirs: [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    for (let i = 0; i < 4; i++) {
      const d = dirs[i]!;
      if (d[0] === dx && d[1] === dz) return i;
    }
    return 0;
  }

  function buildLivePanelObstacleProps(): ObstacleProps | null {
    if (
      !panelCollisionToggle ||
      !panelHexCb ||
      !panelPyramidCb ||
      !panelSphereCb ||
      !panelRampCb
    ) {
      return null;
    }
    if (panelObjectEditGate) {
      const dirs: readonly [number, number][] = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ];
      const d = dirs[(panelGateExitDir + 4) % 4]!;
      const ex = panelObjectTileX + d[0];
      const ez = panelObjectTileZ + d[1];
      return {
        passable: false,
        quarter: false,
        half: false,
        hex: false,
        pyramid: false,
        pyramidBaseScale: 1,
        sphere: false,
        ramp: false,
        rampDir: 0,
        colorId: panelSelectedColorId,
        locked: getPanelLocked(),
        gate: {
          adminAddress: panelGateAdminAddress,
          authorizedAddresses: [...panelGateAuthorizedAddresses],
          exitX: ex,
          exitZ: ez,
        },
        gateExitDir: Math.max(0, Math.min(3, Math.floor(panelGateExitDir))),
        editorTileX: panelObjectTileX,
        editorTileY: panelObjectTileY,
        editorTileZ: panelObjectTileZ,
      };
    }
    let quarter = false;
    let half = false;
    if (panelTileInspectorHeightInput) {
      const v = Math.min(
        2,
        Math.max(0, Math.floor(Number(panelTileInspectorHeightInput.value)))
      );
      quarter = v <= 0;
      half = v === 1;
    } else if (panelHeightBtns.length > 0) {
      quarter = panelHeightBtns.some(
        (b) =>
          b.dataset.height === "quarter" &&
          b.classList.contains("build-block-bar__height-btn--active")
      );
      const halfMode = panelHeightBtns.some(
        (b) =>
          b.dataset.height === "half" &&
          b.classList.contains("build-block-bar__height-btn--active")
      );
      half = quarter ? false : halfMode;
    } else {
      return null;
    }
    const ramp = panelRampCb.checked;
    const rampDir = Math.max(0, Math.min(3, Math.floor(panelRampDir)));
    const prism = normalizeBlockPrismParts({
      hex: panelHexCb.checked,
      pyramid: panelPyramidCb.checked,
      sphere: panelSphereCb.checked,
      ramp,
    });
    const pyramidBaseScale = prism.pyramid
      ? clampPyramidBaseScale(
          Number(panelPyramidBaseInput?.value ?? 100) / 100
        )
      : 1;
    return {
      passable: getPanelPassable(),
      quarter,
      half,
      hex: prism.hex,
      pyramid: prism.pyramid,
      pyramidBaseScale,
      sphere: prism.sphere,
      ramp: prism.ramp,
      rampDir: prism.ramp ? rampDir : 0,
      colorId: panelSelectedColorId,
      locked: getPanelLocked(),
    };
  }

  function emitPanelProps(): void {
    if (!panelOnPropsChange) return;
    const next = buildLivePanelObstacleProps();
    if (!next) return;
    panelOnPropsChange(next);
    inspectorPreviewGameRef?.syncInspectorSelectionTilePreview(next);
    inspectorPreviewGameRef?.refreshGateRepositionPreviewsFromStoredPointer();
  }

  function previewInspectorSelectionFromPanel(): void {
    const next = buildLivePanelObstacleProps();
    if (next) {
      inspectorPreviewGameRef?.syncInspectorSelectionTilePreview(next);
      inspectorPreviewGameRef?.refreshGateRepositionPreviewsFromStoredPointer();
    }
  }

  function panelPyramidBaseSliderUiBusy(): boolean {
    if (!panelPyramidBaseInput) return false;
    return (
      document.activeElement === panelPyramidBaseInput ||
      panelPyramidBaseInput.matches(":active")
    );
  }

  function schedulePanelPyramidBaseCommit(): void {
    if (panelPyramidBaseCommitTimer !== null) {
      clearTimeout(panelPyramidBaseCommitTimer);
    }
    panelPyramidBaseCommitTimer = setTimeout(() => {
      panelPyramidBaseCommitTimer = null;
      emitPanelProps();
    }, 50);
  }

  panelShapePopover.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      ".tile-inspector__shape-btn"
    ) as HTMLButtonElement | null;
    if (!btn || !panelShapePopover.contains(btn)) return;
    if (
      !objectPanel?.querySelector("#tile-inspector-selection") ||
      !panelRampCb ||
      !panelHexCb ||
      !panelPyramidCb ||
      !panelSphereCb
    ) {
      return;
    }
    const shape = btn.dataset.shape;
    if (shape === "cube") {
      panelHexCb.checked = false;
      panelPyramidCb.checked = false;
      panelSphereCb.checked = false;
      panelRampCb.checked = false;
      if (rampDirRow) rampDirRow.hidden = true;
      emitPanelProps();
    } else if (shape === "hex") {
      panelHexCb.checked = true;
      panelPyramidCb.checked = false;
      panelSphereCb.checked = false;
      panelRampCb.checked = false;
      if (rampDirRow) rampDirRow.hidden = true;
      emitPanelProps();
    } else if (shape === "pyramid") {
      panelPyramidCb.checked = true;
      panelHexCb.checked = false;
      panelSphereCb.checked = false;
      panelRampCb.checked = false;
      if (rampDirRow) rampDirRow.hidden = true;
      emitPanelProps();
    } else if (shape === "sphere") {
      panelSphereCb.checked = true;
      panelHexCb.checked = false;
      panelPyramidCb.checked = false;
      panelRampCb.checked = false;
      if (rampDirRow) rampDirRow.hidden = true;
      emitPanelProps();
    } else if (shape === "ramp") {
      panelRampCb.checked = true;
      panelHexCb.checked = false;
      panelPyramidCb.checked = false;
      panelSphereCb.checked = false;
      if (rampDirRow) rampDirRow.hidden = false;
      emitPanelProps();
    }
    syncPanelShapeButtons();
    setPanelShapePopoverOpen(false);
  });

  function applyPanelHueDegrees(hueDeg: number): void {
    if (!panelHueRing || !panelHueCore) return;
    const h = ((hueDeg % 360) + 360) % 360;
    panelLastHueDeg = Math.round(h);
    panelHueRing.setAttribute("aria-valuenow", String(panelLastHueDeg));
    const { r, g, b } = hslToRgb(h / 360, 1, 0.52);
    const id = nearestPaletteColorIdFromRgb(r, g, b);
    panelSelectedColorId = id;
    pushRecentColorId(id);
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

  function hideObjectEditPanel(): void {
    hideGateAclEditor();
    inspectorPreviewGameRef?.bindInspectorTilePreviewCanvas("selection", null);
    inspectorPreviewGameRef?.syncInspectorSelectionTilePreview(null);
    if (panelPyramidBaseCommitTimer !== null) {
      clearTimeout(panelPyramidBaseCommitTimer);
      panelPyramidBaseCommitTimer = null;
      if (panelOnPropsChange && panelPyramidBaseInput) {
        emitPanelProps();
      }
    }
    setPanelAdvancedOpen(false);
    setPanelShapePopoverOpen(false);
    objectPanelAdvancedPopover.replaceChildren();
    objectPanelAdvancedPopover.hidden = true;
    objectPanelContextPopover.hidden = true;
    objectPanelContextPopover.replaceChildren();
    objectPanelContextPopover.classList.remove(
      "build-object-panel-context--teleporter",
      "build-object-panel-context--billboard",
      "build-object-panel-context--billboard-readonly"
    );
    teleporterPanelCleanup?.();
    teleporterPanelCleanup = null;
    panelTeleporterRoomRows = null;
    panelTeleporterSelectedRoomId = null;
    panelTeleporterRoomNameEl = null;
    panelTeleporterRoomPicker = null;
    panelTeleporterRoomPickerDocDown = null;
    panelTeleporterRoomPickerKeydown = null;
    panelTeleporterX = null;
    panelTeleporterZ = null;
    applyTeleporterHubUi = null;
    teleporterPanelSyncRoomTrigger = null;
    teleporterPanelEnsureRowForId = null;
    teleporterPanelRenderPickerList = null;
    if (objectPanel) {
      objectPanel.remove();
      objectPanel = null;
    }
    if (panelShapePopoverAbort) {
      panelShapePopoverAbort.abort();
      panelShapePopoverAbort = null;
    }
    panelShapeTriggerEl = null;
    if (panelShapeColorRow) {
      panelShapeColorRow.remove();
      panelShapeColorRow = null;
    }
    panelDockHueWrap = null;
    panelTileInspectorHeightInput = null;
    panelTileInspectorHeightVal = null;
    panelTileInspectorResetBtn = null;
    panelPyramidBaseRow = null;
    panelPyramidBaseInput = null;
    panelPyramidBaseVal = null;
    syncHueDockVisibility();
    syncModeSidebarBodyInteractive();
    panelCollisionToggle = null;
    panelLockToggle = null;
    lockOptionBlock = null;
    panelHexCb = null;
    panelPyramidCb = null;
    panelSphereCb = null;
    panelRampCb = null;
    panelHeightBtns = [];
    panelShapeBtns = [];
    rampDirRow = null;
    panelRampRotCCW = null;
    panelRampRotCW = null;
    panelObjectEditGate = false;
    panelGateEditBlock = null;
    panelGateAclBar = null;
    panelGateAclSummaryEl = null;
    panelGateAclBtn = null;
    panelOnEditGateAcl = null;
    panelGateExitCCW = null;
    panelGateExitCW = null;
    panelContextHeightRow = null;
    panelAdvancedToggle = null;
    panelHueRingWrap = null;
    panelHueRing = null;
    panelHueCore = null;
    panelOnPropsChange = null;
    panelLockedState = false;
    syncBlockPreviewDockSlots();
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

  function bindTileInspectorPreviewGame(game: Game | null): void {
    const prev = inspectorPreviewGameRef;
    inspectorPreviewGameRef = game;
    if (prev && prev !== game) {
      prev.bindInspectorTilePreviewCanvas("placement", null);
      prev.bindInspectorTilePreviewCanvas("selection", null);
    }
    if (game) {
      const placementCanvas = hueDockBlockPreview.querySelector(
        "#tile-inspector-preview-canvas"
      ) as HTMLCanvasElement | null;
      game.bindInspectorTilePreviewCanvas("placement", placementCanvas);
    } else if (prev) {
      prev.bindInspectorTilePreviewCanvas("placement", null);
      prev.bindInspectorTilePreviewCanvas("selection", null);
    }
  }

  const lastSystemChatAtByText = new Map<string, number>();

  let restartBannerTick: ReturnType<typeof setInterval> | null = null;
  let restartPendingEndMono = 0;
  let restartPendingLastSeq = 0;
  let restartDisconnectExpectActive = false;

  function stopRestartBannerTick(): void {
    if (restartBannerTick) {
      clearInterval(restartBannerTick);
      restartBannerTick = null;
    }
  }

  function syncRestartBannerVisual(): void {
    const remainSec = Math.max(
      0,
      Math.ceil((restartPendingEndMono - performance.now()) / 1000)
    );
    restartBannerLine.textContent = `Server restart in ${remainSec}s`;
    if (performance.now() >= restartPendingEndMono) {
      stopRestartBannerTick();
      restartBanner.hidden = true;
      syncHudBelowTopWrap();
    }
  }

  return {
    setStatus(s: string) {
      const t = s.trim();
      statusSub.textContent = t;
      statusSub.classList.toggle("hud-status-sub--empty", !t);
      ui.classList.toggle("hud--has-status-sub", !!t);
      syncHudBelowTopWrap();
    },
    resetRoomChatDom() {
      worldChatLog.replaceChildren();
      systemChatLog.replaceChildren();
      lastSystemChatAtByText.clear();
    },
    appendChat(
      from: string,
      text: string,
      opts?: {
        fromAddress?: string | null;
        profileIsSelf?: boolean;
        historical?: boolean;
        skipSystemDedup?: boolean;
      }
    ) {
      const isSystem = from.trim().toLowerCase() === "system";
      if (isSystem && !opts?.skipSystemDedup) {
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
      if (opts?.historical) {
        line.classList.add("chat-line--historical");
      }
      const prefix = document.createElement("span");
      prefix.className = "chat-line__prefix";
      prefix.textContent = `${from}: `;
      const body = document.createElement("span");
      body.className = "chat-line__body";
      body.textContent = text;
      line.append(prefix, body);
      line.dataset.chatTranslateText = text;
      line.dataset.chatDisplayName = from;
      const addr = opts?.fromAddress
        ? String(opts.fromAddress).replace(/\s+/g, "").trim()
        : "";
      if (addr) {
        line.dataset.chatFromAddress = addr;
      }
      if (opts?.profileIsSelf) {
        line.dataset.chatProfileSelf = "1";
      }
      const targetLog = isSystem ? systemChatLog : worldChatLog;
      targetLog.appendChild(line);
      if (!isSystem) {
        const maxWorld = 200;
        while (worldChatLog.childElementCount > maxWorld) {
          worldChatLog.removeChild(worldChatLog.firstElementChild!);
        }
      }
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
    isChatMinimized: () => chatMinimized,
    setChatMinimized(minimized: boolean) {
      setChatMinimizedState(minimized, true);
    },
    onFullscreenToggle(fn: () => void) {
      fsHandler = fn;
    },
    setReturnHomeVisible(visible: boolean) {
      returnHomeBtn.hidden = !visible;
    },
    setPortalEnterVisible(visible: boolean) {
      portalEnterBtn.hidden = !visible;
    },
    setPortalEnterScreenPosition(x: number, y: number) {
      portalEnterBtn.style.left = `${x}px`;
      portalEnterBtn.style.top = `${y}px`;
    },
    setPortalEnterLabel(text: string) {
      portalEnterBtn.textContent = text;
    },
    showSelfEmojiMenu(
      anchorX: number,
      anchorY: number,
      onPick: (emoji: string) => void,
      openedAtFloor: FloorTile | null = null
    ) {
      closeOtherPlayerUiOverlays();
      closeSelfEmojiMenu();
      selfEmojiOpenedFloor = openedAtFloor;
      selfEmojiPickHandler = onPick;
      selfEmojiMenu.style.left = `${anchorX}px`;
      selfEmojiMenu.style.top = `${anchorY}px`;
      selfEmojiMenu.hidden = false;
      armSelfEmojiAutoCloseFade();
      requestAnimationFrame(() => bindSelfEmojiOutside());
    },
    hideSelfEmojiMenu() {
      closeSelfEmojiMenu();
    },
    setSelfEmojiMenuAnchor(
      x: number | null,
      y: number | null,
      currentFloor?: FloorTile | null
    ) {
      if (selfEmojiMenu.hidden) return;
      if (
        currentFloor &&
        selfEmojiOpenedFloor &&
        (currentFloor.x !== selfEmojiOpenedFloor.x ||
          currentFloor.y !== selfEmojiOpenedFloor.y)
      ) {
        closeSelfEmojiMenu();
        return;
      }
      if (
        x != null &&
        y != null &&
        Number.isFinite(x) &&
        Number.isFinite(y)
      ) {
        selfEmojiMenu.style.left = `${x}px`;
        selfEmojiMenu.style.top = `${y}px`;
      }
    },
    isSelfEmojiMenuOpen() {
      return !selfEmojiMenu.hidden;
    },
    showOtherPlayerContextMenu(
      clientX: number,
      clientY: number,
      targets: Array<{ address: string; displayName: string }>,
      opts?: { emoteRowFirst?: boolean; onEmote?: () => void }
    ) {
      closeSelfEmojiMenu();
      closeChatLineContextMenu();
      closeGateContextMenu();
      closeOtherPlayerProfile();
      if (targets.length === 0) return;
      otherPlayerCtx.hidden = false;
      otherPlayerCtx.style.position = "fixed";
      const emoteBlock =
        opts?.emoteRowFirst && typeof opts.onEmote === "function"
          ? { onEmote: opts.onEmote }
          : undefined;
      if (emoteBlock) {
        openOtherPlayerMultiPicker(targets, emoteBlock);
      } else if (targets.length === 1) {
        otherPlayerCtxMulti.replaceChildren();
        otherPlayerCtxMulti.hidden = true;
        otherPlayerCtxSingle.hidden = false;
        const t = targets[0]!;
        setSingleCtxTarget(t.address, t.displayName);
      } else {
        openOtherPlayerMultiPicker(targets);
      }
      requestAnimationFrame(() => {
        const w = otherPlayerCtx.offsetWidth || 160;
        const h = otherPlayerCtx.offsetHeight || 44;
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = Math.min(Math.max(pad, clientX), vw - w - pad);
        const y = Math.min(Math.max(pad, clientY), vh - h - pad);
        otherPlayerCtx.style.left = `${x}px`;
        otherPlayerCtx.style.top = `${y}px`;
        bindOtherCtxOutside();
      });
    },
    hideOtherPlayerContextMenu() {
      closeOtherPlayerContextMenu();
    },
    dismissOtherPlayerOverlays() {
      closeOtherPlayerUiOverlays();
    },
    openOwnPlayerProfile() {
      openOwnPlayerProfileFromBar();
    },
    onReturnHome(fn: () => void) {
      returnHomeHandler = fn;
    },
    onPortalEnter(fn: () => void) {
      portalEnterHandler = fn;
    },
    onReturnToLobby(fn: () => void) {
      lobbyHandler = fn;
    },
    onRoomsOpen(fn: () => void) {
      roomsOpenHandler = fn;
    },
    onProfileRoomJoin(fn: (roomId: string) => void) {
      profileRoomJoinHandler = fn;
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
      syncHueDockVisibility();
      syncBlockPreviewDockSlots();
    },
    setRoomBackgroundHuePanelVisible(visible: boolean) {
      roomBgHuePanel.hidden = !visible;
      syncModeSidebarBodyInteractive();
      syncHueDockVisibility();
    },
    setRoomEntrySpawnPanelVisible(visible: boolean) {
      roomEntrySpawnPanel.hidden = !visible;
      syncModeSidebarBodyInteractive();
      syncHueDockVisibility();
    },
    onRoomEntrySpawnPickState(fn: ((armed: boolean) => void) | null) {
      roomEntrySpawnPickStateHandler = fn;
    },
    onRoomEntrySpawnUseCenter(fn: (() => void) | null) {
      roomEntrySpawnUseCenterHandler = fn;
    },
    clearRoomEntrySpawnPickUi,
    isRoomEntrySpawnPickArmed(): boolean {
      return roomEntrySpawnPickArmed;
    },
    syncRoomBackgroundHueRing(
      hueDeg: number | null,
      neutral: RoomBackgroundNeutral | null
    ) {
      if (roomBgHueDragging) return;
      const ringDeg =
        hueDeg !== null && Number.isFinite(hueDeg)
          ? Math.round(((hueDeg % 360) + 360) % 360)
          : ROOM_BG_HUE_DEFAULT_RING;
      roomBgHueRing.setAttribute("aria-valuenow", String(ringDeg));
      const coreBg =
        neutral === "black"
          ? "#070a0f"
          : neutral === "white"
            ? "#d4dce8"
            : neutral === "gray"
              ? "#2a313c"
              : `hsl(${ringDeg} 42% 11%)`;
      roomBgHueCore.style.background = coreBg;
      for (const id of neutralDefs) {
        const btn = roomBgNeutralBtns[id.id];
        if (btn) {
          const on = neutral === id.id;
          btn.classList.toggle(
            "hud-mode-sidebar__room-bg-neutral--active",
            on
          );
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        }
      }
    },
    onRoomBackgroundHueAdjust(handlers: {
      onHueDeg: (deg: number) => void;
      onPointerUp: () => void;
    }) {
      roomBgHueInputHandler = handlers.onHueDeg;
      roomBgHueUpHandler = handlers.onPointerUp;
    },
    onRoomBackgroundNeutralPick(fn: (neutral: RoomBackgroundNeutral) => void) {
      roomBgNeutralPickHandler = fn;
    },
    setPlayModeState(mode: "walk" | "build" | "floor") {
      hudPlayMode = mode;
      const editOn = mode === "build" || mode === "floor";
      buildToggleBtn.classList.toggle(
        "hud-mode-sidebar__tab--active-build",
        editOn
      );
      buildToggleBtn.setAttribute("aria-pressed", editOn ? "true" : "false");
      if (mode === "floor") {
        buildEditKindSelect.value = "room";
      } else if (mode === "build") {
        buildEditKindSelect.value = "objects";
      }
      const showKindPicker =
        editOn && roomAllowPlaceBlocks && roomAllowExtraFloor;
      buildEditKindWrap.hidden = !showKindPicker;
      buildEditKindLabel.hidden = buildEditKindWrap.hidden;
      modeSidebarBody.setAttribute("aria-labelledby", "hud-mode-tab-build");
      syncHueDockVisibility();
    },
    showObjectEditPanel(opts) {
      hideObjectEditPanel();
      if ("teleporterEdit" in opts) {
        const te = opts.teleporterEdit;
        panelOnPropsChange = null;
        objectPanel = document.createElement("div");
        objectPanel.className =
          "build-object-panel build-object-panel--teleporter";
        objectPanel.hidden = true;
        objectPanel.innerHTML = `<div class="build-object-panel__surface" aria-hidden="true"></div>`;
        modeSidebarBuildMount.appendChild(objectPanel);

        objectPanelContextPopover.classList.remove(
          "build-object-panel-context--billboard"
        );
        objectPanelContextPopover.classList.add(
          "build-object-panel-context--teleporter"
        );
        objectPanelContextPopover.innerHTML = `
          <div class="build-object-panel-context__inner build-object-panel-context__inner--teleporter">
            <div class="build-object-panel-context__tp-stack">
              <div class="build-object-panel-context__tp-head">
                <div class="build-object-panel-context__tp-head-main">
                  <span class="build-object-panel-context__tp-title">Teleporter</span>
                  <span class="build-object-panel-context__tp-coords">(${opts.x}, ${opts.z})</span>
                </div>
                <button type="button" class="build-object-panel__dismiss build-object-panel-context__dismiss build-object-panel-context__dismiss--inline" aria-label="Close teleporter editor">${nimiqIconUseMarkup("nq-cross", { width: 13, height: 13, class: "build-object-panel__dismiss-icon" })}</button>
              </div>
              <p class="build-object-panel-context__tp-lead">${
                te.pending
                  ? "No destination yet. Pick a room and save."
                  : "One-way teleport. Change the destination below."
              }</p>
              <div class="build-object-panel-context__tp-field build-object-panel-context__tp-field--room">
                <button type="button" id="build-object-panel-tp-room-open" class="build-object-panel-context__tp-room-trigger" aria-haspopup="listbox" aria-expanded="false">
                  <span class="build-object-panel-context__tp-room-trigger-cap">Room</span>
                  <span class="build-object-panel-context__tp-room-trigger-name" id="build-object-panel-tp-room-name"></span>
                  <span class="build-object-panel-context__tp-room-trigger-meta" id="build-object-panel-tp-room-meta"></span>
                </button>
              </div>
              <p class="build-object-panel-context__tp-hint" id="build-object-panel-tp-hub-hint" hidden>Hub: spawn is fixed at the center (0, 0).</p>
              <div class="build-object-panel-context__tp-coords-wrap" id="build-object-panel-tp-dest-coords-wrap">
                <div class="build-object-panel-context__tp-xz">
                  <label class="build-object-panel-context__tp-num-label">X <input type="number" id="build-object-panel-tp-x" class="build-object-panel-context__tp-num" step="1" inputmode="numeric" /></label>
                  <label class="build-object-panel-context__tp-num-label">Z <input type="number" id="build-object-panel-tp-z" class="build-object-panel-context__tp-num" step="1" inputmode="numeric" /></label>
                </div>
                <button type="button" class="build-object-panel__btn build-object-panel-context__tp-pick" id="build-object-panel-tp-pick">Use tile I click…</button>
              </div>
              <button type="button" class="build-object-panel__btn build-object-panel-context__tp-save" id="build-object-panel-tp-save">Save destination</button>
              <div class="build-object-panel-context__actions">
                <button type="button" class="build-object-panel__btn build-object-panel__move">Move</button>
                <button type="button" class="build-object-panel__btn build-object-panel__remove">Delete</button>
              </div>
            </div>
            <div id="build-object-panel-tp-room-picker" class="build-object-panel-context__tp-room-picker" hidden>
              <div class="build-object-panel-context__tp-room-picker-head">
                <button type="button" class="build-object-panel-context__tp-room-picker-back" id="build-object-panel-tp-room-picker-back">← Back</button>
                <span class="build-object-panel-context__tp-room-picker-title">Choose room</span>
              </div>
              <ul class="build-object-panel-context__tp-room-picker-list" id="build-object-panel-tp-room-picker-list" role="listbox" aria-label="Rooms"></ul>
            </div>
          </div>`;
        const tpRoot = objectPanelContextPopover;
        const tpFormatRoomCode = (id: string): string =>
          normalizeRoomId(id).toUpperCase();
        const tpSubtitleForRow = (row: TeleporterRoomPickerRow): string => {
          const code = tpFormatRoomCode(row.id);
          const bits: string[] = [];
          if (row.isBuiltin) bits.push("Built-in");
          else if (row.isOfficial) bits.push("Official");
          bits.push(row.isPublic ? "Public" : "Private");
          bits.push(`${row.playerCount} online`);
          return `${code} · ${bits.join(" · ")}`;
        };
        const roomOpenBtn = tpRoot.querySelector(
          "#build-object-panel-tp-room-open"
        ) as HTMLButtonElement;
        const roomNameEl = tpRoot.querySelector(
          "#build-object-panel-tp-room-name"
        ) as HTMLElement;
        const roomMetaEl = tpRoot.querySelector(
          "#build-object-panel-tp-room-meta"
        ) as HTMLElement;
        const roomPicker = tpRoot.querySelector(
          "#build-object-panel-tp-room-picker"
        ) as HTMLElement;
        const roomPickerList = tpRoot.querySelector(
          "#build-object-panel-tp-room-picker-list"
        ) as HTMLUListElement;
        const detachTeleporterRoomPickerListeners = (): void => {
          if (panelTeleporterRoomPickerDocDown) {
            document.removeEventListener(
              "mousedown",
              panelTeleporterRoomPickerDocDown,
              true
            );
            panelTeleporterRoomPickerDocDown = null;
          }
          if (panelTeleporterRoomPickerKeydown) {
            document.removeEventListener(
              "keydown",
              panelTeleporterRoomPickerKeydown,
              true
            );
            panelTeleporterRoomPickerKeydown = null;
          }
        };
        const closeTeleporterRoomPicker = (): void => {
          detachTeleporterRoomPickerListeners();
          if (roomPicker) roomPicker.hidden = true;
          if (roomOpenBtn) roomOpenBtn.setAttribute("aria-expanded", "false");
        };
        const syncTeleporterRoomTrigger = (): void => {
          if (!roomNameEl || !roomMetaEl) return;
          const id = panelTeleporterSelectedRoomId ?? "";
          if (!id) {
            roomNameEl.textContent = "—";
            roomMetaEl.textContent = "Tap to choose";
            return;
          }
          const row = panelTeleporterRoomRows?.find(
            (r) => normalizeRoomId(r.id) === id
          );
          if (row) {
            roomNameEl.textContent = row.displayName;
            roomMetaEl.textContent = tpSubtitleForRow(row);
          } else {
            roomNameEl.textContent = `↪ ${tpFormatRoomCode(id)}`;
            roomMetaEl.textContent =
              "Open list to pick a catalog room, or save with current X/Z.";
          }
        };
        const ensureTeleporterRowForId = (destId: string): void => {
          if (!panelTeleporterRoomRows) return;
          const n = normalizeRoomId(destId);
          if (!n) return;
          if (
            panelTeleporterRoomRows.some((r) => normalizeRoomId(r.id) === n)
          ) {
            return;
          }
          panelTeleporterRoomRows.push({
            id: n,
            displayName: n,
            isPublic: true,
            playerCount: 0,
            isOfficial: false,
            isBuiltin: false,
          });
        };
        const renderTeleporterRoomPickerList = (): void => {
          if (!roomPickerList) return;
          const selId = panelTeleporterSelectedRoomId
            ? normalizeRoomId(panelTeleporterSelectedRoomId)
            : "";
          roomPickerList.replaceChildren();
          const rows = panelTeleporterRoomRows ?? [];
          for (const row of rows) {
            const rid = normalizeRoomId(row.id);
            const li = document.createElement("li");
            li.className = "build-object-panel-context__tp-room-picker-item";
            li.setAttribute("role", "presentation");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "build-object-panel-context__tp-room-picker-row";
            btn.setAttribute("role", "option");
            btn.setAttribute(
              "aria-selected",
              rid === selId ? "true" : "false"
            );
            const main = document.createElement("div");
            main.className =
              "build-object-panel-context__tp-room-picker-row-name";
            main.textContent = row.displayName;
            const sub = document.createElement("div");
            sub.className =
              "build-object-panel-context__tp-room-picker-row-meta";
            sub.textContent = tpSubtitleForRow(row);
            btn.appendChild(main);
            btn.appendChild(sub);
            btn.addEventListener("click", () => {
              panelTeleporterSelectedRoomId = rid;
              syncTeleporterRoomTrigger();
              applyTeleporterHubUi?.();
              closeTeleporterRoomPicker();
            });
            li.appendChild(btn);
            roomPickerList.appendChild(li);
          }
        };
        teleporterPanelSyncRoomTrigger = syncTeleporterRoomTrigger;
        teleporterPanelEnsureRowForId = ensureTeleporterRowForId;
        teleporterPanelRenderPickerList = renderTeleporterRoomPickerList;
        const openTeleporterRoomPicker = (): void => {
          closeTeleporterRoomPicker();
          renderTeleporterRoomPickerList();
          roomPicker.hidden = false;
          roomOpenBtn.setAttribute("aria-expanded", "true");
          panelTeleporterRoomPickerDocDown = (ev: MouseEvent) => {
            const t = ev.target as Node | null;
            if (!t) return;
            if (roomOpenBtn.contains(t)) return;
            if (roomPicker.contains(t)) return;
            closeTeleporterRoomPicker();
          };
          document.addEventListener(
            "mousedown",
            panelTeleporterRoomPickerDocDown,
            true
          );
          panelTeleporterRoomPickerKeydown = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
              ev.preventDefault();
              closeTeleporterRoomPicker();
            }
          };
          document.addEventListener(
            "keydown",
            panelTeleporterRoomPickerKeydown,
            true
          );
        };
        panelTeleporterRoomRows = te.roomOptions.map((o) => ({ ...o }));
        panelTeleporterSelectedRoomId = normalizeRoomId(te.destRoomId);
        if (panelTeleporterSelectedRoomId) {
          ensureTeleporterRowForId(panelTeleporterSelectedRoomId);
        }
        panelTeleporterRoomNameEl = roomNameEl;
        panelTeleporterRoomPicker = roomPicker;
        syncTeleporterRoomTrigger();
        const xIn = tpRoot.querySelector(
          "#build-object-panel-tp-x"
        ) as HTMLInputElement;
        const zIn = tpRoot.querySelector(
          "#build-object-panel-tp-z"
        ) as HTMLInputElement;
        xIn.value = String(te.destX);
        zIn.value = String(te.destZ);
        panelTeleporterX = xIn;
        panelTeleporterZ = zIn;
        applyTeleporterHubUi = () => {
          const wrap = tpRoot.querySelector(
            "#build-object-panel-tp-dest-coords-wrap"
          ) as HTMLElement | null;
          const hubHint = tpRoot.querySelector(
            "#build-object-panel-tp-hub-hint"
          ) as HTMLElement | null;
          const pickBtn = tpRoot.querySelector(
            "#build-object-panel-tp-pick"
          ) as HTMLButtonElement | null;
          if (!wrap || !hubHint) return;
          const destRoom = panelTeleporterSelectedRoomId
            ? normalizeRoomId(panelTeleporterSelectedRoomId)
            : "";
          const isHub = destRoom === HUB_ROOM_ID;
          wrap.hidden = isHub;
          hubHint.hidden = !isHub;
          if (pickBtn) {
            const here = normalizeRoomId(te.currentRoomId);
            pickBtn.hidden = isHub || destRoom !== here;
          }
        };
        roomOpenBtn.addEventListener("click", () => {
          if (roomPicker.hidden) openTeleporterRoomPicker();
          else closeTeleporterRoomPicker();
        });
        tpRoot
          .querySelector("#build-object-panel-tp-room-picker-back")
          ?.addEventListener("click", () => closeTeleporterRoomPicker());
        teleporterPanelCleanup = () => {
          closeTeleporterRoomPicker();
          te.onPickCancel();
        };
        applyTeleporterHubUi();
        objectPanelContextPopover.hidden = false;
        objectPanelContextPopover
          .querySelector(".build-object-panel__move")
          ?.addEventListener("click", () => opts.onMove());
        objectPanelContextPopover
          .querySelector(".build-object-panel__remove")
          ?.addEventListener("click", () => opts.onRemove());
        objectPanelContextPopover
          .querySelector(".build-object-panel-context__dismiss")
          ?.addEventListener("click", () => opts.onClose());
        tpRoot
          .querySelector("#build-object-panel-tp-pick")
          ?.addEventListener("click", () => {
            te.onPickTileInCurrentRoom();
          });
        tpRoot
          .querySelector("#build-object-panel-tp-save")
          ?.addEventListener("click", () => {
            const roomId = panelTeleporterSelectedRoomId
              ? normalizeRoomId(panelTeleporterSelectedRoomId)
              : "";
            if (!roomId) return;
            if (roomId === HUB_ROOM_ID) {
              te.onConfigure(roomId, 0, 0);
              return;
            }
            const dx = Number(xIn.value);
            const dz = Number(zIn.value);
            if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
              return;
            }
            te.onConfigure(roomId, Math.floor(dx), Math.floor(dz));
          });
        requestAnimationFrame(() => {
          layoutObjectPanelSatellites();
          requestAnimationFrame(() => layoutObjectPanelSatellites());
        });
        return;
      }
      if ("billboardSelection" in opts) {
        const bs = opts.billboardSelection;
        panelOnPropsChange = null;
        objectPanel = document.createElement("div");
        objectPanel.className =
          "build-object-panel build-object-panel--teleporter";
        objectPanel.hidden = true;
        objectPanel.innerHTML = `<div class="build-object-panel__surface" aria-hidden="true"></div>`;
        modeSidebarBuildMount.appendChild(objectPanel);

        objectPanelContextPopover.classList.remove(
          "build-object-panel-context--teleporter"
        );
        objectPanelContextPopover.classList.add(
          "build-object-panel-context--billboard"
        );
        objectPanelContextPopover.classList.toggle(
          "build-object-panel-context--billboard-readonly",
          !bs.canModify
        );
        const dismissMarkup = `${nimiqIconUseMarkup("nq-cross", { width: 13, height: 13, class: "build-object-panel__dismiss-icon" })}`;
        objectPanelContextPopover.innerHTML = bs.canModify
          ? `
          <div class="build-object-panel-context__inner">
            <div class="build-object-panel-context__height-row">
              <div class="build-object-panel-context__height-main">
                <span class="build-object-panel-context__title-text">Billboard</span>
                <span class="build-object-panel-context__tp-coords">(${opts.x}, ${opts.z})</span>
              </div>
              <button type="button" class="build-object-panel__dismiss build-object-panel-context__dismiss build-object-panel-context__dismiss--inline" aria-label="Close billboard menu">${dismissMarkup}</button>
            </div>
            <div class="build-object-panel-context__advanced build-object-panel-context__advanced--row">
              <button type="button" class="build-object-panel__btn build-object-panel-context__edit-billboard nq-button-pill light-blue">Edit</button>
              <button type="button" class="build-object-panel__advanced-toggle build-block-bar__advanced-toggle tile-inspector__advanced-link" hidden disabled aria-hidden="true">Advanced…</button>
            </div>
            <div class="build-object-panel-context__actions">
              <button type="button" class="build-object-panel__btn build-object-panel__move nq-button-pill light-blue">Move</button>
              <button type="button" class="build-object-panel__btn build-object-panel__remove nq-button-pill">Delete</button>
            </div>
          </div>`
          : `
          <div class="build-object-panel-context__inner">
            <div class="build-object-panel-context__height-row">
              <div class="build-object-panel-context__height-main">
                <span class="build-object-panel-context__title-text">Billboard (${opts.x}, ${opts.z})</span>
              </div>
              <button type="button" class="build-object-panel__dismiss build-object-panel-context__dismiss build-object-panel-context__dismiss--inline" aria-label="Close">${dismissMarkup}</button>
            </div>
          </div>`;
        objectPanelContextPopover.hidden = false;
        if (bs.canModify) {
          objectPanelContextPopover
            .querySelector(".build-object-panel-context__edit-billboard")
            ?.addEventListener("click", () => bs.onEdit());
          objectPanelContextPopover
            .querySelector(".build-object-panel__move")
            ?.addEventListener("click", () => bs.onMove());
          objectPanelContextPopover
            .querySelector(".build-object-panel__remove")
            ?.addEventListener("click", () => bs.onRemove());
        }
        objectPanelContextPopover
          .querySelector(".build-object-panel-context__dismiss")
          ?.addEventListener("click", () => bs.onClose());
        requestAnimationFrame(() => {
          layoutObjectPanelSatellites();
          requestAnimationFrame(() => layoutObjectPanelSatellites());
        });
        return;
      }
      objectPanelContextPopover.classList.remove(
        "build-object-panel-context--billboard"
      );
      panelOnPropsChange = opts.onPropsChange;
      const gateEdit = opts.gate !== undefined;
      panelObjectEditGate = gateEdit;
      if (gateEdit) {
        panelGateAdminAddress = normalizeWalletKey(opts.gate!.adminAddress);
        panelGateAuthorizedAddresses = opts.gate!.authorizedAddresses.map((a) =>
          normalizeWalletKey(String(a))
        );
        panelOnEditGateAcl =
          "onEditGateAcl" in opts && typeof opts.onEditGateAcl === "function"
            ? opts.onEditGateAcl
            : null;
        panelObjectTileX = opts.x;
        panelObjectTileZ = opts.z;
        panelObjectTileY = Math.max(
          0,
          Math.min(2, Math.floor(Number(opts.y ?? 0)))
        );
        panelGateExitDir =
          opts.gateExitDir !== undefined && Number.isFinite(opts.gateExitDir)
            ? Math.max(0, Math.min(3, Math.floor(opts.gateExitDir)))
            : gateExitDirFromTile(opts.x, opts.z, opts.gate!);
        panelRampDir = Math.max(0, Math.min(3, Math.floor(opts.rampDir)));
      } else {
        panelOnEditGateAcl = null;
      }
      panelSelectedColorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(opts.colorId))
      );
      objectPanel = document.createElement("div");
      objectPanel.className =
        "tile-inspector build-object-panel build-object-panel--rail";
      const lockIcon = opts.locked
        ? '<span class="nq-icon nq-lock-locked build-object-panel__lock-icon" title="This object is locked"></span>'
        : "";
      objectPanel.innerHTML = `
        <div class="build-object-panel__surface">
          <div class="tile-inspector" id="tile-inspector-selection">
            <button type="button" class="tile-inspector__reset-btn" id="panel-tile-inspector-reset">Reset to defaults</button>
          </div>
          <input type="checkbox" class="build-object-panel__hex" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
          <input type="checkbox" class="build-object-panel__pyramid" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
          <input type="checkbox" class="build-object-panel__sphere" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
          <input type="checkbox" class="build-object-panel__ramp" tabindex="-1" aria-hidden="true" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none" />
        </div>
      `;
      objectPanelAdvancedPopover.innerHTML = `
        <div class="build-object-panel-advanced__inner">
          <div class="build-object-panel-adv__icon-toggles" role="toolbar" aria-label="Block options">
            <button type="button" id="panel-adv-collision-toggle" class="build-object-panel-adv__icon-toggle"></button>
            <div class="build-object-panel-adv__lock-wrap" hidden>
              <button type="button" id="panel-adv-lock-toggle" class="build-object-panel-adv__icon-toggle"></button>
            </div>
          </div>
          <div class="build-block-bar__ramp-dir-row build-block-bar__ramp-dir-row--popover" hidden>
            <span class="build-block-bar__ramp-dir-label">Ramp rotation</span>
            <div class="build-block-bar__ramp-dir-controls">
              <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-ccw" title="Rotate counter-clockwise" aria-label="Rotate ramp counter-clockwise">↺</button>
              <button type="button" class="build-block-bar__ramp-rot build-block-bar__ramp-cw" title="Rotate clockwise" aria-label="Rotate ramp clockwise">↻</button>
            </div>
          </div>
        </div>
      `;
      objectPanelContextPopover.innerHTML = `
        <div class="build-object-panel-context__inner">
          <div class="build-object-panel-context__height-row">
            <div class="build-object-panel-context__height-main">
              ${lockIcon}
              <label class="tile-inspector__param build-object-panel-context__height-param" for="panel-tile-inspector-height">
                <span class="tile-inspector__param-label">Height</span>
                <input type="range" id="panel-tile-inspector-height" class="tile-inspector__slider" min="0" max="2" step="1" value="2" aria-valuetext="Full" />
                <span class="tile-inspector__param-value" id="panel-tile-inspector-height-val">1.0 m</span>
              </label>
            </div>
            <button type="button" class="build-object-panel__dismiss build-object-panel-context__dismiss build-object-panel-context__dismiss--inline" aria-label="Close block editor">${nimiqIconUseMarkup("nq-cross", { width: 13, height: 13, class: "build-object-panel__dismiss-icon" })}</button>
          </div>
          <div class="build-object-panel-context__pyramid-base-row" id="panel-tile-inspector-pyramid-base-row" hidden>
            <label class="tile-inspector__param build-object-panel-context__height-param" for="panel-tile-inspector-pyramid-base">
              <span class="tile-inspector__param-label">Pyramid base</span>
              <input type="range" id="panel-tile-inspector-pyramid-base" class="tile-inspector__slider" min="100" max="165" step="5" value="100" aria-valuetext="100%" />
              <span class="tile-inspector__param-value" id="panel-tile-inspector-pyramid-base-val">100%</span>
            </label>
          </div>
          <div class="build-object-panel-context__gate-edit-block" id="panel-gate-edit-block" hidden>
            <div class="build-block-bar__ramp-dir-row build-block-bar__gate-tool-row">
              <span class="build-block-bar__ramp-dir-label">Opening direction</span>
              <div class="build-block-bar__ramp-dir-controls">
                <button type="button" class="build-block-bar__ramp-rot build-block-bar__panel-gate-exit-ccw" title="Rotate opening direction counter-clockwise" aria-label="Rotate gate opening direction counter-clockwise">↺</button>
                <button type="button" class="build-block-bar__ramp-rot build-block-bar__panel-gate-exit-cw" title="Rotate opening direction clockwise" aria-label="Rotate gate opening direction clockwise">↻</button>
              </div>
            </div>
            <div class="build-object-panel-context__gate-acl-bar" id="panel-gate-acl-bar" hidden>
              <span class="build-object-panel-context__gate-acl-summary" id="panel-gate-acl-summary"></span>
              <button type="button" class="build-object-panel__btn build-object-panel__btn--secondary" id="panel-gate-acl-open">Permissions</button>
            </div>
          </div>
          <div class="build-object-panel-context__advanced build-object-panel-context__advanced--row">
            <button type="button" class="build-object-panel__advanced-toggle build-block-bar__advanced-toggle tile-inspector__advanced-link" aria-expanded="false" aria-controls="build-object-panel-advanced">Advanced…</button>
          </div>
          <div class="build-object-panel-context__actions">
            <button type="button" class="build-object-panel__btn build-object-panel__move">Move</button>
            <button type="button" class="build-object-panel__btn build-object-panel__remove">Delete</button>
          </div>
        </div>`;
      objectPanelContextPopover.hidden = false;
      modeSidebarBuildMount.appendChild(objectPanel);
      if (panelShapePopoverAbort) {
        panelShapePopoverAbort.abort();
        panelShapePopoverAbort = null;
      }
      if (panelShapeColorRow) {
        panelShapeColorRow.remove();
        panelShapeColorRow = null;
      }
      panelDockHueWrap = null;
      panelShapeTriggerEl = null;
      panelShapeColorRow = document.createElement("div");
      panelShapeColorRow.className =
        "hud-mode-sidebar__shape-color-row hud-mode-sidebar__shape-color-row--selection";
      const pShapeTrigger = document.createElement("button");
      pShapeTrigger.type = "button";
      pShapeTrigger.className = "hud-mode-sidebar__shape-trigger";
      pShapeTrigger.title = "Block shape";
      pShapeTrigger.setAttribute("aria-haspopup", "dialog");
      pShapeTrigger.setAttribute("aria-expanded", "false");
      pShapeTrigger.setAttribute(
        "aria-controls",
        "build-object-panel-shape-popover"
      );
      pShapeTrigger.innerHTML = `<span class="hud-mode-sidebar__shape-trigger-icon" aria-hidden="true">${SHAPE_TRIG_SVG.cube}</span><span class="hud-mode-sidebar__shape-trigger-label">Cube</span>`;
      panelShapeTriggerEl = pShapeTrigger;
      if (gateEdit) {
        panelShapeTriggerEl.hidden = true;
      }
      panelDockHueWrap = document.createElement("div");
      panelDockHueWrap.className =
        "build-block-bar__hue-ring-wrap hud-mode-sidebar__room-bg-hue-wrap";
      panelDockHueWrap.title = gateEdit
        ? "Gate color. Drag on the ring; selection snaps to the nearest preset."
        : "Color. Drag on the ring; selection snaps to the nearest preset.";
      panelDockHueWrap.innerHTML = `
            <div class="build-block-bar__hue-ring" role="slider" tabindex="0" aria-label="Block color" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0"></div>
            <div class="build-block-bar__hue-core" aria-hidden="true"></div>
          `;
      panelShapeColorRow.appendChild(pShapeTrigger);
      panelShapeColorRow.appendChild(panelDockHueWrap);
      hueDock.insertBefore(panelShapeColorRow, hueDockBlockPreview);
      inspectorPreviewGameRef?.bindInspectorTilePreviewCanvas(
        "selection",
        hueDockBlockPreview.querySelector(
          "#panel-tile-inspector-preview-canvas"
        ) as HTMLCanvasElement | null
      );
      syncHueDockVisibility();
      panelCollisionToggle = objectPanelAdvancedPopover.querySelector(
        "#panel-adv-collision-toggle"
      ) as HTMLButtonElement;
      panelLockToggle = objectPanelAdvancedPopover.querySelector(
        "#panel-adv-lock-toggle"
      ) as HTMLButtonElement;
      lockOptionBlock = objectPanelAdvancedPopover.querySelector(
        ".build-object-panel-adv__lock-wrap"
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
      panelContextHeightRow = objectPanelContextPopover.querySelector(
        ".build-object-panel-context__height-row"
      ) as HTMLElement | null;
      panelGateEditBlock = objectPanelContextPopover.querySelector(
        "#panel-gate-edit-block"
      ) as HTMLElement | null;
      panelGateAclBar = objectPanelContextPopover.querySelector(
        "#panel-gate-acl-bar"
      ) as HTMLElement | null;
      panelGateAclSummaryEl = objectPanelContextPopover.querySelector(
        "#panel-gate-acl-summary"
      ) as HTMLElement | null;
      panelGateAclBtn = objectPanelContextPopover.querySelector(
        "#panel-gate-acl-open"
      ) as HTMLButtonElement | null;
      panelGateExitCCW = objectPanelContextPopover.querySelector(
        ".build-block-bar__panel-gate-exit-ccw"
      ) as HTMLButtonElement | null;
      panelGateExitCW = objectPanelContextPopover.querySelector(
        ".build-block-bar__panel-gate-exit-cw"
      ) as HTMLButtonElement | null;
      if (gateEdit) {
        if (panelContextHeightRow) panelContextHeightRow.hidden = true;
        if (panelGateEditBlock) panelGateEditBlock.hidden = false;
        if (panelGateAclBar) panelGateAclBar.hidden = false;
        if (panelGateAclSummaryEl) {
          const n = panelGateAuthorizedAddresses.length;
          panelGateAclSummaryEl.textContent = `${n} wallet${
            n === 1 ? "" : "s"
          } can open`;
        }
        if (panelGateAclBtn) {
          panelGateAclBtn.disabled = !panelOnEditGateAcl;
          panelGateAclBtn.onclick = panelOnEditGateAcl ?? null;
        }
        if (rampDirRow) rampDirRow.hidden = true;
      } else {
        if (panelGateEditBlock) panelGateEditBlock.hidden = true;
        if (panelGateAclBar) panelGateAclBar.hidden = true;
      }
      panelGateExitCCW?.addEventListener("click", () => {
        panelGateExitDir = (panelGateExitDir - 1 + 4) % 4;
        emitPanelProps();
      });
      panelGateExitCW?.addEventListener("click", () => {
        panelGateExitDir = (panelGateExitDir + 1) % 4;
        emitPanelProps();
      });
      panelHeightBtns = [];
      panelShapeBtns = Array.from(
        panelShapePopover.querySelectorAll(".tile-inspector__shape-btn")
      ) as HTMLButtonElement[];
      panelHexCb = objectPanel.querySelector(
        ".build-object-panel__hex"
      ) as HTMLInputElement;
      panelPyramidCb = objectPanel.querySelector(
        ".build-object-panel__pyramid"
      ) as HTMLInputElement;
      panelSphereCb = objectPanel.querySelector(
        ".build-object-panel__sphere"
      ) as HTMLInputElement;
      panelRampCb = objectPanel.querySelector(
        ".build-object-panel__ramp"
      ) as HTMLInputElement;
      panelAdvancedToggle = objectPanelContextPopover.querySelector(
        ".build-object-panel__advanced-toggle"
      ) as HTMLButtonElement;
      panelHueRingWrap = panelDockHueWrap;
      panelHueRing = panelDockHueWrap.querySelector(
        ".build-block-bar__hue-ring"
      ) as HTMLElement;
      panelHueCore = panelDockHueWrap.querySelector(
        ".build-block-bar__hue-core"
      ) as HTMLElement;
      panelTileInspectorHeightInput = objectPanelContextPopover.querySelector(
        "#panel-tile-inspector-height"
      ) as HTMLInputElement;
      panelTileInspectorHeightVal = objectPanelContextPopover.querySelector(
        "#panel-tile-inspector-height-val"
      ) as HTMLElement;
      panelTileInspectorResetBtn = objectPanel.querySelector(
        "#panel-tile-inspector-reset"
      ) as HTMLButtonElement;
      if (gateEdit) {
        panelTileInspectorResetBtn.hidden = true;
      }
      panelPyramidBaseRow = objectPanelContextPopover.querySelector(
        "#panel-tile-inspector-pyramid-base-row"
      ) as HTMLElement | null;
      panelPyramidBaseInput = objectPanelContextPopover.querySelector(
        "#panel-tile-inspector-pyramid-base"
      ) as HTMLInputElement | null;
      panelPyramidBaseVal = objectPanelContextPopover.querySelector(
        "#panel-tile-inspector-pyramid-base-val"
      ) as HTMLElement | null;
      syncPanelCollisionToggle(gateEdit ? false : opts.passable);
      if (gateEdit && panelCollisionToggle) {
        panelCollisionToggle.hidden = true;
      }
      panelLockedState = opts.locked || false;
      syncPanelLockToggle(panelLockedState);
      if (lockOptionBlock) {
        lockOptionBlock.hidden = !opts.isAdmin;
      }
      if (!gateEdit) {
        syncPanelHeightButtons(opts.quarter, opts.quarter ? false : opts.half);
      }
      panelHexCb.checked = opts.ramp ? false : opts.hex;
      panelPyramidCb.checked = opts.ramp ? false : opts.pyramid;
      panelSphereCb.checked = opts.ramp ? false : opts.sphere;
      panelRampCb.checked = opts.ramp;
      rampDirRow.hidden = !opts.ramp || gateEdit;
      syncPanelPyramidBaseSliderFromScale(opts.pyramidBaseScale ?? 1);
      syncPanelShapeButtons();

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
      syncPanelHueVisualFromColorId(panelSelectedColorId);
      {
        const live = buildLivePanelObstacleProps();
        if (live) inspectorPreviewGameRef?.syncInspectorSelectionTilePreview(live);
      }

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

      panelCollisionToggle!.addEventListener("click", () => {
        syncPanelCollisionToggle(!getPanelPassable());
        emitPanelProps();
      });
      panelLockToggle!.addEventListener("click", () => {
        const next = !getPanelLocked();
        panelLockedState = next;
        syncPanelLockToggle(next);
        emitPanelProps();
      });
      panelTileInspectorHeightInput!.addEventListener("input", () => {
        emitPanelProps();
        syncPanelTileHeightLabel();
      });
      panelPyramidBaseInput?.addEventListener("input", () => {
        if (!panelPyramidBaseInput || !panelPyramidBaseVal) return;
        const raw = Math.min(
          165,
          Math.max(100, Math.floor(Number(panelPyramidBaseInput.value)))
        );
        panelPyramidBaseInput.value = String(raw);
        panelPyramidBaseVal.textContent = `${raw}%`;
        panelPyramidBaseInput.setAttribute("aria-valuetext", `${raw}%`);
        previewInspectorSelectionFromPanel();
      });
      panelPyramidBaseInput?.addEventListener("change", () => {
        schedulePanelPyramidBaseCommit();
      });
      panelPyramidBaseInput?.addEventListener("pointerup", () => {
        schedulePanelPyramidBaseCommit();
      });
      panelPyramidBaseInput?.addEventListener("blur", () => {
        schedulePanelPyramidBaseCommit();
      });
      panelTileInspectorResetBtn!.addEventListener("click", () => {
        if (!panelHexCb || !panelRampCb || !panelPyramidCb || !panelSphereCb) {
          return;
        }
        panelHexCb.checked = false;
        panelPyramidCb.checked = false;
        panelSphereCb.checked = false;
        panelRampCb.checked = false;
        panelRampDir = 0;
        if (rampDirRow) rampDirRow.hidden = true;
        panelSelectedColorId = 0;
        syncPanelHeightButtons(false, false);
        syncPanelShapeButtons();
        syncPanelCollisionToggle(false);
        syncPanelHueVisualFromColorId(0);
        syncPanelPyramidBaseSliderFromScale(1);
        emitPanelProps();
      });
      panelShapePopoverAbort = new AbortController();
      const pShapeSig = panelShapePopoverAbort.signal;
      panelShapeTriggerEl.addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          setPanelShapePopoverOpen(panelShapePopover.hidden);
        },
        { signal: pShapeSig }
      );
      panelShapeTriggerEl.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape" && !panelShapePopover.hidden) {
            e.preventDefault();
            setPanelShapePopoverOpen(false);
          }
        },
        { signal: pShapeSig }
      );
      const rotatePanelRamp = (delta: -1 | 1): void => {
        if (!panelRampCb?.checked) return;
        panelRampDir = (panelRampDir + delta + 4) % 4;
        emitPanelProps();
      };
      panelRampRotCCW!.addEventListener("click", () => rotatePanelRamp(-1));
      panelRampRotCW!.addEventListener("click", () => rotatePanelRamp(1));
      objectPanelContextPopover
        .querySelector(".build-object-panel__move")
        ?.addEventListener("click", () => opts.onMove());
      objectPanelContextPopover
        .querySelector(".build-object-panel__remove")
        ?.addEventListener("click", () => opts.onRemove());
      const dismissPanel = (): void => {
        setPanelAdvancedOpen(false);
        setPanelShapePopoverOpen(false);
        opts.onClose();
      };
      objectPanelContextPopover
        .querySelector(".build-object-panel-context__dismiss")
        ?.addEventListener("click", () => dismissPanel());
      syncBlockPreviewDockSlots();
      requestAnimationFrame(() => {
        layoutObjectPanelSatellites();
        requestAnimationFrame(() => layoutObjectPanelSatellites());
      });
    },
    hideObjectEditPanel() {
      hideObjectEditPanel();
    },
    showGateAclEditor(opts) {
      showGateAclEditor(opts);
    },
    hideGateAclEditor() {
      hideGateAclEditor();
    },
    setTeleporterEditFields(p: {
      destRoomId: string;
      destX: number;
      destZ: number;
    }) {
      if (
        !panelTeleporterRoomNameEl ||
        !panelTeleporterX ||
        !panelTeleporterZ
      ) {
        return;
      }
      const n = normalizeRoomId(p.destRoomId);
      panelTeleporterSelectedRoomId = n;
      teleporterPanelEnsureRowForId?.(n);
      teleporterPanelSyncRoomTrigger?.();
      if (
        panelTeleporterRoomPicker &&
        !panelTeleporterRoomPicker.hidden
      ) {
        teleporterPanelRenderPickerList?.();
      }
      panelTeleporterX.value = String(p.destX);
      panelTeleporterZ.value = String(p.destZ);
      applyTeleporterHubUi?.();
    },
    setObjectPanelProps(p: ObstacleProps) {
      if (p.gate) {
        panelObjectEditGate = true;
        panelGateAdminAddress = normalizeWalletKey(p.gate.adminAddress);
        panelGateAuthorizedAddresses = p.gate.authorizedAddresses.map((a) =>
          normalizeWalletKey(String(a))
        );
        if (p.editorTileX !== undefined && p.editorTileZ !== undefined) {
          panelObjectTileX = p.editorTileX;
          panelObjectTileY = p.editorTileY ?? 0;
          panelObjectTileZ = p.editorTileZ;
        }
        panelGateExitDir =
          p.gateExitDir !== undefined && Number.isFinite(p.gateExitDir)
            ? Math.max(0, Math.min(3, Math.floor(p.gateExitDir)))
            : gateExitDirFromTile(
                panelObjectTileX,
                panelObjectTileZ,
                p.gate
              );
        panelRampDir = Math.max(0, Math.min(3, Math.floor(p.rampDir)));
        panelLockedState = p.locked || false;
        syncPanelLockToggle(panelLockedState);
        panelSelectedColorId = Math.max(
          0,
          Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(p.colorId))
        );
        syncPanelHueVisualFromColorId(panelSelectedColorId);
        if (panelGateAclSummaryEl) {
          const n = panelGateAuthorizedAddresses.length;
          panelGateAclSummaryEl.textContent = `${n} wallet${
            n === 1 ? "" : "s"
          } can open`;
        }
        if (panelGateAclBtn) {
          panelGateAclBtn.disabled = !panelOnEditGateAcl;
          panelGateAclBtn.onclick = panelOnEditGateAcl ?? null;
        }
        if (panelGateEditBlock) panelGateEditBlock.hidden = false;
        if (panelContextHeightRow) panelContextHeightRow.hidden = true;
        if (panelShapeTriggerEl) panelShapeTriggerEl.hidden = true;
        if (panelCollisionToggle) {
          panelCollisionToggle.hidden = true;
          syncPanelCollisionToggle(false);
        }
        if (panelTileInspectorResetBtn) {
          panelTileInspectorResetBtn.hidden = true;
        }
        if (rampDirRow) rampDirRow.hidden = true;
        syncPanelShapeButtons();
        inspectorPreviewGameRef?.syncInspectorSelectionTilePreview(p);
        return;
      }
      panelObjectEditGate = false;
      if (panelGateEditBlock) panelGateEditBlock.hidden = true;
      if (panelGateAclBar) panelGateAclBar.hidden = true;
      if (panelContextHeightRow) panelContextHeightRow.hidden = false;
      if (panelShapeTriggerEl) panelShapeTriggerEl.hidden = false;
      if (panelCollisionToggle) panelCollisionToggle.hidden = false;
      if (panelTileInspectorResetBtn) panelTileInspectorResetBtn.hidden = false;
      syncPanelCollisionToggle(p.passable);
      panelLockedState = p.locked || false;
      syncPanelLockToggle(panelLockedState);
      syncPanelHeightButtons(p.quarter, p.quarter ? false : p.half);
      if (panelHexCb) panelHexCb.checked = p.ramp ? false : p.hex;
      if (panelPyramidCb) {
        panelPyramidCb.checked = p.ramp ? false : p.pyramid;
      }
      if (panelSphereCb) {
        panelSphereCb.checked = p.ramp ? false : p.sphere;
      }
      if (panelRampCb) panelRampCb.checked = p.ramp;
      if (!panelPyramidBaseSliderUiBusy()) {
        syncPanelPyramidBaseSliderFromScale(p.pyramidBaseScale ?? 1);
      }
      panelRampDir = Math.max(0, Math.min(3, Math.floor(p.rampDir)));
      if (rampDirRow) rampDirRow.hidden = !p.ramp;
      syncPanelShapeButtons();
      panelSelectedColorId = Math.max(
        0,
        Math.min(BLOCK_COLOR_COUNT - 1, Math.floor(p.colorId))
      );
      syncPanelHueVisualFromColorId(panelSelectedColorId);
      inspectorPreviewGameRef?.syncInspectorSelectionTilePreview(p);
    },
    rotateRampToward(delta: -1 | 1): boolean {
      if (objectPanel && panelObjectEditGate) {
        panelGateExitDir = (panelGateExitDir + delta + 4) % 4;
        emitPanelProps();
        return true;
      }
      if (
        objectPanel &&
        panelRampCb?.checked &&
        rampDirRow &&
        !rampDirRow.hidden
      ) {
        panelRampDir = (panelRampDir + delta + 4) % 4;
        emitPanelProps();
        return true;
      }
      if (barRampCb.checked && !buildBlockBar.hidden) {
        rotateBarRamp(delta);
        return true;
      }
      if (gateModeActive) {
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
      const hideForObjectEdit = objectPanel !== null;
      buildBlockBar.hidden =
        !state.visible || hideBarForObjectPanel || hideForObjectEdit;
      if (buildBlockBar.hidden) {
        setBarPopoverOpen(false);
        setBarShapePopoverOpen(false);
      }
      syncModeSidebarBodyInteractive();
      syncHueDockVisibility();
      if (state.placementAdmin !== undefined) {
        barExperimentalOnly.hidden = !state.placementAdmin;
        const bbOpt = tileInspectorToolSelect?.querySelector(
          "option[value=\"billboard\"]"
        ) as HTMLOptionElement | null;
        if (bbOpt) {
          const admin = state.placementAdmin === true;
          bbOpt.hidden = !admin;
          bbOpt.disabled = !admin;
          if (!admin && billboardModeActive) {
            activateBuildTool("block");
          }
        }
      }
      syncBarHeightButtons(state.quarter, state.quarter ? false : state.half);
      barHexCb.checked = state.ramp ? false : state.hex;
      barPyramidCb.checked = state.ramp ? false : state.pyramid;
      barSphereCb.checked = state.ramp ? false : state.sphere;
      syncBarPyramidBaseSliderFromScale(state.pyramidBaseScale ?? 1);
      barRampCb.checked = state.ramp;
      barRampDir = Math.max(0, Math.min(3, Math.floor(state.rampDir)));
      barRampDirRow.hidden = !state.ramp && !gateModeActive;
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
    isBillboardModeActive(): boolean {
      return billboardModeActive;
    },
    isTeleporterModeActive(): boolean {
      return teleporterModeActive;
    },
    isGateModeActive(): boolean {
      return gateModeActive;
    },
    showGateContextMenu(
      clientX: number,
      clientY: number,
      opts: { onOpen: () => void }
    ) {
      closeSelfEmojiMenu();
      closeChatLineContextMenu();
      closeOtherPlayerContextMenu();
      closeGateContextMenu();
      gateCtxOpenBtn.onclick = () => {
        closeGateContextMenu();
        opts.onOpen();
      };
      gateCtx.hidden = false;
      requestAnimationFrame(() => {
        const w = gateCtx.offsetWidth || 160;
        const h = gateCtx.offsetHeight || 44;
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = Math.min(Math.max(pad, clientX), vw - w - pad);
        const y = Math.min(Math.max(pad, clientY), vh - h - pad);
        gateCtx.style.left = `${x}px`;
        gateCtx.style.top = `${y}px`;
        gateCtx.style.position = "fixed";
        gateCtxEsc = (e: KeyboardEvent) => {
          if (e.key === "Escape") closeGateContextMenu();
        };
        window.addEventListener("keydown", gateCtxEsc);
        window.addEventListener("pointerdown", onGateCtxOutside, true);
        gateCtxOutsideBound = true;
      });
    },
    hideGateContextMenu() {
      closeGateContextMenu();
    },
    onBuildToolSelect(
      fn: (
        tool: "block" | "signpost" | "teleporter" | "billboard" | "gate"
      ) => void
    ) {
      buildToolChangeHandler = fn;
    },
    deactivateTeleporterMode() {
      activateBuildTool("block");
    },
    deactivateGateMode() {
      activateBuildTool("block");
    },
    deactivateSignpostMode() {
      activateBuildTool("block");
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
    promptBillboardPlace(
      x: number,
      z: number,
      draft?: {
        orientation: "horizontal" | "vertical";
        yawSteps: number;
        advertId: string;
        advertIds: string[];
        intervalSec: number;
        liveChartRange?: NimBillboardChartRange;
        liveChartFallbackAdvertId?: string;
        liveChartRangeCycle?: boolean;
        liveChartCycleIntervalSec?: number;
        billboardSourceTab?: "images" | "other";
      }
    ): void {
      billboardEditTargetId = null;
      billboardPendingTile = { x, z };
      if (billboardModalTitleEl) {
        billboardModalTitleEl.textContent = "Place billboard";
      }
      if (billboardCreateBtn) billboardCreateBtn.textContent = "Place";
      const orient = draft?.orientation ?? "horizontal";
      setBillboardSizeUi(orient);
      resetBillboardRotationFromDraft(draft);
      const lr =
        draft?.liveChartRange === "24h" || draft?.liveChartRange === "7d"
          ? draft.liveChartRange
          : "24h";
      if (billboardChartRangeSelect) billboardChartRangeSelect.value = lr;
      const fb =
        draft?.liveChartFallbackAdvertId &&
        BILLBOARD_ADVERTS_CATALOG.some(
          (a) => a.id === draft.liveChartFallbackAdvertId
        )
          ? draft.liveChartFallbackAdvertId
          : DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID;
      if (billboardChartFallbackSelect) billboardChartFallbackSelect.value = fb;
      if (billboardChartRangeCycleInput) {
        billboardChartRangeCycleInput.checked = Boolean(
          draft?.liveChartRangeCycle
        );
      }
      if (billboardChartCycleIntervalInput) {
        const cs = draft?.liveChartCycleIntervalSec;
        billboardChartCycleIntervalInput.value = String(
          cs !== undefined && Number.isFinite(cs)
            ? Math.max(5, Math.min(300, Math.floor(cs)))
            : 20
        );
      }
      syncBillboardChartCycleUi();
      billboardSourceTab =
        draft?.billboardSourceTab === "other" ? "other" : "images";
      syncBillboardSourceTabUi();
      if (billboardSourceTab === "other") void refreshBillboardChartPreview();
      emitBillboardDraftFromForm();
      billboardOverlay.hidden = false;
    },
    promptBillboardEdit(
      id: string,
      spec: Pick<
        BillboardState,
        "orientation" | "advertId" | "advertIds" | "intervalMs" | "liveChart"
      >
    ): void {
      billboardEditTargetId = id;
      billboardPendingTile = null;
      if (billboardModalTitleEl) {
        billboardModalTitleEl.textContent = "Edit billboard";
      }
      if (billboardCreateBtn) billboardCreateBtn.textContent = "Save";
      setBillboardSizeUi(spec.orientation);
      if (
        spec.liveChart?.range === "24h" ||
        spec.liveChart?.range === "7d"
      ) {
        billboardSourceTab = "other";
        if (billboardChartRangeSelect)
          billboardChartRangeSelect.value = spec.liveChart.range;
        if (billboardChartFallbackSelect) {
          const f = spec.liveChart?.fallbackAdvertId;
          billboardChartFallbackSelect.value =
            f && BILLBOARD_ADVERTS_CATALOG.some((a) => a.id === f)
              ? f
              : DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID;
        }
        if (billboardChartRangeCycleInput) {
          billboardChartRangeCycleInput.checked =
            spec.liveChart.rangeCycle === true;
        }
        if (billboardChartCycleIntervalInput) {
          const cs = spec.liveChart.cycleIntervalSec;
          billboardChartCycleIntervalInput.value = String(
            cs !== undefined && Number.isFinite(cs)
              ? Math.max(5, Math.min(300, Math.floor(cs)))
              : 20
          );
        }
        syncBillboardChartCycleUi();
        syncBillboardSourceTabUi();
        void refreshBillboardChartPreview();
      } else {
        billboardSourceTab = "images";
        syncBillboardSourceTabUi();
        resetBillboardRotationFromDraft({
          advertIds: spec.advertIds,
          advertId: spec.advertId,
          intervalMs: spec.intervalMs,
        });
      }
      emitBillboardDraftFromForm();
      billboardOverlay.hidden = false;
    },
    applyBillboardModalDraft(draft: {
      orientation: "horizontal" | "vertical";
      yawSteps: number;
      advertId: string;
      advertIds: string[];
      intervalSec: number;
      liveChartRange?: NimBillboardChartRange;
      liveChartFallbackAdvertId?: string;
      liveChartRangeCycle?: boolean;
      liveChartCycleIntervalSec?: number;
      billboardSourceTab?: "images" | "other";
    }): void {
      setBillboardSizeUi(draft.orientation);
      resetBillboardRotationFromDraft(draft);
      const lr =
        draft.liveChartRange === "24h" || draft.liveChartRange === "7d"
          ? draft.liveChartRange
          : "24h";
      if (billboardChartRangeSelect) billboardChartRangeSelect.value = lr;
      const fb =
        draft.liveChartFallbackAdvertId &&
        BILLBOARD_ADVERTS_CATALOG.some(
          (a) => a.id === draft.liveChartFallbackAdvertId
        )
          ? draft.liveChartFallbackAdvertId
          : DEFAULT_BILLBOARD_CHART_FALLBACK_ADVERT_ID;
      if (billboardChartFallbackSelect) billboardChartFallbackSelect.value = fb;
      if (billboardChartRangeCycleInput) {
        billboardChartRangeCycleInput.checked = Boolean(
          draft.liveChartRangeCycle
        );
      }
      if (billboardChartCycleIntervalInput) {
        const cs = draft.liveChartCycleIntervalSec;
        billboardChartCycleIntervalInput.value = String(
          cs !== undefined && Number.isFinite(cs)
            ? Math.max(5, Math.min(300, Math.floor(cs)))
            : 20
        );
      }
      syncBillboardChartCycleUi();
      billboardSourceTab =
        draft.billboardSourceTab === "other" ? "other" : "images";
      syncBillboardSourceTabUi();
      if (billboardSourceTab === "other") void refreshBillboardChartPreview();
    },
    onBillboardDraftChange(
      fn: ((
        d: {
          orientation: "horizontal" | "vertical";
          yawSteps: number;
          advertId: string;
          advertIds: string[];
          intervalSec: number;
          liveChartRange: NimBillboardChartRange;
          liveChartFallbackAdvertId: string;
          liveChartRangeCycle: boolean;
          liveChartCycleIntervalSec: number;
          billboardSourceTab: "images" | "other";
        }
      ) => void) | null
    ): void {
      billboardDraftChangeHandler = fn;
    },
    onBillboardPlace(
      fn: (
        x: number,
        z: number,
        opts:
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
            }
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
              liveChart: {
                range: NimBillboardChartRange;
                fallbackAdvertId: string;
                rangeCycle?: boolean;
                cycleIntervalSec?: number;
              };
            }
      ) => void
    ) {
      billboardPlaceHandler = fn;
    },
    onBillboardUpdate(
      fn: (
        id: string,
        opts:
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
            }
          | {
              orientation: "horizontal" | "vertical";
              advertId: string;
              advertIds: string[];
              intervalSec: number;
              liveChart: {
                range: NimBillboardChartRange;
                fallbackAdvertId: string;
                rangeCycle?: boolean;
                cycleIntervalSec?: number;
              };
            }
      ) => void
    ) {
      billboardUpdateHandler = fn;
    },
    showBillboardExternalVisitConfirm(p: {
      url: string;
      displayName: string;
      onConfirm: () => void;
    }): void {
      presentExternalVisitConfirm(p);
    },
    setDebugText(text: string) {
      if (!showDebug) return;
      debugPanel.textContent = text;
    },
    setCanvasLeaderboardVisible(visible: boolean) {
      canvasLeaderboard.hidden = !visible;
    },
    updateCanvasLeaderboard(leaders: Array<{ address: string; bestMs: number }>) {
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
          // Reuse existing entry - update rank/time
          const rank = entry.querySelector(".canvas-leaderboard__rank");
          const count = entry.querySelector(".canvas-leaderboard__count");
          if (rank) rank.textContent = `${i + 1}.`;
          if (count) count.textContent = `${(leader.bestMs / 1000).toFixed(2)}s`;
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
          count.textContent = `${(leader.bestMs / 1000).toFixed(2)}s`;

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
    setLoadingVisible(visible: boolean, opts?: { skipMinWait?: boolean }) {
      if (visible) {
        clearLoadingOverlayTimers();
        loadingOverlay.classList.remove("loading-overlay--fade-out");
        loadingOverlay.hidden = false;
        if (loadingShownAt === null) {
          loadingShownAt = performance.now();
        }
        return;
      }

      const skipMin = opts?.skipMinWait === true;
      if (
        loadingOverlay.hidden &&
        !loadingOverlay.classList.contains("loading-overlay--fade-out")
      ) {
        return;
      }

      clearLoadingOverlayTimers();

      const runFadeOut = (): void => {
        let done = false;
        const complete = (): void => {
          if (done) return;
          done = true;
          if (loadingFadeUnsub) {
            loadingFadeUnsub();
            loadingFadeUnsub = null;
          }
          finishLoadingOverlayDismiss();
        };
        const onTransitionEnd = (ev: TransitionEvent): void => {
          if (ev.target !== loadingOverlay || ev.propertyName !== "opacity") {
            return;
          }
          complete();
        };
        const fallbackTimer = window.setTimeout(complete, LOADING_FADE_FALLBACK_MS);
        loadingOverlay.addEventListener("transitionend", onTransitionEnd);
        loadingFadeUnsub = () => {
          window.clearTimeout(fallbackTimer);
          loadingOverlay.removeEventListener(
            "transitionend",
            onTransitionEnd
          );
        };
        requestAnimationFrame(() => {
          loadingOverlay.classList.add("loading-overlay--fade-out");
        });
      };

      if (skipMin || loadingShownAt === null) {
        runFadeOut();
        return;
      }

      const elapsed = performance.now() - loadingShownAt;
      const remaining = Math.max(0, LOADING_MIN_MS - elapsed);
      if (remaining <= 0) {
        runFadeOut();
        return;
      }
      loadingHideWaitTimer = setTimeout(() => {
        loadingHideWaitTimer = null;
        runFadeOut();
      }, remaining);
    },
    setLoadingLabel(text: string) {
      if (loadingOverlayText) loadingOverlayText.textContent = text;
    },
    setPlayerCount(count: number, roomCount?: number) {
      const countEl = playerCount.querySelector(".hud-player-count__number");
      const tipEl = playerCount.querySelector(
        ".hud-player-count__tooltip"
      ) as HTMLElement | null;
      const room = Number.isFinite(roomCount as number)
        ? Math.max(0, Math.floor(roomCount as number))
        : count;
      if (countEl) {
        if (room === count) {
          countEl.textContent = String(count);
        } else {
          countEl.innerHTML = `<span class="hud-player-count__room-num">${room}</span><span class="hud-player-count__total-wrap" aria-hidden="true"><span class="hud-player-count__total-sep">/</span><span class="hud-player-count__total-num">${count}</span></span>`;
        }
      }
      if (tipEl) {
        tipEl.textContent = `Online now: ${count} total · ${room} in this room.`;
      }
      playerCount.setAttribute(
        "aria-label",
        room === count
          ? `${count} players online`
          : `${room} in this room, ${count} players online total`
      );
      repositionOpenHudStatTips();
    },
    showPlayerJoinedToast(address: string) {
      const normalized = address.replace(/\s+/g, "");
      const compact =
        normalized.length > 8
          ? `${normalized.slice(0, 4)}${normalized.slice(-4)}`
          : normalized;
      if (playerJoinToastText) {
        playerJoinToastText.textContent = `${compact} has entered the space`;
      }
      if (playerJoinToastIdenticon) {
        playerJoinToastIdenticon.hidden = false;
        playerJoinToastIdenticon.removeAttribute("src");
        playerJoinToastIdenticon.dataset.address = address;
        void (async () => {
          try {
            const { identiconDataUrl } = await import("../game/identiconTexture.js");
            const url = await identiconDataUrl(address);
            if (playerJoinToastIdenticon.dataset.address !== address) return;
            playerJoinToastIdenticon.src = url;
          } catch {
            if (playerJoinToastIdenticon.dataset.address === address) {
              playerJoinToastIdenticon.hidden = true;
            }
          }
        })();
      }
      playerJoinToast.hidden = false;
      playerJoinToast.classList.add("hud-player-join-toast--visible");
      if (playerJoinToastTimer) clearTimeout(playerJoinToastTimer);
      playerJoinToastTimer = setTimeout(() => {
        playerJoinToast.classList.remove("hud-player-join-toast--visible");
        playerJoinToast.hidden = true;
        playerJoinToastTimer = null;
      }, 2600);
    },
    onFeedbackSubmit(
      fn: (message: string) => Promise<{ ok: boolean; error?: string }>
    ) {
      feedbackSubmitHandler = fn;
    },
    setNimWalletStatus(status: string) {
      if (nimBalanceValue) {
        nimBalanceValue.textContent = status;
      }
    },
    setBrandLinksPlayerAddress(address: string) {
      brandLinksPlayerAddress = address.replace(/\s+/g, "").trim();
      syncBrandLinksWalletAddressDisplay();
      syncTopBarPlayerIdentity();
      if (!brandLinksOverlay.hidden) {
        syncBrandLinksWalletIdenticon();
      }
    },
    setReconnectOffer(visible: boolean) {
      reconnectBtn.hidden = !visible;
    },
    setServerRestartPendingNotice(p: {
      etaSeconds: number;
      message?: string;
      seq: number;
    }) {
      if (p.seq < restartPendingLastSeq) return;
      restartPendingLastSeq = p.seq;
      const sec = Math.max(
        1,
        Math.min(86400, Math.floor(Number(p.etaSeconds)) || 60)
      );
      restartPendingEndMono = performance.now() + sec * 1000;
      restartDisconnectExpectActive = true;
      if (p.message && p.message.trim()) {
        restartBannerDetail.textContent = p.message.trim();
        restartBannerDetail.hidden = false;
      } else {
        restartBannerDetail.textContent = "";
        restartBannerDetail.hidden = true;
      }
      restartBanner.hidden = false;
      stopRestartBannerTick();
      syncRestartBannerVisual();
      restartBannerTick = setInterval(syncRestartBannerVisual, 400);
      syncHudBelowTopWrap();
    },
    consumeRestartDisconnectForStatus() {
      if (!restartDisconnectExpectActive) return false;
      restartDisconnectExpectActive = false;
      return true;
    },
    onReconnect(fn: () => void) {
      reconnectHandler = fn;
    },
    setNimClaimProgress(
      state: null | { progress: number; adjacent: boolean },
      opts?: { fadeOutMs?: number }
    ) {
      if (nimClaimFadeTimer !== null) {
        clearTimeout(nimClaimFadeTimer);
        nimClaimFadeTimer = null;
      }
      if (!state) {
        const fadeMs = opts?.fadeOutMs;
        if (
          typeof fadeMs === "number" &&
          fadeMs > 0 &&
          !nimClaimBar.hidden &&
          !nimClaimBar.classList.contains("nim-claim-bar--fading")
        ) {
          nimClaimBar.classList.add("nim-claim-bar--fading");
          nimClaimFadeTimer = window.setTimeout(() => {
            nimClaimFadeTimer = null;
            nimClaimBar.classList.remove("nim-claim-bar--fading", "nim-claim-bar--adjacent");
            nimClaimBar.hidden = true;
          }, fadeMs);
          return;
        }
        nimClaimBar.classList.remove("nim-claim-bar--fading", "nim-claim-bar--adjacent");
        nimClaimBar.hidden = true;
        return;
      }
      nimClaimBar.classList.remove("nim-claim-bar--fading");
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
    setCanvasCountdown(text: string | null, msRemaining?: number) {
      if (!text) {
        canvasCountdown.hidden = true;
        return;
      }
      canvasCountdown.textContent = text;
      canvasCountdown.hidden = false;
      if (text === "GO!" || (typeof msRemaining === "number" && msRemaining <= 0)) {
        window.setTimeout(() => {
          if (canvasCountdown.textContent === "GO!") {
            canvasCountdown.hidden = true;
          }
        }, 850);
      }
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
    isPerfHudEnabled() {
      return perfHudEnabled;
    },
    feedPerfHudFrame(now: number) {
      if (!perfHudEnabled || !perfHudFpsEl) return;
      if (perfHudLastNow > 0) {
        const dt = (now - perfHudLastNow) / 1000;
        if (dt > 1e-6) {
          const inst = 1 / dt;
          perfHudFpsSmoothed = perfHudFpsSmoothed * 0.9 + inst * 0.1;
        }
      }
      perfHudLastNow = now;
      perfHudFpsEl.textContent = `${Math.round(perfHudFpsSmoothed)} fps`;
    },
    setPerfHudLatencyMs(ms: number | null) {
      if (!perfHudMsEl) return;
      perfHudMsEl.textContent =
        ms === null || !Number.isFinite(ms) ? "—" : `${Math.round(ms)} ms`;
    },
    bindTileInspectorPreviewGame,
    destroy() {
      stopRestartBannerTick();
      disposeHeaderMarquee();
      clearLoadingOverlayTimers();
      finishLoadingOverlayDismiss();
      if (brandLinksTitleEl) {
        brandLinksTitleEl.removeEventListener("click", onBrandLinksTitleSecretClick);
      }
      setPerfHudEnabled(false);
      bindTileInspectorPreviewGame(null);
      closeSelfEmojiMenu();
      closeOtherPlayerProfile();
      closeOtherPlayerContextMenu();
      closeChatLineContextMenu();
      chatHoverZone.removeEventListener("contextmenu", onChatHoverZoneContextMenu);
      hideBrandLinksOverlay();
      hideFeedbackOverlay();
      if (playerJoinToastTimer) {
        clearTimeout(playerJoinToastTimer);
        playerJoinToastTimer = null;
      }
      if (translateClipboardHintTimer) {
        clearTimeout(translateClipboardHintTimer);
        translateClipboardHintTimer = null;
      }
      clearChatLogCollapseTimers();
      chatHoverZone.removeEventListener("pointerenter", onChatPointerEnter);
      chatHoverZone.removeEventListener("pointerleave", onChatPointerLeave);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("nspace-pseudo-fullscreen-change", onFullscreenChange);
      document.removeEventListener("click", closeHudTooltips);
      document.removeEventListener("pointerdown", closeHudAdvancedPopoversOnOutside);
      setBarShapePopoverOpen(false);
      setPanelShapePopoverOpen(false);
      hideObjectEditPanel();
      hideLobbyConfirm();
      if (nimClaimFadeTimer !== null) {
        clearTimeout(nimClaimFadeTimer);
        nimClaimFadeTimer = null;
      }
      nimClaimBar.classList.remove("nim-claim-bar--fading", "nim-claim-bar--adjacent");
      nimClaimBar.hidden = true;
      canvasCountdown.hidden = true;
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
