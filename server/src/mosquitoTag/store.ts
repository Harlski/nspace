import { normalizeRoomId } from "../roomLayouts.js";
import {
  initTagState,
  reduceTag,
  type TagEvent,
  type TagState,
} from "./engine.js";

const byRoom = new Map<string, TagState>();

export function getMosquitoTag(roomId: string): TagState {
  return byRoom.get(normalizeRoomId(roomId)) ?? initTagState();
}

function tagStateRetained(state: TagState): boolean {
  if (state.phase !== "idle") return true;
  return Boolean(state.stungPlayerId);
}

export function setMosquitoTag(roomId: string, state: TagState): void {
  const n = normalizeRoomId(roomId);
  if (!tagStateRetained(state)) byRoom.delete(n);
  else byRoom.set(n, state);
}

export function applyMosquitoTagEvent(
  roomId: string,
  event: TagEvent
): { prev: TagState; next: TagState } {
  const prev = getMosquitoTag(roomId);
  const next = reduceTag(prev, event);
  if (next !== prev) setMosquitoTag(roomId, next);
  return { prev, next };
}

export function roomsWithMosquitoTag(): string[] {
  return [...byRoom.keys()];
}
