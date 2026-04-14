import "@nimiq/style/nimiq-style.min.css";
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
import { ROOM_ID } from "./game/constants.js";
import { Game } from "./game/Game.js";
import { isOrthogonallyAdjacentToFloorTile } from "./game/grid.js";
import { HUB_ROOM_ID, CANVAS_ROOM_ID, normalizeRoomId } from "./game/roomLayouts.js";
import {
  connectGameWs,
  sendChat,
  sendBeginBlockClaim,
  sendBlockClaimTick,
  sendCompleteBlockClaim,
  sendMoveObstacle,
  sendMoveTo,
  sendPlaceBlock,
  sendPlaceExtraFloor,
  sendRemoveExtraFloor,
  sendRemoveObstacle,
  sendSetObstacleProps,
  type ServerMessage,
} from "./net/ws.js";
import { installAdminOverlay } from "./ui/adminOverlay.js";
import { createHud } from "./ui/hud.js";
import { installInputShell } from "./ui/inputShell.js";
import { formatWalletAddressConnectAs } from "./formatWalletAddress.js";
import { mountMainMenu } from "./ui/mainMenu.js";

const DEV_CLIENT_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "1";
/** Inactivity: return to hub center (not lobby). */
const IDLE_RETURN_HUB_MS = 15 * 60 * 1000;

/** Admin wallet addresses (must match server config) */
const ADMIN_ADDRESSES = new Set([
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
]);

function isAdmin(address: string): boolean {
  return ADMIN_ADDRESSES.has(address);
}

let unmountMainMenu: (() => void) | null = null;
let selfAddress = "";

function startIdleReturnToHub(ms: number, onIdle: () => void): () => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  const arm = (): void => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      onIdle();
    }, ms);
  };
  arm();
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
    if (t) clearTimeout(t);
    for (const e of ev) {
      document.removeEventListener(e, arm, opts);
    }
  };
}

function openMainMenu(): void {
  const orientation = (screen as Screen & {
    orientation?: { unlock?: () => void };
  }).orientation;
  orientation?.unlock?.();
  const app = document.getElementById("app");
  if (!app) return;
  const cachedEntries = listCachedSessions();
  const cached = loadCachedSession();
  const hasValid = !!(cached && !isTokenExpired(cached.token));
  unmountMainMenu?.();
  unmountMainMenu = mountMainMenu({
    app,
    cachedSessions: cachedEntries.map((entry) => ({
      address: entry.address,
      token: entry.token,
      updatedAt: entry.updatedAt,
      expiresAtMs: getTokenExpiryMs(entry.token),
      isExpired: isTokenExpired(entry.token),
    })),
    authToken:
      hasValid && cached && !isTokenExpired(cached.token) ? cached.token : null,
    devBypass: DEV_CLIENT_BYPASS,
    onReconnect: (address) => {
      const c = listCachedSessions().find((e) => e.address === address);
      if (!c || isTokenExpired(c.token)) return;
      saveCachedSession(c.token, c.address);
      enterGame(c.token, c.address);
    },
    onLoggedIn: (token, address) => {
      saveCachedSession(token, address);
      enterGame(token, address);
    },
    onLogout: (address) => {
      if (address) removeCachedSession(address);
      else clearCachedSession();
      openMainMenu();
    },
  });
}

function enterGame(token: string, address: string): void {
  const app = document.getElementById("app");
  if (!app) return;
  unmountMainMenu?.();
  unmountMainMenu = null;

  app.innerHTML = "";
  const hudRoot = document.createElement("div");
  hudRoot.style.height = "100%";
  app.appendChild(hudRoot);

  const showDebugHud =
    import.meta.env.DEV ||
    new URLSearchParams(location.search).has("debug");
  const shortAddr = formatWalletAddressConnectAs(address);
  const hud = createHud(hudRoot, { showDebug: showDebugHud });
  const canvasHost = hudRoot.querySelector(".canvas-host") as HTMLElement;
  const game = new Game(canvasHost);
  const adminOverlay = installAdminOverlay(hudRoot, game, { roomId: ROOM_ID });

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
    if (!isCoarsePointer || !screenOrientation?.lock) return;
    void screenOrientation.lock("landscape").catch(() => {});
  };

  const ensureGameLandscape = (): void => {
    if (!isCoarsePointer || disposed) return;
    const fullscreenEl = document.fullscreenElement;
    const isGameFullscreen =
      !!fullscreenEl &&
      (fullscreenEl === hudRoot ||
        fullscreenEl === app ||
        app.contains(fullscreenEl));
    if (!isGameFullscreen) {
      void hudRoot.requestFullscreen().then(lockLandscape).catch(() => {
        // Some browsers block fullscreen without a gesture; still try lock.
        lockLandscape();
      });
      return;
    }
    lockLandscape();
  };

  const startLandscapeRetries = (): void => {
    if (!isCoarsePointer) return;
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

  function syncPlayerCountHud(): void {
    const roomCount = roomRealPlayerCount(lastPlayers);
    const total = Math.max(totalOnlinePlayers, roomCount);
    hud.setPlayerCount(total, roomCount);
  }

  /** From server welcome; aligned with canEditRoomContent. */
  let roomAllowPlaceBlocks = true;
  let roomAllowExtraFloor = true;
  let editingTile: { x: number; z: number } | null = null;
  let ws: WebSocket | null = null;
  let connectGen = 0;
  let cancelActiveNimClaim: (() => void) | null = null;
  /** Active claimable-block UI session (aligned with server begin → complete flow). */
  let nimClaimUiRef: {
    blockX: number;
    blockZ: number;
    claimId: string | null;
    holdMs: number;
    rewardHoldSince: number | null;
    completeSent: boolean;
  } | null = null;
  /** Extra delay before complete so server tick accumulation reaches holdMs. */
  const NIM_CLAIM_COMPLETE_SLACK_MS = 550;

  let disposed = false;
  let rafId = 0;
  let idleCleanup: (() => void) | null = null;
  const ac = new AbortController();
  const { signal } = ac;

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
      if (document.hidden) return;
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
    if (orientationRetryTimer) {
      clearInterval(orientationRetryTimer);
      orientationRetryTimer = null;
    }
    idleCleanup?.();
    idleCleanup = null;
    cancelActiveNimClaim?.();
    cancelActiveNimClaim = null;
    nimClaimUiRef = null;
    hud.setNimClaimProgress(null);
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
    hud.destroy();
  }

  function disposeToMenu(): void {
    if (disposed) return;
    const appEl = document.getElementById("app");
    const restoreFullscreen =
      !!appEl &&
      !!document.fullscreenElement &&
      appEl.contains(document.fullscreenElement);
    disposed = true;
    cleanupResources();
    openMainMenu();
    if (restoreFullscreen && appEl) {
      requestAnimationFrame(() => {
        void appEl.requestFullscreen().catch(() => {});
      });
    }
  }

  const syncHubButton = (): void => {
    hud.setReturnToHubVisible(
      normalizeRoomId(game.getRoomId()) !== HUB_ROOM_ID
    );
  };

  async function updateCanvasLeaderboard(): Promise<void> {
    const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    console.log(`[canvas] updateCanvasLeaderboard called, isCanvas: ${isCanvas}`);
    hud.setCanvasLeaderboardVisible(isCanvas);
    if (!isCanvas) return;
    
    try {
      const { resolveApiBaseUrl } = await import("./net/apiBase.js");
      const base = resolveApiBaseUrl() || "";
      const url = `${base}/api/canvas/leaderboard`;
      console.log(`[canvas] Fetching leaderboard from: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[canvas] Leaderboard fetch failed: ${res.status} ${res.statusText}`);
        return;
      }
      const data = await res.json() as { leaderboard: Array<{ address: string; count: number }> };
      console.log(`[canvas] Leaderboard data:`, data.leaderboard);
      hud.updateCanvasLeaderboard(data.leaderboard);
    } catch (err) {
      console.error("[canvas] Failed to fetch leaderboard:", err);
    }
  }

  async function updateNimWalletStatus(): Promise<void> {
    try {
      const { resolveApiBaseUrl } = await import("./net/apiBase.js");
      const base = resolveApiBaseUrl() || "";
      const url = `${base}/api/nim/payout-balance`;
      const res = await fetch(url);
      if (!res.ok) {
        hud.setNimWalletStatus("unavailable");
        return;
      }
      const data = (await res.json()) as {
        configured: boolean;
        hasNim: boolean;
        balanceNim: string;
      };
      if (!data.configured || !data.hasNim) {
        hud.setNimWalletStatus("No more NIM to earn :(");
        return;
      }
      hud.setNimWalletStatus(data.balanceNim);
    } catch (err) {
      console.error("[nim-wallet] Failed to fetch payout wallet balance:", err);
      hud.setNimWalletStatus("unavailable");
    }
  }

  function playModeFromGame(): "walk" | "build" | "floor" {
    if (game.getFloorExpandMode()) return "floor";
    if (game.getBuildMode()) return "build";
    return "walk";
  }

  function syncBuildHud(): void {
    const barStyle = game.getPlacementBlockStyle();
    const touchUi =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    const canBuild = roomAllowPlaceBlocks && !isCanvas;
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
      hud.setBuildBlockBarState({
        visible: false,
        ...barStyle,
        placementAdmin: isAdmin(selfAddress),
      });
      hud.setPlayModeState("walk");
      hud.setStatus(
        touchUi
          ? `Connect as ${shortAddr} — mode icons bottom-right`
          : `Connect as ${shortAddr} — this room is view-only for building`
      );
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
    if (game.getFloorExpandMode() && canFloor) {
      hud.setStatus(
        touchUi
          ? "Floor — tap next to walkable space outside the core (pick Walk when done)"
          : "Expand floor — click outside the core room, next to walkable space (F to exit). Shift+click removes an extra tile."
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
      hud.setStatus(
        touchUi
          ? "Build — tap a block to edit, empty tile to place (Walk to exit)"
          : "Build mode — click a block to edit, empty floor to place (B to exit)"
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
    if (canFloor) modeHints.push("F: expand walkable floor");
    const desktopHint =
      modeHints.length > 0
        ? modeHints.join(" · ")
        : "This room is view-only for building";
    hud.setStatus(
      touchUi
        ? `Connect as ${shortAddr} — mode icons bottom-right`
        : `Connect as ${shortAddr} — ${desktopHint}`
    );
    hud.setPlayModeState(playModeFromGame());
  }

  hud.onPlayModeSelect((mode) => {
    if (document.activeElement === hud.getChatInput()) return;

    const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    if (mode === "build" && (!roomAllowPlaceBlocks || isCanvas)) return;
    if (mode === "floor" && (!roomAllowExtraFloor || isCanvas)) return;
    
    if (mode === "walk") {
      game.setFloorExpandMode(false);
      game.setBuildMode(false);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
      // Deactivate signpost mode when leaving build
      hud.deactivateSignpostMode();
    } else if (mode === "build") {
      game.setFloorExpandMode(false);
      game.setBuildMode(true);
    } else {
      game.setBuildMode(false);
      game.setFloorExpandMode(true);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
      // Deactivate signpost mode when leaving build
      hud.deactivateSignpostMode();
    }
    syncBuildHud();
  });

  hud.onBuildPlacementStyle((patch) => {
    game.setPlacementBlockStyle(patch);
    syncBuildHud();
  });

  const wireWsHandlers = (socket: WebSocket): void => {
    cancelActiveNimClaim?.();
    cancelActiveNimClaim = null;
    nimClaimUiRef = null;
    hud.setNimClaimProgress(null);

    game.setTileClickHandler((x, z, layer = 0) => {
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
            console.log(`[main] Signpost click outside build radius (${distance.toFixed(2)} > ${placeRadius}), moving instead`);
            sendMoveTo(socket, x, z, layer);
            return;
          }
        }
        hud.promptSignpostMessage(x, z);
        return;
      }
      sendMoveTo(socket, x, z, layer);
    });
    game.setPlaceBlockHandler((x, z) => {
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
            console.log(`[main] Signpost click outside build radius (${distance.toFixed(2)} > ${placeRadius}), moving instead`);
            sendMoveTo(socket, x, z, 0);
            return;
          }
        }
        hud.promptSignpostMessage(x, z);
        return;
      }
      sendPlaceBlock(socket, x, z, game.getPlacementBlockStyle());
    });
    
    game.setClaimBlockHandler((x, z) => {
      cancelActiveNimClaim?.();
      cancelActiveNimClaim = null;

      nimClaimUiRef = {
        blockX: x,
        blockZ: z,
        claimId: null,
        holdMs: 3000,
        rewardHoldSince: null,
        completeSent: false,
      };

      let beginSent = false;
      let lastTickSent = 0;
      let raf = 0;
      let cancelled = false;

      const finish = (): void => {
        if (cancelled) return;
        cancelled = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        hud.setNimClaimProgress(null);
        nimClaimUiRef = null;
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
        if (!ref || ref.blockX !== x || ref.blockZ !== z) {
          return;
        }

        const pos = game.getSelfPosition();
        const now = performance.now();
        const adjacent = !!(
          pos &&
          isOrthogonallyAdjacentToFloorTile(pos.x, pos.z, x, z)
        );

        if (adjacent) {
          if (!beginSent) {
            sendBeginBlockClaim(socket, x, z);
            beginSent = true;
          }
          const cid = ref.claimId;
          if (
            cid &&
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

        const readyToComplete =
          ref.claimId &&
          ref.rewardHoldSince !== null &&
          !ref.completeSent &&
          now - ref.rewardHoldSince >= holdMs + NIM_CLAIM_COMPLETE_SLACK_MS;

        if (readyToComplete && ref.claimId) {
          ref.completeSent = true;
          sendCompleteBlockClaim(socket, ref.claimId);
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    });
    
    game.setMoveBlockHandler((fromX, fromZ, toX, toZ) => {
      sendMoveObstacle(socket, fromX, fromZ, toX, toZ);
    });
    game.setPlaceExtraFloorHandler((x, z) => {
      sendPlaceExtraFloor(socket, x, z);
    });
    game.setRemoveExtraFloorHandler((x, z) => {
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
    game.setObstacleSelectHandler((x, z) => {
      const m = game.getPlacedAt(x, z);
      if (!m) return;
      editingTile = { x, z };
      
      console.log(`[Main] Setting up object panel for (${x}, ${z}), selfAddress="${selfAddress}", isAdmin=${isAdmin(selfAddress)}`);
      
      hud.showObjectEditPanel({
        x,
        z,
        passable: m.passable,
        half: m.half,
        quarter: m.quarter,
        hex: m.hex,
        ramp: m.ramp,
        rampDir: m.rampDir,
        colorId: m.colorId,
        locked: m.locked || false,
        isAdmin: isAdmin(selfAddress),
        onPropsChange: (p) => {
          sendSetObstacleProps(socket, x, z, p);
        },
        onRemove: () => {
          sendRemoveObstacle(socket, x, z);
          editingTile = null;
          hud.hideObjectEditPanel();
          game.clearSelectedBlock();
          syncBuildHud();
        },
        onMove: () => {
          game.beginReposition(x, z);
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

  const handleServerMessage = async (msg: ServerMessage): Promise<void> => {
    if (msg.type === "welcome") {
      hud.setReconnectOffer(false);
      console.log(`[Main] Received welcome message for room: ${msg.roomId}, obstacles: ${msg.obstacles.length}, extraFloor: ${msg.extraFloorTiles.length}`);
      hud.setLoadingVisible(true);
      
      game.applyRoomFromWelcome({
        roomId: msg.roomId,
        roomBounds: msg.roomBounds,
        doors: msg.doors,
        placeRadiusBlocks: Number.isFinite(msg.placeRadiusBlocks)
          ? msg.placeRadiusBlocks
          : 5,
      });
      game.setSelf(msg.self.address, msg.self.displayName);
      selfAddress = msg.self.address;

      const isCanvas = normalizeRoomId(msg.roomId) === CANVAS_ROOM_ID;
      roomAllowPlaceBlocks = msg.allowPlaceBlocks !== false;
      roomAllowExtraFloor = msg.allowExtraFloor !== false;
      hud.setRoomEditCaps({
        allowPlaceBlocks: roomAllowPlaceBlocks,
        allowExtraFloor: roomAllowExtraFloor,
      });

      if (isCanvas || !roomAllowPlaceBlocks) {
        game.setBuildMode(false);
        hud.deactivateSignpostMode();
      }
      if (isCanvas || !roomAllowExtraFloor) {
        game.setFloorExpandMode(false);
      }
      if (isCanvas || !roomAllowPlaceBlocks) {
        editingTile = null;
        hud.hideObjectEditPanel();
        game.clearSelectedBlock();
      }

      console.log(`[Main] Calling setObstacles with ${msg.obstacles.length} obstacles`);
      game.setObstacles(msg.obstacles);
      console.log(`[Main] Calling setExtraFloorTiles with ${msg.extraFloorTiles.length} extra floor tiles`);
      game.setExtraFloorTiles(msg.extraFloorTiles);
      game.setSignboards(msg.signboards);
      
      // Load canvas claims if present and wait for them to finish
      if (msg.canvasClaims) {
        await game.setCanvasClaims(msg.canvasClaims);
      }
      
      lastPlayers = [msg.self, ...msg.others];
      game.syncState(lastPlayers);
      syncHubButton();
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
      
      console.log(`[Main] Welcome processing complete for room ${msg.roomId}`);
      // Hide loading overlay after everything is loaded
      hud.setLoadingVisible(false);
      syncBuildHud();
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
      return;
    }
    if (msg.type === "playerLeft") {
      lastPlayers = lastPlayers.filter((p) => p.address !== msg.address);
      game.syncState(lastPlayers);
      syncPlayerCountHud();
      return;
    }
    if (msg.type === "state") {
      lastPlayers = msg.players;
      game.syncState(msg.players);
      syncPlayerCountHud();
      return;
    }
    if (msg.type === "onlineCount") {
      totalOnlinePlayers = Math.max(0, Math.floor(msg.count));
      syncPlayerCountHud();
      return;
    }
    if (msg.type === "chat") {
      // Show chat bubble for all messages
      game.showChatBubble(msg.fromAddress, msg.text, msg.from);
      
      // Only add to chat log if not bubble-only (NPCs use bubbleOnly)
      if (!msg.bubbleOnly) {
        hud.appendChat(msg.from, msg.text);
      }
      return;
    }
    if (msg.type === "blockClaimOffered") {
      if (
        nimClaimUiRef &&
        nimClaimUiRef.blockX === msg.x &&
        nimClaimUiRef.blockZ === msg.z
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
          game.showFloatingText(bx, bz, `+${reward} NIM`);
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
      console.log(`[Main] Received obstacles message for room ${msg.roomId}, ${msg.tiles.length} tiles, editingTile=${editingTile ? `(${editingTile.x}, ${editingTile.z})` : 'null'}`);
      game.setObstacles(msg.tiles);
      if (editingTile) {
        const m = game.getPlacedAt(editingTile.x, editingTile.z);
        console.log(`[Main] After setObstacles, getPlacedAt returned:`, m);
        if (!m) {
          editingTile = null;
          hud.hideObjectEditPanel();
        } else {
          hud.setObjectPanelProps(m);
        }
      }
      syncBuildHud();
    }
    if (msg.type === "extraFloor") {
      game.setExtraFloorTiles(msg.tiles);
      syncBuildHud();
    }
    if (msg.type === "canvasClaim") {
      console.log(`[canvas] Received canvasClaim message:`, msg);
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
    if (msg.type === "error") {
      // Handle canvas cooldown error
      if (msg.code === "CANVAS_COOLDOWN") {
        console.log("[canvas] Entry blocked - room on cooldown");
        // Don't need to do anything special - server already sent chat message
        // and the connection will be closed, triggering a reconnect to hub
      }
    }
    if (msg.type === "signboards") {
      game.setSignboards(msg.signboards);
      // Clear signboard tooltip if it's showing a deleted signboard
      hud.setSignboardTooltip(null);
    }
  };

  const connectToRoom = (
    room: string,
    spawn?: { x: number; z: number }
  ): void => {
    connectGen += 1;
    const myGen = connectGen;
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
        if (ev.code === 4001) {
          clearCachedSession();
          location.reload();
          return;
        }
        hud.setReconnectOffer(true);
        hud.setStatus("Disconnected — tap Reconnect or reload");
      },
      spawn ? { spawnX: spawn.x, spawnZ: spawn.z } : undefined
    );
    wireWsHandlers(ws);
  };

  idleCleanup = startIdleReturnToHub(IDLE_RETURN_HUB_MS, () => {
    if (disposed) return;
    connectToRoom(HUB_ROOM_ID, { x: 0, z: 0 });
    hud.setStatus(
      "Returned to hub after 15 minutes inactive — explore again anytime"
    );
  });

  game.setRoomChangeHandler((targetRoomId, spawnX, spawnZ) => {
    connectToRoom(targetRoomId, { x: spawnX, z: spawnZ });
  });

  game.setSignboardHoverHandler((signboard) => {
    hud.setSignboardTooltip(signboard);
  });

  hud.onReturnToHub(() => {
    connectToRoom(HUB_ROOM_ID);
  });

  hud.onReturnToLobby(() => {
    disposeToMenu();
  });

  hud.onReconnect(() => {
    if (disposed) return;
    hud.setReconnectOffer(false);
    hud.setStatus("Connecting…");
    connectToRoom(normalizeRoomId(game.getRoomId()));
  });

  connectToRoom(ROOM_ID);
  void updateNimWalletStatus();
  const nimWalletPoll = setInterval(() => {
    void updateNimWalletStatus();
  }, 30000);

  syncBuildHud();

  const chatInput = hud.getChatInput();
  chatInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const t = chatInput.value.trim();
      chatInput.value = "";
      if (t) ws && sendChat(ws, t);
      chatInput.blur();
      e.preventDefault();
    }
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && document.activeElement !== chatInput) {
        e.preventDefault();
        chatInput.focus();
        return;
      }
      if (e.key === "Escape") {
        if (document.activeElement === chatInput) return;
        if (game.isRepositioning()) {
          game.cancelReposition();
          syncBuildHud();
          return;
        }
        if (game.getFloorExpandMode()) {
          game.setFloorExpandMode(false);
          syncBuildHud();
          return;
        }
        if (editingTile) {
          editingTile = null;
          hud.hideObjectEditPanel();
        }
        // Return to walk mode if in any build mode
        if (game.getBuildMode()) {
          game.setBuildMode(false);
          syncBuildHud();
        }
        game.clearSelectedBlock();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        if (document.activeElement === chatInput) return;

        const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
        if (isCanvas || !roomAllowExtraFloor) return;
        
        game.setFloorExpandMode(!game.getFloorExpandMode());
        syncBuildHud();
        return;
      }
      if (e.key === "b" || e.key === "B") {
        if (document.activeElement === chatInput) return;

        const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
        if (isCanvas || !roomAllowPlaceBlocks) return;
        
        const next = !game.getBuildMode();
        game.setBuildMode(next);
        if (!next) {
          editingTile = null;
          hud.hideObjectEditPanel();
          game.clearSelectedBlock();
        }
        syncBuildHud();
      }
      if (game.getBuildMode() && document.activeElement !== chatInput) {
        const k = e.key;
        if (k >= "1" && k <= "9") {
          const id = Number(k) - 1;
          game.setPlacementBlockStyle({ colorId: id });
          syncBuildHud();
          e.preventDefault();
          return;
        }
        if (k === "0") {
          game.setPlacementBlockStyle({ colorId: 9 });
          syncBuildHud();
          e.preventDefault();
          return;
        }
        if (k === "d" || k === "D") {
          const sel = game.getSelectedBlockTile();
          const t = sel ?? editingTile;
          if (t && ws) {
            sendRemoveObstacle(ws, t.x, t.z);
            editingTile = null;
            hud.hideObjectEditPanel();
            game.clearSelectedBlock();
            syncBuildHud();
          }
          e.preventDefault();
          return;
        }
        if (k === "r" || k === "R") {
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
    const host = hudRoot;
    if (!document.fullscreenElement) void host.requestFullscreen();
    else void document.exitFullscreen();
  });

  let last = performance.now();
  let fpsSmoothed = 60;
  function loop(now: number): void {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.tick(dt);
    if (showDebugHud) {
      const inst = dt > 1e-6 ? 1 / dt : 0;
      fpsSmoothed = fpsSmoothed * 0.9 + inst * 0.1;
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
          `ws: ${wsLabel}   fps: ${fpsSmoothed.toFixed(0)}`,
        ].join("\n")
      );
    }
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
    clearInterval(nimWalletPoll);
  });
}

function main(): void {
  document.title = "Nimiq Space";
  openMainMenu();
}

main();
