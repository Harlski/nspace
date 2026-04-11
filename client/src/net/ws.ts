import type { PlayerState } from "../types.js";
import { resolveApiBaseUrl } from "./apiBase.js";

export type ObstacleTile = {
  x: number;
  z: number;
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
};

export type ObstacleProps = {
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
};

export type ExtraFloorTile = { x: number; z: number };

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

export type ServerMessage =
  | {
      type: "welcome";
      self: PlayerState;
      others: PlayerState[];
      roomId: string;
      roomBounds: RoomBounds;
      doors: RoomDoor[];
      obstacles: ObstacleTile[];
      extraFloorTiles: ExtraFloorTile[];
    }
  | { type: "playerJoined"; player: PlayerState }
  | { type: "playerLeft"; address: string }
  | { type: "state"; players: PlayerState[] }
  | { type: "obstacles"; roomId: string; tiles: ObstacleTile[] }
  | { type: "extraFloor"; roomId: string; tiles: ExtraFloorTile[] }
  | { type: "chat"; from: string; fromAddress: string; text: string; at: number }
  | { type: "error"; code: string };

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
  }
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const quarter = style?.quarter ?? false;
  const half = quarter ? false : (style?.half ?? false);
  const ramp = Boolean(style?.ramp);
  const rampDir = Math.max(0, Math.min(3, Math.floor(style?.rampDir ?? 0)));
  const hex = ramp ? false : Boolean(style?.hex);
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
    })
  );
}

export function sendSetObstacleProps(
  ws: WebSocket,
  x: number,
  z: number,
  props: ObstacleProps
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const quarter = props.quarter;
  const half = quarter ? false : props.half;
  const ramp = props.ramp;
  const rampDir = Math.max(0, Math.min(3, Math.floor(props.rampDir)));
  const hex = ramp ? false : props.hex;
  ws.send(
    JSON.stringify({
      type: "setObstacleProps",
      x,
      z,
      passable: props.passable,
      half,
      quarter,
      hex,
      ramp,
      rampDir: ramp ? rampDir : 0,
      colorId: props.colorId,
    })
  );
}

export function sendRemoveObstacle(ws: WebSocket, x: number, z: number): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "removeObstacle", x, z }));
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
  toX: number,
  toZ: number
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: "moveObstacle",
      fromX,
      fromZ,
      toX,
      toZ,
    })
  );
}

export function sendChat(ws: WebSocket, text: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "chat", text }));
}
