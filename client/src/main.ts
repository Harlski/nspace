import "@nimiq/style/nimiq-style.min.css";
import "./style.css";
import {
  clearCachedSession,
  isTokenExpired,
  loadCachedSession,
  saveCachedSession,
} from "./auth/session.js";
import { ROOM_ID } from "./game/constants.js";
import { Game } from "./game/Game.js";
import { HUB_ROOM_ID, normalizeRoomId } from "./game/roomLayouts.js";
import {
  connectGameWs,
  sendChat,
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
import { mountMainMenu } from "./ui/mainMenu.js";

const DEV_CLIENT_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "1";
/** Inactivity: return to hub center (not lobby). */
const IDLE_RETURN_HUB_MS = 15 * 60 * 1000;

let unmountMainMenu: (() => void) | null = null;

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
  const app = document.getElementById("app");
  if (!app) return;
  const cached = loadCachedSession();
  const hasValid = !!(
    cached && !isTokenExpired(cached.token)
  );
  unmountMainMenu?.();
  unmountMainMenu = mountMainMenu({
    app,
    hasValidSession: hasValid,
    cachedAddress: cached?.address ?? null,
    authToken:
      hasValid && cached && !isTokenExpired(cached.token) ? cached.token : null,
    devBypass: DEV_CLIENT_BYPASS,
    onReconnect: () => {
      const c = loadCachedSession();
      if (!c || isTokenExpired(c.token)) return;
      enterGame(c.token, c.address);
    },
    onLoggedIn: (token, address) => {
      saveCachedSession(token, address);
      enterGame(token, address);
    },
    onLogout: () => {
      clearCachedSession();
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
  const hud = createHud(hudRoot, { showDebug: showDebugHud });
  const canvasHost = hudRoot.querySelector(".canvas-host") as HTMLElement;
  const game = new Game(canvasHost);
  const adminOverlay = installAdminOverlay(hudRoot, game, { roomId: ROOM_ID });

  const uninstallShell = installInputShell(hudRoot);

  let lastPlayers: import("./types.js").PlayerState[] = [];
  let editingTile: { x: number; z: number } | null = null;
  let ws: WebSocket | null = null;
  let connectGen = 0;

  let disposed = false;
  let rafId = 0;
  let idleCleanup: (() => void) | null = null;
  const ac = new AbortController();
  const { signal } = ac;

  function cleanupResources(): void {
    idleCleanup?.();
    idleCleanup = null;
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
    disposed = true;
    cleanupResources();
    openMainMenu();
  }

  const syncHubButton = (): void => {
    hud.setReturnToHubVisible(
      normalizeRoomId(game.getRoomId()) !== HUB_ROOM_ID
    );
  };

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
    if (game.isRepositioning()) {
      hud.setStatus(
        "Choose an empty tile for the new position (Esc to cancel)"
      );
      hud.setBuildBlockBarState({ visible: false, ...barStyle });
      hud.setPlayModeState(playModeFromGame());
      return;
    }
    if (game.getFloorExpandMode()) {
      hud.setStatus(
        touchUi
          ? "Floor — tap next to walkable space outside the core (pick Walk when done)"
          : "Expand floor — click outside the core room, next to walkable space (F to exit). Shift+click removes an extra tile."
      );
      hud.setBuildBlockBarState({ visible: false, ...barStyle });
      hud.setPlayModeState(playModeFromGame());
      return;
    }
    if (game.getBuildMode()) {
      hud.setStatus(
        touchUi
          ? "Build — tap a block to edit, empty tile to place (Walk to exit)"
          : "Build mode — click a block to edit, empty floor to place (B to exit)"
      );
      hud.setBuildBlockBarState({ visible: true, ...barStyle });
      hud.setPlayModeState(playModeFromGame());
      return;
    }
    hud.setBuildBlockBarState({ visible: false, ...barStyle });
    hud.setStatus(
      touchUi
        ? `Connected — Walk / Build / Floor (right)`
        : `Connected as ${address.slice(0, 8)}… — B: blocks · F: expand walkable floor`
    );
    hud.setPlayModeState(playModeFromGame());
  }

  hud.onPlayModeSelect((mode) => {
    if (document.activeElement === hud.getChatInput()) return;
    if (mode === "walk") {
      game.setFloorExpandMode(false);
      game.setBuildMode(false);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
    } else if (mode === "build") {
      game.setFloorExpandMode(false);
      game.setBuildMode(true);
    } else {
      game.setBuildMode(false);
      game.setFloorExpandMode(true);
      editingTile = null;
      hud.hideObjectEditPanel();
      game.clearSelectedBlock();
    }
    syncBuildHud();
  });

  hud.onBuildPlacementStyle((patch) => {
    game.setPlacementBlockStyle(patch);
    syncBuildHud();
  });

  const wireWsHandlers = (socket: WebSocket): void => {
    game.setTileClickHandler((x, z, layer = 0) => {
      sendMoveTo(socket, x, z, layer);
    });
    game.setPlaceBlockHandler((x, z) => {
      sendPlaceBlock(socket, x, z, game.getPlacementBlockStyle());
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
    game.setObstacleSelectHandler((x, z) => {
      const m = game.getPlacedAt(x, z);
      if (!m) return;
      editingTile = { x, z };
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
        onPropsChange: (p) => {
          sendSetObstacleProps(socket, x, z, p);
        },
        onRemove: () => {
          sendRemoveObstacle(socket, x, z);
          editingTile = null;
          hud.hideObjectEditPanel();
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
        },
      });
    });
  };

  const handleServerMessage = (msg: ServerMessage): void => {
    if (msg.type === "welcome") {
      game.applyRoomFromWelcome({
        roomId: msg.roomId,
        roomBounds: msg.roomBounds,
        doors: msg.doors,
        placeRadiusBlocks: Number.isFinite(msg.placeRadiusBlocks)
          ? msg.placeRadiusBlocks
          : 5,
      });
      game.setSelf(msg.self.address, msg.self.displayName);
      game.setObstacles(msg.obstacles);
      game.setExtraFloorTiles(msg.extraFloorTiles);
      lastPlayers = [msg.self, ...msg.others];
      game.syncState(lastPlayers);
      syncHubButton();
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
      game.syncState(lastPlayers);
      return;
    }
    if (msg.type === "playerLeft") {
      lastPlayers = lastPlayers.filter((p) => p.address !== msg.address);
      game.syncState(lastPlayers);
      return;
    }
    if (msg.type === "state") {
      lastPlayers = msg.players;
      game.syncState(msg.players);
      return;
    }
    if (msg.type === "chat") {
      hud.appendChat(msg.from, msg.text);
      game.showChatBubble(msg.fromAddress, msg.text, msg.from);
    }
    if (msg.type === "obstacles") {
      game.setObstacles(msg.tiles);
      if (editingTile) {
        const m = game.getPlacedAt(editingTile.x, editingTile.z);
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
        handleServerMessage(msg);
      },
      (ev) => {
        if (myGen !== connectGen) return;
        if (ev.code === 4001) {
          clearCachedSession();
          location.reload();
          return;
        }
        hud.setStatus("Disconnected — refresh to reconnect");
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

  hud.onReturnToHub(() => {
    connectToRoom(HUB_ROOM_ID);
  });

  hud.onReturnToLobby(() => {
    disposeToMenu();
  });

  connectToRoom(ROOM_ID);

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
        game.clearSelectedBlock();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        if (document.activeElement === chatInput) return;
        game.setFloorExpandMode(!game.getFloorExpandMode());
        syncBuildHud();
        return;
      }
      if (e.key === "b" || e.key === "B") {
        if (document.activeElement === chatInput) return;
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
}

function main(): void {
  document.title = "Nimiq Space";
  openMainMenu();
}

main();
