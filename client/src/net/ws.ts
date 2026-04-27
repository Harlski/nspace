import type { PlayerState } from "../types.js";
import { resolveApiBaseUrl } from "./apiBase.js";

export type ObstacleTile = {
  x: number;
  z: number;
  /** Vertical stack level (0..2). */
  y: number;
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
  signboardId?: string;
  locked?: boolean;
  teleporter?:
    | { pending: true }
    | { targetRoomId: string; targetX: number; targetZ: number };
};

export type ObstacleProps = {
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
  locked?: boolean;
};

export type ObstacleRef = {
  x: number;
  z: number;
  y: number;
};

export type ExtraFloorTile = { x: number; z: number };
export type VoxelTextSpec = {
  id: string;
  text: string;
  roomId: string;
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  unit: number;
  letterSpacing: number;
  color: number;
  emissive: number;
  emissiveIntensity: number;
  zTween: boolean;
  zTweenAmp: number;
  zTweenSpeed: number;
};

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type RoomDoor = {
  x: number;
  z: number;
  targetRoomId: string;
  spawnX: number;
  spawnZ: number;
};

export type RoomCatalogEntry = {
  id: string;
  displayName: string;
  /** Player-created rooms only; official rooms use `null`. */
  ownerAddress: string | null;
  playerCount: number;
  isPublic: boolean;
  /** Hub, Chamber, Canvas. */
  isBuiltin: boolean;
  /** Server allows editing name / visibility (room owner or admin). */
  canEdit: boolean;
  /** Soft-deleted; admin can restore. */
  isDeleted?: boolean;
  canDelete?: boolean;
  canRestore?: boolean;
};

export type ServerMessage =
  | {
      type: "welcome";
      self: PlayerState;
      others: PlayerState[];
      roomId: string;
      roomBounds: RoomBounds;
      doors: RoomDoor[];
      /** Max horizontal distance from player to tile for place/move; 0 = unlimited. */
      placeRadiusBlocks: number;
      obstacles: ObstacleTile[];
      extraFloorTiles: ExtraFloorTile[];
      canvasClaims?: Array<{ x: number; z: number; address: string }>;
      signboards: Array<{
        id: string;
        x: number;
        z: number;
        message: string;
        createdBy: string;
        createdAt: number;
      }>;
      voxelTexts?: VoxelTextSpec[];
      /** Real players online across all rooms (NPCs excluded). */
      onlinePlayerCount?: number;
      /** Omitted on older servers; client defaults to true. */
      allowPlaceBlocks?: boolean;
      allowExtraFloor?: boolean;
    }
  | { type: "playerJoined"; player: PlayerState }
  | { type: "playerLeft"; address: string }
  | { type: "state"; players: PlayerState[] }
  | { type: "onlineCount"; count: number }
  | { type: "obstacles"; roomId: string; tiles: ObstacleTile[] }
  | {
      type: "obstaclesDelta";
      roomId: string;
      add: ObstacleTile[];
      /** Block keys ("x,z,y") that should be removed from the room. */
      remove: string[];
    }
  | { type: "extraFloor"; roomId: string; tiles: ExtraFloorTile[] }
  | {
      type: "extraFloorDelta";
      roomId: string;
      add: ExtraFloorTile[];
      /** Tile keys ("x,z") that should be removed from the room. */
      remove: string[];
    }
  | { type: "canvasClaim"; x: number; z: number; address: string }
  | { type: "canvasTimer"; timeRemaining: number }
  | { type: "canvasCountdown"; text: string; msRemaining: number }
  | {
      type: "signboards";
      roomId: string;
      signboards: Array<{
        id: string;
        x: number;
        z: number;
        message: string;
        createdBy: string;
        createdAt: number;
      }>;
    }
  | { type: "voxelTexts"; roomId: string; texts: VoxelTextSpec[] }
  | {
      type: "chat";
      from: string;
      fromAddress: string;
      text: string;
      at: number;
      bubbleOnly?: boolean;
    }
  | { type: "error"; code: string }
  | { type: "joinRoomFailed"; roomId: string; reason: "not_found" }
  | {
      type: "roomActionResult";
      action: "deleteRoom" | "restoreRoom";
      ok: boolean;
      roomId?: string;
      reason?: string;
    }
  | { type: "roomCatalog"; rooms: RoomCatalogEntry[] }
  | {
      type: "blockClaimOffered";
      claimId: string;
      x: number;
      z: number;
      /** Stack level in `blockKey` (0..2). */
      y?: number;
      holdMs: number;
      completeBy: number;
    }
  | {
      type: "blockClaimResult";
      ok: boolean;
      reason?: string;
      recoverable?: boolean;
      x?: number;
      z?: number;
      amountNim?: string;
    };

export type ConnectGameWsOptions = {
  spawnX?: number;
  spawnZ?: number;
};

export function connectGameWs(
  token: string,
  room: string,
  onMessage: (msg: ServerMessage) => void,
  onClose: (ev: CloseEvent) => void,
  opts?: ConnectGameWsOptions
): WebSocket {
  const q = new URLSearchParams({
    token,
    room,
  });
  if (
    opts &&
    Number.isFinite(opts.spawnX) &&
    Number.isFinite(opts.spawnZ)
  ) {
    q.set("sx", String(opts.spawnX));
    q.set("sz", String(opts.spawnZ));
  }
  let originBase: string;
  const wsEnv = import.meta.env.VITE_WS_BASE_URL;
  if (wsEnv) {
    let w = String(wsEnv).trim().replace(/\/$/, "");
    if (!w.includes("://")) {
      const lower = w.toLowerCase();
      const useWs =
        lower.startsWith("localhost") ||
        lower.startsWith("127.0.0.1") ||
        lower.startsWith("[::1]");
      w = `${useWs ? "ws://" : "wss://"}${w}`;
    }
    try {
      originBase = new URL(w).origin;
    } catch {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      originBase = `${proto}//${location.host}`;
    }
  } else {
    const api = resolveApiBaseUrl();
    if (api) {
      try {
        const u = new URL(api);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        originBase = u.origin;
      } catch {
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        originBase = `${proto}//${location.host}`;
      }
    } else {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      originBase = `${proto}//${location.host}`;
    }
  }
  const url = `${originBase}/ws?${q}`;
  const ws = new WebSocket(url);
  ws.addEventListener("message", (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as ServerMessage;
      onMessage(data);
    } catch {
      /* ignore */
    }
  });
  ws.addEventListener("close", (ev) => onClose(ev));
  return ws;
}

export function sendMoveTo(
  ws: WebSocket,
  x: number,
  z: number,
  layer: 0 | 1 = 0
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "moveTo", x, z, layer }));
}

export function sendEnterPortal(ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "enterPortal" }));
}

export function sendPlacePendingTeleporter(
  ws: WebSocket,
  x: number,
  z: number
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "placePendingTeleporter", x, z }));
}

export function sendConfigureTeleporter(
  ws: WebSocket,
  x: number,
  z: number,
  y: number,
  destRoomId: string,
  destX: number,
  destZ: number
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: "configureTeleporter",
      x,
      z,
      y,
      destRoomId,
      destX,
      destZ,
    })
  );
}

export function sendListRooms(ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "listRooms" }));
}

export function sendJoinRoom(ws: WebSocket, roomId: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "joinRoom", roomId }));
}

export function sendCreateRoom(
  ws: WebSocket,
  widthTiles: number,
  heightTiles: number,
  options?: { displayName?: string; isPublic?: boolean }
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: "createRoom",
      widthTiles,
      heightTiles,
      ...(options?.displayName !== undefined
        ? { displayName: options.displayName }
        : {}),
      ...(options?.isPublic !== undefined ? { isPublic: options.isPublic } : {}),
    })
  );
}

export function sendUpdateRoom(
  ws: WebSocket,
  roomId: string,
  patch: { displayName?: string; isPublic?: boolean }
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: "updateRoom",
      roomId,
      ...patch,
    })
  );
}

export function sendDeleteRoom(ws: WebSocket, roomId: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "deleteRoom", roomId }));
}

export function sendRestoreRoom(ws: WebSocket, roomId: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "restoreRoom", roomId }));
}

export function sendPlaceBlock(
  ws: WebSocket,
  x: number,
  z: number,
  style?: {
    half?: boolean;
    quarter?: boolean;
    hex?: boolean;
    ramp?: boolean;
    rampDir?: number;
    colorId?: number;
    claimable?: boolean;
  }
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const quarter = style?.quarter ?? false;
  const half = quarter ? false : (style?.half ?? false);
  const ramp = Boolean(style?.ramp);
  const rampDir = Math.max(0, Math.min(3, Math.floor(style?.rampDir ?? 0)));
  const hex = ramp ? false : Boolean(style?.hex);
  const claimable = Boolean(style?.claimable);
  ws.send(
    JSON.stringify({
      type: "placeBlock",
      x,
      z,
      half,
      quarter,
      hex,
      ramp,
      rampDir: ramp ? rampDir : 0,
      colorId: style?.colorId ?? 0,
      claimable,
    })
  );
}

export function sendSetObstacleProps(
  ws: WebSocket,
  x: number,
  z: number,
  y: number,
  props: ObstacleProps
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const quarter = props.quarter;
  const half = quarter ? false : props.half;
  const ramp = props.ramp;
  const rampDir = Math.max(0, Math.min(3, Math.floor(props.rampDir)));
  const hex = ramp ? false : props.hex;
  const locked = props.locked || false;
  
  ws.send(
    JSON.stringify({
      type: "setObstacleProps",
      x,
      z,
      y,
      passable: props.passable,
      half,
      quarter,
      hex,
      ramp,
      rampDir: ramp ? rampDir : 0,
      colorId: props.colorId,
      locked,
    })
  );
}

export function sendRemoveObstacle(ws: WebSocket, x: number, z: number): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "removeObstacle", x, z, y: 0 }));
}

export function sendRemoveObstacleAt(
  ws: WebSocket,
  x: number,
  z: number,
  y: number
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "removeObstacle", x, z, y }));
}

export function sendBeginBlockClaim(
  ws: WebSocket,
  x: number,
  z: number,
  y = 0
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const payload: { type: string; x: number; z: number; y?: number } = {
    type: "beginBlockClaim",
    x,
    z,
  };
  if (y !== 0) payload.y = y;
  ws.send(JSON.stringify(payload));
}

export function sendBlockClaimTick(ws: WebSocket, claimId: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "blockClaimTick", claimId }));
}

export function sendCompleteBlockClaim(ws: WebSocket, claimId: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "completeBlockClaim", claimId }));
}

export function sendPlaceExtraFloor(ws: WebSocket, x: number, z: number): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "placeExtraFloor", x, z }));
}

export function sendRemoveExtraFloor(ws: WebSocket, x: number, z: number): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "removeExtraFloor", x, z }));
}

export function sendMoveObstacle(
  ws: WebSocket,
  fromX: number,
  fromZ: number,
  fromY: number,
  toX: number,
  toZ: number,
  toY: number
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: "moveObstacle",
      fromX,
      fromZ,
      fromY,
      toX,
      toZ,
      toY,
    })
  );
}

export function sendNimSendIntent(ws: WebSocket, active: boolean): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "nimSendIntent", active }));
}

export function sendChatTyping(ws: WebSocket, active: boolean): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "chatTyping", active }));
}

export function sendChat(ws: WebSocket, text: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "chat", text }));
}

export function sendSetVoxelText(ws: WebSocket, spec: VoxelTextSpec): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "setVoxelText", ...spec }));
}

export function sendRemoveVoxelText(ws: WebSocket, roomId: string, id: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "removeVoxelText", roomId, id }));
}
