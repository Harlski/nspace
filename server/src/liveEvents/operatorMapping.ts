import { randomUUID } from "node:crypto";
import { HUB_ROOM_ID, hasRoom, normalizeRoomId } from "../roomLayouts.js";
import {
  isKnownLiveEventInteraction,
  isLiveEventRoomTarget,
  type LiveEventRoomTarget,
} from "./interactions.js";
import { LIVE_EVENT_TYPE_RE } from "./types.js";

export type OperatorLiveEventMapping = {
  id: string;
  eventType: string;
  interactionKind: string;
  roomTarget: LiveEventRoomTarget;
  roomId: string | null;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

export type OperatorMappingInputError =
  | "invalid_event_type"
  | "unknown_interaction"
  | "invalid_room_target"
  | "room_required"
  | "unknown_room";

export type ParseOperatorMappingSuccess = {
  ok: true;
  value: {
    eventType: string;
    interactionKind: string;
    roomTarget: LiveEventRoomTarget;
    roomId: string | null;
    enabled: boolean;
  };
};

export type ParseOperatorMappingFailure = {
  ok: false;
  error: OperatorMappingInputError;
};

export function parseOperatorMappingInput(
  body: unknown
): ParseOperatorMappingSuccess | ParseOperatorMappingFailure {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_event_type" };
  }
  const o = body as Record<string, unknown>;
  const eventType = typeof o.eventType === "string" ? o.eventType.trim() : "";
  if (!LIVE_EVENT_TYPE_RE.test(eventType)) {
    return { ok: false, error: "invalid_event_type" };
  }
  const interactionKind =
    typeof o.interactionKind === "string" ? o.interactionKind.trim() : "";
  if (!isKnownLiveEventInteraction(interactionKind)) {
    return { ok: false, error: "unknown_interaction" };
  }
  const roomTargetRaw =
    typeof o.roomTarget === "string" ? o.roomTarget.trim() : "";
  if (!isLiveEventRoomTarget(roomTargetRaw)) {
    return { ok: false, error: "invalid_room_target" };
  }
  let roomId: string | null = null;
  if (roomTargetRaw === "other") {
    const raw = typeof o.roomId === "string" ? o.roomId.trim() : "";
    if (!raw) return { ok: false, error: "room_required" };
    const normalized = normalizeRoomId(raw);
    if (!hasRoom(normalized)) return { ok: false, error: "unknown_room" };
    roomId = normalized;
  }
  const enabled = o.enabled === undefined ? true : Boolean(o.enabled);
  return {
    ok: true,
    value: {
      eventType,
      interactionKind,
      roomTarget: roomTargetRaw,
      roomId,
      enabled,
    },
  };
}

export function newOperatorMappingId(): string {
  return randomUUID();
}

/** Resolve where a mapped interaction should run. Live Boost ignores this today. */
export function resolveOperatorRoomId(
  mapping: Pick<OperatorLiveEventMapping, "roomTarget" | "roomId">,
  currentRoomId: string,
  hubRoomId: string = HUB_ROOM_ID
): string {
  if (mapping.roomTarget === "hub") return hubRoomId;
  if (mapping.roomTarget === "other" && mapping.roomId) return mapping.roomId;
  return currentRoomId || hubRoomId;
}
