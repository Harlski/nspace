import "./nimiqStyleShell.js";
import "./style.css";
import {
  clearCachedSession,
  getTokenExpiryMs,
  isTokenExpired,
  listCachedSessions,
  loadCachedSession,
  removeCachedSession,
  saveCachedSession,
} from "./auth/session.js";
import { CHAMBER_DEFAULT_SPAWN, ROOM_ID, VIEW_FRUSTUM_SIZE } from "./game/constants.js";
import { StreamDirector } from "./stream/streamDirector.js";
import { mountStreamPanDebugPanel } from "./stream/streamPanDebug.js";
import {
  type BlockStyleProps,
  BLOCK_COLOR_EXIT_PORTAL_RGB,
  cubeRotationForPlainCube,
  resolveBlockColorRgb,
} from "./game/blockStyle.js";
import {
  canOpenGateAs,
  isGateAclAdmin,
  normalizeClientGate,
} from "./game/gateAuth.js";
import {
  consumeGameReturnResume,
  markGameReturnResume,
} from "./game/gameReturnResume.js";
import {
  miniappTargetToHttpsUrl,
  openMiniappTarget,
} from "./net/miniappDeepLink.js";
import {
  CAMPAIGN_VIEWER_AFK_MS,
  visibleCampaignIdsNearPlayer,
} from "./game/campaignBillboardVisibility.js";
import { Game } from "./game/Game.js";
// worldcup: seasonal soccer scoreboard + country picker (feature-flagged, deletable)
import {
  WORLDCUP_ENABLED as WORLDCUP_ENABLED_CLIENT,
  FIELD_ROOM_ID as WORLDCUP_FIELD_ROOM_ID,
  isFieldLikeRoomId as worldcupIsFieldLikeRoomId,
  isMatchPitchRoomId as worldcupIsMatchPitchRoomId,
} from "./worldcup/config.js";
import { WorldcupScoreboard } from "./worldcup/scoreboard.js";
import { WorldcupMatchHud } from "./worldcup/matchHud.js";
import { WorldcupMatchCountdown } from "./worldcup/matchCountdown.js";
import { WorldcupJoystick } from "./worldcup/joystick.js";
import { WorldcupBallEdgeMarker } from "./worldcup/ballEdgeMarker.js";
// Country picker + flag emoji are reused for the profile flag / Flag Emote. They are pure UI
// (no season gate), so they are imported unconditionally even when the World Cup is off.
import { flagEmoji } from "./worldcup/countries.js";
import { showCountryPickerModal } from "./worldcup/countryPickerModal.js";
import { isOrthogonallyAdjacentToFloorTile, snapFloorTile } from "./game/grid.js";
import { remotePlayerIsNpc } from "./remotePlayerNpc.js";
import {
  HUB_ROOM_ID,
  CHAMBER_ROOM_ID,
  CANVAS_ROOM_ID,
  PIXEL_ROOM_ID,
  PIXEL_DEFAULT_SPAWN,
  normalizeRoomId,
} from "./game/roomLayouts.js";
import {
  connectGameWs,
  sendChat,
  sendSetCountry,
  sendPlaceBall,
  sendChatTyping,
  sendViewInterest,
  sendClientPing,
  sendNimSendIntent,
  sendBeginBlockClaim,
  sendCreateOfficialRoom,
  sendCreateRoom,
  sendBlockClaimTick,
  sendCompleteBlockClaim,
  sendEnterPortal,
  sendDeleteRoom,
  sendJoinRoom,
  sendListRooms,
  sendRestoreRoom,
  sendUpdateRoom,
  sendMoveObstacle,
  sendMoveTo,
  sendStopMove,
  sendPublishDesign,
  sendDeleteDesign,
  sendUpdateDesignVisibility,
  sendPlaceDesignInRoom,
  sendPlaceBlock,
  type DesignWire,
  sendPlaceBillboard,
  sendUpdateBillboard,
  sendPlacePendingTeleporter,
  sendPlacePendingGate,
  sendOpenGate,
  sendConfigureTeleporter,
  sendPlaceTeleporterBidirectionalPair,
  sendPlaceExtraFloor,
  sendRemoveExtraFloor,
  sendRemoveObstacleAt,
  sendRemoveVoxelText,
  sendSetVoxelText,
  sendSetGateAuthorizedAddresses,
  sendSetObstacleProps,
  sendCampaignImpressions,
  sendCampaignLinkClick,
  sendSetChallenge,
  sendAcceptChallenge,
  sendLeaveMatch,
  sendRequestSpectate,
  sendCancelDirectInvite,
  type ObstacleProps,
  type RoomBackgroundNeutral,
  type ServerMessage,
} from "./net/ws.js";
import { installAdminOverlay } from "./ui/adminOverlay.js";
import { nimToLunaString } from "./ui/objectPrefabAuthoring.js";
import { createHud } from "./ui/hud.js";
import { isPaletteHueHexPopoverTyping } from "./ui/paletteHueHexPopover.js";
import {
  enableNimiqPayViewportLayout,
  initNimiqPayDevEmulation,
  isNimiqPayPortraitDocument,
  isNimiqPayWebViewHost,
  isPseudoFullscreenActive,
  requestMiniAppImmersiveLayout,
  scheduleNimiqPayLayoutResync,
  setPseudoFullscreen,
  tryRequestFullscreen,
  unlockScreenOrientation,
  waitForNimiqPayWebViewHost,
} from "./ui/pseudoFullscreen.js";
import { installInputShell } from "./ui/inputShell.js";
import { formatWalletAddressConnectAs } from "./formatWalletAddress.js";
import { mountPatchnotesPage } from "./patchnotes/mountPatchnotesPage.js";
import { runUsernamePromptGate } from "./auth/usernamePromptGate.js";
import { mountMainMenu } from "./ui/mainMenu.js";
import { nimiqIconUseMarkup } from "./ui/nimiqIcons.js";
import {
  createDirectInvite,
  isInviteLobbyRoomId,
  parseJoinSlugFromPath,
} from "./invite/api.js";
import { pickPlaySpaceTemplateId } from "./invite/playSpaceTemplatePicker.js";
import {
  createDirectInviteLobbyOverlay,
  type DirectInviteLobbyState,
} from "./invite/lobbyOverlay.js";
import {
  resolveRoomsJoinTarget,
  sanitizeRoomsJoinCodeInput,
} from "./invite/playSpaceLayout.js";
import { mountJoinGate } from "./invite/joinGate.js";
import { showGetWalletPrompt } from "./invite/getWalletPrompt.js";
import {
  clearGuestInviteCookie,
  mountGuestPlaySpaceClosedOnboarding,
} from "./invite/walletOnboarding.js";

const DEV_CLIENT_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "1";

/** Let WebGL paint loaded room geometry before lifting the blackout overlay. */
function waitForPaintFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let painted = 0;
    const step = (): void => {
      painted += 1;
      if (painted >= count) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

const GATE_CARDINAL: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function gateExitDirFromNeighbor(
  gx: number,
  gz: number,
  gate: Pick<NonNullable<BlockStyleProps["gate"]>, "exitX" | "exitZ">
): number {
  const dx = gate.exitX - gx;
  const dz = gate.exitZ - gz;
  for (let i = 0; i < 4; i++) {
    const d = GATE_CARDINAL[i]!;
    if (d[0] === dx && d[1] === dz) return i;
  }
  return 0;
}

/** Props for the object panel + selection inspector (includes tile ref for gate preview). */
function placedMetaToPanelObstacleProps(
  x: number,
  z: number,
  y: number,
  m: BlockStyleProps
): ObstacleProps {
  const base: ObstacleProps = {
    passable: m.passable,
    half: m.half,
    quarter: m.quarter,
    hex: m.hex,
    pyramid: m.pyramid,
    pyramidBaseScale: m.pyramidBaseScale ?? 1,
    hexRadiusScale: m.hexRadiusScale ?? 1,
    sphereRadiusScale: m.sphereRadiusScale ?? 1,
    sphere: m.sphere,
    ramp: m.ramp,
    rampDir: m.rampDir,
    ...cubeRotationForPlainCube(
      {
        hex: m.hex,
        pyramid: m.pyramid,
        sphere: m.sphere,
        ramp: m.ramp,
      },
      m
    ),
    colorRgb: m.colorRgb ?? resolveBlockColorRgb(m),
    locked: m.locked || false,
    editorTileX: x,
    editorTileY: y,
    editorTileZ: z,
    ...(m.claimable
      ? { claimable: true, active: m.active !== false }
      : {}),
  };
  if (m.gate) {
    const gw = normalizeClientGate(m.gate);
    return {
      ...base,
      passable: false,
      half: false,
      quarter: false,
      hex: false,
      pyramid: false,
      pyramidBaseScale: 1,
      hexRadiusScale: 1,
      sphere: false,
      sphereRadiusScale: 1,
      ramp: false,
      rampDir: m.rampDir,
      gate: {
        adminAddress: gw.adminAddress,
        authorizedAddresses: [...gw.authorizedAddresses],
        exitX: gw.exitX,
        exitZ: gw.exitZ,
      },
      gateExitDir: gateExitDirFromNeighbor(x, z, gw),
    };
  }
  return base;
}

function teleporterPanelRefreshFromPlaced(
  x: number,
  z: number,
  y: number,
  m: BlockStyleProps,
  currentRoomId: string
): void {
  const tp = m.teleporter;
  if (!tp) return;
  const pending = "pending" in tp && tp.pending;
  const isBidirectionalPair =
    !pending &&
    "pairedPeerKey" in tp &&
    typeof (tp as { pairedPeerKey?: unknown }).pairedPeerKey === "string" &&
    Boolean((tp as { pairedPeerKey: string }).pairedPeerKey) &&
    "targetRoomId" in tp &&
    normalizeRoomId((tp as { targetRoomId: string }).targetRoomId) ===
      normalizeRoomId(currentRoomId);
  hud.refreshTeleporterObjectSelection({
    pending,
    isBidirectionalPair,
    x,
    z,
    y,
  });
  if (!pending && "targetRoomId" in tp) {
    hud.setTeleporterEditFields({
      destRoomId: tp.targetRoomId,
      destX: tp.targetX,
      destZ: tp.targetZ,
    });
  }
  hud.ackTeleporterDestinationBaseline();
}

/** Inactivity: return to chamber home spawn (not lobby). */
const IDLE_RETURN_HUB_MS = 15 * 60 * 1000;
/** Admin wallet addresses (must match server `config.ADMIN_ADDRESSES`). */
const ADMIN_ADDRESSES = new Set([
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
]);

const ADMIN_COMPACT_KEYS = new Set(
  [...ADMIN_ADDRESSES].map((a) => a.replace(/\s+/g, "").toUpperCase())
);

/** Match server `isAdmin`: JWT `sub` may be grouped or compact. */
function isAdmin(address: string): boolean {
  const c = String(address || "").replace(/\s+/g, "").toUpperCase();
  return ADMIN_COMPACT_KEYS.has(c);
}

function compactWallet(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

function canModifyBillboardAsViewer(
  createdBy: string,
  viewerAddress: string
): boolean {
  if (isAdmin(viewerAddress)) return true;
  const owner = String(createdBy ?? "").trim();
  if (!owner) return false;
  return compactWallet(owner) === compactWallet(viewerAddress);
}

/** Lobby reconnect list: cap rows (`saveCachedSession` keeps newest first). */
const MAIN_MENU_MAX_CACHED_ACCOUNTS = 4;

let unmountMainMenu: (() => void) | null = null;
let selfAddress = "";

function startIdleReturnToHub(ms: number, onIdle: () => void): () => void {
  let deadline = Date.now() + ms;
  let t: ReturnType<typeof setTimeout> | null = null;
  let hiddenAt: number | null = null;

  const clearTimer = (): void => {
    if (t) clearTimeout(t);
    t = null;
  };

  const schedule = (): void => {
    clearTimer();
    if (document.hidden) return;
    const remain = Math.max(0, deadline - Date.now());
    t = setTimeout(() => {
      t = null;
      if (document.hidden) return;
      onIdle();
    }, remain);
  };

  const arm = (): void => {
    deadline = Date.now() + ms;
    schedule();
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      hiddenAt = Date.now();
      clearTimer();
    } else {
      if (hiddenAt !== null) {
        deadline += Date.now() - hiddenAt;
        hiddenAt = null;
      } else {
        deadline = Date.now() + ms;
      }
      schedule();
    }
  };

  arm();
  document.addEventListener("visibilitychange", onVisibility, {
    capture: true,
    passive: true,
  });
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  const ev = [
    "pointerdown",
    "pointermove",
    "keydown",
    "wheel",
    "touchstart",
  ] as const;
  for (const e of ev) {
    document.addEventListener(e, arm, opts);
  }
  return () => {
    clearTimer();
    document.removeEventListener("visibilitychange", onVisibility, opts);
    for (const e of ev) {
      document.removeEventListener(e, arm, opts);
    }
  };
}

function loadingLabelForTargetRoom(room: string): string {
  const id = normalizeRoomId(room);
  if (id === HUB_ROOM_ID) return "Loading hub...";
  if (id === CANVAS_ROOM_ID) return "Loading maze...";
  if (id === CHAMBER_ROOM_ID) return "Loading chamber...";
  if (id === PIXEL_ROOM_ID) return "Loading pixel board...";
  // worldcup: entering a 1v1 Match Pitch (as a player or a spectator).
  if (worldcupIsMatchPitchRoomId(id)) return "Entering the match...";
  return "Loading room...";
}

function isPixelRoomId(roomId: string): boolean {
  return normalizeRoomId(roomId) === PIXEL_ROOM_ID;
}

function openMainMenu(): void {
  unlockScreenOrientation();
  const app = document.getElementById("app");
  if (!app) return;
  const cachedEntries = listCachedSessions();
  const menuCachedEntries = cachedEntries.slice(0, MAIN_MENU_MAX_CACHED_ACCOUNTS);
  const cached = loadCachedSession();
  const hasValid = !!(cached && !isTokenExpired(cached.token));
  unmountMainMenu?.();
  unmountMainMenu = mountMainMenu({
    app,
    cachedSessions: menuCachedEntries.map((entry) => ({
      address: entry.address,
      token: entry.token,
      updatedAt: entry.updatedAt,
      expiresAtMs: getTokenExpiryMs(entry.token),
      isExpired: isTokenExpired(entry.token),
      nimiqPay: entry.nimiqPay === true || undefined,
    })),
    authToken:
      hasValid && cached && !isTokenExpired(cached.token) ? cached.token : null,
    devBypass: DEV_CLIENT_BYPASS,
    onReconnect: async (address) => {
      const c = listCachedSessions().find((e) => e.address === address);
      if (!c || isTokenExpired(c.token)) return;
      const np = c.nimiqPay === true;
      saveCachedSession(c.token, c.address, np);
      const ok = await runUsernamePromptGate(c.token, c.address);
      if (!ok) return;
      enterGame(c.token, c.address, np);
    },
    onLoggedIn: async (token, address, nimiqPay, usernamePrompt) => {
      saveCachedSession(token, address, nimiqPay);
      const ok = await runUsernamePromptGate(token, address, usernamePrompt);
      if (!ok) return;
      enterGame(token, address, nimiqPay);
    },
    onLogout: (address) => {
      if (address) removeCachedSession(address);
      else clearCachedSession();
      openMainMenu();
    },
  });
}

function enterGame(
  token: string,
  address: string,
  nimiqPay?: boolean,
  opts?: { initialRoomId?: string; inviteLinkSlug?: string }
): void {
  const app = document.getElementById("app");
  if (!app) return;
  unlockScreenOrientation();
  enableNimiqPayViewportLayout();
  unmountMainMenu?.();
  unmountMainMenu = null;
  app.innerHTML = "";
  const hudRoot = document.createElement("div");
  hudRoot.style.height = "100%";
  app.appendChild(hudRoot);

  const inviteLinkSlug = opts?.inviteLinkSlug?.trim() || null;
  selfAddress = address;
  const query = new URLSearchParams(location.search);
  const showDebugHud = query.has("debug");
  const streamMode = query.has("stream");
  const streamFollow = query.has("streamFollow");
  const streamChat = query.has("streamChat");
  const streamDebug = query.has("streamDebug");
  const streamNoScroll = query.has("noScroll");

  let ws: WebSocket | null = null;
  const perfPingSentAt = new Map<number, number>();
  let perfPingSeq = 0;
  let perfPingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * RTT probes feed both the perf-HUD latency readout (brand-modal easter egg) and the
   * debug-panel latency graph (profile identicon toggle). Either consumer keeps the 1s
   * ping running; the 1s cadence is fine enough to surface periodic stalls (e.g. ~30s
   * payout spikes) in the graph.
   */
  let perfHudPingActive = false;
  let debugPanelPingActive = false;

  function sendPerfPingOnce(): void {
    const s = ws;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    const id = ++perfPingSeq;
    perfPingSentAt.set(id, performance.now());
    sendClientPing(s, id);
    while (perfPingSentAt.size > 8) {
      const k = perfPingSentAt.keys().next().value;
      if (k === undefined) break;
      perfPingSentAt.delete(k);
    }
  }

  function syncPerfPingInterval(): void {
    const want = perfHudPingActive || debugPanelPingActive;
    if (want) {
      if (perfPingInterval !== null) return;
      sendPerfPingOnce();
      perfPingInterval = setInterval(sendPerfPingOnce, 1000);
    } else {
      if (perfPingInterval !== null) {
        clearInterval(perfPingInterval);
        perfPingInterval = null;
      }
      perfPingSentAt.clear();
    }
  }

  /** True after “Send NIM” opened the wallet link until the game tab is focused again. */
  let walletSendNimFlowOpen = false;

  let lastCampaignViewerActivityMs = Date.now();
  const markCampaignViewerActivity = (): void => {
    lastCampaignViewerActivityMs = Date.now();
  };
  const campaignViewerActivityOpts: AddEventListenerOptions = {
    capture: true,
    passive: true,
  };
  const campaignViewerActivityEvents = [
    "pointerdown",
    "pointermove",
    "keydown",
    "wheel",
    "touchstart",
  ] as const;
  for (const ev of campaignViewerActivityEvents) {
    document.addEventListener(ev, markCampaignViewerActivity, campaignViewerActivityOpts);
  }

  let campaignImpressionAccum = new Map<string, number>();
  let lastCampaignImpressionSampleMs = 0;
  const CAMPAIGN_IMPRESSION_SAMPLE_MS = 1000;
  const CAMPAIGN_IMPRESSION_FLUSH_MS = 5000;
  let lastCampaignImpressionFlushMs = 0;

  const campaignViewerCountsAsActive = (): boolean => {
    if (document.hidden || walletSendNimFlowOpen) return false;
    return Date.now() - lastCampaignViewerActivityMs < CAMPAIGN_VIEWER_AFK_MS;
  };

  const flushCampaignImpressions = (nowMs: number): void => {
    if (!ws || ws.readyState !== WebSocket.OPEN || streamMode) return;
    if (campaignImpressionAccum.size === 0) {
      lastCampaignImpressionFlushMs = nowMs;
      return;
    }
    const items = [...campaignImpressionAccum.entries()].map(
      ([campaignId, visibleMs]) => ({
        campaignId,
        visibleMs: Math.min(Math.max(1, Math.floor(visibleMs)), 60_000),
      })
    );
    campaignImpressionAccum.clear();
    lastCampaignImpressionFlushMs = nowMs;
    sendCampaignImpressions(ws, items);
  };

  const sampleCampaignImpressions = (nowMs: number): void => {
    if (!ws || ws.readyState !== WebSocket.OPEN || streamMode) return;
    if (!campaignViewerCountsAsActive()) return;
    const pos = game.getSelfPosition();
    if (!pos) return;
    if (
      lastCampaignImpressionSampleMs > 0 &&
      nowMs - lastCampaignImpressionSampleMs < CAMPAIGN_IMPRESSION_SAMPLE_MS
    ) {
      return;
    }
    const delta =
      lastCampaignImpressionSampleMs > 0
        ? nowMs - lastCampaignImpressionSampleMs
        : CAMPAIGN_IMPRESSION_SAMPLE_MS;
    lastCampaignImpressionSampleMs = nowMs;
    const visible = visibleCampaignIdsNearPlayer(
      game.iterBillboardSpecs(),
      pos.x,
      pos.z,
      nowMs
    );
    for (const campaignId of visible) {
      campaignImpressionAccum.set(
        campaignId,
        (campaignImpressionAccum.get(campaignId) ?? 0) + delta
      );
    }
    if (
      lastCampaignImpressionFlushMs === 0 ||
      nowMs - lastCampaignImpressionFlushMs >= CAMPAIGN_IMPRESSION_FLUSH_MS
    ) {
      flushCampaignImpressions(nowMs);
    }
  };

  function syncAwayPresenceToServer(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const away = document.hidden || walletSendNimFlowOpen;
    sendNimSendIntent(ws, away);
  }

  const sessionNimiqPay = nimiqPay === true;
  const hud = createHud(hudRoot, {
    showDebug: showDebugHud,
    getGameAuthToken: () => token,
    isGameAdmin: () => isAdmin(address),
    didSessionUseNimiqPay: () => sessionNimiqPay,
    playerUsesNimiqPayInRoom: (compactWalletKey) => {
      const k = compactWalletKey.replace(/\s+/g, "").trim().toUpperCase();
      const p = lastPlayers.find(
        (x) =>
          x.address.replace(/\s+/g, "").trim().toUpperCase() === k
      );
      return p?.nimiqPay === true;
    },
    onNimRecipientDeepLinkOpen: () => {
      walletSendNimFlowOpen = true;
      syncAwayPresenceToServer();
    },
    onNimRecipientDeepLinkPopupBlocked: () => {
      walletSendNimFlowOpen = false;
      syncAwayPresenceToServer();
    },
    onPerfHudEnabledChange: (enabled) => {
      perfHudPingActive = enabled;
      syncPerfPingInterval();
    },
    onDebugPanelVisibleChange: (visible) => {
      debugPanelPingActive = visible;
      syncPerfPingInterval();
    },
    // Render a country code as its flag emoji for the profile card + Flag Emote.
    flagEmojiFor: (code) => flagEmoji(code),
    // Self clicked their profile flag chip → open the country picker.
    onEditOwnCountry: () => openCountryPickerForSelf(),
  });
  hud.setLoadingVisible(true, { blackout: true });
  // `?debug` opens the panel at load without firing onDebugPanelVisibleChange; start pings.
  if (hud.isDebugPanelVisible()) {
    debugPanelPingActive = true;
    syncPerfPingInterval();
  }
  // The player's single chosen country (reused from the World Cup). Drives the profile flag
  // chip and the Flag Emote on the player's own Emote Wheel; works regardless of the season.
  let selfCountry: string | null = null;
  function applySelfCountry(code: string | null): void {
    selfCountry = code;
    hud.setSelfCountry(code);
  }
  function openCountryPickerForSelf(): void {
    showCountryPickerModal({
      currentCode: selfCountry,
      dismissable: true,
      onPick: (code) => {
        if (ws) sendSetCountry(ws, code);
        applySelfCountry(code);
      },
    });
  }
  if (isNimiqPayWebViewHost()) {
    scheduleNimiqPayLayoutResync();
  }
  let roomTransitionProgressTimer: ReturnType<typeof setInterval> | null = null;
  function clearRoomTransitionProgressTimer(): void {
    if (roomTransitionProgressTimer !== null) {
      clearInterval(roomTransitionProgressTimer);
      roomTransitionProgressTimer = null;
    }
  }
  /** Black loading screen + progress immediately on room change (before server welcome). */
  function beginRoomTransition(roomId: string, labelOverride?: string): void {
    clearRoomTransitionProgressTimer();
    hud.setLoadingLabel(labelOverride ?? loadingLabelForTargetRoom(roomId));
    hud.setLoadingProgress("indeterminate");
    hud.setLoadingVisible(true);
    let fake = 0.06;
    roomTransitionProgressTimer = setInterval(() => {
      fake = Math.min(0.45, fake + 0.014);
      hud.setLoadingProgress(fake);
    }, 140);
  }
  function bumpRoomLoadProgress(value: number): void {
    hud.setLoadingProgress(Math.max(0, Math.min(1, value)));
  }
  hud.setBrandLinksPlayerAddress(address);
  const canvasHost = hudRoot.querySelector(".canvas-host") as HTMLElement;
  const game = new Game(canvasHost);
  game.setMapOverviewUnlocked(isAdmin(address));
  // worldcup: mount corner-docked worldcup HUD inside the letterbox (the rendered game area)
  // so it stays within game bounds instead of spilling into the black letterbox bars.
  const worldcupHudParent =
    (canvasHost.parentElement as HTMLElement | null) ?? hudRoot;
  // worldcup: seasonal soccer scoreboard (only meaningful in the field room)
  const worldcupScoreboard = WORLDCUP_ENABLED_CLIENT
    ? new WorldcupScoreboard(worldcupHudParent)
    : null;
  if (worldcupScoreboard) {
    worldcupScoreboard.onChangeCountry = (code) => {
      if (ws) sendSetCountry(ws, code);
    };
  }
  let worldcupAutoPromptShown = false;
  // worldcup: 1v1 Match HUD (clock + scores + result) shown only inside a Match Pitch.
  // worldcup: 1v1 Match HUD (clock + scores + result) shown only inside a Match Pitch.
  const worldcupMatchHud = WORLDCUP_ENABLED_CLIENT
    ? new WorldcupMatchHud(worldcupHudParent)
    : null;
  // worldcup: off-screen ball edge chevron for active pitch players.
  const worldcupBallEdgeMarker = WORLDCUP_ENABLED_CLIENT
    ? new WorldcupBallEdgeMarker(worldcupHudParent)
    : null;
  if (worldcupMatchHud) {
    worldcupMatchHud.setSelfAddress(address);
    worldcupMatchHud.onLeave = () => {
      if (ws) sendLeaveMatch(ws);
    };
  }
  /** End post-goal kickoff freeze when HUD countdown or server matchState says play resumes. */
  const finishWorldcupKickoffFreeze = (): void => {
    if (game.isWorldcupMoveLocked()) {
      game.setWorldcupMoveLocked(false);
    }
  };
  // worldcup: pre-teleport handshake countdown overlay (shown in the origin room).
  const worldcupMatchCountdown = WORLDCUP_ENABLED_CLIENT
    ? new WorldcupMatchCountdown()
    : null;
  // worldcup: spectating is no longer a teleport-on-click. You walk onto the portal's
  // footprint tile and press the "Watch" intent pill (see syncPortalEnterButton).
  // worldcup: touch joystick for pitch movement (touch / Nimiq Pay only; coexists with tap-to-move).
  const worldcupJoystickTouchHost =
    (typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches) ||
    isNimiqPayWebViewHost();
  const worldcupJoystick =
    WORLDCUP_ENABLED_CLIENT && worldcupJoystickTouchHost
      ? new WorldcupJoystick()
      : null;
  // The floating joystick is a visual the game positions; Game owns the tap-vs-drag gesture and
  // drives showAt/moveThumbTo/hide from its own pitch pointer pipeline.
  game.setWorldcupJoystickView(worldcupJoystick);
  // Releasing the joystick sends an immediate (un-rate-limited) stop so the player halts at once.
  game.setWorldcupStopMoveHandler(() => {
    const s = ws;
    if (s) sendStopMove(s);
  });
  // True while watching a 1v1 from the stands (fixed position; no joystick/tap movement).
  let worldcupSpectating = false;
  // worldcup: which side's default camera orientation we've applied for the current Match, so the
  // 180-degree default for side a is set once on entry and never fights a manual re-orbit.
  let worldcupAppliedMatchSide: "a" | "b" | null = null;
  const updateWorldcupJoystickVisibility = (): void => {
    game.setWorldcupJoystickEnabled(
      !!worldcupJoystick &&
        worldcupIsFieldLikeRoomId(worldcupCurrentRoomId) &&
        !worldcupSpectating
    );
  };
  // worldcup: local mirror of the open-Challenge toggle + current room (for the donut label).
  let worldcupSelfChallengeOpen = false;
  let directInviteActive = false;
  // Latest Play Space state, kept so the persistent share button can re-open the panel with
  // the current room code / QR after it's been dismissed.
  let lastDirectInviteState: DirectInviteLobbyState | null = null;
  // The Play Space whose share panel we've already auto-opened once (don't re-pop on updates).
  let directInviteAutoShownSlug: string | null = null;
  const directInviteLobby = createDirectInviteLobbyOverlay(hudRoot, {
    onCancel: () => {
      if (ws?.readyState === WebSocket.OPEN) sendCancelDirectInvite(ws);
      directInviteActive = false;
      lastDirectInviteState = null;
      directInviteAutoShownSlug = null;
      hud.setPlaySpaceShareVisible(false);
      directInviteLobby.hide();
    },
    onClose: () => directInviteLobby.hide(),
  });
  // Re-open the share panel from the persistent HUD button (owner + guests).
  const openDirectInviteSharePanel = (): void => {
    if (lastDirectInviteState) directInviteLobby.show(lastDirectInviteState);
  };
  hud.onPlaySpaceShareOpen(openDirectInviteSharePanel);
  let worldcupCurrentRoomId = "";
  // worldcup: scheduled "Entering the match..." loading screen fired when the pre-teleport
  // countdown reaches zero; cleared if a room welcome (or socket close) preempts it.
  let worldcupMatchEnterTimer: ReturnType<typeof setTimeout> | null = null;
  if (streamMode) {
    game.setStreamObserverMode(true);
    game.setStreamBubblesHidden(!streamChat);
  }

  hud.bindTileInspectorPreviewGame(game);
  game.setViewInterestReporter((rect) => {
    if (ws?.readyState === WebSocket.OPEN) {
      sendViewInterest(ws, rect, {
        retainLoaded: game.isStreamPresentationActive(),
      });
    }
  });

  let streamDirector: StreamDirector | null = null;
  let unmountStreamPanDebug: (() => void) | null = null;
  if (streamMode && streamDebug) {
    unmountStreamPanDebug = mountStreamPanDebugPanel(game, hudRoot);
  }

  function resolveInitialRoomId(): string {
    if (opts?.initialRoomId) return normalizeRoomId(opts.initialRoomId);
    const roomParam = query.get("room")?.trim();
    if (roomParam) return normalizeRoomId(roomParam);
    if (streamMode) return PIXEL_ROOM_ID;
    return ROOM_ID;
  }

  function applyStreamPresentation(): void {
    if (!streamMode) return;
    hud.setStreamCinemaMode(true, {
      showChat: streamChat,
      onLayout: () => game.resize(),
    });
    hud.setStreamBroadcastOverlay({
      visible: true,
      subtitle: "Play Nimiq Space at https://nimiq.space",
    });
    game.setStreamPresentationActive(true);
    game.setContinuousRender(true);
    game.setStreamBubblesHidden(!streamChat);
    game.animateZoomFrustumTo(game.getStreamOverviewFrustumSize(), 0);
    const center = game.getRoomLookAtCenter();
    game.setCameraLookAtTarget(center.x, center.y, center.z, { instant: true });
    if (streamFollow) {
      streamDirector?.stop();
      streamDirector = new StreamDirector({
        game,
        selfAddress: address,
        panOverview: !streamNoScroll,
        onFollowBar: (state) => hud.setStreamFollowBar(state),
      });
      streamDirector.start();
    } else if (!streamNoScroll) {
      game.setStreamPanEnabled(true);
    } else {
      game.setStreamPanEnabled(false);
    }
    // Letterbox + room bounds may settle after this tick; refresh stream sizing.
    game.resize();
    requestAnimationFrame(() => {
      game.resize();
    });
  }

  if (streamMode) {
    hud.setStreamCinemaMode(true, { showChat: streamChat });
    hud.setStreamBroadcastOverlay({
      visible: true,
      subtitle: "Play Nimiq Space at https://nimiq.space",
    });
  }
  type KnownRoomRow = {
    id: string;
    displayName: string;
    ownerAddress: string | null;
    playerCount: number;
    isPublic: boolean;
    isBuiltin: boolean;
    isOfficial: boolean;
    canEdit: boolean;
    isDeleted: boolean;
    canDelete: boolean;
    canRestore: boolean;
    backgroundHueDeg: number | null;
    backgroundNeutral: RoomBackgroundNeutral | null;
  };
  type TeleporterDestinationRoomRow = {
    id: string;
    displayName: string;
    isPublic: boolean;
    playerCount: number;
    isOfficial: boolean;
    isBuiltin: boolean;
  };
  let knownRooms: KnownRoomRow[] = [];
  let roomsCatalogTab: "official" | "user" | "admin" | "deleted" = "official";
  /** Client-side page index for the User rooms catalog (4 rooms per page). */
  let roomsUserCatalogPage = 0;
  const USER_ROOMS_PAGE_SIZE = 4;

  function compactWallet(a: string): string {
    return a.replace(/\s+/g, "").toUpperCase();
  }

  /** Stable sort for room labels; avoids `localeCompare` edge cases with emoji / rare Unicode. */
  function safeRoomNameCompare(a: string, b: string): number {
    const as = typeof a === "string" ? a : "";
    const bs = typeof b === "string" ? b : "";
    let cmp = 0;
    try {
      cmp = as.localeCompare(bs, "en", { sensitivity: "accent", numeric: true });
    } catch {
      if (as < bs) return -1;
      if (as > bs) return 1;
      return 0;
    }
    if (cmp !== 0) return cmp;
    return 0;
  }

  function normalizeRoomCatalogDisplayName(
    raw: string | undefined,
    idFallback: string
  ): string {
    const t = typeof raw === "string" ? raw.trim() : "";
    const base = t.length > 0 ? t : idFallback;
    try {
      return base.normalize("NFC");
    } catch {
      return base;
    }
  }

  function viewerOwnsRoom(r: KnownRoomRow): boolean {
    if (!r.ownerAddress) return false;
    return compactWallet(r.ownerAddress) === compactWallet(address);
  }

  /** Hub + owned rooms for players; full catalog (incl. private) for admins — teleporter room picker. */
  function teleporterDestinationRoomOptions(): TeleporterDestinationRoomRow[] {
    const nHub = normalizeRoomId(HUB_ROOM_ID);
    const rowFromKnown = (r: KnownRoomRow): TeleporterDestinationRoomRow => ({
      id: normalizeRoomId(r.id),
      displayName: normalizeRoomCatalogDisplayName(r.displayName, r.id),
      isPublic: r.isPublic,
      playerCount: r.playerCount,
      isOfficial: r.isOfficial,
      isBuiltin: r.isBuiltin,
    });
    if (isAdmin(address)) {
      const out: TeleporterDestinationRoomRow[] = [];
      for (const r of knownRooms) {
        if (r.isDeleted) continue;
        out.push(rowFromKnown(r));
      }
      out.sort((a, b) => {
        if (a.id === nHub) return -1;
        if (b.id === nHub) return 1;
        const c = safeRoomNameCompare(a.displayName, b.displayName);
        if (c !== 0) return c;
        return a.id.localeCompare(b.id);
      });
      return out;
    }
    const hubRow = knownRooms.find((r) => normalizeRoomId(r.id) === nHub);
    const out: TeleporterDestinationRoomRow[] = [
      {
        id: normalizeRoomId(hubRow?.id ?? HUB_ROOM_ID),
        displayName: normalizeRoomCatalogDisplayName(
          hubRow?.displayName,
          "Hub"
        ),
        isPublic: hubRow?.isPublic ?? true,
        playerCount: hubRow?.playerCount ?? 0,
        isOfficial: hubRow?.isOfficial ?? false,
        isBuiltin: hubRow?.isBuiltin ?? true,
      },
    ];
    for (const r of knownRooms) {
      if (r.isDeleted) continue;
      if (normalizeRoomId(r.id) === nHub) continue;
      if (!viewerOwnsRoom(r)) continue;
      out.push(rowFromKnown(r));
    }
    out.sort((a, b) => {
      if (a.id === nHub) return -1;
      if (b.id === nHub) return 1;
      const c = safeRoomNameCompare(a.displayName, b.displayName);
      if (c !== 0) return c;
      return a.id.localeCompare(b.id);
    });
    return out;
  }

  function formatRoomJoinCode(id: string): string {
    return normalizeRoomId(id).toUpperCase();
  }

  const roomsModal = document.createElement("div");
  roomsModal.className = "rooms-modal";
  roomsModal.hidden = true;
  roomsModal.setAttribute("role", "presentation");
  roomsModal.innerHTML = `
    <div class="rooms-modal__dialog" role="dialog" aria-modal="true" aria-label="Browse and join rooms">
      <div class="rooms-modal__body">
        <div id="rooms-view-list" class="rooms-modal__list-view">
          <div class="rooms-modal__catalog-tabs">
            <div class="rooms-modal__tabs" role="tablist" aria-label="Room categories">
              <button type="button" class="rooms-modal__tab rooms-modal__tab--active" id="rooms-tab-official" role="tab" aria-selected="true">Official rooms</button>
              <button type="button" class="rooms-modal__tab" id="rooms-tab-user" role="tab" aria-selected="false">User rooms</button>
              <button type="button" class="rooms-modal__tab" id="rooms-tab-admin" role="tab" aria-selected="false" hidden>Hidden</button>
              <button type="button" class="rooms-modal__tab" id="rooms-tab-deleted" role="tab" aria-selected="false" hidden>Deleted</button>
            </div>
          </div>
            <div class="rooms-modal__list-view-scroll">
            <p class="rooms-modal__section-title" id="rooms-list-heading">Official rooms</p>
            <p id="rooms-modal-current-line" class="rooms-modal__current-line" aria-live="polite"></p>
            <ul class="rooms-modal__list rooms-modal__list--rows rooms-modal__list--catalog" id="rooms-modal-list"></ul>
          </div>
          <div class="rooms-modal__join-code-block" id="rooms-join-panel" hidden>
            <p class="rooms-modal__section-title">Join with code</p>
            <div class="rooms-modal__join-code-row">
              <input class="rooms-modal__input rooms-modal__input--code" id="rooms-join-code" type="text" inputmode="text" maxlength="32" autocomplete="off" placeholder="AB12CD" aria-label="Room code" />
              <button type="button" class="rooms-modal__btn rooms-modal__btn--primary" id="rooms-join-submit">Join</button>
              <span class="rooms-modal__join-status" id="rooms-join-status" hidden aria-live="polite"></span>
            </div>
            <p class="rooms-modal__hint" id="rooms-join-hint" hidden></p>
          </div>
          <div class="rooms-modal__list-footer">
            <div class="rooms-modal__list-footer-start">
              <button type="button" class="rooms-modal__btn" id="rooms-open-join" aria-expanded="false" aria-controls="rooms-join-panel">Join Room</button>
              <button type="button" class="rooms-modal__btn rooms-modal__btn--primary rooms-modal__create-launch" id="rooms-open-create">Create a room</button>
            </div>
            <div id="rooms-user-pagination" class="rooms-modal__user-pagination" hidden>
              <button type="button" class="rooms-modal__btn rooms-modal__btn--compact" id="rooms-user-page-prev">Previous</button>
              <span class="rooms-modal__user-page-label" id="rooms-user-page-label" aria-live="polite"></span>
              <button type="button" class="rooms-modal__btn rooms-modal__btn--compact" id="rooms-user-page-next">Next</button>
            </div>
          </div>
        </div>
        <div id="rooms-view-edit" hidden>
          <div class="rooms-modal__edit-head">
            <button type="button" class="rooms-modal__back" id="rooms-edit-back">← Back</button>
            <p class="rooms-modal__section-title">Edit room</p>
            <p class="rooms-modal__fineprint">Room code: <strong id="rooms-edit-code"></strong></p>
          </div>
          <label class="rooms-modal__label" for="rooms-edit-name">Name</label>
          <input class="rooms-modal__input rooms-modal__input--full" id="rooms-edit-name" type="text" maxlength="48" autocomplete="off" />
          <div id="rooms-edit-public-row">
            <label class="rooms-modal__check">
              <input type="checkbox" id="rooms-edit-public" />
              <span>Show in public room list</span>
            </label>
          </div>
          <div id="rooms-edit-delete-block" class="rooms-modal__edit-delete" hidden>
            <p class="rooms-modal__fineprint" id="rooms-edit-delete-msg"></p>
            <input
              class="rooms-modal__input rooms-modal__input--full rooms-modal__input--delete-confirm"
              id="rooms-edit-delete-confirm"
              type="text"
              autocomplete="off"
              spellcheck="false"
              aria-label="Type DELETE to confirm"
            />
            <p class="rooms-modal__hint" id="rooms-edit-delete-err" hidden></p>
          </div>
          <div class="rooms-modal__edit-actions">
            <button type="button" class="rooms-modal__btn rooms-modal__btn--danger" id="rooms-edit-delete" hidden disabled>DELETE</button>
            <button type="button" class="rooms-modal__btn rooms-modal__btn--primary" id="rooms-edit-save">Save</button>
          </div>
          <p class="rooms-modal__hint" id="rooms-edit-hint" hidden></p>
        </div>
      </div>
    </div>
  `;
  hudRoot.appendChild(roomsModal);

  const roomsCreateModal = document.createElement("div");
  roomsCreateModal.className = "rooms-modal rooms-create-modal";
  roomsCreateModal.hidden = true;
  roomsCreateModal.setAttribute("role", "presentation");
  roomsCreateModal.innerHTML = `
    <div class="rooms-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="rooms-create-modal-title">
      <button type="button" class="rooms-modal__close" id="rooms-create-modal-close" aria-label="Close">${nimiqIconUseMarkup("nq-close", { width: 20, height: 20, class: "rooms-modal__close-icon" })}</button>
      <div class="rooms-modal__header">
        <h2 class="rooms-modal__title" id="rooms-create-modal-title">Create a room</h2>
      </div>
      <div class="rooms-modal__body rooms-create-modal__body">
        <button type="button" class="rooms-modal__back" id="rooms-create-modal-back">← Back</button>
        <p class="rooms-modal__fineprint">New rooms get a random 6-character code (e.g. AB12CD). Max size 30×30 tiles.</p>
        <label class="rooms-modal__label" for="rooms-create-name">Name</label>
        <input class="rooms-modal__input rooms-modal__input--full" id="rooms-create-name" type="text" maxlength="48" autocomplete="off" placeholder="Your room name" required />
        <div class="rooms-modal__create-grid">
          <label class="rooms-modal__label" for="rooms-create-w">Width</label>
          <label class="rooms-modal__label" for="rooms-create-h">Height</label>
          <input class="rooms-modal__input rooms-modal__input--w" id="rooms-create-w" type="number" min="5" max="30" value="16" />
          <input class="rooms-modal__input rooms-modal__input--w" id="rooms-create-h" type="number" min="5" max="30" value="16" />
        </div>
        <label class="rooms-modal__check">
          <input type="checkbox" id="rooms-create-public" checked />
          <span>Show in public room list</span>
        </label>
        <div id="rooms-create-official-row" class="rooms-modal__create-official-row" hidden>
          <label class="rooms-modal__check">
            <input type="checkbox" id="rooms-create-official" />
            <span>Create as official room (listed under Official rooms; does not use your personal room limit)</span>
          </label>
        </div>
        <div class="rooms-modal__create-actions">
          <button type="button" class="rooms-modal__btn rooms-modal__btn--primary" id="rooms-create-submit">Create &amp; enter</button>
        </div>
        <p class="rooms-modal__hint" id="rooms-create-hint" hidden></p>
      </div>
    </div>
  `;
  hudRoot.appendChild(roomsCreateModal);

  const roomsModalList = roomsModal.querySelector("#rooms-modal-list") as HTMLUListElement;
  const roomsModalCurrentLine = roomsModal.querySelector(
    "#rooms-modal-current-line"
  ) as HTMLParagraphElement;
  const roomsListHeading = roomsModal.querySelector("#rooms-list-heading") as HTMLElement;
  const roomsTabOfficialBtn = roomsModal.querySelector("#rooms-tab-official") as HTMLButtonElement;
  const roomsTabUserBtn = roomsModal.querySelector("#rooms-tab-user") as HTMLButtonElement;
  const roomsTabAdminBtn = roomsModal.querySelector("#rooms-tab-admin") as HTMLButtonElement;
  const roomsTabDeletedBtn = roomsModal.querySelector("#rooms-tab-deleted") as HTMLButtonElement;
  const roomsViewList = roomsModal.querySelector("#rooms-view-list") as HTMLElement;
  const roomsUserPagination = roomsModal.querySelector(
    "#rooms-user-pagination"
  ) as HTMLDivElement;
  const roomsUserPagePrev = roomsModal.querySelector(
    "#rooms-user-page-prev"
  ) as HTMLButtonElement;
  const roomsUserPageNext = roomsModal.querySelector(
    "#rooms-user-page-next"
  ) as HTMLButtonElement;
  const roomsUserPageLabel = roomsModal.querySelector(
    "#rooms-user-page-label"
  ) as HTMLSpanElement;
  const roomsViewEdit = roomsModal.querySelector("#rooms-view-edit") as HTMLElement;
  const roomsJoinCodeInput = roomsModal.querySelector("#rooms-join-code") as HTMLInputElement;
  const roomsJoinSubmitBtn = roomsModal.querySelector("#rooms-join-submit") as HTMLButtonElement;
  const roomsJoinHint = roomsModal.querySelector("#rooms-join-hint") as HTMLParagraphElement;
  const roomsJoinStatus = roomsModal.querySelector("#rooms-join-status") as HTMLSpanElement;
  const roomsJoinPanel = roomsModal.querySelector("#rooms-join-panel") as HTMLDivElement;
  const roomsOpenJoinBtn = roomsModal.querySelector("#rooms-open-join") as HTMLButtonElement;
  const roomsOpenCreateBtn = roomsModal.querySelector("#rooms-open-create") as HTMLButtonElement;
  const roomsCreateModalClose = roomsCreateModal.querySelector(
    "#rooms-create-modal-close"
  ) as HTMLButtonElement;
  const roomsCreateModalBack = roomsCreateModal.querySelector(
    "#rooms-create-modal-back"
  ) as HTMLButtonElement;
  const roomsCreateNameInput = roomsCreateModal.querySelector(
    "#rooms-create-name"
  ) as HTMLInputElement;
  const roomsCreateWInput = roomsCreateModal.querySelector(
    "#rooms-create-w"
  ) as HTMLInputElement;
  const roomsCreateHInput = roomsCreateModal.querySelector(
    "#rooms-create-h"
  ) as HTMLInputElement;
  const roomsCreatePublicInput = roomsCreateModal.querySelector(
    "#rooms-create-public"
  ) as HTMLInputElement;
  const roomsCreateOfficialRow = roomsCreateModal.querySelector(
    "#rooms-create-official-row"
  ) as HTMLDivElement;
  const roomsCreateOfficialInput = roomsCreateModal.querySelector(
    "#rooms-create-official"
  ) as HTMLInputElement;
  const roomsCreateSubmitBtn = roomsCreateModal.querySelector(
    "#rooms-create-submit"
  ) as HTMLButtonElement;
  const roomsCreateHint = roomsCreateModal.querySelector(
    "#rooms-create-hint"
  ) as HTMLParagraphElement;
  const roomsEditBackBtn = roomsModal.querySelector("#rooms-edit-back") as HTMLButtonElement;
  const roomsEditCodeEl = roomsModal.querySelector("#rooms-edit-code") as HTMLElement;
  const roomsEditNameInput = roomsModal.querySelector("#rooms-edit-name") as HTMLInputElement;
  const roomsEditPublicRow = roomsModal.querySelector("#rooms-edit-public-row") as HTMLElement;
  const roomsEditPublicInput = roomsModal.querySelector("#rooms-edit-public") as HTMLInputElement;
  const roomsEditSaveBtn = roomsModal.querySelector("#rooms-edit-save") as HTMLButtonElement;
  const roomsEditDeleteBtn = roomsModal.querySelector("#rooms-edit-delete") as HTMLButtonElement;
  const roomsEditHint = roomsModal.querySelector("#rooms-edit-hint") as HTMLParagraphElement;
  const roomsEditDeleteBlock = roomsModal.querySelector("#rooms-edit-delete-block") as HTMLElement;
  const roomsEditDeleteMsg = roomsModal.querySelector("#rooms-edit-delete-msg") as HTMLParagraphElement;
  const roomsEditDeleteConfirmInput = roomsModal.querySelector(
    "#rooms-edit-delete-confirm"
  ) as HTMLInputElement;
  const roomsEditDeleteErr = roomsModal.querySelector("#rooms-edit-delete-err") as HTMLParagraphElement;

  let roomsEscHandler: ((e: KeyboardEvent) => void) | null = null;
  let roomsViewState: "list" | "edit" = "list";
  let roomsEditingRoomId: string | null = null;
  /** Set when joining via the code field; cleared on result or modal/ws reset. */
  let pendingModalJoinRoomId: string | null = null;
  /** Set when joining from a player profile room row; cleared on result. */
  let pendingProfileJoinRoomId: string | null = null;
  /** After Create & enter is sent; cleared on welcome, failure chat, or closing the create modal. */
  let pendingCreateRoomAwaiting = false;

  function clearRoomsJoinProgress(): void {
    pendingModalJoinRoomId = null;
    roomsJoinSubmitBtn.disabled = false;
    roomsJoinStatus.hidden = true;
    roomsJoinStatus.textContent = "";
    roomsJoinStatus.classList.remove(
      "rooms-modal__join-status--loading",
      "rooms-modal__join-status--error"
    );
  }

  function showRoomsView(next: "list" | "edit"): void {
    roomsViewState = next;
    roomsViewList.hidden = next !== "list";
    roomsViewEdit.hidden = next !== "edit";
    if (next === "edit") {
      roomsEditHint.hidden = true;
      roomsEditHint.textContent = "";
    }
    if (next !== "edit") {
      resetEditDeleteUi();
    }
  }

  function resetEditDeleteUi(): void {
    roomsEditDeleteBlock.hidden = true;
    roomsEditDeleteMsg.innerHTML = "";
    roomsEditDeleteConfirmInput.value = "";
    roomsEditDeleteBtn.disabled = true;
    roomsEditDeleteErr.hidden = true;
    roomsEditDeleteErr.textContent = "";
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeRoomsCreateModal(): void {
    pendingCreateRoomAwaiting = false;
    roomsCreateSubmitBtn.disabled = false;
    if (!roomsCreateModal.hidden) {
      roomsCreateModal.hidden = true;
    }
  }

  function openRoomsCreateModal(): void {
    roomsCreateNameInput.value = "";
    roomsCreateWInput.value = "16";
    roomsCreateHInput.value = "16";
    roomsCreatePublicInput.checked = true;
    roomsCreateOfficialInput.checked = false;
    roomsCreateOfficialRow.hidden = !isAdmin(address);
    roomsCreateHint.hidden = true;
    roomsCreateHint.textContent = "";
    roomsCreateSubmitBtn.disabled = false;
    roomsCreateModal.hidden = false;
  }

  function closeRoomsModal(opts?: { keepJoinPending?: boolean }): void {
    closeRoomsCreateModal();
    if (roomsModal.hidden) return;
    roomsModal.hidden = true;
    setRoomsJoinPanelOpen(false);
    showRoomsView("list");
    roomsEditingRoomId = null;
    resetEditDeleteUi();
    if (!opts?.keepJoinPending) {
      clearRoomsJoinProgress();
    }
    if (roomsEscHandler) {
      document.removeEventListener("keydown", roomsEscHandler);
      roomsEscHandler = null;
    }
  }

  roomsTabAdminBtn.hidden = !isAdmin(address);
  roomsTabDeletedBtn.hidden = !isAdmin(address);

  function applyRoomsTabUi(tab: "official" | "user" | "admin" | "deleted"): void {
    if ((tab === "admin" || tab === "deleted") && !isAdmin(address)) {
      tab = "official";
    }
    roomsCatalogTab = tab;
    roomsTabOfficialBtn.classList.toggle("rooms-modal__tab--active", tab === "official");
    roomsTabUserBtn.classList.toggle("rooms-modal__tab--active", tab === "user");
    roomsTabAdminBtn.classList.toggle("rooms-modal__tab--active", tab === "admin");
    roomsTabDeletedBtn.classList.toggle("rooms-modal__tab--active", tab === "deleted");
    roomsTabOfficialBtn.setAttribute("aria-selected", tab === "official" ? "true" : "false");
    roomsTabUserBtn.setAttribute("aria-selected", tab === "user" ? "true" : "false");
    roomsTabAdminBtn.setAttribute("aria-selected", tab === "admin" ? "true" : "false");
    roomsTabDeletedBtn.setAttribute("aria-selected", tab === "deleted" ? "true" : "false");
    if (tab === "official") {
      roomsListHeading.textContent = "Official rooms";
    } else if (tab === "user") {
      roomsListHeading.textContent = "User rooms";
    } else if (tab === "deleted") {
      roomsListHeading.textContent = "Deleted rooms";
    } else {
      roomsListHeading.textContent = "Hidden rooms (other players' private)";
    }
  }

  function setRoomsCatalogTab(tab: "official" | "user" | "admin" | "deleted"): void {
    if (tab === "user" && roomsCatalogTab !== "user") {
      roomsUserCatalogPage = 0;
    }
    applyRoomsTabUi(tab);
    renderRoomsModalList();
  }

  roomsTabOfficialBtn.addEventListener("click", () => setRoomsCatalogTab("official"));
  roomsTabUserBtn.addEventListener("click", () => setRoomsCatalogTab("user"));
  roomsTabAdminBtn.addEventListener("click", () => setRoomsCatalogTab("admin"));
  roomsTabDeletedBtn.addEventListener("click", () => setRoomsCatalogTab("deleted"));

  roomsEditDeleteConfirmInput.addEventListener("input", () => {
    let v = roomsEditDeleteConfirmInput.value.toUpperCase().replace(/[^A-Z]/g, "");
    if (v.length > 6) v = v.slice(0, 6);
    roomsEditDeleteConfirmInput.value = v;
    roomsEditDeleteBtn.disabled = v !== "DELETE";
  });

  function setRoomsJoinPanelOpen(open: boolean): void {
    roomsJoinPanel.hidden = !open;
    roomsOpenJoinBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
      roomsJoinCodeInput.value = "";
      roomsJoinHint.hidden = true;
      roomsJoinHint.textContent = "";
      clearRoomsJoinProgress();
      return;
    }
    requestAnimationFrame(() => {
      roomsJoinCodeInput.focus();
      roomsJoinCodeInput.select();
    });
  }

  function openRoomsModal(): void {
    closeRoomsCreateModal();
    setRoomsJoinPanelOpen(false);
    clearRoomsJoinProgress();
    roomsModal.hidden = false;
    showRoomsView("list");
    applyRoomsTabUi("official");
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendListRooms(ws);
    }
    renderRoomsModalList();
    roomsEscHandler = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (!roomsCreateModal.hidden) {
        closeRoomsCreateModal();
        return;
      }
      if (roomsViewState === "edit") {
        showRoomsView("list");
        roomsEditingRoomId = null;
        return;
      }
      closeRoomsModal();
    };
    document.addEventListener("keydown", roomsEscHandler);
  }

  function openEditRoom(roomId: string): void {
    const n = normalizeRoomId(roomId);
    const room = knownRooms.find((x) => normalizeRoomId(x.id) === n);
    if (!room || !room.canEdit) return;
    roomsEditingRoomId = roomId;
    const isBuiltin = room.isBuiltin;
    roomsEditCodeEl.textContent = isBuiltin
      ? room.id
      : formatRoomJoinCode(room.id);
    roomsEditNameInput.value = room.displayName;
    roomsEditPublicRow.hidden = false;
    roomsEditPublicInput.checked = room.isPublic;
    const canDelete = Boolean(room.canDelete && !room.isBuiltin);
    roomsEditDeleteBtn.hidden = !canDelete;
    if (canDelete) {
      roomsEditDeleteBlock.hidden = false;
      const label =
        room.displayName?.trim().length
          ? `${room.displayName.trim()} (${formatRoomJoinCode(roomId)})`
          : formatRoomJoinCode(roomId);
      const safe = escapeHtml(label);
      roomsEditDeleteMsg.innerHTML = `Are you sure you want to delete room:<br><b>${safe}</b><br><br>Type <span class="rooms-modal__delete-word">DELETE</span> to confirm.`;
      roomsEditDeleteConfirmInput.value = "";
      roomsEditDeleteBtn.disabled = true;
      roomsEditDeleteErr.hidden = true;
      roomsEditDeleteErr.textContent = "";
    } else {
      roomsEditDeleteBlock.hidden = true;
    }
    showRoomsView("edit");
  }

  roomsModal.addEventListener("click", (e) => {
    if (e.target === roomsModal) closeRoomsModal();
  });

  roomsUserPagePrev.addEventListener("click", () => {
    if (roomsUserCatalogPage > 0) {
      roomsUserCatalogPage -= 1;
      renderRoomsModalList();
    }
  });
  roomsUserPageNext.addEventListener("click", () => {
    roomsUserCatalogPage += 1;
    renderRoomsModalList();
  });

  roomsJoinCodeInput.addEventListener("input", () => {
    roomsJoinCodeInput.value = sanitizeRoomsJoinCodeInput(roomsJoinCodeInput.value);
    if (roomsJoinStatus.textContent === "Room not found") {
      roomsJoinStatus.hidden = true;
      roomsJoinStatus.textContent = "";
      roomsJoinStatus.classList.remove("rooms-modal__join-status--error");
    }
  });

  roomsJoinSubmitBtn.addEventListener("click", () => {
    roomsJoinHint.hidden = true;
    roomsJoinHint.textContent = "";
    const raw = roomsJoinCodeInput.value.trim();
    if (!raw) {
      roomsJoinHint.textContent = "Enter a 6-character code or room id.";
      roomsJoinHint.hidden = false;
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const roomIdToJoin = resolveRoomsJoinTarget(
      raw,
      knownRooms.map((r) => r.id)
    );
    if (!roomIdToJoin) {
      roomsJoinHint.textContent = "Enter a valid room code or id.";
      roomsJoinHint.hidden = false;
      return;
    }
    pendingModalJoinRoomId = roomIdToJoin;
    roomsJoinSubmitBtn.disabled = true;
    roomsJoinStatus.hidden = false;
    roomsJoinStatus.textContent = "Looking up room…";
    roomsJoinStatus.classList.remove("rooms-modal__join-status--error");
    roomsJoinStatus.classList.add("rooms-modal__join-status--loading");
    sendJoinRoom(ws, roomIdToJoin);
  });

  roomsOpenJoinBtn.addEventListener("click", () => {
    setRoomsJoinPanelOpen(roomsJoinPanel.hidden);
  });

  roomsOpenCreateBtn.addEventListener("click", () => openRoomsCreateModal());

  roomsCreateModalClose.addEventListener("click", () => closeRoomsCreateModal());
  roomsCreateModalBack.addEventListener("click", () => closeRoomsCreateModal());
  roomsCreateModal.addEventListener("click", (e) => {
    if (e.target === roomsCreateModal) closeRoomsCreateModal();
  });

  roomsCreateSubmitBtn.addEventListener("click", () => {
    roomsCreateHint.hidden = true;
    roomsCreateHint.textContent = "";
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const w = Number(roomsCreateWInput.value);
    const h = Number(roomsCreateHInput.value);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      roomsCreateHint.textContent = "Width and height must be numbers.";
      roomsCreateHint.hidden = false;
      return;
    }
    if (w < 5 || h < 5 || w > 30 || h > 30) {
      roomsCreateHint.textContent = "Width and height must be between 5 and 30.";
      roomsCreateHint.hidden = false;
      return;
    }
    const nameRaw = roomsCreateNameInput.value.trim();
    const asOfficial = isAdmin(address) && roomsCreateOfficialInput.checked;
    if (!nameRaw) {
      roomsCreateHint.textContent = "Enter a room name.";
      roomsCreateHint.hidden = false;
      return;
    }
    pendingCreateRoomAwaiting = true;
    roomsCreateSubmitBtn.disabled = true;
    roomsCreateHint.textContent = "Creating room…";
    roomsCreateHint.hidden = false;
    if (asOfficial) {
      sendCreateOfficialRoom(ws, w, h, {
        displayName: nameRaw,
        isPublic: roomsCreatePublicInput.checked,
      });
    } else {
      sendCreateRoom(ws, w, h, {
        displayName: nameRaw,
        isPublic: roomsCreatePublicInput.checked,
      });
    }
  });

  roomsEditBackBtn.addEventListener("click", () => {
    roomsEditingRoomId = null;
    showRoomsView("list");
  });

  roomsEditSaveBtn.addEventListener("click", () => {
    roomsEditHint.hidden = true;
    roomsEditHint.textContent = "";
    if (!ws || ws.readyState !== WebSocket.OPEN || !roomsEditingRoomId) return;
    const name = roomsEditNameInput.value.trim();
    if (!name) {
      roomsEditHint.textContent = "Enter a room name.";
      roomsEditHint.hidden = false;
      return;
    }
    const editing = knownRooms.find((x) => x.id === roomsEditingRoomId);
    const basePatch = {
      displayName: name,
      isPublic: roomsEditPublicInput.checked,
    };
    if (editing?.isBuiltin) {
      sendUpdateRoom(ws, roomsEditingRoomId, basePatch);
    } else {
      sendUpdateRoom(ws, roomsEditingRoomId, basePatch);
    }
    showRoomsView("list");
    roomsEditingRoomId = null;
  });

  roomsEditDeleteBtn.addEventListener("click", () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !roomsEditingRoomId) return;
    if (roomsEditDeleteConfirmInput.value !== "DELETE") return;
    roomsEditDeleteErr.hidden = true;
    sendDeleteRoom(ws, roomsEditingRoomId);
  });

  function renderRoomsModalList(): void {
    roomsModalList.innerHTML = "";
    const currentId = normalizeRoomId(game.getRoomId());
    const currentRoomMeta = knownRooms.find(
      (r) => normalizeRoomId(r.id) === currentId
    );
    if (currentId) {
      const displayName = currentRoomMeta?.displayName?.trim().length
        ? currentRoomMeta.displayName.trim()
        : formatRoomJoinCode(currentId);
      roomsModalCurrentLine.textContent = `Currently in ${displayName}`;
    } else {
      roomsModalCurrentLine.textContent = "";
    }

    const filtered = knownRooms.filter((r) => {
      if (normalizeRoomId(r.id) === currentId) return false;
      if (roomsCatalogTab === "deleted") {
        return isAdmin(address) && r.isDeleted;
      }
      if (r.isDeleted) return false;
      if (roomsCatalogTab === "official") return r.isBuiltin || r.isOfficial;
      if (roomsCatalogTab === "user") {
        if (r.isBuiltin || r.isOfficial) return false;
        return r.isPublic || viewerOwnsRoom(r);
      }
      if (roomsCatalogTab === "admin") {
        if (!isAdmin(address)) return false;
        if (r.isBuiltin) return false;
        return !r.isPublic && !viewerOwnsRoom(r);
      }
      return false;
    });
    const officialBuiltinOrder = ["hub", "canvas", "chamber"];
    if (roomsCatalogTab === "official") {
      filtered.sort((a, b) => {
        const na = normalizeRoomId(a.id);
        const nb = normalizeRoomId(b.id);
        const ia = officialBuiltinOrder.indexOf(na);
        const ib = officialBuiltinOrder.indexOf(nb);
        if (ia !== -1 || ib !== -1) {
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          if (ia !== ib) return ia - ib;
        }
        const c = safeRoomNameCompare(a.displayName, b.displayName);
        if (c !== 0) return c;
        return a.id.localeCompare(b.id);
      });
    } else if (roomsCatalogTab === "user") {
      filtered.sort((a, b) => {
        const pc =
          Math.max(0, Math.floor(b.playerCount)) -
          Math.max(0, Math.floor(a.playerCount));
        if (pc !== 0) return pc;
        const c = safeRoomNameCompare(a.displayName, b.displayName);
        if (c !== 0) return c;
        return a.id.localeCompare(b.id);
      });
    }

    if (roomsCatalogTab === "user" && filtered.length > 0) {
      const totalPages = Math.ceil(filtered.length / USER_ROOMS_PAGE_SIZE);
      if (roomsUserCatalogPage >= totalPages) roomsUserCatalogPage = totalPages - 1;
      if (roomsUserCatalogPage < 0) roomsUserCatalogPage = 0;
    }

    roomsUserPagination.hidden = true;
    if (roomsCatalogTab === "user" && filtered.length > USER_ROOMS_PAGE_SIZE) {
      const totalPages = Math.ceil(filtered.length / USER_ROOMS_PAGE_SIZE);
      roomsUserPagination.hidden = false;
      roomsUserPageLabel.textContent = `${roomsUserCatalogPage + 1} / ${totalPages}`;
      roomsUserPagePrev.disabled = roomsUserCatalogPage <= 0;
      roomsUserPageNext.disabled = roomsUserCatalogPage >= totalPages - 1;
    }

    const roomsToShow =
      roomsCatalogTab === "user"
        ? filtered.slice(
            roomsUserCatalogPage * USER_ROOMS_PAGE_SIZE,
            roomsUserCatalogPage * USER_ROOMS_PAGE_SIZE + USER_ROOMS_PAGE_SIZE
          )
        : filtered;

    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "rooms-modal__empty";
      empty.textContent =
        roomsCatalogTab === "user"
          ? "No user rooms in this list yet. Create one from the button below."
          : roomsCatalogTab === "admin"
            ? "No other players' private rooms."
            : roomsCatalogTab === "deleted"
              ? "No deleted rooms."
              : "No rooms to show.";
      roomsModalList.appendChild(empty);
      return;
    }
    for (const room of roomsToShow) {
      appendRoomCatalogRow(roomsModalList, room, {
        showJoinButton: true,
      });
    }
  }

  function appendRoomCatalogRow(
    ul: HTMLUListElement,
    room: KnownRoomRow,
    opts: { showJoinButton: boolean }
  ): void {
    const { showJoinButton } = opts;
    const li = document.createElement("li");
    li.className = "rooms-modal__row rooms-modal__row--line";
    const nameCell = document.createElement("div");
    nameCell.className = "rooms-modal__cell rooms-modal__cell--name";
    if (room.isDeleted) {
      const prefix = document.createElement("span");
      prefix.className = "rooms-modal__badge rooms-modal__badge--deleted";
      prefix.textContent = "[D]";
      nameCell.appendChild(prefix);
      nameCell.appendChild(document.createTextNode(" "));
    }
    const nameEl = document.createElement("span");
    nameEl.className = "rooms-modal__cell-name-text";
    nameEl.textContent = room.displayName;
    nameCell.appendChild(nameEl);
    if (!room.isDeleted && !room.isPublic) {
      const badge = document.createElement("span");
      badge.className = "rooms-modal__badge rooms-modal__badge--private";
      badge.textContent = "Pvt";
      nameCell.appendChild(badge);
    }
    const ownerCell = document.createElement("div");
    ownerCell.className = "rooms-modal__cell rooms-modal__cell--owner";
    if (room.ownerAddress) {
      const addr = room.ownerAddress.trim();
      const img = document.createElement("img");
      img.className = "rooms-modal__owner-ident rooms-modal__owner-ident--sm";
      img.alt = "";
      img.width = 24;
      img.height = 24;
      img.dataset.address = addr;
      const label = document.createElement("span");
      label.className = "rooms-modal__owner-label";
      label.textContent = formatWalletAddressConnectAs(addr);
      ownerCell.appendChild(img);
      ownerCell.appendChild(label);
      void (async (): Promise<void> => {
        try {
          const { identiconDataUrl } = await import("./game/identiconTexture.js");
          const url = await identiconDataUrl(addr);
          if (img.dataset.address !== addr) return;
          img.src = url;
        } catch {
          img.hidden = true;
        }
      })();
    } else {
      const official = document.createElement("span");
      official.className = "rooms-modal__cell--owner-official";
      official.textContent = "—";
      ownerCell.appendChild(official);
    }
    const playersCell = document.createElement("div");
    playersCell.className = "rooms-modal__cell rooms-modal__cell--players";
    const n = room.playerCount;
    playersCell.textContent = String(n);
    playersCell.title = `${n} player${n === 1 ? "" : "s"} in room`;
    const actions = document.createElement("div");
    actions.className = "rooms-modal__cell rooms-modal__cell--actions";
    if (room.isDeleted && room.canRestore) {
      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.className =
        "rooms-modal__btn rooms-modal__btn--compact rooms-modal__btn--restore";
      restoreBtn.textContent = "Restore";
      restoreBtn.addEventListener("click", () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        sendRestoreRoom(ws, room.id);
      });
      actions.appendChild(restoreBtn);
    } else if (showJoinButton) {
      const join = document.createElement("button");
      join.type = "button";
      join.className = "rooms-modal__join rooms-modal__join--inline";
      join.textContent = "Join";
      join.addEventListener("click", () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (normalizeRoomId(game.getRoomId()) === normalizeRoomId(room.id)) return;
        beginRoomTransition(room.id);
        sendJoinRoom(ws, room.id);
        closeRoomsModal();
      });
      actions.appendChild(join);
      if (room.canEdit) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "rooms-modal__btn rooms-modal__btn--compact";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openEditRoom(room.id));
        actions.appendChild(editBtn);
      }
    } else {
      if (room.canEdit) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "rooms-modal__btn rooms-modal__btn--compact";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openEditRoom(room.id));
        actions.appendChild(editBtn);
      }
    }
    li.appendChild(nameCell);
    li.appendChild(ownerCell);
    li.appendChild(playersCell);
    li.appendChild(actions);
    ul.appendChild(li);
  }

  hud.onRoomsOpen(() => openRoomsModal());
  const syncGuestToolbarMode = (): void => {
    hud.setGuestToolbarMode(
      selfAddress.startsWith("guest:") || inviteLinkSlug !== null
    );
  };
  syncGuestToolbarMode();
  hud.onGetWalletOpen(() => {
    showGetWalletPrompt({ onWebWallet: () => openMainMenu() });
  });
  hud.onProfileRoomJoin((roomId) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (normalizeRoomId(game.getRoomId()) === normalizeRoomId(roomId)) return;
    pendingProfileJoinRoomId = roomId;
    beginRoomTransition(roomId);
    sendJoinRoom(ws, roomId);
  });
  const adminOverlay = installAdminOverlay(hudRoot, game, {
    roomId: ROOM_ID,
    enabled: isAdmin(address),
    onSetVoxelText: (spec) => {
      if (!ws) return;
      sendSetVoxelText(ws, spec);
    },
    onRemoveVoxelText: (roomId, id) => {
      if (!ws) return;
      sendRemoveVoxelText(ws, roomId, id);
    },
    onInspectorPreviewLayoutChange: () => {
      hud.refreshBuildDockToolStrip();
    },
  });

  const uninstallShell = installInputShell(hudRoot);

  const isCoarsePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  const screenOrientation = (screen as Screen & {
    orientation?: {
      lock?: (type: string) => Promise<void>;
      addEventListener?: (type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => void;
    };
  }).orientation;
  let orientationRetryTimer: ReturnType<typeof setInterval> | null = null;

  const lockLandscape = (): void => {
    if (isNimiqPayWebViewHost() || !isCoarsePointer || !screenOrientation?.lock) return;
    void screenOrientation.lock("landscape").catch(() => {});
  };

  const ensureGameLandscape = (): void => {
    if (isNimiqPayWebViewHost() || !isCoarsePointer || disposed) return;
    const fullscreenEl = document.fullscreenElement;
    const isGameFullscreen =
      isPseudoFullscreenActive() ||
      (!!fullscreenEl &&
        (fullscreenEl === hudRoot ||
          fullscreenEl === app ||
          fullscreenEl === document.documentElement ||
          fullscreenEl === document.body ||
          app.contains(fullscreenEl)));
    if (!isGameFullscreen) {
      void tryRequestFullscreen(hudRoot).then((entered) => {
        if (entered) lockLandscape();
        else lockLandscape();
      });
      return;
    }
    lockLandscape();
  };

  const startLandscapeRetries = (): void => {
    if (isNimiqPayWebViewHost() || !isCoarsePointer) return;
    if (orientationRetryTimer) clearInterval(orientationRetryTimer);
    let attempts = 0;
    orientationRetryTimer = setInterval(() => {
      attempts += 1;
      ensureGameLandscape();
      if (attempts >= 10) {
        if (orientationRetryTimer) clearInterval(orientationRetryTimer);
        orientationRetryTimer = null;
      }
    }, 700);
  };

  requestAnimationFrame(() => {
    ensureGameLandscape();
    startLandscapeRetries();
  });

  let lastPlayers: import("./types.js").PlayerState[] = [];
  let totalOnlinePlayers = 0;
  function roomRealPlayerCount(players: import("./types.js").PlayerState[]): number {
    return players.filter((p) => !p.displayName.startsWith("[NPC] ")).length;
  }

  // worldcup: in the Free Play Field, the crowd waves the flags of the players currently present
  // (distinct countries). Recomputed whenever the roster or someone's country changes.
  function refreshWorldcupCrowdRoster(): void {
    if (!WORLDCUP_ENABLED_CLIENT) return;
    if (normalizeRoomId(worldcupCurrentRoomId) !== WORLDCUP_FIELD_ROOM_ID) return;
    const codes = new Set<string>();
    for (const p of lastPlayers) {
      const c = (p.worldcupCountry ?? "").trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(c)) codes.add(c);
    }
    game.setWorldcupCrowdRoster([...codes]);
  }

  function syncPlayerCountHud(): void {
    const roomCount = roomRealPlayerCount(lastPlayers);
    const total = Math.max(totalOnlinePlayers, roomCount);
    hud.setPlayerCount(total, roomCount);
  }

  /** From server welcome; aligned with canEditRoomContent. */
  let roomAllowPlaceBlocks = true;
  let roomAllowExtraFloor = true;
  /** From server welcome; who may change dynamic room background hue. */
  let welcomeAllowRoomBackgroundHueEdit = false;
  /** From server welcome; who may set wallet-room guest join tile (`joinSpawn`). */
  let welcomeAllowRoomJoinSpawnEdit = false;
  let welcomeAllowPublishDesign = false;
  /** Last welcome `roomBackgroundHueDeg` (undefined = built-in / omitted). */
  let latestWelcomeBackgroundHueDeg: number | null | undefined = undefined;
  /** Last welcome `roomBackgroundNeutral` (undefined = built-in / omitted). */
  let latestWelcomeBackgroundNeutral:
    | RoomBackgroundNeutral
    | null
    | undefined = undefined;
  let editingTile: { x: number; z: number; y: number } | null = null;
  let portalEnterVisible = false;
  let portalAction:
    | { kind: "door" }
    | { kind: "canvas-exit" }
    | { kind: "teleporter" }
    | { kind: "spectate"; matchId: string; full: boolean }
    | {
        kind: "billboard";
        billboardId: string;
        campaignId?: string;
        visitUrl: string;
        visitName: string;
        miniappTargetUrl?: string;
      }
    | null = null;
  let connectGen = 0;
  /** Cleared when `welcome` arrives or the socket closes; avoids infinite loading if the server never responds. */
  let welcomeDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  const clearWelcomeDeadlineTimer = (): void => {
    if (welcomeDeadlineTimer !== null) {
      clearTimeout(welcomeDeadlineTimer);
      welcomeDeadlineTimer = null;
    }
  };
  let cancelActiveNimClaim: (() => void) | null = null;
  /** Active claimable-block UI session (aligned with server begin → complete flow). */
  let nimClaimUiRef: {
    blockX: number;
    blockZ: number;
    /** Stack level in `blockKey` (0..2). */
    blockY: number;
    claimId: string | null;
    holdMs: number;
    rewardHoldSince: number | null;
    completeSent: boolean;
  } | null = null;
  /** Extra delay before complete so server tick accumulation reaches holdMs. */
  const NIM_CLAIM_COMPLETE_SLACK_MS = 550;
  /** Hide the NIM reward hint if the player stays away from the block this long. */
  const NIM_CLAIM_AWAY_DISMISS_MS = 4500;

  let disposed = false;
  let rafId = 0;
  let idleCleanup: (() => void) | null = null;
  const ac = new AbortController();
  const { signal } = ac;

  let chatTypingSent = false;
  let chatTypingIdleTimer: ReturnType<typeof setTimeout> | null = null;
  const clearChatTypingIdle = (): void => {
    if (chatTypingIdleTimer !== null) {
      clearTimeout(chatTypingIdleTimer);
      chatTypingIdleTimer = null;
    }
  };
  const notifyChatNotTyping = (): void => {
    clearChatTypingIdle();
    if (ws && ws.readyState === WebSocket.OPEN && chatTypingSent) {
      sendChatTyping(ws, false);
    }
    chatTypingSent = false;
  };
  let chatInput: HTMLInputElement | null = null;
  const onChatComposing = (): void => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!chatInput) return;
    if (chatInput.value.trim().length < 1) {
      notifyChatNotTyping();
      return;
    }
    if (!chatTypingSent) {
      sendChatTyping(ws, true);
      chatTypingSent = true;
    }
    clearChatTypingIdle();
    chatTypingIdleTimer = setTimeout(() => {
      chatTypingIdleTimer = null;
      notifyChatNotTyping();
    }, 2500);
  };

  /** When the game API is down, backing off avoids spamming the Vite proxy (ECONNREFUSED every 30s). */
  let nimWalletPollTimer: ReturnType<typeof setTimeout> | null = null;
  let nimWalletPollStarted = false;
  let nimWalletPollFailStreak = 0;
  const NIM_WALLET_POLL_OK_MS = 30_000;
  const NIM_WALLET_POLL_FAIL_BASE_MS = 45_000;
  const NIM_WALLET_POLL_FAIL_MAX_MS = 300_000;

  document.addEventListener(
    "fullscreenchange",
    () => {
      ensureGameLandscape();
      startLandscapeRetries();
    },
    { signal }
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        walletSendNimFlowOpen = false;
      }
      syncAwayPresenceToServer();
      if (document.hidden) return;
      if (isNimiqPayWebViewHost()) {
        unlockScreenOrientation();
        enableNimiqPayViewportLayout();
        scheduleNimiqPayLayoutResync();
        return;
      }
      ensureGameLandscape();
      startLandscapeRetries();
    },
    { signal }
  );
  window.addEventListener(
    "focus",
    () => {
      ensureGameLandscape();
      startLandscapeRetries();
    },
    { signal }
  );
  screenOrientation?.addEventListener?.(
    "change",
    () => {
      ensureGameLandscape();
    },
    { signal }
  );

  function cleanupResources(): void {
    clearWelcomeDeadlineTimer();
    setPseudoFullscreen(false);
    notifyChatNotTyping();
    if (nimWalletPollTimer !== null) {
      clearTimeout(nimWalletPollTimer);
      nimWalletPollTimer = null;
    }
    if (orientationRetryTimer) {
      clearInterval(orientationRetryTimer);
      orientationRetryTimer = null;
    }
    idleCleanup?.();
    idleCleanup = null;
    clearRoomTransitionProgressTimer();
    cancelActiveNimClaim?.();
    cancelActiveNimClaim = null;
    nimClaimUiRef = null;
    hud.setNimClaimProgress(null);
    flushCampaignImpressions(Date.now());
    for (const ev of campaignViewerActivityEvents) {
      document.removeEventListener(
        ev,
        markCampaignViewerActivity,
        campaignViewerActivityOpts
      );
    }
    cancelAnimationFrame(rafId);
    ac.abort();
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      ws.close();
    }
    ws = null;
    adminOverlay.destroy();
    game.dispose();
    uninstallShell();
    roomsCreateModal.remove();
    roomsModal.remove();
    hud.destroy();
  }

  function disposeToMenu(): void {
    if (disposed) return;
    const appEl = document.getElementById("app");
    const fsEl = document.fullscreenElement;
    const restoreFullscreen =
      !!appEl &&
      !!fsEl &&
      (appEl.contains(fsEl) ||
        fsEl === document.documentElement ||
        fsEl === document.body);
    disposed = true;
    cleanupResources();
    openMainMenu();
    if (restoreFullscreen && appEl) {
      requestAnimationFrame(() => {
        void tryRequestFullscreen(appEl).catch(() => {});
      });
    }
  }

  function redirectGuestToWalletOnboarding(message: string): void {
    const actor = selfAddress.startsWith("guest:") ? selfAddress : address;
    if (!actor.startsWith("guest:")) {
      hud.setStatus(message);
      return;
    }
    if (disposed) return;
    disposed = true;
    cleanupResources();
    clearCachedSession();
    clearGuestInviteCookie();
    const appEl = document.getElementById("app");
    if (!appEl) return;
    mountGuestPlaySpaceClosedOnboarding(appEl, {
      message,
      onWebWallet: () => openMainMenu(),
    });
  }

  const syncReturnHomeButton = (): void => {
    hud.setReturnHomeVisible(
      normalizeRoomId(game.getRoomId()) !== CHAMBER_ROOM_ID
    );
  };

  async function updateCanvasLeaderboard(): Promise<void> {
    const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    hud.setCanvasLeaderboardVisible(isCanvas);
    if (!isCanvas) return;
    
    try {
      const { resolveApiBaseUrl } = await import("./net/apiBase.js");
      const base = resolveApiBaseUrl() || "";
      const url = `${base}/api/canvas/leaderboard`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[canvas] Leaderboard fetch failed: ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json() as {
        leaderboard: Array<{ address: string; bestMs: number }>;
      };
      hud.updateCanvasLeaderboard(data.leaderboard);
    } catch (err) {
      console.error("[canvas] Failed to fetch leaderboard:", err);
    }
  }

  /** @returns true if the HTTP API responded successfully (HUD updated). */
  async function updateNimWalletStatus(): Promise<boolean> {
    try {
      const { resolveApiBaseUrl } = await import("./net/apiBase.js");
      const base = resolveApiBaseUrl() || "";
      const url = `${base}/api/nim/payout-balance`;
      const res = await fetch(url);
      if (!res.ok) {
        hud.setNimWalletStatus("unavailable");
        return false;
      }
      const data = (await res.json()) as {
        configured: boolean;
        hasNim: boolean;
        balanceNim: string;
        _devProxyBackendDown?: boolean;
      };
      if (data._devProxyBackendDown) {
        hud.setNimWalletStatus("unavailable");
        return false;
      }
      if (!data.configured || !data.hasNim) {
        hud.setNimWalletStatus("No more NIM to earn :(");
        return true;
      }
      hud.setNimWalletStatus(data.balanceNim);
      return true;
    } catch {
      hud.setNimWalletStatus("unavailable");
      return false;
    }
  }

  function ensureNimWalletPollStarted(): void {
    if (nimWalletPollStarted || disposed) return;
    nimWalletPollStarted = true;
    scheduleNextNimWalletPoll(0);
  }

  function scheduleNextNimWalletPoll(delayMs: number): void {
    if (nimWalletPollTimer !== null) {
      clearTimeout(nimWalletPollTimer);
      nimWalletPollTimer = null;
    }
    if (disposed) return;
    nimWalletPollTimer = setTimeout(() => {
      nimWalletPollTimer = null;
      void (async () => {
        if (disposed) return;
        const ok = await updateNimWalletStatus();
        if (disposed) return;
        if (ok) {
          nimWalletPollFailStreak = 0;
          scheduleNextNimWalletPoll(NIM_WALLET_POLL_OK_MS);
        } else {
          nimWalletPollFailStreak = Math.min(nimWalletPollFailStreak + 1, 8);
          const exp = Math.max(0, nimWalletPollFailStreak - 1);
          const backoff = Math.min(
            NIM_WALLET_POLL_FAIL_BASE_MS * 2 ** exp,
            NIM_WALLET_POLL_FAIL_MAX_MS
          );
          scheduleNextNimWalletPoll(backoff);
        }
      })();
    }, delayMs);
  }

  function playModeFromGame(): "walk" | "build" | "floor" {
    if (game.getFloorExpandMode()) return "floor";
    if (game.getBuildMode()) return "build";
    return "walk";
  }

  function removeSelectedPlacedObject(): void {
    if (!ws) return;
    const sel = game.getSelectedBlockTile();
    const t = sel ?? editingTile;
    if (!t) return;
    game.setTeleporterDestPickHandler(null);
    sendRemoveObstacleAt(ws, t.x, t.z, t.y);
    editingTile = null;
    hud.hideObjectEditPanel();
    game.clearSelectedBlock();
    syncBuildHud();
  }

  function canEditCurrentRoomBackgroundHue(
    row: KnownRoomRow | undefined
  ): boolean {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (welcomeAllowRoomBackgroundHueEdit) return true;
    const actor = selfAddress.trim() !== "" ? selfAddress : address;
    const rid = normalizeRoomId(game.getRoomId());
    if (
      rid === HUB_ROOM_ID ||
      rid === CHAMBER_ROOM_ID ||
      rid === CANVAS_ROOM_ID ||
      rid === PIXEL_ROOM_ID
    ) {
      return isAdmin(actor);
    }
    if (!row) {
      return isAdmin(actor);
    }
    if (row.isDeleted || row.isBuiltin) return false;
    if (isAdmin(actor)) return true;
    if (row.isOfficial) return false;
    return viewerOwnsRoom(row);
  }

  const ROOM_BG_HUE_THROTTLE_MS = 100;
  let roomHueThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  let roomHueThrottlePending: number | null = null;

  function clearRoomHueThrottleTimer(): void {
    if (roomHueThrottleTimer !== null) {
      clearTimeout(roomHueThrottleTimer);
      roomHueThrottleTimer = null;
    }
  }

  function flushRoomHueThrottleSend(): void {
    clearRoomHueThrottleTimer();
    if (roomHueThrottlePending === null) return;
    const deg = roomHueThrottlePending;
    roomHueThrottlePending = null;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    sendUpdateRoom(ws, normalizeRoomId(game.getRoomId()), {
      backgroundHueDeg: deg,
    });
  }

  function scheduleRoomHueSend(deg: number): void {
    roomHueThrottlePending = deg;
    if (roomHueThrottleTimer !== null) return;
    roomHueThrottleTimer = setTimeout(() => {
      roomHueThrottleTimer = null;
      if (roomHueThrottlePending === null) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        roomHueThrottlePending = null;
        return;
      }
      sendUpdateRoom(ws, normalizeRoomId(game.getRoomId()), {
        backgroundHueDeg: roomHueThrottlePending,
      });
      roomHueThrottlePending = null;
    }, ROOM_BG_HUE_THROTTLE_MS);
  }

  function syncRoomBackgroundHuePanel(): void {
    const rid = normalizeRoomId(game.getRoomId());
    const row = knownRooms.find((r) => normalizeRoomId(r.id) === rid);
    const isCanvas = rid === CANVAS_ROOM_ID;
    const isPixel = rid === PIXEL_ROOM_ID;
    const isBuiltInPlaySpace =
      rid === HUB_ROOM_ID || rid === CHAMBER_ROOM_ID || rid === CANVAS_ROOM_ID;
    const dynamicRoom = !isBuiltInPlaySpace;
    const actor = selfAddress.trim() !== "" ? selfAddress : address;
    const isAdminViewer = isAdmin(actor);
    const allowHue = canEditCurrentRoomBackgroundHue(row);
    const show =
      allowHue &&
      ((isCanvas && isAdminViewer) ||
        (isPixel && isAdminViewer) ||
        (game.getFloorExpandMode() &&
          roomAllowExtraFloor &&
          !isCanvas &&
          !isPixel &&
          (dynamicRoom || rid === HUB_ROOM_ID || rid === CHAMBER_ROOM_ID)));
    hud.setRoomBackgroundHuePanelVisible(show);
    if (!show) return;
    let ringHue: number | null = null;
    let panelNeutral: RoomBackgroundNeutral | null = null;
    if (row) {
      panelNeutral = row.backgroundNeutral;
      if (
        typeof row.backgroundHueDeg === "number" &&
        Number.isFinite(row.backgroundHueDeg)
      ) {
        ringHue = row.backgroundHueDeg;
      }
    } else {
      if (latestWelcomeBackgroundNeutral !== undefined) {
        panelNeutral = latestWelcomeBackgroundNeutral;
      }
      if (latestWelcomeBackgroundHueDeg !== undefined) {
        ringHue =
          latestWelcomeBackgroundHueDeg === null
            ? null
            : latestWelcomeBackgroundHueDeg;
      }
    }
    hud.syncRoomBackgroundHueRing(ringHue, panelNeutral);
  }

  function syncRoomEntrySpawnPanel(): void {
    const rid = normalizeRoomId(game.getRoomId());
    const isCanvas = rid === CANVAS_ROOM_ID;
    const isBuiltInPlaySpace =
      rid === HUB_ROOM_ID || rid === CHAMBER_ROOM_ID || rid === CANVAS_ROOM_ID;
    const dynamicRoom = !isBuiltInPlaySpace;
    const actor = selfAddress.trim() !== "" ? selfAddress : address;
    const isAdminViewer = isAdmin(actor);
    const allowJoinSpawn = welcomeAllowRoomJoinSpawnEdit;
    const wsOpen = ws?.readyState === WebSocket.OPEN;
    const show =
      allowJoinSpawn &&
      wsOpen &&
      ((isCanvas && isAdminViewer) ||
        (game.getFloorExpandMode() &&
          roomAllowExtraFloor &&
          !isCanvas &&
          (dynamicRoom || rid === HUB_ROOM_ID || rid === CHAMBER_ROOM_ID)));
    hud.setRoomEntrySpawnPanelVisible(show);
    if (!show) {
      hud.clearRoomEntrySpawnPickUi();
      game.setRoomEntrySpawnPickHandler(null);
      return;
    }
  }

  function syncRoomSidePanels(): void {
    syncRoomBackgroundHuePanel();
    syncRoomEntrySpawnPanel();
  }

  hud.onRoomBackgroundHueAdjust({
    onHueDeg(deg: number) {
      game.setRoomSceneBackgroundHueDeg(deg);
      const r = knownRooms.find(
        (x) => normalizeRoomId(x.id) === normalizeRoomId(game.getRoomId())
      );
      if (!canEditCurrentRoomBackgroundHue(r)) return;
      if (r) {
        r.backgroundHueDeg = Math.round(((deg % 360) + 360) % 360);
        r.backgroundNeutral = null;
      }
      scheduleRoomHueSend(deg);
    },
    onPointerUp() {
      const r = knownRooms.find(
        (x) => normalizeRoomId(x.id) === normalizeRoomId(game.getRoomId())
      );
      if (!canEditCurrentRoomBackgroundHue(r)) return;
      flushRoomHueThrottleSend();
    },
  });

  hud.onRoomBackgroundNeutralPreview((neutral) => {
    game.setRoomSceneBackground({ hueDeg: null, neutral });
  });

  hud.onRoomBackgroundNeutralPick((neutral) => {
    clearRoomHueThrottleTimer();
    roomHueThrottlePending = null;
    game.setRoomSceneBackground({ hueDeg: null, neutral });
    const r = knownRooms.find(
      (x) => normalizeRoomId(x.id) === normalizeRoomId(game.getRoomId())
    );
    if (!canEditCurrentRoomBackgroundHue(r)) return;
    if (r) {
      r.backgroundHueDeg = null;
      r.backgroundNeutral = neutral;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    sendUpdateRoom(ws, normalizeRoomId(game.getRoomId()), {
      backgroundNeutral: neutral,
    });
    syncRoomSidePanels();
  });

  function syncBuildHud(): void {
    try {
    const barStyle = game.getPlacementBlockStyle();
    const touchUi =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    const payPortrait = isNimiqPayPortraitDocument();
    const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    const isPixel = isPixelRoomId(game.getRoomId());
    const canBuild = roomAllowPlaceBlocks && !isCanvas && !isPixel;
    const canFloor = roomAllowExtraFloor && !isCanvas;

    if (!canBuild && game.getBuildMode()) {
      game.setBuildMode(false);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
      hud.deactivateSignpostMode();
    }
    if (!canFloor && game.getFloorExpandMode()) {
      game.setFloorExpandMode(false);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
    }

    if (!canBuild && !canFloor) {
      const readOnlyHint = isCanvas
        ? "Find the exit the quickest to win NIM"
        : "this room is view-only for building";
      hud.setBuildBlockBarState({
        visible: false,
        ...barStyle,
        placementAdmin: isAdmin(selfAddress),
      });
      hud.setPlayModeState("walk");
      hud.setStatus(readOnlyHint);
      return;
    }
    
    if (game.isRepositioning()) {
      hud.setStatus(
        "Choose an empty tile for the new position (Esc to cancel)"
      );
      hud.setBuildBlockBarState({
        visible: false,
        ...barStyle,
        placementAdmin: isAdmin(selfAddress),
      });
      hud.setPlayModeState(playModeFromGame());
      return;
    }
    if (game.isTeleporterDestPickActive()) {
      hud.setStatus(
        touchUi
          ? "Tap an empty walkable floor tile for destination (Esc to cancel)"
          : "Click an empty walkable floor tile for destination (Esc to cancel)"
      );
      hud.setBuildBlockBarState({
        visible: false,
        ...barStyle,
        placementAdmin: isAdmin(selfAddress),
      });
      hud.setPlayModeState(playModeFromGame());
      return;
    }
    if (game.getFloorExpandMode() && canFloor) {
      const entryPickHint = hud.isRoomEntrySpawnPickArmed()
        ? touchUi
          ? " Guest entry: tap a walkable tile (or turn off “Pick tile” in the sidebar)."
          : " Guest entry: click a walkable floor tile, or turn off “Pick tile on map…” in the sidebar."
        : "";
      hud.setStatus(
        touchUi
          ? isPixel
            ? `Paint — tap tiles to recolor (F or Build off when done)${entryPickHint}`
            : `Floor — tap tiles next to walkable space (F or Build off when done)${entryPickHint}`
          : isPixel
            ? `Paint — left-click tiles to recolor (F to exit).${entryPickHint}`
            : `Expand floor — left-click to add a tile; right-click to remove (F to exit).${entryPickHint}`
      );
      hud.setBuildBlockBarState({
        visible: false,
        ...barStyle,
        placementAdmin: isAdmin(selfAddress),
      });
      hud.setPlayModeState(playModeFromGame());
      return;
    }
    if (game.getBuildMode() && canBuild) {
      game.setBillboardPlacementPreviewActive(hud.isBillboardModeActive());
      const tpHint = hud.isTeleporterModeActive()
        ? " Teleporter: click an empty floor tile to place."
        : "";
      const gateHint = hud.isGateModeActive()
        ? " Gate: green/red on neighbors show clearance; click an empty floor tile."
        : "";
      const prefabHint = hud.isObjectPrefabPlaceModeActive()
        ? touchUi
          ? game.isPrefabPlacePreviewArmed()
            ? payPortrait
              ? " Prefab: tap again or Place; Cancel clears (↺ ↻)."
              : " Prefab: tap the same spot again or Place to stamp; Cancel to clear preview (↺ ↻ rotate)."
            : payPortrait
              ? " Prefab: tap floor to preview (↺ ↻)."
              : " Prefab: tap the floor to preview placement (↺ ↻ rotate)."
          : " Prefab: pick one, hover anchor, click to place (↺ ↻ rotate)."
        : hud.isObjectPrefabSaveModeActive()
          ? touchUi
            ? payPortrait
              ? " Prefab: drag on floor to capture."
              : " Prefab: press and drag on the floor to capture your prefab area."
            : " Prefab: click and drag on the floor to capture your prefab area."
          : "";
      const sel = game.getSelectedBlockTile();
      const selectedHint = sel
        ? touchUi
          ? payPortrait
            ? " Selected: D delete, R rotate ramp."
            : " Selected block: D delete, R rotate ramp, Ctrl+tap selected block to stack higher."
          : " Selected block: D delete, R rotate ramp, Ctrl+click selected block to stack higher."
        : "";
      hud.setStatus(
        touchUi
          ? payPortrait
            ? `Build — tap block to edit, empty tile to place (Build off to exit)${tpHint}${gateHint}${prefabHint}${selectedHint}`
            : `Build — tap a block to edit, empty tile to place (Build off to exit)${tpHint}${gateHint}${prefabHint}${selectedHint}`
          : `Build mode — click a block to edit, empty floor to place (B or Build off to exit)${tpHint}${gateHint}${prefabHint}${selectedHint}`
      );
      hud.setBuildBlockBarState({
        visible: true,
        ...barStyle,
        placementAdmin: isAdmin(selfAddress),
      });
      hud.setPlayModeState(playModeFromGame());
      return;
    }
    hud.setBuildBlockBarState({
      visible: false,
      ...barStyle,
      placementAdmin: isAdmin(selfAddress),
    });
    const modeHints: string[] = [];
    if (canBuild) modeHints.push("B: blocks");
    if (canFloor) {
      modeHints.push(isPixelRoomId(game.getRoomId()) ? "F: paint floor" : "F: expand walkable floor");
    }
    const desktopHint =
      modeHints.length > 0
        ? modeHints.join(" · ")
        : isCanvas
          ? "Find the exit the quickest to win NIM"
          : "This room is view-only for building";
    const touchIdleHint =
      canBuild && canFloor
        ? payPortrait
          ? "Build: toggle at top-right · palette along bottom"
          : "Build: edge toggle + palette along the bottom (F: floor if allowed)"
        : canBuild
          ? payPortrait
            ? "Build: toggle at top-right · palette along bottom"
            : "Build: edge toggle + palette along the bottom"
          : desktopHint;
    hud.setStatus(touchUi ? touchIdleHint : desktopHint);
    hud.setPlayModeState(playModeFromGame());
    } finally {
      const isCanvasRoom = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
      const canBuildGates = roomAllowPlaceBlocks && !isCanvasRoom;
      game.setGateFloorHintsActive(
        Boolean(
          canBuildGates &&
          game.getBuildMode() &&
          hud.isGateModeActive() &&
          !game.isRepositioning()
        )
      );
      syncRoomSidePanels();
    }
  }

  const prefabUi = hud.getObjectPrefabAuthoringUi();

  function canPlacePrefabInRoom(): boolean {
    const rid = normalizeRoomId(game.getRoomId());
    if (rid === CANVAS_ROOM_ID || rid === PIXEL_ROOM_ID) return false;
    return roomAllowPlaceBlocks;
  }

  function syncObjectPrefabModes(
    tool: "block" | "signpost" | "teleporter" | "billboard" | "gate" | "prefab"
  ): void {
    prefabUi.setAllowPublish(welcomeAllowPublishDesign);
    const canUse =
      tool === "prefab" && game.getBuildMode() && canPlacePrefabInRoom();
    if (!canUse) {
      game.setObjectPrefabSaveActive(false);
      game.setObjectPrefabPlaceActive(false);
      prefabUi.setPrefabToolActive(false);
      return;
    }
    prefabUi.setPrefabToolActive(true);
    if (!welcomeAllowPublishDesign && prefabUi.getMode() === "save") {
      prefabUi.setMode("place");
    }
    const mode = prefabUi.getMode();
    game.setObjectPrefabSaveActive(mode === "save" && welcomeAllowPublishDesign);
    game.setObjectPrefabPlaceActive(mode === "place");
    const design = prefabUi.getSelectedDesign();
    if (mode === "place" && design) {
      void loadPrefabSnapshotForDesign(design);
    } else {
      game.setObjectPrefabPlaceDesign(null);
      game.setObjectPrefabPlaceSnapshot(null);
    }
    hud.refreshPrefabAuthoringChrome();
  }

  async function fetchPlaceableDesigns(): Promise<void> {
    try {
      const { resolveApiBaseUrl } = await import("./net/apiBase.js");
      const base = resolveApiBaseUrl() || "";
      const res = await fetch(`${base}/api/designs/placeable?kind=object`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { designs?: DesignWire[] };
      const designs = data.designs ?? [];
      prefabUi.setPlaceableDesigns(designs);
      void prefetchPrefabSnapshotsForCatalog(designs);
      if (hud.isObjectPrefabToolActive()) {
        syncObjectPrefabModes("prefab");
      }
    } catch {
      /* ignore */
    }
  }

  hud.onBuildToolSelect((tool) => {
    game.setBillboardPlacementPreviewActive(tool === "billboard");
    syncObjectPrefabModes(tool);
    if (tool === "billboard") {
      const d = game.getBillboardPlacementDraft();
      hud.applyBillboardModalDraft(d);
    }
    syncBuildHud();
  });

  game.setObjectPrefabBboxStatsHandler((stats) => {
    prefabUi.updateStats(stats);
  });
  prefabUi.onPublishModalClose(() => {
    game.clearPrefabSaveCapturePreview();
    prefabUi.updateStats(null);
  });

  game.setObjectPrefabBboxCompleteHandler((bbox) => {
    if (!welcomeAllowPublishDesign) return;
    prefabUi.openPublishModal(
      bbox,
      game.getPrefabCaptureThumbnailDataUrl(bbox),
      (payload) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        prefabUi.setPublishBusy(true);
        sendPublishDesign(ws, {
          kind: "object",
          minX: payload.bbox.minX,
          maxX: payload.bbox.maxX,
          minZ: payload.bbox.minZ,
          maxZ: payload.bbox.maxZ,
          name: payload.name,
          description: payload.description,
          visibility: payload.visibility,
          priceLuna: nimToLunaString(payload.priceNim),
        });
      }
    );
  });

  prefabUi.onModeChange(() => {
    if (hud.isObjectPrefabToolActive()) {
      syncObjectPrefabModes("prefab");
    }
    hud.refreshPrefabAuthoringChrome();
    syncPrefabPlacePreviewHud();
  });

  hud.onPrefabDesignManage((action, design) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (action === "delete") {
      sendDeleteDesign(ws, design.id);
      return;
    }
    const next = design.visibility === "public" ? "private" : "public";
    sendUpdateDesignVisibility(ws, design.id, next);
  });

  const prefabSnapshotCache = new Map<string, import("./game/designFootprint.js").DesignSnapshotV1>();

  hud.setPrefabSnapshotForThumb((id) => prefabSnapshotCache.get(id) ?? null);

  async function fetchPrefabSnapshotIntoCache(
    design: DesignWire
  ): Promise<import("./game/designFootprint.js").DesignSnapshotV1 | null> {
    const cached = prefabSnapshotCache.get(design.id);
    if (cached) return cached;
    try {
      const { resolveApiBaseUrl } = await import("./net/apiBase.js");
      const base = resolveApiBaseUrl() || "";
      const res = await fetch(
        `${base}/api/designs/${encodeURIComponent(design.id)}/snapshot`,
        { headers: { authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        snapshot?: import("./game/designFootprint.js").DesignSnapshotV1;
      };
      if (!data.snapshot?.obstacles) return null;
      prefabSnapshotCache.set(design.id, data.snapshot);
      return data.snapshot;
    } catch {
      return null;
    }
  }

  async function prefetchPrefabSnapshotsForCatalog(
    designs: DesignWire[]
  ): Promise<void> {
    if (designs.length === 0) return;
    await Promise.all(designs.map((d) => fetchPrefabSnapshotIntoCache(d)));
    hud.refreshPrefabAuthoringChrome();
  }

  async function loadPrefabSnapshotForDesign(
    design: DesignWire | null
  ): Promise<void> {
    if (!design) {
      game.setObjectPrefabPlaceSnapshot(null);
      return;
    }
    const designId = design.id;
    game.setObjectPrefabPlaceDesign({
      id: designId,
      footprintW: design.footprintW,
      footprintD: design.footprintD,
    });
    const snapshot = await fetchPrefabSnapshotIntoCache(design);
    if (prefabUi.getSelectedDesignId() !== designId) return;
    game.setObjectPrefabPlaceSnapshot(snapshot, designId);
    hud.refreshPrefabAuthoringChrome();
  }

  prefabUi.onDesignChange((design) => {
    game.cancelPrefabPlacePreview();
    syncPrefabPlacePreviewHud();
    void loadPrefabSnapshotForDesign(design);
    hud.refreshPrefabAuthoringChrome();
  });

  hud.onPrefabPlaceRotate((delta) => {
    game.cycleObjectPrefabPlaceYaw(delta);
  });

  function syncPrefabPlacePreviewHud(): void {
    hud.setPrefabPlacePreviewChrome({
      armed: game.isPrefabPlacePreviewArmed(),
      canConfirm: game.canConfirmArmedPrefabPlace(),
    });
  }

  game.setPrefabPlacePreviewChangeHandler(() => {
    syncPrefabPlacePreviewHud();
    hud.refreshPrefabAuthoringChrome();
  });

  hud.onPrefabPlaceConfirm(() => {
    if (game.confirmArmedPrefabPlace()) {
      syncBuildHud();
    }
  });

  hud.onPrefabPlaceCancel(() => {
    game.cancelPrefabPlacePreview();
    syncPrefabPlacePreviewHud();
    syncBuildHud();
  });

  game.setObjectPrefabPlaceHandler((anchorX, anchorZ, yawSteps) => {
    const designId = prefabUi.getSelectedDesignId();
    if (!designId || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (!game.isPrefabPlaceValidAt(anchorX, anchorZ)) return;
    sendPlaceDesignInRoom(ws, {
      designId,
      anchorX,
      anchorZ,
      yawSteps,
    });
  });

  void fetchPlaceableDesigns();

  hud.onObjectSelectionDismiss(() => {
    game.setTeleporterDestPickHandler(null);
    editingTile = null;
    hud.hideObjectEditPanel();
    game.clearSelectedBlock();
    syncBuildHud();
  });

  hud.onSelectedObjectDelete(() => {
    removeSelectedPlacedObject();
  });

  hud.onPlayModeSelect((mode) => {
    if (document.activeElement === hud.getChatInput()) return;
    if (streamMode) return;

    const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    if (mode === "build" && (!roomAllowPlaceBlocks || isCanvas || isPixelRoomId(game.getRoomId()))) return;
    if (mode === "floor" && (!roomAllowExtraFloor || isCanvas)) return;
    
    if (mode === "walk") {
      game.setTeleporterDestPickHandler(null);
      game.setFloorExpandMode(false);
      game.setBuildMode(false);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
      // Deactivate signpost mode when leaving build
      hud.deactivateSignpostMode();
      hud.deactivateGateMode();
      syncObjectPrefabModes("prefab");
      hud.clearRoomEntrySpawnPickUi();
      game.setRoomEntrySpawnPickHandler(null);
    } else if (mode === "build") {
      game.setTeleporterDestPickHandler(null);
      game.setFloorExpandMode(false);
      game.setBuildMode(true);
      hud.clearRoomEntrySpawnPickUi();
      game.setRoomEntrySpawnPickHandler(null);
    } else {
      game.setTeleporterDestPickHandler(null);
      game.setBuildMode(false);
      game.setFloorExpandMode(true);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
      // Deactivate signpost mode when leaving build
      hud.deactivateSignpostMode();
      hud.deactivateGateMode();
      hud.clearRoomEntrySpawnPickUi();
      game.setRoomEntrySpawnPickHandler(null);
    }
    syncBuildHud();
  });

  hud.onBuildPlacementStyle((patch) => {
    game.setPlacementBlockStyle(patch);
    syncBuildHud();
  });
  hud.onFloorPlacementColor((rgb) => {
    game.setFloorPlacementColorRgb(rgb);
  });
  hud.onFloorBrushSize((size) => {
    game.setFloorBrushSize(size);
  });

  const wireWsHandlers = (socket: WebSocket): void => {
    perfPingSentAt.clear();
    hud.setPerfHudLatencyMs(null);
    game.setTeleporterDestPickHandler(null);
    clearRoomsJoinProgress();
    closeRoomsCreateModal();
    resetEditDeleteUi();
    hud.deactivateTeleporterMode();
    hud.deactivateGateMode();
    hud.clearRoomEntrySpawnPickUi();
    game.setRoomEntrySpawnPickHandler(null);
    hud.onRoomEntrySpawnPickState((armed) => {
      if (armed) {
        game.setRoomEntrySpawnPickHandler((x, z) => {
          if (socket.readyState === WebSocket.OPEN) {
            sendUpdateRoom(socket, normalizeRoomId(game.getRoomId()), {
              joinSpawn: { x, z },
            });
          }
          hud.clearRoomEntrySpawnPickUi();
          syncRoomSidePanels();
        });
      } else {
        game.setRoomEntrySpawnPickHandler(null);
      }
    });
    hud.onRoomEntrySpawnUseCenter(() => {
      if (socket.readyState === WebSocket.OPEN) {
        sendUpdateRoom(socket, normalizeRoomId(game.getRoomId()), {
          joinSpawn: null,
        });
      }
      hud.clearRoomEntrySpawnPickUi();
      game.setRoomEntrySpawnPickHandler(null);
      syncRoomSidePanels();
    });
    cancelActiveNimClaim?.();
    cancelActiveNimClaim = null;
    nimClaimUiRef = null;
    hud.setNimClaimProgress(null);

    // worldcup: shared Action Wheel handlers (emotes + Games sub-wheel incl. 1v1 toggle).
    const buildActionWheelHandlers = () => ({
      onEmote: (emoji: string) => {
        if (socket.readyState === WebSocket.OPEN) sendChat(socket, emoji);
      },
      onJoinFreePlayField: () => {
        sendJoinRoom(socket, WORLDCUP_FIELD_ROOM_ID);
      },
      onToggleChallenge: () => {
        const next = !worldcupSelfChallengeOpen;
        worldcupSelfChallengeOpen = next;
        if (socket.readyState === WebSocket.OPEN) sendSetChallenge(socket, next);
      },
      onOpenRooms: () => openRoomsModal(),
      // "Invite" / "Private Room": if we're already in a Play Space just re-open its share
      // panel; otherwise create (or return to, server-side idempotent) the space and join it.
      onOpenPlaySpace: () => {
        const inPlaySpace =
          directInviteActive && isInviteLobbyRoomId(worldcupCurrentRoomId);
        if (inPlaySpace) {
          if (lastDirectInviteState) {
            openDirectInviteSharePanel();
          } else if (socket.readyState === WebSocket.OPEN) {
            // State wire missed — same-room join re-registers with the server.
            sendJoinRoom(socket, worldcupCurrentRoomId);
          }
          return;
        }
        void (async () => {
          try {
            let templateId: string | undefined;
            if (isAdmin(selfAddress)) {
              const picked = await pickPlaySpaceTemplateId(token);
              if (picked === null) return;
              templateId = picked;
            }
            const created = await createDirectInvite(
              token,
              templateId ? { templateId } : undefined
            );
            directInviteActive = true;
            const target = created.lobbyRoomId;
            if (socket.readyState === WebSocket.OPEN) {
              if (
                normalizeRoomId(worldcupCurrentRoomId) !== normalizeRoomId(target)
              ) {
                beginRoomTransition(target);
              }
              sendJoinRoom(socket, target);
            } else {
              connectToRoom(target);
            }
          } catch (e) {
            const code = e instanceof Error ? e.message : "create_failed";
            hud.setStatus(
              code === "challenge_open"
                ? "Cancel your open Challenge before opening a play space."
                : "Could not open play space — try again."
            );
          }
        })();
      },
      challengeActive: worldcupSelfChallengeOpen,
      challengeAvailable:
        WORLDCUP_ENABLED_CLIENT &&
        !worldcupIsMatchPitchRoomId(worldcupCurrentRoomId),
      directInviteActive,
      isGuest: selfAddress.startsWith("guest:"),
      gamesAvailable: WORLDCUP_ENABLED_CLIENT,
    });

    game.setSelfQuickEmojiOpener(() => {
      // Centred on the avatar body (lower than the old head-height strip) so the
      // transparent Hub frames the player inside the Action Wheel ring.
      const a = game.getSelfScreenPosition(0.45);
      if (!a) return;
      const pos = game.getSelfPosition();
      const openedFloor = pos ? snapFloorTile(pos.x, pos.z) : null;
      hud.showActionWheel(a.x, a.y, buildActionWheelHandlers(), openedFloor);
    });
    game.setOtherPlayerContextOpener((pick) => {
      const acceptOpts = {
        onAcceptChallenge: (addr: string) => {
          if (socket.readyState === WebSocket.OPEN)
            sendAcceptChallenge(socket, addr);
        },
      };
      hud.showOtherPlayerContextMenu(
        pick.clientX,
        pick.clientY,
        pick.targets,
        pick.emoteRowFirst
          ? {
              ...acceptOpts,
              emoteRowFirst: true,
              onEmote: () => {
                const a = game.getSelfScreenPosition(0.45);
                if (!a) return;
                const pos = game.getSelfPosition();
                const openedFloor = pos ? snapFloorTile(pos.x, pos.z) : null;
                hud.showActionWheel(
                  a.x,
                  a.y,
                  buildActionWheelHandlers(),
                  openedFloor
                );
              },
            }
          : acceptOpts
      );
    });

    game.setGateContextOpener((pick) => {
      const parts = pick.blockKey.split(",").map(Number);
      const bx = parts[0];
      const bz = parts[1];
      const byRaw = parts[2];
      if (bx === undefined || bz === undefined) return;
      const by = Number.isFinite(byRaw) ? Math.floor(byRaw!) : 0;
      hud.showGateContextMenu(pick.clientX, pick.clientY, {
        onOpen: () => {
          const meta = game.getPlacedAt(bx, bz, by);
          if (!meta?.gate) return;
          game.queueWalkToGateThenInteract(bx, bz, by);
        },
      });
    });

    game.setWorldTileContextOpener((pick) => {
      const cx = pick.clientX;
      const cy = pick.clientY;
      const walkAt = pick.walkAt;
      const mine = pick.mine;
      const signboard = pick.signboard;
      hud.showWorldTileContextMenu(cx, cy, {
        onWalkHere: walkAt
          ? () => {
              hud.dismissOtherPlayerOverlays();
              game.performWalkNavigationAtScreen(
                walkAt.clientX,
                walkAt.clientY
              );
            }
          : null,
        onMine: mine
          ? () => {
              hud.dismissOtherPlayerOverlays();
              const pos = game.getSelfPosition();
              const adjacent = !!(
                pos &&
                isOrthogonallyAdjacentToFloorTile(
                  pos.x,
                  pos.z,
                  mine.x,
                  mine.z
                )
              );
              const claimIntent = adjacent
                ? "world_ctx_adjacent"
                : "world_ctx_auto_walk";
              game.performClaimBlockAtWorld(mine.x, mine.z, mine.y, {
                claimIntent,
              });
            }
          : null,
        onReadSign: signboard ? () => hud.showSignReadModal(signboard) : null,
      });
    });

    game.setGateDoubleOpenHandler((bx, bz, by) => {
      const meta = game.getPlacedAt(bx, bz, by);
      if (!meta?.gate) return;
      if (
        !canOpenGateAs(address, meta.gate, game.getRoomId()) &&
        !isAdmin(address)
      ) {
        game.showFloatingText(bx, bz, "You can't open that");
        return;
      }
      if (socket.readyState === WebSocket.OPEN) {
        sendOpenGate(socket, bx, bz, by);
      }
    });

    game.setTileClickHandler((x, z, layer = 0) => {
      if (streamMode) return;
      hud.dismissOtherPlayerOverlays();
      // Check if in signpost mode (only in build mode)
      if (game.getBuildMode() && hud.isSignpostModeActive()) {
        // Validate placement is within build radius
        const selfPos = game.getSelfPosition();
        if (selfPos) {
          const dx = selfPos.x - x;
          const dz = selfPos.z - z;
          const distance = Math.hypot(dx, dz);
          const placeRadius = game.getPlaceRadiusBlocks();
          if (distance > placeRadius + 1e-6) {
            sendMoveTo(socket, x, z, layer);
            return;
          }
        }
        hud.promptSignpostMessage(x, z);
        return;
      }
      if (game.getBuildMode() && hud.isBillboardModeActive()) {
        const selfPos = game.getSelfPosition();
        if (selfPos) {
          const dx = selfPos.x - x;
          const dz = selfPos.z - z;
          const distance = Math.hypot(dx, dz);
          const placeRadius = game.getPlaceRadiusBlocks();
          if (distance > placeRadius + 1e-6) {
            sendMoveTo(socket, x, z, layer);
            return;
          }
        }
        hud.promptBillboardPlace(x, z, game.getBillboardPlacementDraft());
        return;
      }
      sendMoveTo(socket, x, z, layer);
    });
    game.setPlaceBlockHandler((x, z) => {
      // worldcup: place a kickable soccer ball at the clicked tile (builders only).
      // Server validates room permission + walkability + per-room cap.
      if (hud.isWorldcupBallModeActive()) {
        const selfPos = game.getSelfPosition();
        if (selfPos) {
          const dx = selfPos.x - x;
          const dz = selfPos.z - z;
          const distance = Math.hypot(dx, dz);
          const placeRadius = game.getPlaceRadiusBlocks();
          if (distance > placeRadius + 1e-6) {
            sendMoveTo(socket, x, z, 0);
            return;
          }
        }
        sendPlaceBall(socket, x, z);
        return;
      }
      if (hud.isTeleporterModeActive()) {
        sendPlacePendingTeleporter(socket, x, z);
        return;
      }
      if (hud.isGateModeActive()) {
        const st = game.getPlacementBlockStyle();
        sendPlacePendingGate(
          socket,
          x,
          z,
          game.getPlacementRampDir(),
          0,
          st.colorRgb
        );
        return;
      }
      // Don't place blocks if in signpost mode
      if (hud.isSignpostModeActive()) {
        // Validate placement is within build radius
        const selfPos = game.getSelfPosition();
        if (selfPos) {
          const dx = selfPos.x - x;
          const dz = selfPos.z - z;
          const distance = Math.hypot(dx, dz);
          const placeRadius = game.getPlaceRadiusBlocks();
          if (distance > placeRadius + 1e-6) {
            sendMoveTo(socket, x, z, 0);
            return;
          }
        }
        hud.promptSignpostMessage(x, z);
        return;
      }
      if (hud.isBillboardModeActive()) {
        const selfPos = game.getSelfPosition();
        if (selfPos) {
          const dx = selfPos.x - x;
          const dz = selfPos.z - z;
          const distance = Math.hypot(dx, dz);
          const placeRadius = game.getPlaceRadiusBlocks();
          if (distance > placeRadius + 1e-6) {
            sendMoveTo(socket, x, z, 0);
            return;
          }
        }
        hud.promptBillboardPlace(x, z, game.getBillboardPlacementDraft());
        return;
      }
      sendPlaceBlock(socket, x, z, game.getPlacementBlockStyle());
    });
    
    game.setClaimBlockHandler((x, z, y) => {
      cancelActiveNimClaim?.();
      cancelActiveNimClaim = null;

      nimClaimUiRef = {
        blockX: x,
        blockZ: z,
        blockY: y,
        claimId: null,
        holdMs: 3000,
        rewardHoldSince: null,
        completeSent: false,
      };

      let beginSent = false;
      let lastTickSent = 0;
      let raf = 0;
      let cancelled = false;
      let notAdjacentSince: number | null = null;

      const finish = (fadeOut?: boolean): void => {
        if (cancelled) return;
        cancelled = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        hud.setNimClaimProgress(null, fadeOut ? { fadeOutMs: 400 } : undefined);
        nimClaimUiRef = null;
        game.clearBlockClaimBeginIntent();
        if (cancelActiveNimClaim === cancelThisClaim) {
          cancelActiveNimClaim = null;
        }
      };

      const cancelThisClaim = (): void => {
        finish();
      };
      cancelActiveNimClaim = cancelThisClaim;

      hud.setNimClaimProgress({ progress: 0, adjacent: false });

      const tick = (): void => {
        if (cancelled) return;
        const ref = nimClaimUiRef;
        if (!ref || ref.blockX !== x || ref.blockZ !== z || ref.blockY !== y) {
          return;
        }

        const pos = game.getSelfPosition();
        const now = performance.now();
        const adjacent = !!(
          pos &&
          isOrthogonallyAdjacentToFloorTile(pos.x, pos.z, x, z)
        );

        if (adjacent) {
          notAdjacentSince = null;
          if (!beginSent && socket.readyState === WebSocket.OPEN) {
            const claimIntent = game.takeBlockClaimBeginIntent();
            sendBeginBlockClaim(socket, x, z, y, claimIntent);
            beginSent = true;
          }
          const cid = ref.claimId;
          if (
            cid &&
            !ref.completeSent &&
            socket.readyState === WebSocket.OPEN &&
            now - lastTickSent >= 220
          ) {
            sendBlockClaimTick(socket, cid);
            lastTickSent = now;
          }
        }

        if (ref.claimId) {
          if (adjacent) {
            if (ref.rewardHoldSince === null) {
              ref.rewardHoldSince = now;
            }
          } else {
            ref.rewardHoldSince = null;
          }
        }

        const holdMs = ref.holdMs;
        let progress = 0;
        if (ref.claimId && ref.rewardHoldSince !== null) {
          progress = Math.min(1, (now - ref.rewardHoldSince) / holdMs);
        }

        hud.setNimClaimProgress({ progress, adjacent });

        if (!adjacent) {
          if (notAdjacentSince === null) {
            notAdjacentSince = now;
          } else if (now - notAdjacentSince >= NIM_CLAIM_AWAY_DISMISS_MS) {
            finish(true);
            return;
          }
        }

        const readyToComplete =
          ref.claimId &&
          ref.rewardHoldSince !== null &&
          !ref.completeSent &&
          now - ref.rewardHoldSince >= holdMs + NIM_CLAIM_COMPLETE_SLACK_MS;

        if (readyToComplete && ref.claimId && ref.rewardHoldSince !== null) {
          ref.completeSent = true;
          sendCompleteBlockClaim(socket, ref.claimId);
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    });
    
    game.setMoveBlockHandler((fromX, fromZ, toX, toZ) => {
      if (game.getRepositioningBillboardId()) {
        const toY = game.getNextOpenStackLevelAt(toX, toZ);
        if (toY === null || toY !== 0) return;
        sendMoveObstacle(
          socket,
          fromX,
          fromZ,
          0,
          toX,
          toZ,
          0,
          game.getBillboardRepositionYaw()
        );
        return;
      }
      const fromY =
        editingTile?.x === fromX && editingTile?.z === fromZ ? editingTile.y : 0;
      const toY = game.getNextOpenStackLevelAt(toX, toZ);
      if (toY === null) return;
      sendMoveObstacle(socket, fromX, fromZ, fromY, toX, toZ, toY);
    });
    game.setPlaceExtraFloorHandler((x, z, colorRgb, brushSize) => {
      if (streamMode) return;
      sendPlaceExtraFloor(socket, x, z, colorRgb, brushSize);
    });
    game.setRemoveExtraFloorHandler((x, z) => {
      if (streamMode) return;
      sendRemoveExtraFloor(socket, x, z);
    });
    hud.onSignpostPlace((x, z, message) => {
      socket.send(JSON.stringify({
        type: "placeSignboard",
        x,
        z,
        message,
      }));
    });
    hud.onSignpostUpdate((signboardId, message) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          type: "updateSignboard",
          signboardId,
          message,
        })
      );
    });
    hud.onBillboardPlace((x, z, opts) => {
      if ("rotationSetId" in opts && opts.rotationSetId) {
        game.setBillboardPlacementDraft({
          orientation: opts.orientation,
          yawSteps: 0,
          rotationSetId: opts.rotationSetId,
          billboardSourceTab: "campaign",
        });
        sendPlaceBillboard(socket, {
          x,
          z,
          orientation: opts.orientation,
          rotationSetId: opts.rotationSetId,
        });
      } else if ("liveChart" in opts && opts.liveChart) {
        game.setBillboardPlacementDraft({
          orientation: opts.orientation,
          yawSteps: 0,
          advertIds: opts.advertIds,
          intervalSec: opts.intervalSec,
          liveChartRange: opts.liveChart.range,
          liveChartFallbackAdvertId: opts.liveChart.fallbackAdvertId,
          liveChartRangeCycle: opts.liveChart.rangeCycle === true,
          liveChartCycleIntervalSec: opts.liveChart.cycleIntervalSec ?? 20,
          /** Next modal open defaults to Images; range stays for the chart dropdown. */
          billboardSourceTab: "images",
        });
        sendPlaceBillboard(socket, {
          x,
          z,
          orientation: opts.orientation,
          advertId: opts.advertId,
          advertIds: opts.advertIds,
          intervalMs: opts.intervalSec * 1000,
          liveChart: opts.liveChart,
        });
      } else {
        const d = game.getBillboardPlacementDraft();
        game.setBillboardPlacementDraft({
          orientation: opts.orientation,
          yawSteps: 0,
          advertIds: opts.advertIds,
          intervalSec: opts.intervalSec,
          liveChartRange: d.liveChartRange,
          liveChartFallbackAdvertId: d.liveChartFallbackAdvertId,
          liveChartRangeCycle: d.liveChartRangeCycle,
          liveChartCycleIntervalSec: d.liveChartCycleIntervalSec,
          billboardSourceTab: "images",
        });
        sendPlaceBillboard(socket, {
          x,
          z,
          orientation: opts.orientation,
          advertId: opts.advertId,
          advertIds: opts.advertIds,
          intervalMs: opts.intervalSec * 1000,
        });
      }
    });
    hud.onBillboardDraftChange((d) => {
      game.setBillboardPlacementDraft(d);
    });
    hud.onBillboardUpdate((id, opts) => {
      if ("liveChart" in opts && opts.liveChart) {
        sendUpdateBillboard(socket, {
          billboardId: id,
          orientation: opts.orientation,
          advertId: opts.advertId,
          advertIds: opts.advertIds,
          intervalMs: opts.intervalSec * 1000,
          liveChart: opts.liveChart,
        });
      } else {
        sendUpdateBillboard(socket, {
          billboardId: id,
          orientation: opts.orientation,
          advertId: opts.advertId,
          advertIds: opts.advertIds,
          intervalMs: opts.intervalSec * 1000,
        });
      }
    });
    game.setObstacleSelectHandler((x, z, y) => {
      const selectedBb = game.getSelectedBillboardId();
      if (selectedBb) {
        const spec = game.getBillboardState(selectedBb);
        if (!spec) return;
        editingTile = { x: spec.anchorX, z: spec.anchorZ, y: 0 };
        const canModify = canModifyBillboardAsViewer(
          spec.createdBy,
          selfAddress
        );
        hud.showObjectEditPanel({
          x: spec.anchorX,
          z: spec.anchorZ,
          billboardSelection: {
            id: selectedBb,
            canModify,
            onEdit: () => {
              const s = game.getBillboardState(selectedBb);
              if (!s) return;
              hud.hideObjectEditPanel();
              hud.promptBillboardEdit(selectedBb, {
                orientation: s.orientation,
                advertId: s.advertId,
                advertIds: s.advertIds,
                intervalMs: s.intervalMs,
                liveChart: s.liveChart,
              });
              editingTile = null;
              syncBuildHud();
            },
            onMove: () => {
              hud.hideObjectEditPanel();
              editingTile = null;
              game.clearSelectedBlock();
              game.beginReposition(spec.anchorX, spec.anchorZ);
              syncBuildHud();
            },
            onRemove: () => {
              sendRemoveObstacleAt(socket, spec.anchorX, spec.anchorZ, 0);
              editingTile = null;
              hud.hideObjectEditPanel();
              game.clearSelectedBlock();
              syncBuildHud();
            },
            onClose: () => {
              editingTile = null;
              hud.hideObjectEditPanel();
              game.clearSelectedBlock();
              syncBuildHud();
            },
          },
        });
        syncBuildHud();
        return;
      }

      const m = game.getPlacedAt(x, z, y);
      if (!m) return;
      editingTile = { x, z, y };

      const tp = m.teleporter;
      if (tp) {
        const pending = "pending" in tp && tp.pending;
        const isBidirectionalPair =
          !pending &&
          "pairedPeerKey" in tp &&
          typeof (tp as { pairedPeerKey?: unknown }).pairedPeerKey === "string" &&
          Boolean((tp as { pairedPeerKey: string }).pairedPeerKey) &&
          "targetRoomId" in tp &&
          normalizeRoomId((tp as { targetRoomId: string }).targetRoomId) ===
            normalizeRoomId(game.getRoomId());
        let destRoomId = normalizeRoomId(game.getRoomId());
        let destX = 0;
        let destZ = 0;
        if (!pending && "targetRoomId" in tp) {
          destRoomId = tp.targetRoomId;
          destX = tp.targetX;
          destZ = tp.targetZ;
        }
        hud.showObjectEditPanel({
          x,
          z,
          teleporterEdit: {
            pending,
            y,
            isBidirectionalPair,
            destRoomId,
            destX,
            destZ,
            currentRoomId: normalizeRoomId(game.getRoomId()),
            roomOptions: teleporterDestinationRoomOptions(),
            onPickTileInCurrentRoom: () => {
              game.setTeleporterDestPickHandler((px, pz) => {
                const here = normalizeRoomId(game.getRoomId());
                const tx = Math.floor(px);
                const tz = Math.floor(pz);
                game.setTeleporterDestPickHandler(null);
                hud.setTeleporterEditFields({
                  destRoomId: here,
                  destX: tx,
                  destZ: tz,
                });
                game.setTeleporterDestinationDraftHighlight({ x: tx, z: tz });
                syncBuildHud();
              });
              syncBuildHud();
            },
            onPickCancel: () => {
              game.setTeleporterDestPickHandler(null);
            },
            onCommitDestination: (destRoomId, dx, dz) => {
              const destX = Math.floor(dx);
              const destZ = Math.floor(dz);
              if (destRoomId === "__THIS_ROOM_PAIR__") {
                sendPlaceTeleporterBidirectionalPair(
                  socket,
                  x,
                  z,
                  y,
                  destX,
                  destZ
                );
                return;
              }
              const rid = normalizeRoomId(destRoomId);
              if (rid === HUB_ROOM_ID) {
                sendConfigureTeleporter(socket, x, z, y, HUB_ROOM_ID, 0, 0);
                return;
              }
              sendConfigureTeleporter(socket, x, z, y, rid, destX, destZ);
            },
          },
          onRemove: () => {
            game.setTeleporterDestPickHandler(null);
            sendRemoveObstacleAt(socket, x, z, y);
            editingTile = null;
            hud.hideObjectEditPanel();
            game.clearSelectedBlock();
            syncBuildHud();
          },
          onMove: () => {
            game.setTeleporterDestPickHandler(null);
            game.beginReposition(x, z, y);
            editingTile = null;
            hud.hideObjectEditPanel();
            syncBuildHud();
          },
          onClose: () => {
            game.setTeleporterDestPickHandler(null);
            editingTile = null;
            hud.hideObjectEditPanel();
            game.clearSelectedBlock();
            syncBuildHud();
          },
        });
        syncBuildHud();
        return;
      }

      const gateWire = m.gate ? normalizeClientGate(m.gate) : null;
      hud.showObjectEditPanel({
        x,
        z,
        y,
        passable: m.passable,
        half: m.half,
        quarter: m.quarter,
        hex: m.hex,
        pyramid: m.pyramid,
        pyramidBaseScale: m.pyramidBaseScale ?? 1,
        hexRadiusScale: m.hexRadiusScale ?? 1,
    sphereRadiusScale: m.sphereRadiusScale ?? 1,
        sphere: m.sphere,
        ramp: m.ramp,
        rampDir: m.rampDir,
        ...cubeRotationForPlainCube(
          {
            hex: m.hex,
            pyramid: m.pyramid,
            sphere: m.sphere,
            ramp: m.ramp,
          },
          m
        ),
        colorRgb: m.colorRgb ?? resolveBlockColorRgb(m),
        locked: m.locked || false,
        isAdmin: isAdmin(selfAddress),
        ...(m.claimable
          ? { claimable: true, active: m.active !== false }
          : {}),
        ...(gateWire
          ? {
              gate: {
                adminAddress: gateWire.adminAddress,
                authorizedAddresses: [...gateWire.authorizedAddresses],
                exitX: gateWire.exitX,
                exitZ: gateWire.exitZ,
              },
              gateExitDir: gateExitDirFromNeighbor(x, z, gateWire),
              ...(isGateAclAdmin(selfAddress, m.gate) || isAdmin(selfAddress)
                ? {
                    onEditGateAcl: () => {
                      hud.showGateAclEditor({
                        x,
                        z,
                        y,
                        adminAddress: gateWire.adminAddress,
                        addresses: [...gateWire.authorizedAddresses],
                        players: lastPlayers.filter(
                          (p) =>
                            !remotePlayerIsNpc(p.address, p.displayName)
                        ),
                        onSave: (next) => {
                          sendSetGateAuthorizedAddresses(
                            socket,
                            x,
                            z,
                            y,
                            next
                          );
                        },
                      });
                    },
                  }
                : {}),
            }
          : {}),
        onPropsChange: (p) => {
          sendSetObstacleProps(socket, x, z, y, p);
        },
        onRemove: () => {
          sendRemoveObstacleAt(socket, x, z, y);
          editingTile = null;
          hud.hideObjectEditPanel();
          game.clearSelectedBlock();
          syncBuildHud();
        },
        onMove: () => {
          game.beginReposition(x, z, y);
          editingTile = null;
          hud.hideObjectEditPanel();
          syncBuildHud();
        },
        onClose: () => {
          editingTile = null;
          hud.hideObjectEditPanel();
          game.clearSelectedBlock();
          syncBuildHud();
        },
      });
      syncBuildHud();
    });
  };

  function isExitPortalTile(meta: {
    passable: boolean;
    quarter: boolean;
    hex: boolean;
    colorRgb: number;
    locked?: boolean;
    teleporter?: unknown;
  } | null): boolean {
    return Boolean(
      meta &&
        meta.passable &&
        meta.quarter &&
        meta.hex &&
        resolveBlockColorRgb(meta) === BLOCK_COLOR_EXIT_PORTAL_RGB &&
        meta.locked &&
        !meta.teleporter
    );
  }

  function formatBillboardPortalLabel(visitName: string): string {
    const n = visitName.trim() || "link";
    const full = `Visit ${n}`;
    if (full.length <= 40) return full;
    const short = n.length > 27 ? `${n.slice(0, 27)}…` : n;
    return `Visit ${short}`;
  }

  function displayNameForTeleporterTarget(
    roomId: string,
    obstacleSnapshotName?: string
  ): string {
    const n = normalizeRoomId(roomId);
    const row = knownRooms.find((r) => normalizeRoomId(r.id) === n);
    const fromCatalog = row?.displayName?.trim();
    if (fromCatalog) return fromCatalog;
    const fromObstacle = obstacleSnapshotName?.trim();
    if (fromObstacle) return fromObstacle;
    if (n === HUB_ROOM_ID) return "Hub";
    if (n === CANVAS_ROOM_ID) return "Canvas";
    if (n === CHAMBER_ROOM_ID) return "Chamber";
    if (n === PIXEL_ROOM_ID) return "Pixel";
    return formatRoomJoinCode(n);
  }

  function formatTeleporterPortalLabel(
    targetRoomId: string,
    obstacleSnapshotName?: string
  ): string {
    const name = displayNameForTeleporterTarget(
      targetRoomId,
      obstacleSnapshotName
    );
    const full = `Enter ${name}`;
    if (full.length <= 44) return full;
    const maxName = 28;
    const short =
      name.length > maxName ? `${name.slice(0, maxName - 1)}…` : name;
    return `Enter ${short}`;
  }

  function syncPortalEnterButton(): void {
    const anchor = game.getSelfScreenPosition(1.15);
    if (anchor) {
      hud.setPortalEnterScreenPosition(anchor.x, anchor.y);
    }
    const standingDoor = game.getStandingDoor();
    if (standingDoor) {
      portalAction = { kind: "door" };
      hud.setPortalEnterLabel("Enter");
      if (!portalEnterVisible) {
        portalEnterVisible = true;
        hud.setPortalEnterVisible(true);
      }
      return;
    }
    const standingTp = game.getStandingTeleporter();
    if (standingTp) {
      portalAction = { kind: "teleporter" };
      hud.setPortalEnterLabel(
        formatTeleporterPortalLabel(
          standingTp.targetRoomId,
          standingTp.targetRoomDisplayName
        )
      );
      if (!portalEnterVisible) {
        portalEnterVisible = true;
        hud.setPortalEnterVisible(true);
      }
      return;
    }
    if (WORLDCUP_ENABLED_CLIENT) {
      const standingPortal = game.getStandingSpectatePortal();
      if (standingPortal) {
        portalAction = {
          kind: "spectate",
          matchId: standingPortal.matchId,
          full: standingPortal.full,
        };
        hud.setPortalEnterLabel(standingPortal.full ? "Stands full" : "Watch");
        if (!portalEnterVisible) {
          portalEnterVisible = true;
          hud.setPortalEnterVisible(true);
        }
        return;
      }
    }
    const inCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    if (!inCanvas) {
      const visit = game.getStandingBillboardVisitOffer();
      if (visit) {
        portalAction = {
          kind: "billboard",
          billboardId: visit.billboardId,
          campaignId: visit.campaignId,
          visitUrl: visit.visitUrl,
          visitName: visit.visitName,
          miniappTargetUrl: visit.miniappTargetUrl,
        };
        hud.setPortalEnterLabel(formatBillboardPortalLabel(visit.visitName));
        if (!portalEnterVisible) {
          portalEnterVisible = true;
          hud.setPortalEnterVisible(true);
        }
        return;
      }
      portalAction = null;
      hud.setPortalEnterLabel("Enter");
      if (portalEnterVisible) {
        portalEnterVisible = false;
        hud.setPortalEnterVisible(false);
      }
      return;
    }
    const pos = game.getSelfPosition();
    if (!pos) {
      portalAction = null;
      hud.setPortalEnterLabel("Enter");
      if (portalEnterVisible) {
        portalEnterVisible = false;
        hud.setPortalEnterVisible(false);
      }
      return;
    }
    const tile = snapFloorTile(pos.x, pos.z);
    const show = isExitPortalTile(game.getPlacedAt(tile.x, tile.y));
    portalAction = show ? { kind: "canvas-exit" } : null;
    hud.setPortalEnterLabel("Enter");
    if (show !== portalEnterVisible) {
      portalEnterVisible = show;
      hud.setPortalEnterVisible(show);
    }
  }

  const handleServerMessage = async (msg: ServerMessage): Promise<void> => {
    if (msg.type === "serverNotice") {
      if (msg.kind === "restart_pending") {
        hud.setServerRestartPendingNotice({
          etaSeconds: msg.etaSeconds,
          message: msg.message,
          seq: msg.seq,
        });
      }
      return;
    }
    if (msg.type === "clientPong") {
      const t0 = perfPingSentAt.get(msg.id);
      if (t0 !== undefined) {
        perfPingSentAt.delete(msg.id);
        const rttMs = performance.now() - t0;
        hud.setPerfHudLatencyMs(rttMs);
        hud.pushLatencySample(rttMs);
      }
      return;
    }
    if (msg.type === "joinRoomFailed") {
      clearRoomTransitionProgressTimer();
      hud.setLoadingProgress(null);
      hud.setLoadingVisible(false, { skipMinWait: true });
      if (
        pendingProfileJoinRoomId &&
        normalizeRoomId(msg.roomId).toLowerCase() ===
          normalizeRoomId(pendingProfileJoinRoomId).toLowerCase()
      ) {
        pendingProfileJoinRoomId = null;
        hud.appendChat("System", "Room not found.");
      }
      if (
        pendingModalJoinRoomId &&
        normalizeRoomId(msg.roomId).toLowerCase() ===
          normalizeRoomId(pendingModalJoinRoomId).toLowerCase()
      ) {
        pendingModalJoinRoomId = null;
        roomsJoinSubmitBtn.disabled = false;
        roomsJoinStatus.hidden = false;
        roomsJoinStatus.textContent = "Room not found";
        roomsJoinStatus.classList.remove("rooms-modal__join-status--loading");
        roomsJoinStatus.classList.add("rooms-modal__join-status--error");
      }
      return;
    }
    if (msg.type === "roomJoinSpawn") {
      const nr = normalizeRoomId(msg.roomId);
      if (nr === normalizeRoomId(game.getRoomId())) {
        game.setRoomJoinSpawnFromWelcome({
          x: msg.x,
          z: msg.z,
          customized: msg.customized,
        });
      }
      return;
    }
    if (msg.type === "roomBackgroundHue") {
      const nr = normalizeRoomId(msg.roomId);
      if (nr === normalizeRoomId(game.getRoomId())) {
        game.setRoomSceneBackground({
          hueDeg: msg.hueDeg,
          neutral: msg.neutral,
        });
      }
      const row = knownRooms.find((r) => normalizeRoomId(r.id) === nr);
      if (row) {
        row.backgroundHueDeg =
          msg.hueDeg != null && Number.isFinite(msg.hueDeg)
            ? Math.round(((msg.hueDeg % 360) + 360) % 360)
            : null;
        if (msg.neutral !== undefined) {
          const n = msg.neutral;
          row.backgroundNeutral =
            n === "black" || n === "white" || n === "gray" ? n : null;
        }
      }
      syncRoomSidePanels();
      return;
    }
    if (msg.type === "welcome") {
      clearWelcomeDeadlineTimer();
      // worldcup: any room change clears a stale post-goal movement freeze.
      game.setWorldcupMoveLocked(false);
      if (pendingCreateRoomAwaiting) {
        closeRoomsModal();
      }

      const joinedViaModalJoin =
        pendingModalJoinRoomId !== null &&
        normalizeRoomId(msg.roomId).toLowerCase() ===
          normalizeRoomId(pendingModalJoinRoomId).toLowerCase();
      const joinedViaProfileJoin =
        pendingProfileJoinRoomId !== null &&
        normalizeRoomId(msg.roomId).toLowerCase() ===
          normalizeRoomId(pendingProfileJoinRoomId).toLowerCase();

      if (joinedViaModalJoin) {
        beginRoomTransition(msg.roomId);
        roomsJoinStatus.hidden = true;
        roomsJoinStatus.textContent = "";
        roomsJoinStatus.classList.remove(
          "rooms-modal__join-status--loading",
          "rooms-modal__join-status--error"
        );
        closeRoomsModal({ keepJoinPending: true });
      }

      try {
      clearRoomTransitionProgressTimer();
      hud.resetRoomChatDom();
      hud.setReconnectOffer(false);
      hud.setFeedbackReportRoomId(msg.roomId);
      bumpRoomLoadProgress(0.12);
      
      game.applyRoomFromWelcome({
        roomId: msg.roomId,
        roomBounds: msg.roomBounds,
        doors: msg.doors,
        placeRadiusBlocks: Number.isFinite(msg.placeRadiusBlocks)
          ? msg.placeRadiusBlocks
          : 5,
      });
      bumpRoomLoadProgress(0.22);
      requestAnimationFrame(() => {
        game.resize();
      });
      game.setRoomSceneBackground({
        hueDeg: msg.roomBackgroundHueDeg,
        neutral: msg.roomBackgroundNeutral,
      });
      game.setSelf(msg.self.address, msg.self.displayName);
      selfAddress = msg.self.address;
      syncGuestToolbarMode();
      hud.setBrandLinksPlayerDisplayName(msg.self.displayName);

      // worldcup: track room + self Challenge flag for the donut toggle; the Match HUD only
      // belongs inside a Match Pitch, so hide it whenever we land anywhere else.
      worldcupCurrentRoomId = normalizeRoomId(msg.roomId);
      worldcupSelfChallengeOpen = !!msg.self.challengeOpen;
      if (isInviteLobbyRoomId(worldcupCurrentRoomId)) {
        directInviteActive = true;
        // The share button persists across the play space; the panel itself follows the
        // incoming directInviteState (auto-open once, re-openable via the button).
        hud.setPlaySpaceShareVisible(true);
      } else {
        directInviteActive = false;
        directInviteLobby.hide();
        hud.setPlaySpaceShareVisible(false);
        lastDirectInviteState = null;
        directInviteAutoShownSlug = null;
      }
      // Any room change ends the pre-teleport countdown (we either landed on the pitch or left).
      worldcupMatchCountdown?.hide();
      // The countdown's scheduled "Entering the match..." loading screen has done its job (or is
      // moot) once a welcome lands; cancel it so a cancelled match can't strand a black screen.
      if (worldcupMatchEnterTimer !== null) {
        clearTimeout(worldcupMatchEnterTimer);
        worldcupMatchEnterTimer = null;
      }
      // A fresh room means we're no longer locked in the stands until a matchState says otherwise.
      worldcupSpectating = false;
      // Show the touch joystick only on the pitch (and not while spectating).
      updateWorldcupJoystickVisibility();
      // worldcup: leaving a Match Pitch tears down the Match-only view (spectator framing, goal
      // arrow, participant set, and the 180-degree orientation). Inside a pitch, the matchState
      // handler sets these up; the welcome handler runs first so we only clear on the way out.
      if (!worldcupIsMatchPitchRoomId(worldcupCurrentRoomId)) {
        game.setWorldcupSpectatorView(false);
        game.setWorldcupAttackGoal(null);
        game.setWorldcupMatchParticipants(null, null);
        game.setWorldcupMatchOrientation(null);
        worldcupAppliedMatchSide = null;
      }
      if (
        worldcupMatchHud &&
        !worldcupIsMatchPitchRoomId(worldcupCurrentRoomId)
      ) {
        worldcupMatchHud.hide();
      }

      const selfKey = selfAddress.replace(/\s+/g, "").trim().toUpperCase();
      const backlog = Array.isArray(msg.chatBacklog) ? msg.chatBacklog : [];
      for (const line of backlog) {
        if (
          !line ||
          typeof line.from !== "string" ||
          typeof line.text !== "string"
        ) {
          continue;
        }
        const fromAddr =
          typeof line.fromAddress === "string" ? line.fromAddress : "";
        const fromKey = fromAddr.replace(/\s+/g, "").trim().toUpperCase();
        hud.appendChat(line.from, line.text, {
          fromAddress: fromAddr || undefined,
          profileIsSelf: !!fromKey && fromKey === selfKey,
          historical: true,
          skipSystemDedup: true,
        });
      }

      const isCanvas = normalizeRoomId(msg.roomId) === CANVAS_ROOM_ID;
      const isPixel = isPixelRoomId(msg.roomId);
      if (!isCanvas) {
        hud.setCanvasCountdown(null);
      }
      const zoomMin = game.getZoomBounds().min;
      if (isCanvas) {
        game.setZoomLocked(true, zoomMin);
      } else {
        game.setZoomLocked(false);
        game.setZoomFrustumSize(game.getZoomBounds().max);
      }
      portalEnterVisible = false;
      portalAction = null;
      hud.setPortalEnterVisible(false);
      hud.setPortalEnterLabel("Enter");
      roomAllowPlaceBlocks = msg.allowPlaceBlocks !== false;
      roomAllowExtraFloor = msg.allowExtraFloor !== false;
      welcomeAllowRoomBackgroundHueEdit =
        msg.allowRoomBackgroundHueEdit === true;
      welcomeAllowRoomJoinSpawnEdit = msg.allowRoomJoinSpawnEdit === true;
      welcomeAllowPublishDesign = msg.allowPublishDesign === true;
      prefabUi.setAllowPublish(welcomeAllowPublishDesign);
      void fetchPlaceableDesigns();
      if (hud.isObjectPrefabToolActive()) {
        syncObjectPrefabModes("prefab");
      }
      if (msg.roomBackgroundHueDeg === undefined) {
        latestWelcomeBackgroundHueDeg = undefined;
      } else if (msg.roomBackgroundHueDeg === null) {
        latestWelcomeBackgroundHueDeg = null;
      } else if (
        typeof msg.roomBackgroundHueDeg === "number" &&
        Number.isFinite(msg.roomBackgroundHueDeg)
      ) {
        latestWelcomeBackgroundHueDeg = Math.round(
          ((msg.roomBackgroundHueDeg % 360) + 360) % 360
        );
      } else {
        latestWelcomeBackgroundHueDeg = undefined;
      }
      if (msg.roomBackgroundNeutral === undefined) {
        latestWelcomeBackgroundNeutral = undefined;
      } else if (msg.roomBackgroundNeutral === null) {
        latestWelcomeBackgroundNeutral = null;
      } else if (
        msg.roomBackgroundNeutral === "black" ||
        msg.roomBackgroundNeutral === "white" ||
        msg.roomBackgroundNeutral === "gray"
      ) {
        latestWelcomeBackgroundNeutral = msg.roomBackgroundNeutral;
      } else {
        latestWelcomeBackgroundNeutral = undefined;
      }
      hud.setRoomEditCaps({
        allowPlaceBlocks: roomAllowPlaceBlocks,
        allowExtraFloor: roomAllowExtraFloor,
      });
      game.setRoomJoinSpawnFromWelcome(msg.roomJoinSpawn ?? null);

      if (isCanvas || !roomAllowPlaceBlocks) {
        game.setBuildMode(false);
        hud.deactivateSignpostMode();
        hud.clearRoomEntrySpawnPickUi();
        game.setRoomEntrySpawnPickHandler(null);
      }
      if (isCanvas || !roomAllowExtraFloor) {
        game.setFloorExpandMode(false);
      }
      if (isCanvas || !roomAllowPlaceBlocks) {
        editingTile = null;
        hud.hideObjectEditPanel();
        game.clearSelectedBlock();
      }

      // Extra floor before obstacles so walkable quads sit earlier in the scene graph
      // than blocks on those tiles (avoids depth-tie flicker until blocks are rebuilt).
      bumpRoomLoadProgress(0.38);
      game.applyWelcomeFloorPayload({
        extraFloorTiles: msg.extraFloorTiles,
        baseFloorColorTiles: msg.baseFloorColorTiles ?? [],
        removedBaseFloorTiles: msg.removedBaseFloorTiles ?? [],
        spawnX: msg.self.x,
        spawnZ: msg.self.z,
      });
      bumpRoomLoadProgress(0.62);
      game.setObstacles(msg.obstacles);
      game.setSignboards(msg.signboards);
      game.setBillboards(msg.billboards ?? []);
      game.setVoxelTextsForRoom(msg.roomId, msg.voxelTexts ?? []);
      // worldcup: render any balls present in this room
      game.applyWorldcupBalls(msg.balls ?? []);
      // Self country is sent in every room (not just the field) so the profile flag chip and
      // Flag Emote reflect it everywhere; the scoreboard handles its own field-only display.
      applySelfCountry(msg.worldcupSelfCountry ?? null);
      if (worldcupScoreboard) {
        const inField = msg.roomId === WORLDCUP_FIELD_ROOM_ID;
        worldcupScoreboard.setVisible(inField);
        if (inField) {
          worldcupScoreboard.setSelfCountry(msg.worldcupSelfCountry ?? null);
          worldcupScoreboard.setLeaderboard(msg.worldcupTopCountries ?? []);
          worldcupScoreboard.setPreviousWinner(
            msg.worldcupPrevWinnerCountry ?? null
          );
        }
      }
      // worldcup: the crowd waves the previous UTC day's champion flag.
      game.setWorldcupCrowdFlag(msg.worldcupPrevWinnerCountry ?? null);
      // worldcup: live 1v1 spectate portals in this room.
      game.setWorldcupPortals(msg.worldcupPortals ?? []);
      
      // Load canvas claims if present and wait for them to finish
      if (msg.canvasClaims) {
        await game.setCanvasClaims(msg.canvasClaims);
      }
      
      lastPlayers = streamMode || msg.streamObserver
        ? [...msg.others]
        : [msg.self, ...msg.others];
      game.syncState(lastPlayers);
      refreshWorldcupCrowdRoster();
      bumpRoomLoadProgress(0.88);
      syncReturnHomeButton();
      await updateCanvasLeaderboard();
      const welcomeOnlineCount =
        typeof msg.onlinePlayerCount === "number" &&
        Number.isFinite(msg.onlinePlayerCount)
          ? msg.onlinePlayerCount
          : null;
      totalOnlinePlayers =
        welcomeOnlineCount !== null
          ? Math.max(0, Math.floor(welcomeOnlineCount))
          : roomRealPlayerCount(lastPlayers);
      syncPlayerCountHud();
      
      bumpRoomLoadProgress(1);
      if (loadingBlackoutReveal) {
        await waitForPaintFrames(2);
      }
      hud.setLoadingVisible(false, {
        skipMinWait: loadingBlackoutReveal,
      });
      syncBuildHud();
      applyStreamPresentation();
      ensureNimWalletPollStarted();
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendListRooms(ws);
        syncAwayPresenceToServer();
      }
      } finally {
        if (joinedViaModalJoin) {
          pendingModalJoinRoomId = null;
          roomsJoinSubmitBtn.disabled = false;
        }
        if (joinedViaProfileJoin) {
          pendingProfileJoinRoomId = null;
        }
      }
      return;
    }
    if (msg.type === "roomActionResult") {
      if (msg.action === "deleteRoom") {
        if (msg.ok) {
          resetEditDeleteUi();
          showRoomsView("list");
          roomsEditingRoomId = null;
          if (ws && ws.readyState === WebSocket.OPEN) {
            sendListRooms(ws);
          }
        } else {
          roomsEditDeleteErr.textContent = msg.reason ?? "Could not delete room.";
          roomsEditDeleteErr.hidden = false;
        }
      } else if (msg.action === "restoreRoom" && !msg.ok && msg.reason) {
        hud.appendChat("System", msg.reason);
      }
      return;
    }
    if (msg.type === "roomCatalog") {
      knownRooms = msg.rooms
        .map((r) => {
          const id = String(r.id).trim().toLowerCase();
          const isBuiltin =
            typeof r.isBuiltin === "boolean"
              ? r.isBuiltin
              : id === HUB_ROOM_ID ||
                id === CHAMBER_ROOM_ID ||
                id === CANVAS_ROOM_ID ||
                id === PIXEL_ROOM_ID;
          return {
            id,
            displayName: normalizeRoomCatalogDisplayName(
              typeof r.displayName === "string" ? r.displayName : undefined,
              String(r.id)
            ),
            ownerAddress:
              r.ownerAddress === null || r.ownerAddress === undefined
                ? null
                : String(r.ownerAddress).trim(),
            playerCount:
              typeof r.playerCount === "number" && Number.isFinite(r.playerCount)
                ? Math.max(0, Math.floor(r.playerCount))
                : 0,
            isPublic: r.isPublic !== false,
            isBuiltin,
            isOfficial: r.isOfficial === true,
            canEdit: r.canEdit === true,
            isDeleted: r.isDeleted === true,
            canDelete: r.canDelete === true,
            canRestore: r.canRestore === true,
            backgroundHueDeg:
              typeof r.backgroundHueDeg === "number" &&
              Number.isFinite(r.backgroundHueDeg)
                ? Math.round(((r.backgroundHueDeg % 360) + 360) % 360)
                : null,
            backgroundNeutral:
              r.backgroundNeutral === "black" ||
              r.backgroundNeutral === "white" ||
              r.backgroundNeutral === "gray"
                ? r.backgroundNeutral
                : null,
          };
        })
        .sort((a, b) => {
          const c = safeRoomNameCompare(a.displayName, b.displayName);
          if (c !== 0) return c;
          return a.id.localeCompare(b.id);
        });
      syncRoomSidePanels();
      if (!roomsModal.hidden) {
        renderRoomsModalList();
      }
      return;
    }
    if (msg.type === "playerJoined") {
      lastPlayers = [
        ...lastPlayers,
        {
          ...msg.player,
          y: Number.isFinite(msg.player.y) ? msg.player.y : 0,
          vx: 0,
          vz: 0,
        },
      ];
      if (
        msg.player.address !== selfAddress &&
        !msg.player.displayName.startsWith("[NPC] ")
      ) {
        hud.showPlayerJoinedToast(msg.player.address);
      }
      game.syncState(lastPlayers);
      syncPlayerCountHud();
      refreshWorldcupCrowdRoster();
      return;
    }
    if (msg.type === "playerLeft") {
      lastPlayers = lastPlayers.filter((p) => p.address !== msg.address);
      game.syncState(lastPlayers);
      refreshWorldcupCrowdRoster();
      syncPlayerCountHud();
      return;
    }
    if (msg.type === "state") {
      lastPlayers = msg.players;
      game.syncState(msg.players);
      syncPlayerCountHud();
      refreshWorldcupCrowdRoster();
      if (WORLDCUP_ENABLED_CLIENT) {
        const selfKey = selfAddress.replace(/\s+/g, "").toUpperCase();
        const self = msg.players.find(
          (p) => p.address.replace(/\s+/g, "").toUpperCase() === selfKey
        );
        if (self) worldcupSelfChallengeOpen = !!self.challengeOpen;
      }
      return;
    }
    if (msg.type === "stateDelta") {
      const byAddr = new Map(lastPlayers.map((p) => [p.address, p]));
      for (const p of msg.players) {
        const prev = byAddr.get(p.address);
        const py = Number.isFinite(p.y) ? p.y : 0;
        byAddr.set(p.address, {
          ...(prev ?? {
            address: p.address,
            displayName: p.displayName,
            x: p.x,
            y: py,
            z: p.z,
            vx: 0,
            vz: 0,
          }),
          ...p,
          y: py,
          // Each `stateDelta` entry is a complete per-player snapshot, but the server omits
          // these presence/ephemeral flags when false/absent. Derive them from the delta
          // (not the stale `prev`) so a cleared state can't leak forward — e.g. a finished
          // 1v1 Challenge still offering "Accept 1v1" in the right-click menu.
          nimSendAway: p.nimSendAway,
          chatTyping: p.chatTyping,
          challengeOpen: p.challengeOpen,
          worldcupCountry: p.worldcupCountry,
        });
      }
      lastPlayers = [...byAddr.values()];
      game.syncState(lastPlayers);
      syncPlayerCountHud();
      refreshWorldcupCrowdRoster();
      return;
    }
    if (msg.type === "onlineCount") {
      totalOnlinePlayers = Math.max(0, Math.floor(msg.count));
      syncPlayerCountHud();
      return;
    }
    // worldcup: dynamic soccer ball positions
    if (msg.type === "ballState") {
      game.applyWorldcupBalls(msg.balls);
      return;
    }
    // worldcup: server-controlled Goalie positions
    if (msg.type === "goalieState") {
      game.applyWorldcupGoalies(msg.goalies);
      return;
    }
    // worldcup: a 1v1 spectate portal appeared / refreshed in the current room
    if (msg.type === "matchPortalSpawn") {
      game.addWorldcupPortal({
        matchId: msg.matchId,
        x: msg.x,
        z: msg.z,
        aAddress: msg.aAddress,
        bAddress: msg.bAddress,
        aCountry: msg.aCountry,
        bCountry: msg.bCountry,
        full: msg.full,
      });
      return;
    }
    // worldcup: a 1v1 spectate portal was removed (Match ended)
    if (msg.type === "matchPortalRemove") {
      game.removeWorldcupPortal(msg.matchId);
      return;
    }
    // worldcup: handshake + "Match starting in 3…2…1" countdown before the teleport
    if (msg.type === "matchCountdown") {
      directInviteLobby.hide();
      directInviteActive = false;
      worldcupMatchCountdown?.show({
        durationMs: msg.durationMs,
        selfAddress: address,
        selfCountry: msg.selfCountry,
        opponentAddress: msg.opponentAddress,
        opponentCountry: msg.opponentCountry,
      });
      // worldcup: when the countdown reaches zero the server teleports both players into the
      // Match Pitch. Show the loading screen for that gap; the pitch welcome hides it. If the
      // match is cancelled before then, the welcome (or close) handler clears this timer.
      if (worldcupMatchEnterTimer !== null) clearTimeout(worldcupMatchEnterTimer);
      worldcupMatchEnterTimer = setTimeout(() => {
        worldcupMatchEnterTimer = null;
        beginRoomTransition("", "Entering the match...");
      }, Math.max(0, msg.durationMs));
      return;
    }
    if (msg.type === "directInviteState") {
      directInviteActive = true;
      lastDirectInviteState = msg;
      hud.setPlaySpaceShareVisible(true);
      // Auto-open the share panel once per space (skip when the player just used that space's
      // invite link). Later roster updates only refresh it if it's still open, so a dismissed
      // panel stays closed until the player taps the share button.
      if (directInviteAutoShownSlug !== msg.slug) {
        directInviteAutoShownSlug = msg.slug;
        const arrivedViaThisInviteLink =
          inviteLinkSlug !== null && msg.slug === inviteLinkSlug;
        if (!arrivedViaThisInviteLink) directInviteLobby.show(msg);
      } else if (directInviteLobby.isOpen()) {
        directInviteLobby.show(msg);
      }
      return;
    }
    if (msg.type === "directInviteError") {
      directInviteActive = false;
      directInviteLobby.hide();
      hud.setPlaySpaceShareVisible(false);
      lastDirectInviteState = null;
      directInviteAutoShownSlug = null;
      const text =
        msg.code === "closed"
          ? "Play space closed."
          : msg.code === "expired"
            ? "Play space expired."
            : msg.code === "full"
              ? "This play space is full."
              : (msg.message ?? msg.code);
      if (
        msg.code === "expired" ||
        msg.code === "closed" ||
        msg.code === "full"
      ) {
        const actor = selfAddress.startsWith("guest:") ? selfAddress : address;
        if (actor.startsWith("guest:")) {
          redirectGuestToWalletOnboarding(text);
          return;
        }
      }
      hud.setStatus(text);
      return;
    }
    // worldcup: 1v1 Match live clock + scores
    if (msg.type === "matchState") {
      worldcupMatchHud?.update({
        matchId: msg.matchId,
        scoreA: msg.scoreA,
        scoreB: msg.scoreB,
        phase: msg.phase,
        remainingMs: msg.remainingMs,
        kickoffRemainingMs: msg.kickoffRemainingMs ?? 0,
        aAddress: msg.aAddress,
        bAddress: msg.bAddress,
        aCountry: msg.aCountry,
        bCountry: msg.bCountry,
      });
      if ((msg.kickoffRemainingMs ?? 0) <= 0) {
        finishWorldcupKickoffFreeze();
      }
      // The Match Pitch crowd splits by side: side a's half waves a's flag, b's half b's.
      game.setWorldcupCrowdSideFlags(msg.aCountry, msg.bCountry);
      // Record the two players so any other avatar in the pitch is seated on the stands.
      game.setWorldcupMatchParticipants(msg.aAddress, msg.bAddress);
      // If we're on the pitch but not a player, we're a Spectator (fixed in the stands).
      const selfKey = selfAddress.replace(/\s+/g, "").toUpperCase();
      const aKey = msg.aAddress.replace(/\s+/g, "").toUpperCase();
      const bKey = msg.bAddress.replace(/\s+/g, "").toUpperCase();
      const selfSide: "a" | "b" | null =
        aKey === selfKey ? "a" : bKey === selfKey ? "b" : null;
      const isParticipant = selfSide !== null;
      const nowSpectating =
        worldcupIsMatchPitchRoomId(worldcupCurrentRoomId) && !isParticipant;
      // Spectators see the whole pitch at a locked zoom; participants get the normal follow cam.
      game.setWorldcupSpectatorView(nowSpectating);
      // Participants get an arrow above the goal they attack; Spectators get none.
      game.setWorldcupAttackGoal(selfSide);
      // Default side a's camera to 180 degrees once on entry (still re-orbitable by the user).
      if (selfSide && worldcupAppliedMatchSide !== selfSide) {
        game.setWorldcupMatchOrientation(selfSide);
        worldcupAppliedMatchSide = selfSide;
      }
      if (nowSpectating !== worldcupSpectating) {
        worldcupSpectating = nowSpectating;
        updateWorldcupJoystickVisibility();
      }
      return;
    }
    // worldcup: a goal in the 1v1 Match — erupt the crowd, flash the goal banner, and (if play
    // continues) run the kickoff countdown while both players are frozen at their spawns.
    if (msg.type === "matchGoal") {
      game.worldcupCrowdCheer(1);
      if (msg.kickoffMs > 0) {
        game.setWorldcupMoveLocked(true);
      }
      worldcupMatchHud?.flashGoal(
        msg.side,
        msg.scoreA,
        msg.scoreB,
        msg.country,
        msg.kickoffMs,
        msg.kickoffMs > 0 ? finishWorldcupKickoffFreeze : undefined
      );
      return;
    }
    // worldcup: 1v1 Match finished — show the result banner (entrants are returned shortly).
    if (msg.type === "matchEnded") {
      game.worldcupCrowdCheer(1);
      game.setWorldcupMoveLocked(false);
      worldcupMatchHud?.showResult(
        msg.outcome,
        msg.scoreA,
        msg.scoreB,
        msg.aAddress,
        msg.bAddress,
        msg.aCountry,
        msg.bCountry
      );
      return;
    }
    if (msg.type === "goalScored") {
      game.worldcupCrowdCheer(1);
      if (worldcupScoreboard) {
        worldcupScoreboard.setLeaderboard(msg.topCountries);
        worldcupScoreboard.flashGoal(msg.scorerName, msg.country);
        const norm = (a: string) => a.replace(/\s+/g, "").toUpperCase();
        const isSelf =
          msg.scorerAddress &&
          selfAddress &&
          norm(msg.scorerAddress) === norm(selfAddress);
        if (isSelf && !msg.country && !worldcupAutoPromptShown) {
          worldcupAutoPromptShown = true;
          worldcupScoreboard.openPicker({
            prompt: "You scored! Pick your country so your goals count.",
            dismissable: true,
          });
        }
      }
      return;
    }
    if (msg.type === "goalRewardOutcome") {
      // Only the scorer receives this; show a small personal note under the GOAL banner.
      if (worldcupScoreboard) {
        if (msg.reason === "ok" && msg.amountNim) {
          worldcupScoreboard.flashReward("earned", `+${msg.amountNim} NIM earned!`);
        } else if (msg.reason === "wallet_cap") {
          worldcupScoreboard.flashReward(
            "capped",
            "Daily NIM cap reached — keep scoring for fun!"
          );
        } else if (msg.reason === "budget_exhausted") {
          worldcupScoreboard.flashReward(
            "capped",
            "Today's NIM rewards are all claimed — back tomorrow!"
          );
        }
      }
      return;
    }
    if (msg.type === "worldcupLeaderboard") {
      applySelfCountry(msg.selfCountry);
      if (worldcupScoreboard) {
        worldcupScoreboard.setSelfCountry(msg.selfCountry);
        worldcupScoreboard.setLeaderboard(msg.topCountries);
        if (msg.prevWinnerCountry !== undefined) {
          worldcupScoreboard.setPreviousWinner(msg.prevWinnerCountry);
        }
      }
      if (msg.prevWinnerCountry !== undefined) {
        game.setWorldcupCrowdFlag(msg.prevWinnerCountry);
      }
      return;
    }
    if (msg.type === "gateWalkBlocked") {
      const bx = Number(msg.x);
      const bz = Number(msg.z);
      const by = Math.max(0, Math.min(2, Math.floor(Number(msg.y ?? 0))));
      if (Number.isFinite(bx) && Number.isFinite(bz)) {
        game.showFloatingText(bx, bz, "You can't walk into that");
      }
      return;
    }
    if (msg.type === "chat") {
      if (
        pendingCreateRoomAwaiting &&
        String(msg.fromAddress).toUpperCase() === "SYSTEM"
      ) {
        pendingCreateRoomAwaiting = false;
        roomsCreateSubmitBtn.disabled = false;
        roomsCreateHint.textContent = msg.text;
        roomsCreateHint.hidden = false;
      }
      // Show chat bubble for all messages
      game.showChatBubble(msg.fromAddress, msg.text, msg.from);
      
      // Only add to chat log if not bubble-only (NPCs use bubbleOnly)
      if (!msg.bubbleOnly) {
        const selfKey = address.replace(/\s+/g, "").trim().toUpperCase();
        const fromKey = String(msg.fromAddress ?? "")
          .replace(/\s+/g, "")
          .trim()
          .toUpperCase();
        hud.appendChat(msg.from, msg.text, {
          fromAddress: msg.fromAddress || undefined,
          profileIsSelf: !!fromKey && fromKey === selfKey,
        });
      }
      return;
    }
    if (msg.type === "blockClaimOffered") {
      const offeredY = msg.y ?? 0;
      if (
        nimClaimUiRef &&
        nimClaimUiRef.blockX === msg.x &&
        nimClaimUiRef.blockZ === msg.z &&
        nimClaimUiRef.blockY === offeredY
      ) {
        nimClaimUiRef.claimId = msg.claimId;
        nimClaimUiRef.holdMs = Math.max(500, msg.holdMs);
        nimClaimUiRef.rewardHoldSince = null;
        nimClaimUiRef.completeSent = false;
      }
      return;
    }
    if (msg.type === "blockClaimResult") {
      if (msg.ok) {
        const bx = Number(msg.x);
        const bz = Number(msg.z);
        const reward = msg.amountNim && /^\d+\.\d{4}$/.test(msg.amountNim)
          ? msg.amountNim
          : "1.0000";
        cancelActiveNimClaim?.();
        if (Number.isFinite(bx) && Number.isFinite(bz)) {
          game.showFloatingText(bx, bz, `+${reward} NIM`, "#ffc107", {
            nimLogo: true,
          });
        }
        return;
      }
      if (msg.recoverable) {
        if (msg.reason) {
          hud.appendChat("System", msg.reason);
        }
        if (nimClaimUiRef) {
          nimClaimUiRef.completeSent = false;
        }
        return;
      }
      const bx = Number(msg.x);
      const bz = Number(msg.z);
      if (
        msg.reason === "Nothing here :(" &&
        Number.isFinite(bx) &&
        Number.isFinite(bz)
      ) {
        game.showFloatingText(bx, bz, "Nothing here :(");
      }
      cancelActiveNimClaim?.();
      nimClaimUiRef = null;
      hud.setNimClaimProgress(null);
      if (msg.reason && msg.reason !== "Nothing here :(") {
        hud.appendChat("System", msg.reason);
      }
      return;
    }
    if (msg.type === "obstacles") {
      game.setObstacles(msg.tiles);
      if (editingTile) {
        const m = game.getPlacedAt(editingTile.x, editingTile.z, editingTile.y);
        if (!m) {
          editingTile = null;
          hud.hideObjectEditPanel();
          game.clearSelectedBlock();
        } else if (m.teleporter) {
          teleporterPanelRefreshFromPlaced(
            editingTile.x,
            editingTile.z,
            editingTile.y,
            m,
            game.getRoomId()
          );
        } else {
          hud.setObjectPanelProps(
            placedMetaToPanelObstacleProps(
              editingTile.x,
              editingTile.z,
              editingTile.y,
              m
            )
          );
        }
      }
      syncBuildHud();
    }
    if (msg.type === "obstaclesDelta") {
      game.applyObstaclesDelta(msg.add, msg.remove);
      if (editingTile) {
        const m = game.getPlacedAt(editingTile.x, editingTile.z, editingTile.y);
        if (!m) {
          editingTile = null;
          hud.hideObjectEditPanel();
          game.clearSelectedBlock();
        } else if (m.teleporter) {
          teleporterPanelRefreshFromPlaced(
            editingTile.x,
            editingTile.z,
            editingTile.y,
            m,
            game.getRoomId()
          );
        } else {
          hud.setObjectPanelProps(
            placedMetaToPanelObstacleProps(
              editingTile.x,
              editingTile.z,
              editingTile.y,
              m
            )
          );
        }
      }
      syncBuildHud();
    }
    if (msg.type === "extraFloor") {
      game.setExtraFloorTiles(msg.tiles);
      syncBuildHud();
    }
    if (msg.type === "extraFloorDelta") {
      game.applyExtraFloorDelta(msg.add, msg.remove);
      syncBuildHud();
    }
    if (msg.type === "baseFloorColorDelta") {
      if (normalizeRoomId(msg.roomId) === normalizeRoomId(game.getRoomId())) {
        game.applyBaseFloorColorDelta(msg.add, msg.remove, msg.loadChunks);
      }
      syncBuildHud();
    }
    if (msg.type === "removedBaseFloorDelta") {
      if (normalizeRoomId(msg.roomId) === normalizeRoomId(game.getRoomId())) {
        game.applyRemovedBaseFloorDelta(msg.add, msg.remove);
      }
      syncBuildHud();
    }
    if (msg.type === "canvasClaim") {
      // Special case: x=-1, z=-1, address="" means clear all claims
      if (msg.x === -1 && msg.z === -1 && msg.address === "") {
        game.clearAllCanvasClaims();
      } else {
        game.applyCanvasClaim(msg.x, msg.z, msg.address);
      }
      // Update leaderboard in real-time when tiles are claimed
      updateCanvasLeaderboard();
    }
    if (msg.type === "canvasTimer") {
      hud.setCanvasTimer(msg.timeRemaining);
    }
    if (msg.type === "canvasCountdown") {
      hud.setCanvasCountdown(msg.text, msg.msRemaining);
      return;
    }
    if (msg.type === "designPublished") {
      prefabUi.setPublishBusy(false);
      prefabUi.closePublishModal();
      hud.appendChat(
        "System",
        `Object prefab published: "${msg.design.name}" (${msg.design.footprintW}×${msg.design.footprintD}).`
      );
      prefabSnapshotCache.delete(msg.design.id);
      void fetchPlaceableDesigns();
      if (prefabUi.getSelectedDesignId() === msg.design.id) {
        void loadPrefabSnapshotForDesign(msg.design);
      }
      return;
    }
    if (msg.type === "designDeleted") {
      prefabSnapshotCache.delete(msg.designId);
      if (prefabUi.getSelectedDesignId() === msg.designId) {
        prefabUi.selectDesign(null);
        game.setObjectPrefabPlaceDesign(null);
        game.setObjectPrefabPlaceSnapshot(null);
      }
      void fetchPlaceableDesigns();
      hud.appendChat("System", "Prefab deleted.");
      return;
    }
    if (msg.type === "designUpdated") {
      prefabSnapshotCache.delete(msg.design.id);
      void fetchPlaceableDesigns();
      hud.appendChat(
        "System",
        `Prefab "${msg.design.name}" is now ${msg.design.visibility === "public" ? "public" : "private"}.`
      );
      return;
    }
    if (msg.type === "designStampResult") {
      if (msg.ok) {
        const n = msg.obstacleCount ?? 0;
        hud.appendChat(
          "System",
          n > 0 ? `Placed prefab (${n} blocks).` : "Placed prefab."
        );
      } else {
        const stampMessages: Record<string, string> = {
          not_entitled: "You are not allowed to place this prefab.",
          out_of_bounds: "Prefab does not fit here.",
          unwalkable_tile: "Prefab needs walkable floor tiles.",
          overlap: "Could not replace blocks in this area.",
          player_on_tile: "A player is standing in the footprint.",
          out_of_range: "Too far away to place.",
          room_not_supported: "You cannot place prefabs in this room.",
          design_not_found: "Prefab not found.",
          snapshot_missing: "Prefab data is missing.",
          empty_design: "Prefab is empty.",
          no_bounds: "Room has no build bounds.",
        };
        const code = msg.code ?? "error";
        hud.appendChat(
          "System",
          stampMessages[code] ?? `Could not place prefab (${code}).`
        );
      }
      return;
    }
    if (msg.type === "error") {
      // worldcup: the spectate portal is at capacity.
      if (msg.code === "spectate_full") {
        hud.appendChat("System", "This match's stands are full — try again shortly.");
      }
      // Handle canvas cooldown error
      if (msg.code === "CANVAS_COOLDOWN") {
        // Don't need to do anything special - server already sent chat message
        // and the connection will be closed, triggering a reconnect to hub
      }
      if (msg.code === "billboard_forbidden") {
        hud.appendChat(
          "System",
          "Only whoever placed this billboard (or an admin) can edit, move, or remove it."
        );
      }
      if (
        msg.code === "invalid_message" ||
        msg.code === "not_signboard_owner" ||
        msg.code === "signboard_not_found"
      ) {
        hud.reportSignReadSaveError(String(msg.code ?? ""));
      }
      if (msg.code === "billboard_admin_only") {
        hud.appendChat(
          "System",
          "Only admins can place billboards right now."
        );
      }
      if (msg.code === "publish_design_forbidden") {
        hud.appendChat(
          "System",
          "You cannot publish prefabs in this room."
        );
        hud.getObjectPrefabAuthoringUi().setPublishBusy(false);
      }
      if (
        msg.code === "design_not_found" ||
        msg.code === "design_delete_forbidden" ||
        msg.code === "design_visibility_forbidden"
      ) {
        const designErr: Record<string, string> = {
          design_not_found: "Prefab not found.",
          design_delete_forbidden: "You cannot delete that prefab.",
          design_visibility_forbidden: "You cannot change that prefab's visibility.",
        };
        hud.appendChat("System", designErr[msg.code] ?? "Could not update prefab.");
      }
      if (
        msg.code === "footprint_too_large" ||
        msg.code === "too_many_obstacles" ||
        msg.code === "empty_selection" ||
        msg.code === "name_required" ||
        msg.code === "name_too_long"
      ) {
        const publishErr: Record<string, string> = {
          footprint_too_large: "Selection is too large (max 6×6).",
          too_many_obstacles: "Too many blocks in this area.",
          empty_selection: "No blocks in this area.",
          name_required: "Name is required.",
          name_too_long: "Name must be 12 characters or fewer.",
        };
        hud.getObjectPrefabAuthoringUi().showPublishError(
          publishErr[msg.code] ?? msg.code.replace(/_/g, " ")
        );
      }
      if (msg.code === "billboard_vertical_disabled") {
        hud.appendChat(
          "System",
          "2×1 (vertical) billboards are temporarily unavailable."
        );
      }
      if (msg.code === "invalid_billboard_advert") {
        hud.appendChat("System", "That billboard advert is not available.");
      }
      if (msg.code === "invalid_rotation_set") {
        hud.appendChat("System", "That campaign rotation set is not available.");
      }
      if (
        msg.code === "invalid_billboard_visit_url" ||
        msg.code === "invalid_billboard_url"
      ) {
        hud.appendChat(
          "System",
          "That billboard link is not allowed (HTTPS links only)."
        );
      }
      if (msg.code === "channel_muted") {
        hud.appendChat("System", "Muted.");
      }
      if (msg.code === "chat_blocked_profanity") {
        hud.appendChat("System", "Message blocked (inappropriate language).");
      }
    }
    if (msg.type === "signboards") {
      game.setSignboards(msg.signboards);
      hud.syncSignReadFromSignboards(msg.signboards);
      hud.syncSignboardTooltipFromSignboards(msg.signboards);
    }
    if (msg.type === "billboards") {
      game.setBillboards(msg.billboards, { refreshRotationContent: false });
    }
    if (msg.type === "voxelTexts") {
      game.setVoxelTextsForRoom(msg.roomId, msg.texts);
      return;
    }
  };

  let loadingBlackoutReveal = false;

  const connectToRoom = (
    room: string,
    spawn?: { x: number; z: number },
    opts?: { resume?: boolean; blackout?: boolean }
  ): void => {
    connectGen += 1;
    const myGen = connectGen;
    clearWelcomeDeadlineTimer();
    if (opts?.resume) {
      loadingBlackoutReveal = opts.blackout === true;
      clearRoomTransitionProgressTimer();
      if (loadingBlackoutReveal) {
        hud.setLoadingVisible(true, { blackout: true });
      } else {
        hud.setLoadingLabel("Loading…");
        hud.setLoadingProgress("indeterminate");
        hud.setLoadingVisible(true);
      }
    } else {
      beginRoomTransition(room);
    }
    requestAnimationFrame(() => {
      if (myGen !== connectGen) return;
      if (
        ws &&
        (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
      ) {
        ws.close();
      }
      ws = connectGameWs(
        token,
        room,
        (msg) => {
          if (myGen !== connectGen) return;
          void handleServerMessage(msg);
        },
        (ev) => {
          if (myGen !== connectGen) return;
          clearWelcomeDeadlineTimer();
          if (ev.code === 4001) {
            clearCachedSession();
            location.reload();
            return;
          }
          const guestActor = selfAddress.startsWith("guest:") ? selfAddress : address;
          if (
            guestActor.startsWith("guest:") &&
            (ev.code === 4003 || ev.code === 4004)
          ) {
            redirectGuestToWalletOnboarding(
              ev.code === 4003
                ? "Your guest session is no longer valid."
                : "This play space has closed — sign in with a wallet or get Nimiq Pay to keep exploring."
            );
            return;
          }
          if (ev.code === 4403) {
            streamDirector?.stop();
            hud.setStreamFollowBar({ visible: false });
            streamDirector = null;
            hud.setStreamCinemaMode(false);
            hud.setStreamBroadcastOverlay({ visible: false });
            game.setStreamPresentationActive(false);
            game.setStreamObserverMode(false);
            game.setContinuousRender(false);
            hud.setLoadingVisible(false, { skipMinWait: true });
            hud.setReconnectOffer(false);
            hud.setStatus(
              "Stream view is restricted — sign in with an authorized stream wallet, or remove ?stream=1 from the URL."
            );
            perfPingSentAt.clear();
            hud.setPerfHudLatencyMs(null);
            return;
          }
          const restartDrop = hud.consumeRestartDisconnectForStatus();
          if (worldcupMatchEnterTimer !== null) {
            clearTimeout(worldcupMatchEnterTimer);
            worldcupMatchEnterTimer = null;
          }
          hud.setLoadingVisible(false, { skipMinWait: true });
          hud.setReconnectOffer(true);
          hud.setStatus(
            restartDrop
              ? "Server restart — tap Reconnect or wait a moment"
              : "Disconnected — tap Reconnect or reload"
          );
          perfPingSentAt.clear();
          hud.setPerfHudLatencyMs(null);
        },
        {
          ...(opts?.resume
            ? { resume: true }
            : spawn
              ? { spawnX: spawn.x, spawnZ: spawn.z }
              : {}),
          stream: streamMode,
        }
      );
      wireWsHandlers(ws);
      welcomeDeadlineTimer = setTimeout(() => {
        welcomeDeadlineTimer = null;
        if (disposed || myGen !== connectGen) return;
        hud.setLoadingVisible(false, { skipMinWait: true });
        hud.setReconnectOffer(true);
        hud.setStatus(
          "No response from server — tap Reconnect, or start the game server if it stopped"
        );
      }, 35_000);
    });
  };

  if (!streamMode) {
    idleCleanup = startIdleReturnToHub(IDLE_RETURN_HUB_MS, () => {
      if (disposed) return;
      connectToRoom(CHAMBER_ROOM_ID, {
        x: CHAMBER_DEFAULT_SPAWN.x,
        z: CHAMBER_DEFAULT_SPAWN.z,
      });
      hud.setStatus(
        "Returned to the chamber after 15 minutes inactive — explore again anytime"
      );
    });
  }

  game.setRoomChangeHandler((targetRoomId, spawnX, spawnZ) => {
    connectToRoom(targetRoomId, { x: spawnX, z: spawnZ });
  });

  game.setSignboardHoverHandler((signboard) => {
    hud.setSignboardTooltip(signboard);
  });

  hud.onReturnHome(() => {
    connectToRoom(CHAMBER_ROOM_ID, {
      x: CHAMBER_DEFAULT_SPAWN.x,
      z: CHAMBER_DEFAULT_SPAWN.z,
    });
  });
  hud.setFeedbackHandlers({
    createTicket: async (kind, message, opts) => {
      const text = message.trim();
      if (!text) {
        return {
          ok: false,
          error: opts?.source === "report"
            ? "Please explain why you are reporting this message."
            : "Please enter a message.",
        };
      }
      const maxLen = opts?.source === "report" ? 400 : 700;
      if (text.length > maxLen) {
        return { ok: false, error: "Message is too long." };
      }
      if (opts?.source === "report" && !opts.report?.reportedWallet) {
        return { ok: false, error: "Invalid report." };
      }
      try {
        const { resolveApiBaseUrl } = await import("./net/apiBase.js");
        const base = resolveApiBaseUrl() || "";
        const res = await fetch(`${base}/api/feedback`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            kind,
            message: text,
            ...(opts?.source === "report"
              ? { source: "report", report: opts.report }
              : {}),
          }),
        });
        if (res.ok) {
          hud.appendChat("System", "Feedback sent. Thank you!");
          return { ok: true };
        }
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          retryAfterMs?: number;
        };
        if (body.error === "daily_ticket_limit") {
          const err = "Daily feedback limit reached (max 3 new tickets per day).";
          hud.appendChat("System", err);
          return { ok: false, error: err };
        }
        if (res.status === 429 && typeof body.retryAfterMs === "number") {
          const s = Math.max(1, Math.ceil(body.retryAfterMs / 1000));
          const err = `Please wait ${s}s before sending again.`;
          hud.appendChat("System", `Feedback rate limit: please wait ${s}s.`);
          return { ok: false, error: err };
        }
        return { ok: false, error: "Could not send feedback right now." };
      } catch {
        return { ok: false, error: "Could not send feedback right now." };
      }
    },
    listMine: async () => {
      try {
        const { resolveApiBaseUrl } = await import("./net/apiBase.js");
        const base = resolveApiBaseUrl() || "";
        const res = await fetch(`${base}/api/feedback/mine`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ok: false, error: "Could not load your feedback." };
        const data = (await res.json()) as {
          tickets?: unknown[];
          unreadCount?: number;
        };
        return {
          ok: true,
          tickets: (data.tickets ?? []) as import("./ui/hud.js").FeedbackTicketSummary[],
          unreadCount:
            typeof data.unreadCount === "number" ? data.unreadCount : undefined,
        };
      } catch {
        return { ok: false, error: "Could not load your feedback." };
      }
    },
    getTicket: async (id) => {
      try {
        const { resolveApiBaseUrl } = await import("./net/apiBase.js");
        const base = resolveApiBaseUrl() || "";
        const res = await fetch(`${base}/api/feedback/${encodeURIComponent(id)}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ok: false, error: "Could not open that ticket." };
        const data = (await res.json()) as { ticket?: import("./ui/hud.js").FeedbackTicketDetail };
        if (!data.ticket) return { ok: false, error: "Could not open that ticket." };
        return { ok: true, ticket: data.ticket };
      } catch {
        return { ok: false, error: "Could not open that ticket." };
      }
    },
    reply: async (id, message) => {
      const text = message.trim();
      if (!text) return { ok: false, error: "Please enter a reply." };
      if (text.length > 700) {
        return { ok: false, error: "Reply is too long (max 700 characters)." };
      }
      try {
        const { resolveApiBaseUrl } = await import("./net/apiBase.js");
        const base = resolveApiBaseUrl() || "";
        const res = await fetch(
          `${base}/api/feedback/${encodeURIComponent(id)}/messages`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message: text }),
          }
        );
        if (res.ok) return { ok: true };
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          retryAfterMs?: number;
        };
        if (body.error === "ticket_closed") {
          return { ok: false, error: "This ticket is closed." };
        }
        if (res.status === 429 && typeof body.retryAfterMs === "number") {
          const s = Math.max(1, Math.ceil(body.retryAfterMs / 1000));
          return { ok: false, error: `Please wait ${s}s before sending again.` };
        }
        return { ok: false, error: "Could not send reply." };
      } catch {
        return { ok: false, error: "Could not send reply." };
      }
    },
  });
  hud.onPortalEnter(() => {
    if (portalAction?.kind === "door") {
      const d = game.getStandingDoor();
      if (d) beginRoomTransition(d.targetRoomId);
      void game.triggerStandingDoorTransition();
      return;
    }
    if (portalAction?.kind === "billboard") {
      const {
        visitUrl,
        visitName,
        miniappTargetUrl,
        campaignId,
        billboardId,
      } = portalAction;
      const displayUrl =
        visitUrl ||
        (miniappTargetUrl ? miniappTargetToHttpsUrl(miniappTargetUrl) : "");
      const reportLinkClick = (): void => {
        if (campaignId && ws && ws.readyState === WebSocket.OPEN) {
          sendCampaignLinkClick(ws, { campaignId, billboardId });
        }
      };
      if (miniappTargetUrl) {
        hud.showNavigateAwayConfirm({
          kind: "miniapp",
          url: displayUrl,
          displayName: visitName,
          onConfirm: () => {
            reportLinkClick();
            markGameReturnResume();
            openMiniappTarget(miniappTargetUrl);
          },
        });
        return;
      }
      hud.showNavigateAwayConfirm({
        kind: "external",
        url: displayUrl,
        displayName: visitName,
        onConfirm: () => {
          reportLinkClick();
          window.open(visitUrl, "_blank", "noopener,noreferrer");
        },
      });
      return;
    }
    if (portalAction?.kind === "spectate" && ws) {
      // worldcup: walk-on + intent to spectate. Show the loading screen while the server
      // drops us into the Match Pitch stands. Skip the loading screen when the stands are
      // full so a rejected request doesn't strand us on a black screen.
      if (!portalAction.full) beginRoomTransition(portalAction.matchId);
      sendRequestSpectate(ws, portalAction.matchId);
      return;
    }
    if (
      (portalAction?.kind === "canvas-exit" || portalAction?.kind === "teleporter") &&
      ws
    ) {
      sendEnterPortal(ws);
    }
  });

  hud.onReturnToLobby(() => {
    disposeToMenu();
  });

  hud.onReconnect(() => {
    if (disposed) return;
    hud.setReconnectOffer(false);
    hud.setStatus("Connecting…");
    connectToRoom(CHAMBER_ROOM_ID, undefined, { resume: true });
  });

  if (streamMode) {
    connectToRoom(PIXEL_ROOM_ID, {
      x: PIXEL_DEFAULT_SPAWN.x,
      z: PIXEL_DEFAULT_SPAWN.z,
    });
  } else {
    const initialRoomId = resolveInitialRoomId();
    // Entering a Play Space must honor the explicit room (no resume → chamber fallback).
    connectToRoom(initialRoomId, undefined, {
      resume: !isInviteLobbyRoomId(initialRoomId),
      blackout: true,
    });
  }

  syncBuildHud();

  chatInput = hud.getChatInput();
  chatInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      notifyChatNotTyping();
      const t = chatInput!.value.trim();
      chatInput!.value = "";
      if (t) ws && sendChat(ws, t);
      chatInput!.blur();
      e.preventDefault();
    }
  });
  chatInput.addEventListener("input", onChatComposing, { signal: ac.signal });
  chatInput.addEventListener("blur", () => notifyChatNotTyping(), {
    signal: ac.signal,
  });

  /** Mobile: dismissing the keyboard often leaves the input focused; taps then reopen it. */
  if (isCoarsePointer) {
    chatInput.setAttribute("inputmode", "none");
    const onChatInputModeFocus = (): void => {
      chatInput.removeAttribute("inputmode");
    };
    const onChatInputModeBlur = (): void => {
      chatInput.setAttribute("inputmode", "none");
    };
    chatInput.addEventListener("focus", onChatInputModeFocus, { signal: ac.signal });
    chatInput.addEventListener("blur", onChatInputModeBlur, { signal: ac.signal });

    const onWindowPointerDownBlurChat = (e: PointerEvent): void => {
      if (e.button !== 0 || disposed) return;
      if (document.activeElement !== chatInput) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      const chatShell = chatInput.closest(".hud-bottom-left");
      if (chatShell?.contains(t)) return;
      chatInput.blur();
    };
    window.addEventListener("pointerdown", onWindowPointerDownBlurChat, {
      capture: true,
      signal: ac.signal,
    });
  }

  window.addEventListener(
    "keydown",
    (e) => {
      const ae = document.activeElement;
      const tag = ae?.tagName ?? "";
      const inFormField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (ae instanceof HTMLElement && ae.isContentEditable);
      /** Hex popover: letters go into the field only; Escape still exits build (below). */
      if (isPaletteHueHexPopoverTyping() && e.key !== "Escape") {
        return;
      }
      if (
        game.getBuildMode() &&
        !inFormField &&
        !e.altKey &&
        (e.key === "m" || e.key === "M")
      ) {
        if (game.tryToggleRepositionWithKeyboard()) {
          e.preventDefault();
          return;
        }
      }
      if (
        !inFormField &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === "p" || e.key === "P")
      ) {
        if (game.toggleFirstPersonView()) {
          e.preventDefault();
          return;
        }
      }
      if (e.altKey) {
        if (!adminOverlay.isVoxelEditorOpen()) return;
        const syncActiveVoxelText = (): void => {
          const activeId = game.getActiveVoxelTextId();
          if (!activeId || !ws) return;
          const spec = game.getVoxelTextSpec(activeId);
          if (!spec) return;
          sendSetVoxelText(ws, spec);
        };
        const k = e.key;
        const step = game.voxelWordMoveStep();
        const active = game.getActiveVoxelTextId() ?? "none";
        if (e.shiftKey && (k === "ArrowUp" || k === "ArrowDown")) {
          e.preventDefault();
          const id = game.getActiveVoxelTextId();
          if (!id) return;
          const cur = game.getVoxelTextSpec(id);
          if (!cur) return;
          const nextY = cur.y + (k === "ArrowUp" ? step : -step);
          game.updateVoxelText(id, { y: nextY });
          syncActiveVoxelText();
          hud.setStatus(
            `Voxel text "${active}" moved ${k === "ArrowUp" ? "+Z" : "-Z"}`
          );
          return;
        }
        if (k === "ArrowUp") {
          e.preventDefault();
          game.moveVoxelWord(0, -step);
          syncActiveVoxelText();
          hud.setStatus(`Voxel text "${active}" moved up`);
          return;
        }
        if (k === "ArrowDown") {
          e.preventDefault();
          game.moveVoxelWord(0, step);
          syncActiveVoxelText();
          hud.setStatus(`Voxel text "${active}" moved down`);
          return;
        }
        if (k === "ArrowLeft") {
          e.preventDefault();
          game.moveVoxelWord(-step, 0);
          syncActiveVoxelText();
          hud.setStatus(`Voxel text "${active}" moved left`);
          return;
        }
        if (k === "ArrowRight") {
          e.preventDefault();
          game.moveVoxelWord(step, 0);
          syncActiveVoxelText();
          hud.setStatus(`Voxel text "${active}" moved right`);
          return;
        }
        if (k === "q" || k === "Q") {
          e.preventDefault();
          game.rotateVoxelWord(-game.voxelWordRotateStepRad());
          syncActiveVoxelText();
          hud.setStatus(`Voxel text "${active}" rotated CCW`);
          return;
        }
        if (k === "e" || k === "E") {
          e.preventDefault();
          game.rotateVoxelWord(game.voxelWordRotateStepRad());
          syncActiveVoxelText();
          hud.setStatus(`Voxel text "${active}" rotated CW`);
          return;
        }
      }
      if (e.key === "Enter") {
        const ae = document.activeElement;
        if (ae === chatInput) return;
        if (
          ae &&
          (ae.tagName === "INPUT" ||
            ae.tagName === "TEXTAREA" ||
            ae.tagName === "SELECT")
        ) {
          return;
        }
        e.preventDefault();
        if (hud.isChatMinimized()) {
          hud.setChatMinimized(false);
        }
        chatInput.focus();
        return;
      }
      if (e.key === "Escape") {
        if (document.activeElement === chatInput) return;
        if (game.isTeleporterDestPickActive()) {
          game.setTeleporterDestPickHandler(null);
          syncBuildHud();
          return;
        }
        if (game.isRepositioning()) {
          game.cancelReposition();
          syncBuildHud();
          return;
        }
        if (game.getFloorExpandMode()) {
          hud.clearRoomEntrySpawnPickUi();
          game.setRoomEntrySpawnPickHandler(null);
          game.setFloorExpandMode(false);
          syncBuildHud();
          return;
        }
        if (editingTile) {
          editingTile = null;
          hud.hideObjectEditPanel();
        }
        if (game.isPrefabPlacePreviewArmed()) {
          game.cancelPrefabPlacePreview();
          syncPrefabPlacePreviewHud();
          syncBuildHud();
          e.preventDefault();
          return;
        }
        // Return to walk mode if in any build mode
        if (game.getBuildMode()) {
          game.setBuildMode(false);
          syncObjectPrefabModes("prefab");
          syncBuildHud();
        }
        game.clearSelectedBlock();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        if (inFormField) return;

        const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
        if (isCanvas || !roomAllowExtraFloor) return;
        
        game.setFloorExpandMode(!game.getFloorExpandMode());
        syncBuildHud();
        return;
      }
      if (e.key === "b" || e.key === "B") {
        if (inFormField) return;

        const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
        if (isCanvas || isPixelRoomId(game.getRoomId()) || !roomAllowPlaceBlocks) return;
        
        const next = !game.getBuildMode();
        game.setBuildMode(next);
        if (!next) {
          editingTile = null;
          hud.hideObjectEditPanel();
          game.clearSelectedBlock();
          syncObjectPrefabModes("prefab");
        }
        syncBuildHud();
      }
      if (game.getBuildMode() && !inFormField) {
        const k = e.key;
        if (k === "d" || k === "D") {
          if (hud.isObjectSelectionActive()) {
            removeSelectedPlacedObject();
          }
          e.preventDefault();
          return;
        }
        if (k === "r" || k === "R") {
          if (hud.isGateModeActive() && hud.rotateRampToward(1)) {
            e.preventDefault();
            return;
          }
          if (game.cycleBillboardInteractionYaw(1)) {
            e.preventDefault();
            return;
          }
          if (hud.rotateRampToward(1)) {
            e.preventDefault();
            return;
          }
        }
      }
    },
    { signal }
  );

  hud.onFullscreenToggle(() => {
    void (async () => {
      const host = hudRoot;
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
        return;
      }
      if (isPseudoFullscreenActive()) {
        setPseudoFullscreen(false);
        return;
      }
      if (typeof window !== "undefined" && window.nimiqPay != null) {
        requestMiniAppImmersiveLayout();
      }
      const entered = await tryRequestFullscreen(host);
      if (!entered) {
        setPseudoFullscreen(true);
      }
    })();
  });

  let last = performance.now();
  /** Smoothed inter-RAF cadence (Hz); reflects how often `loop` runs, not monitor refresh. */
  let debugDispHzSmoothed = 60;
  /** Smoothed previous-frame RAF callback duration (ms); CPU/work in the game loop. */
  let debugLoopMsSmoothed = 16.67;
  /** Previous RAF callback wall (ms); used before this frame's `loopEnd` is known. */
  let prevRafCallbackMsForDebugFps = 16.67;

  function loop(now: number): void {
    if (disposed) return;
    const loopStart = performance.now();
    const rawDelta = now - last;
    /** Inter-RAF spacing for sim + HUD; clamp non-positive (clock blips) and huge tab-background gaps. */
    let rawMs = rawDelta;
    if (!Number.isFinite(rawDelta) || rawDelta <= 0) {
      rawMs = 1000 / 60;
    } else if (rawDelta > 120_000) {
      rawMs = 120_000;
    }
    const dt = Math.min(0.05, rawMs / 1000);
    last = now;
    game.tick(dt);
    syncPortalEnterButton();
    if (worldcupBallEdgeMarker) {
      if (
        worldcupIsFieldLikeRoomId(worldcupCurrentRoomId) &&
        !worldcupSpectating
      ) {
        const vw = canvasHost.clientWidth;
        const vh = canvasHost.clientHeight;
        worldcupBallEdgeMarker.update(
          game.getPrimaryWorldcupBallScreenPosition(),
          { width: vw, height: vh }
        );
      } else {
        worldcupBallEdgeMarker.hide();
      }
    }
    sampleCampaignImpressions(now);
    if (hud.isActionWheelOpen()) {
      const ea = game.getSelfScreenPosition(0.45);
      const pos = game.getSelfPosition();
      const floor = pos ? snapFloorTile(pos.x, pos.z) : null;
      hud.setActionWheelAnchor(ea ? ea.x : null, ea ? ea.y : null, floor);
    }
    if (hud.isDebugPanelVisible()) {
      const rawClamped = Math.min(400, Math.max(1, rawMs));
      const instHz = 1000 / rawClamped;
      debugDispHzSmoothed = debugDispHzSmoothed * 0.9 + instHz * 0.1;
      const loopClamped = Math.min(400, Math.max(0.5, prevRafCallbackMsForDebugFps));
      debugLoopMsSmoothed = debugLoopMsSmoothed * 0.9 + loopClamped * 0.1;
      const d = game.getDebugStats();
      const b = d.bounds;
      const pos = d.selfPosition;
      const posStr = pos
        ? `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
        : "—";
      const wsLabel = (() => {
        if (!ws) return "—";
        switch (ws.readyState) {
          case WebSocket.CONNECTING:
            return "connecting";
          case WebSocket.OPEN:
            return "open";
          case WebSocket.CLOSING:
            return "closing";
          default:
            return "closed";
        }
      })();
      hud.setDebugText(
        [
          `room: ${d.roomId}`,
          `bounds: x [${b.minX}…${b.maxX}]  z [${b.minZ}…${b.maxZ}]`,
          `doors: ${d.doorCount}   obstacles: ${d.obstacleCount}   extra floor: ${d.extraFloorCount}`,
          `avatars: ${d.avatarCount} (${d.remotePlayerCount} remote)`,
          `pos: ${posStr}`,
          `zoom: ${d.zoomFrustum.toFixed(2)}   fog: ${d.fogEnabled ? "on" : "off"} (${d.fogInner.toFixed(1)} / ${d.fogOuter.toFixed(1)})`,
          `mode: ${d.buildMode ? "build" : d.floorExpandMode ? "floor+" : "walk"}`,
          `ws: ${wsLabel}   ${debugDispHzSmoothed.toFixed(0)}Hz disp · ${debugLoopMsSmoothed.toFixed(1)}ms loop`,
        ].join("\n")
      );
    }
    const loopEnd = performance.now();
    const rafCallbackMs = loopEnd - loopStart;
    if (hud.isPerfHudEnabled()) {
      hud.feedPerfHudFrame(now);
    }
    prevRafCallbackMsForDebugFps = rafCallbackMs;
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  window.addEventListener(
    "beforeunload",
    () => {
      if (disposed) return;
      disposed = true;
      cleanupResources();
    },
    { once: true }
  );
  signal.addEventListener("abort", () => {
    if (nimWalletPollTimer !== null) {
      clearTimeout(nimWalletPollTimer);
      nimWalletPollTimer = null;
    }
  });
}

function isPatchnotesPath(): boolean {
  const p = (typeof location !== "undefined" ? location.pathname : "/").replace(/\/$/, "") || "/";
  return p === "/patchnotes";
}

function isJoinInvitePath(): boolean {
  return parseJoinSlugFromPath(location.pathname) !== null;
}

async function bootstrapJoinInvite(): Promise<boolean> {
  const slug = parseJoinSlugFromPath(location.pathname);
  if (!slug || !WORLDCUP_ENABLED_CLIENT) return false;
  const app = document.getElementById("app");
  if (!app) return false;
  try {
    const waitForGate = mountJoinGate(app, slug);
    const result = await waitForGate();
    if (!result.ok) {
      mountGuestPlaySpaceClosedOnboarding(app, {
        title: "Cannot join",
        message: result.error,
        onWebWallet: () => openMainMenu(),
      });
      return true;
    }
    history.replaceState(null, "", "/");
    enterGame(result.token, result.address, result.nimiqPay, {
      initialRoomId: result.lobbyRoomId,
      inviteLinkSlug: slug,
    });
    return true;
  } catch (e) {
    const code = e instanceof Error ? e.message : "join_failed";
    const message =
      code === "expired"
        ? "This invite has expired — ask the host for a new link."
        : code === "full"
          ? "This play space is full."
          : code === "closed"
            ? "This play space has closed."
            : "This invite link has expired or is no longer valid.";
    mountGuestPlaySpaceClosedOnboarding(app, {
      title: "Cannot join",
      message,
      onWebWallet: () => openMainMenu(),
    });
    return true;
  }
}

function main(): void {
  initNimiqPayDevEmulation();
  enableNimiqPayViewportLayout();
  if (isPatchnotesPath()) {
    document.title = "Patch notes — Nimiq Space";
    const app = document.getElementById("app");
    if (app) mountPatchnotesPage(app);
    return;
  }
  document.title = "Nimiq Space";
  if (isJoinInvitePath()) {
    void bootstrapJoinInvite();
    return;
  }
  void bootstrapMainMenuOrResume();
}

async function bootstrapMainMenuOrResume(): Promise<void> {
  if (consumeGameReturnResume()) {
    unlockScreenOrientation();
    await waitForNimiqPayWebViewHost();
    const cached = loadCachedSession();
    if (cached && !isTokenExpired(cached.token)) {
      const ok = await runUsernamePromptGate(cached.token, cached.address);
      if (ok) {
        enterGame(cached.token, cached.address, cached.nimiqPay);
        return;
      }
    }
  }
  openMainMenu();
}

main();
