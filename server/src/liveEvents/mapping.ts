import {
  LIVE_EVENT_TYPE_TEST,
  type LiveEventId,
  type WorldEffect,
} from "./types.js";

export { LIVE_EVENT_TYPE_TEST };

/** Default Live Boost window for `nimiqlive.test` (2 minutes). */
export const LIVE_EVENT_TEST_BOOST_MS_DEFAULT = 120_000;
const LIVE_EVENT_TEST_BOOST_MS_MIN = 15_000;
const LIVE_EVENT_TEST_BOOST_MS_MAX = 15 * 60_000;

/** Operator-tunable duration. NimiqLIVE does not send duration. */
export function liveEventTestBoostMs(): number {
  const raw = Number(process.env.LIVE_EVENT_TEST_BOOST_MS);
  if (!Number.isFinite(raw) || raw <= 0) return LIVE_EVENT_TEST_BOOST_MS_DEFAULT;
  return Math.min(
    LIVE_EVENT_TEST_BOOST_MS_MAX,
    Math.max(LIVE_EVENT_TEST_BOOST_MS_MIN, Math.floor(raw))
  );
}

/**
 * Map a Live Event type to a World Effect. Unknown types return null (accept,
 * no-op) so retries stop and future types can land on the same route.
 */
export function mapLiveEventToWorldEffect(
  type: string,
  liveEventId: LiveEventId,
  nowMs: number
): WorldEffect | null {
  if (type === LIVE_EVENT_TYPE_TEST) {
    return {
      kind: "live_boost",
      earnMultiplier: 2,
      untilMs: nowMs + liveEventTestBoostMs(),
      liveEventId,
    };
  }
  return null;
}
