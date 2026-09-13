import { LIVE_EVENT_SOURCE, type LiveEventEnvelope, type WorldEffect } from "./types.js";
import { mapLiveEventToWorldEffect } from "./mapping.js";
import { persistAcceptedLiveEvent } from "./store.js";

const LIVE_EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIVE_EVENT_TYPE_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

export type AcceptLiveEventSuccess = {
  ok: true;
  duplicate: boolean;
  ignored: boolean;
  effect: WorldEffect | null;
  envelope: LiveEventEnvelope;
};

export type AcceptLiveEventFailure = {
  ok: false;
  error: "invalid_body";
  detail: string;
};

export type AcceptLiveEventResult = AcceptLiveEventSuccess | AcceptLiveEventFailure;

function isPlainPayload(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseLiveEventEnvelope(
  body: unknown
): { ok: true; envelope: LiveEventEnvelope } | { ok: false; detail: string } {
  if (!isPlainPayload(body)) {
    return { ok: false, detail: "body_must_be_object" };
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!LIVE_EVENT_ID_RE.test(id)) {
    return { ok: false, detail: "invalid_id" };
  }
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!LIVE_EVENT_TYPE_RE.test(type)) {
    return { ok: false, detail: "invalid_type" };
  }
  const occurredAt =
    typeof body.occurredAt === "string" ? body.occurredAt.trim() : "";
  if (!occurredAt || !Number.isFinite(Date.parse(occurredAt))) {
    return { ok: false, detail: "invalid_occurredAt" };
  }
  if (body.source !== LIVE_EVENT_SOURCE) {
    return { ok: false, detail: "invalid_source" };
  }
  if (!isPlainPayload(body.payload)) {
    return { ok: false, detail: "invalid_payload" };
  }
  return {
    ok: true,
    envelope: {
      id,
      type,
      occurredAt,
      source: LIVE_EVENT_SOURCE,
      payload: body.payload,
    },
  };
}

/**
 * Validate, persist Live Event Id, and map to a World Effect.
 * Duplicate ids return without remapping so World Effects do not stack.
 */
export function acceptLiveEvent(
  body: unknown,
  nowMs: number = Date.now()
): AcceptLiveEventResult {
  const parsed = parseLiveEventEnvelope(body);
  if (!parsed.ok) {
    return { ok: false, error: "invalid_body", detail: parsed.detail };
  }
  const { envelope } = parsed;
  const effect = mapLiveEventToWorldEffect(envelope.type, envelope.id, nowMs);
  const persisted = persistAcceptedLiveEvent(envelope, effect, nowMs);
  if (persisted.duplicate) {
    return {
      ok: true,
      duplicate: true,
      ignored: false,
      effect: null,
      envelope,
    };
  }
  if (!effect) {
    console.info(
      `[live-events] accepted ${envelope.id} type=${envelope.type} (unknown type, no World Effect)`
    );
    return {
      ok: true,
      duplicate: false,
      ignored: true,
      effect: null,
      envelope,
    };
  }
  console.info(
    `[live-events] accepted ${envelope.id} type=${envelope.type} effect=${effect.kind} untilMs=${effect.untilMs}`
  );
  return {
    ok: true,
    duplicate: false,
    ignored: false,
    effect,
    envelope,
  };
}
