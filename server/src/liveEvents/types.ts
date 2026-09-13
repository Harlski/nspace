/**
 * Live Events are notifications that something happened on NimiqLIVE.
 * NimiqLIVE does not choose in-game consequences; this process maps them to
 * World Effects (see docs/THE-LARGER-SYSTEM.md).
 */

export const LIVE_EVENT_SOURCE = "nimiqlive" as const;
export const LIVE_EVENT_TYPE_TEST = "nimiqlive.test" as const;

/** Live Event `type` from NimiqLIVE (and operator mapping keys). */
export const LIVE_EVENT_TYPE_RE =
  /^[a-z0-9][a-z0-9._-]{0,127}$/i;

/** Stable identity of one Live Event. Retries reuse it. */
export type LiveEventId = string;

export type LiveEventEnvelope = {
  id: LiveEventId;
  type: string;
  /** Originating time (ISO-8601). Not the retry time. */
  occurredAt: string;
  source: typeof LIVE_EVENT_SOURCE;
  payload: Record<string, unknown>;
};

/**
 * Server-authoritative in-game activity applied because a Live Event arrived.
 * `nimiqlive.test` maps to Live Boost (double gameplay NIM + gold presentation).
 */
export type LiveBoostWorldEffect = {
  kind: "live_boost";
  earnMultiplier: 2;
  untilMs: number;
  liveEventId: LiveEventId;
};

export type WorldEffect = LiveBoostWorldEffect;

export type LiveWorldEffectWire = {
  active: boolean;
  kind?: "live_boost";
  earnMultiplier?: number;
  untilMs?: number;
  serverNowMs: number;
};
