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
import { CHAMBER_DEFAULT_SPAWN, ROOM_ID } from "./game/constants.js";
import type { BlockStyleProps } from "./game/blockStyle.js";
import {
  canOpenGateAs,
  isGateAclAdmin,
  normalizeClientGate,
} from "./game/gateAuth.js";
import { Game } from "./game/Game.js";
import { isOrthogonallyAdjacentToFloorTile, snapFloorTile } from "./game/grid.js";
import { remotePlayerIsNpc } from "./remotePlayerNpc.js";
import {
  HUB_ROOM_ID,
  CHAMBER_ROOM_ID,
  CANVAS_ROOM_ID,
  normalizeRoomId,
} from "./game/roomLayouts.js";
import {
  connectGameWs,
  sendChat,
  sendChatTyping,
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
  sendPlaceBlock,
  sendPlaceBillboard,
  sendUpdateBillboard,
  sendPlacePendingTeleporter,
  sendPlacePendingGate,
  sendOpenGate,
  sendConfigureTeleporter,
  sendPlaceExtraFloor,
  sendRemoveExtraFloor,
  sendRemoveObstacleAt,
  sendRemoveVoxelText,
  sendSetVoxelText,
  sendSetGateAuthorizedAddresses,
  sendSetObstacleProps,
  type ObstacleProps,
  type RoomBackgroundNeutral,
  type ServerMessage,
} from "./net/ws.js";
import { installAdminOverlay } from "./ui/adminOverlay.js";
import { createHud } from "./ui/hud.js";
import {
  isPseudoFullscreenActive,
  requestMiniAppImmersiveLayout,
  setPseudoFullscreen,
  tryRequestFullscreen,
} from "./ui/pseudoFullscreen.js";
import { installInputShell } from "./ui/inputShell.js";
import { formatWalletAddressConnectAs } from "./formatWalletAddress.js";
import { mountPatchnotesPage } from "./patchnotes/mountPatchnotesPage.js";
import { mountMainMenu } from "./ui/mainMenu.js";
import { nimiqIconUseMarkup } from "./ui/nimiqIcons.js";
import { mountNimiqPaySiteAdvisory } from "./ui/nimiqPayAdvisory.js";

const DEV_CLIENT_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "1";

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
    sphere: m.sphere,
    ramp: m.ramp,
    rampDir: m.rampDir,
    colorId: m.colorId,
    locked: m.locked || false,
    editorTileX: x,
    editorTileY: y,
    editorTileZ: z,
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
      sphere: false,
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
/** Inactivity: return to chamber home spawn (not lobby). */
const IDLE_RETURN_HUB_MS = 15 * 60 * 1000;
const LS_ZOOM_NON_MAZE_FRUSTUM = "nspace_zoom_non_maze_frustum";

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
  return "Loading room...";
}

function openMainMenu(): void {
  const orientation = (screen as Screen & {
    orientation?: { unlock?: () => void };
  }).orientation;
  orientation?.unlock?.();
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
    onReconnect: (address) => {
      const c = listCachedSessions().find((e) => e.address === address);
      if (!c || isTokenExpired(c.token)) return;
      const np = c.nimiqPay === true;
      saveCachedSession(c.token, c.address, np);
      enterGame(c.token, c.address, np);
    },
    onLoggedIn: (token, address, nimiqPay) => {
      saveCachedSession(token, address, nimiqPay);
      enterGame(token, address, nimiqPay);
    },
    onLogout: (address) => {
      if (address) removeCachedSession(address);
      else clearCachedSession();
      openMainMenu();
    },
  });
}

function enterGame(token: string, address: string, nimiqPay?: boolean): void {
  const app = document.getElementById("app");
  if (!app) return;
  unmountMainMenu?.();
  unmountMainMenu = null;
  app.innerHTML = "";
  const hudRoot = document.createElement("div");
  hudRoot.style.height = "100%";
  app.appendChild(hudRoot);

  const query = new URLSearchParams(location.search);
  const showDebugHud = import.meta.env.DEV || query.has("debug");

  let ws: WebSocket | null = null;
  const perfPingSentAt = new Map<number, number>();
  let perfPingSeq = 0;
  let perfPingInterval: ReturnType<typeof setInterval> | null = null;

  function syncPerfPingInterval(enabled: boolean): void {
    if (enabled) {
      if (perfPingInterval !== null) return;
      const s0 = ws;
      if (s0 && s0.readyState === WebSocket.OPEN) {
        const id0 = ++perfPingSeq;
        perfPingSentAt.set(id0, performance.now());
        sendClientPing(s0, id0);
      }
      perfPingInterval = setInterval(() => {
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
      }, 2000);
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

  function syncAwayPresenceToServer(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const away = document.hidden || walletSendNimFlowOpen;
    sendNimSendIntent(ws, away);
  }

  const sessionNimiqPay = nimiqPay === true;
  let disposeNimiqPayAdvisory: (() => void) | null = null;
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
      syncPerfPingInterval(enabled);
    },
  });
  hud.setBrandLinksPlayerAddress(address);
  if (sessionNimiqPay) {
    disposeNimiqPayAdvisory = mountNimiqPaySiteAdvisory(hudRoot);
  }
  const canvasHost = hudRoot.querySelector(".canvas-host") as HTMLElement;
  const game = new Game(canvasHost);
  hud.bindTileInspectorPreviewGame(game);
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
            <div class="rooms-modal__join-code-block" hidden>
              <p class="rooms-modal__section-title">Join with code</p>
              <div class="rooms-modal__join-code-row">
                <input class="rooms-modal__input rooms-modal__input--code" id="rooms-join-code" type="text" inputmode="text" maxlength="32" autocomplete="off" placeholder="AB12CD" aria-label="Room code" />
                <button type="button" class="rooms-modal__btn rooms-modal__btn--primary" id="rooms-join-submit">Join</button>
                <span class="rooms-modal__join-status" id="rooms-join-status" hidden aria-live="polite"></span>
              </div>
              <p class="rooms-modal__hint" id="rooms-join-hint" hidden></p>
            </div>
            <p class="rooms-modal__section-title" id="rooms-list-heading">Official rooms</p>
            <ul class="rooms-modal__list rooms-modal__list--rows rooms-modal__list--catalog" id="rooms-modal-list"></ul>
          </div>
          <div class="rooms-modal__list-footer">
            <div class="rooms-modal__list-footer-start">
              <button type="button" class="rooms-modal__btn rooms-modal__btn--primary rooms-modal__create-launch" id="rooms-open-create">Create a room</button>
            </div>
            <p id="rooms-modal-current-line" class="rooms-modal__current-line" aria-live="polite"></p>
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
        <input class="rooms-modal__input rooms-modal__input--full" id="rooms-create-name" type="text" maxlength="48" autocomplete="off" />
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
    roomsCreateNameInput.value = `${formatWalletAddressConnectAs(address)}'s room`;
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

  function openRoomsModal(): void {
    closeRoomsCreateModal();
    roomsJoinHint.hidden = true;
    roomsJoinHint.textContent = "";
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
    const v = roomsJoinCodeInput.value;
    if (v.length <= 6) {
      roomsJoinCodeInput.value = v
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
    } else {
      roomsJoinCodeInput.value = v
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 32);
    }
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
    let roomIdToJoin: string;
    if (/^[A-Za-z0-9]{6}$/.test(raw)) {
      roomIdToJoin = raw.toLowerCase();
    } else if (raw.length >= 2) {
      roomIdToJoin = normalizeRoomId(raw);
    } else {
      roomsJoinHint.textContent = "Enter a valid room code or id.";
      roomsJoinHint.hidden = false;
      return;
    }
    pendingModalJoinRoomId = roomIdToJoin;
    roomsJoinSubmitBtn.disabled = true;
    roomsJoinStatus.hidden = false;
    roomsJoinStatus.textContent = "Joining Room..";
    roomsJoinStatus.classList.remove("rooms-modal__join-status--error");
    roomsJoinStatus.classList.add("rooms-modal__join-status--loading");
    sendJoinRoom(ws, roomIdToJoin);
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
    if (asOfficial && !nameRaw) {
      roomsCreateHint.textContent = "Official rooms need a display name.";
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
        ...(nameRaw.length > 0 ? { displayName: nameRaw } : {}),
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
        const ao = viewerOwnsRoom(a) ? 0 : 1;
        const bo = viewerOwnsRoom(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
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
    if (!isCoarsePointer || !screenOrientation?.lock) return;
    void screenOrientation.lock("landscape").catch(() => {});
  };

  const ensureGameLandscape = (): void => {
    if (!isCoarsePointer || disposed) return;
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
  /** From server welcome; who may change dynamic room background hue. */
  let welcomeAllowRoomBackgroundHueEdit = false;
  /** From server welcome; who may set wallet-room guest join tile (`joinSpawn`). */
  let welcomeAllowRoomJoinSpawnEdit = false;
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
    | { kind: "billboard"; visitUrl: string; visitName: string }
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
  let mazeZoomLocked = false;
  let nonMazeFrustum: number | null = (() => {
    try {
      const raw = localStorage.getItem(LS_ZOOM_NON_MAZE_FRUSTUM);
      const n = raw === null ? NaN : Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  })();
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
    disposeNimiqPayAdvisory?.();
    disposeNimiqPayAdvisory = null;
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
      rid === CANVAS_ROOM_ID
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
    const isBuiltInPlaySpace =
      rid === HUB_ROOM_ID || rid === CHAMBER_ROOM_ID || rid === CANVAS_ROOM_ID;
    const dynamicRoom = !isBuiltInPlaySpace;
    const actor = selfAddress.trim() !== "" ? selfAddress : address;
    const isAdminViewer = isAdmin(actor);
    const allowHue = canEditCurrentRoomBackgroundHue(row);
    const show =
      allowHue &&
      ((isCanvas && isAdminViewer) ||
        (game.getFloorExpandMode() &&
          roomAllowExtraFloor &&
          !isCanvas &&
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

  hud.onRoomBackgroundNeutralPick((neutral) => {
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
          ? `Floor — tap tiles next to walkable space (F or Build off when done)${entryPickHint}`
          : `Expand floor — click next to walkable space to add a tile; click an extra tile again to remove it (F to exit).${entryPickHint}`
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
        ? " Gate: R rotates opening direction; green/red on neighbors show clearance; click an empty floor tile."
        : "";
      const sel = game.getSelectedBlockTile();
      const selectedHint = sel
        ? touchUi
          ? " Selected block: D delete, R rotate ramp, Ctrl+tap selected block to stack higher."
          : " Selected block: D delete, R rotate ramp, Ctrl+click selected block to stack higher."
        : "";
      hud.setStatus(
        touchUi
          ? `Build — tap a block to edit, empty tile to place (Build off to exit)${tpHint}${gateHint}${selectedHint}`
          : `Build mode — click a block to edit, empty floor to place (B or Build off to exit)${tpHint}${gateHint}${selectedHint}`
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
        : isCanvas
          ? "Find the exit the quickest to win NIM"
          : "This room is view-only for building";
    const touchIdleHint =
      canBuild && canFloor
        ? "Build toggle bottom-right (F: floor if allowed)"
        : canBuild
          ? "Build toggle bottom-right"
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

  hud.onBuildToolSelect((tool) => {
    game.setBillboardPlacementPreviewActive(tool === "billboard");
    if (tool === "billboard") {
      const d = game.getBillboardPlacementDraft();
      hud.applyBillboardModalDraft(d);
    }
    syncBuildHud();
  });

  hud.onPlayModeSelect((mode) => {
    if (document.activeElement === hud.getChatInput()) return;

    const isCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    if (mode === "build" && (!roomAllowPlaceBlocks || isCanvas)) return;
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

    game.setSelfQuickEmojiOpener(() => {
      const a = game.getSelfScreenPosition(1.32);
      if (!a) return;
      const pos = game.getSelfPosition();
      const openedFloor = pos ? snapFloorTile(pos.x, pos.z) : null;
      hud.showSelfEmojiMenu(
        a.x,
        a.y,
        (emoji) => {
          if (socket.readyState === WebSocket.OPEN) sendChat(socket, emoji);
        },
        openedFloor
      );
    });
    game.setOtherPlayerContextOpener((pick) => {
      hud.showOtherPlayerContextMenu(
        pick.clientX,
        pick.clientY,
        pick.targets,
        pick.emoteRowFirst
          ? {
              emoteRowFirst: true,
              onEmote: () => {
                const a = game.getSelfScreenPosition(1.32);
                if (!a) return;
                const pos = game.getSelfPosition();
                const openedFloor = pos ? snapFloorTile(pos.x, pos.z) : null;
                hud.showSelfEmojiMenu(
                  a.x,
                  a.y,
                  (emoji) => {
                    if (socket.readyState === WebSocket.OPEN)
                      sendChat(socket, emoji);
                  },
                  openedFloor
                );
              },
            }
          : undefined
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
        },
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
          st.colorId
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
          if (!beginSent) {
            sendBeginBlockClaim(socket, x, z, y);
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
    hud.onBillboardPlace((x, z, opts) => {
      if ("liveChart" in opts && opts.liveChart) {
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
            destRoomId,
            destX,
            destZ,
            currentRoomId: normalizeRoomId(game.getRoomId()),
            roomOptions: teleporterDestinationRoomOptions(),
            onPickTileInCurrentRoom: () => {
              game.setTeleporterDestPickHandler((px, pz) => {
                hud.setTeleporterEditFields({
                  destRoomId: normalizeRoomId(game.getRoomId()),
                  destX: px,
                  destZ: pz,
                });
                syncBuildHud();
              });
              syncBuildHud();
            },
            onPickCancel: () => {
              game.setTeleporterDestPickHandler(null);
            },
            onConfigure: (roomId, dx, dz) => {
              sendConfigureTeleporter(
                socket,
                x,
                z,
                y,
                normalizeRoomId(roomId),
                dx,
                dz
              );
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
        sphere: m.sphere,
        ramp: m.ramp,
        rampDir: m.rampDir,
        colorId: m.colorId,
        locked: m.locked || false,
        isAdmin: isAdmin(selfAddress),
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
    colorId: number;
    locked?: boolean;
    teleporter?: unknown;
  } | null): boolean {
    return Boolean(
      meta &&
        meta.passable &&
        meta.quarter &&
        meta.hex &&
        meta.colorId === 4 &&
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
    const inCanvas = normalizeRoomId(game.getRoomId()) === CANVAS_ROOM_ID;
    if (!inCanvas) {
      const visit = game.getStandingBillboardVisitOffer();
      if (visit) {
        portalAction = {
          kind: "billboard",
          visitUrl: visit.visitUrl,
          visitName: visit.visitName,
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
    if (msg.type === "clientPong") {
      const t0 = perfPingSentAt.get(msg.id);
      if (t0 !== undefined) {
        perfPingSentAt.delete(msg.id);
        hud.setPerfHudLatencyMs(performance.now() - t0);
      }
      return;
    }
    if (msg.type === "joinRoomFailed") {
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
      if (pendingCreateRoomAwaiting) {
        closeRoomsModal();
      }

      const joinedViaModalJoin =
        pendingModalJoinRoomId !== null &&
        normalizeRoomId(msg.roomId).toLowerCase() ===
          normalizeRoomId(pendingModalJoinRoomId).toLowerCase();

      if (joinedViaModalJoin) {
        roomsJoinStatus.hidden = true;
        roomsJoinStatus.textContent = "";
        roomsJoinStatus.classList.remove(
          "rooms-modal__join-status--loading",
          "rooms-modal__join-status--error"
        );
        closeRoomsModal({ keepJoinPending: true });
      }

      try {
      hud.setReconnectOffer(false);
      hud.setLoadingLabel(loadingLabelForTargetRoom(msg.roomId));
      hud.setLoadingVisible(true);
      
      game.applyRoomFromWelcome({
        roomId: msg.roomId,
        roomBounds: msg.roomBounds,
        doors: msg.doors,
        placeRadiusBlocks: Number.isFinite(msg.placeRadiusBlocks)
          ? msg.placeRadiusBlocks
          : 5,
      });
      game.setRoomSceneBackground({
        hueDeg: msg.roomBackgroundHueDeg,
        neutral: msg.roomBackgroundNeutral,
      });
      game.setSelf(msg.self.address, msg.self.displayName);
      selfAddress = msg.self.address;

      const isCanvas = normalizeRoomId(msg.roomId) === CANVAS_ROOM_ID;
      if (!isCanvas) {
        hud.setCanvasCountdown(null);
      }
      const zoomMin = game.getZoomBounds().min;
      if (isCanvas) {
        if (!mazeZoomLocked) {
          nonMazeFrustum = game.getZoomFrustumSize();
          try {
            localStorage.setItem(
              LS_ZOOM_NON_MAZE_FRUSTUM,
              String(nonMazeFrustum)
            );
          } catch {
            /* ignore quota */
          }
        }
        game.setZoomLocked(true, zoomMin);
        mazeZoomLocked = true;
      } else {
        game.setZoomLocked(false);
        const restore = nonMazeFrustum ?? game.getZoomFrustumSize();
        game.setZoomFrustumSize(restore);
        nonMazeFrustum = game.getZoomFrustumSize();
        try {
          localStorage.setItem(
            LS_ZOOM_NON_MAZE_FRUSTUM,
            String(nonMazeFrustum)
          );
        } catch {
          /* ignore quota */
        }
        mazeZoomLocked = false;
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
      game.setExtraFloorTiles(msg.extraFloorTiles);
      game.setRemovedBaseFloorTiles(msg.removedBaseFloorTiles ?? []);
      game.setObstacles(msg.obstacles);
      game.setSignboards(msg.signboards);
      game.setBillboards(msg.billboards ?? []);
      game.setVoxelTextsForRoom(msg.roomId, msg.voxelTexts ?? []);
      
      // Load canvas claims if present and wait for them to finish
      if (msg.canvasClaims) {
        await game.setCanvasClaims(msg.canvasClaims);
      }
      
      lastPlayers = [msg.self, ...msg.others];
      game.syncState(lastPlayers);
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
      
      // Hide loading overlay after everything is loaded
      hud.setLoadingVisible(false);
      syncBuildHud();
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendListRooms(ws);
        syncAwayPresenceToServer();
      }
      } finally {
        if (joinedViaModalJoin) {
          pendingModalJoinRoomId = null;
          roomsJoinSubmitBtn.disabled = false;
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
                id === CANVAS_ROOM_ID;
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
        });
      }
      lastPlayers = [...byAddr.values()];
      game.syncState(lastPlayers);
      syncPlayerCountHud();
      return;
    }
    if (msg.type === "onlineCount") {
      totalOnlinePlayers = Math.max(0, Math.floor(msg.count));
      syncPlayerCountHud();
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
    if (msg.type === "error") {
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
      if (msg.code === "billboard_admin_only") {
        hud.appendChat(
          "System",
          "Only admins can place billboards right now."
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
    }
    if (msg.type === "signboards") {
      game.setSignboards(msg.signboards);
      // Clear signboard tooltip if it's showing a deleted signboard
      hud.setSignboardTooltip(null);
    }
    if (msg.type === "billboards") {
      game.setBillboards(msg.billboards);
    }
    if (msg.type === "voxelTexts") {
      game.setVoxelTextsForRoom(msg.roomId, msg.texts);
      return;
    }
  };

  const connectToRoom = (
    room: string,
    spawn?: { x: number; z: number }
  ): void => {
    connectGen += 1;
    const myGen = connectGen;
    clearWelcomeDeadlineTimer();
    hud.setLoadingLabel(loadingLabelForTargetRoom(room));
    hud.setLoadingVisible(true);
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
          hud.setLoadingVisible(false, { skipMinWait: true });
          hud.setReconnectOffer(true);
          hud.setStatus("Disconnected — tap Reconnect or reload");
          perfPingSentAt.clear();
          hud.setPerfHudLatencyMs(null);
        },
        spawn ? { spawnX: spawn.x, spawnZ: spawn.z } : undefined
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
  hud.onFeedbackSubmit(async (message) => {
    const text = message.trim();
    if (!text) {
      return { ok: false, error: "Please enter a message." };
    }
    if (text.length > 700) {
      hud.appendChat("System", "Feedback is too long (max 700 characters).");
      return { ok: false, error: "Message is too long (max 700 characters)." };
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
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        hud.appendChat("System", "Feedback sent. Thank you!");
        return { ok: true };
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        retryAfterMs?: number;
      };
      if (res.status === 429 && typeof body.retryAfterMs === "number") {
        const s = Math.max(1, Math.ceil(body.retryAfterMs / 1000));
        const err = `Please wait ${s}s before sending again.`;
        hud.appendChat("System", `Feedback rate limit: please wait ${s}s.`);
        return { ok: false, error: err };
      }
      hud.appendChat("System", "Could not send feedback right now.");
      return { ok: false, error: "Could not send feedback right now." };
    } catch {
      hud.appendChat("System", "Could not send feedback right now.");
      return { ok: false, error: "Could not send feedback right now." };
    }
  });
  hud.onPortalEnter(() => {
    if (portalAction?.kind === "door") {
      void game.triggerStandingDoorTransition();
      return;
    }
    if (portalAction?.kind === "billboard") {
      const { visitUrl, visitName } = portalAction;
      hud.showBillboardExternalVisitConfirm({
        url: visitUrl,
        displayName: visitName,
        onConfirm: () => {
          window.open(visitUrl, "_blank", "noopener,noreferrer");
        },
      });
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
    connectToRoom(CHAMBER_ROOM_ID, {
      x: CHAMBER_DEFAULT_SPAWN.x,
      z: CHAMBER_DEFAULT_SPAWN.z,
    });
  });

  connectToRoom(ROOM_ID, {
    x: CHAMBER_DEFAULT_SPAWN.x,
    z: CHAMBER_DEFAULT_SPAWN.z,
  });
  scheduleNextNimWalletPoll(0);

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
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
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
        const ae = document.activeElement;
        if (
          ae &&
          (ae.tagName === "INPUT" ||
            ae.tagName === "TEXTAREA" ||
            ae.tagName === "SELECT")
        ) {
          return;
        }
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
            sendRemoveObstacleAt(ws, t.x, t.z, t.y);
            editingTile = null;
            hud.hideObjectEditPanel();
            game.clearSelectedBlock();
            syncBuildHud();
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
    if (hud.isSelfEmojiMenuOpen()) {
      const ea = game.getSelfScreenPosition(1.32);
      const pos = game.getSelfPosition();
      const floor = pos ? snapFloorTile(pos.x, pos.z) : null;
      hud.setSelfEmojiMenuAnchor(ea ? ea.x : null, ea ? ea.y : null, floor);
    }
    if (showDebugHud) {
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

function main(): void {
  if (isPatchnotesPath()) {
    document.title = "Patch notes — Nimiq Space";
    const app = document.getElementById("app");
    if (app) mountPatchnotesPage(app);
    return;
  }
  document.title = "Nimiq Space";
  openMainMenu();
}

main();
