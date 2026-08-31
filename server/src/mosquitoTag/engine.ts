/**
 * Mosquito Tag — pure Tag Call / Tag Round state machine.
 *
 * A reducer `(state, event) -> state`. No rooms, sockets, or timers: `rooms.ts` owns I/O
 * (broadcast, walkable tiles, Path Playback speed including Stung slow).
 */

export type TagPhase = "idle" | "calling" | "countdown" | "playing" | "result";

export type TagVec = { x: number; z: number };

export type BoostPad = {
  x: number;
  z: number;
  coolingUntilMs: number;
};

export type TagOutcome =
  | null
  | { type: "stung"; playerId: string }
  | { type: "last_remaining"; playerId: string };

export type TagConfig = {
  maxParticipants: number;
  minParticipants: number;
  countdownMs: number;
  roundMs: number;
  resultMs: number;
  passCooldownMs: number;
  previousHolderImmuneMs: number;
  passChebyshevMax: number;
  boostDurationMs: number;
  boostPadCooldownMs: number;
  boostPadCount: number;
  boostSpeedMul: number;
  stungSlowMs: number;
  stungSlowMul: number;
};

export const TAG_DEFAULTS: TagConfig = {
  maxParticipants: 8,
  minParticipants: 2,
  countdownMs: 7_000,
  roundMs: 60_000,
  resultMs: 5_000,
  passCooldownMs: 1_000,
  previousHolderImmuneMs: 2_000,
  passChebyshevMax: 1,
  boostDurationMs: 3_000,
  boostPadCooldownMs: 8_000,
  boostPadCount: 6,
  boostSpeedMul: 1.5,
  stungSlowMs: 30_000,
  stungSlowMul: 0.5,
};

export type TagState = {
  phase: TagPhase;
  callerId: string | null;
  joinerIds: string[];
  participantIds: string[];
  holderId: string | null;
  previousHolderId: string | null;
  passCooldownUntilMs: number;
  previousHolderImmuneUntilMs: number;
  holderBoostUntilMs: number;
  countdownEndsAtMs: number;
  roundEndsAtMs: number;
  resultUntilMs: number;
  outcome: TagOutcome;
  boostPads: BoostPad[];
  /** Stung loser; Path Playback slow can outlive the result linger into idle. */
  stungPlayerId: string | null;
  stungUntilMs: number;
};

export type TagEvent =
  | { type: "raise"; playerId: string }
  | { type: "cancel"; playerId: string }
  | { type: "join"; playerId: string }
  | { type: "leave"; playerId: string; nowMs: number; rng?: () => number }
  | { type: "start"; playerId: string; nowMs: number }
  | {
      type: "tick";
      nowMs: number;
      poses: Record<string, TagVec>;
      walkable: TagVec[];
      rng: () => number;
    };

export function initTagState(): TagState {
  return {
    phase: "idle",
    callerId: null,
    joinerIds: [],
    participantIds: [],
    holderId: null,
    previousHolderId: null,
    passCooldownUntilMs: 0,
    previousHolderImmuneUntilMs: 0,
    holderBoostUntilMs: 0,
    countdownEndsAtMs: 0,
    roundEndsAtMs: 0,
    resultUntilMs: 0,
    outcome: null,
    boostPads: [],
    stungPlayerId: null,
    stungUntilMs: 0,
  };
}

function carryStung(from: TagState, into: TagState): TagState {
  return {
    ...into,
    stungPlayerId: from.stungPlayerId,
    stungUntilMs: from.stungUntilMs,
  };
}

function resetToIdle(from: TagState): TagState {
  return carryStung(from, initTagState());
}

function expireStung(state: TagState, nowMs: number): TagState {
  if (!state.stungPlayerId || nowMs < state.stungUntilMs) return state;
  return { ...state, stungPlayerId: null, stungUntilMs: 0 };
}

export function snapTile(x: number, z: number): TagVec {
  return { x: Math.round(x), z: Math.round(z) };
}

export function chebyshev(a: TagVec, b: TagVec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

export function walkSpeedMul(
  state: TagState,
  playerId: string,
  nowMs: number,
  cfg: TagConfig = TAG_DEFAULTS
): number {
  if (
    state.phase === "playing" &&
    state.holderId === playerId &&
    nowMs < state.holderBoostUntilMs
  ) {
    return cfg.boostSpeedMul;
  }
  if (state.stungPlayerId === playerId && nowMs < state.stungUntilMs) {
    return cfg.stungSlowMul;
  }
  return 1;
}

export function isPlayerInTag(state: TagState, playerId: string): boolean {
  if (state.phase === "idle") return false;
  if (state.phase === "calling") {
    return state.callerId === playerId || state.joinerIds.includes(playerId);
  }
  return state.participantIds.includes(playerId);
}

/** True while this player cannot Enter a Teleporter or change Room. */
export function participantRoomLocked(
  state: TagState,
  playerId: string
): boolean {
  if (state.phase !== "countdown" && state.phase !== "playing") return false;
  return state.participantIds.includes(playerId);
}

function pickIndex(length: number, rng: () => number): number {
  if (length <= 0) return 0;
  const r = rng();
  const i = Math.floor(r * length);
  return Math.min(length - 1, Math.max(0, i));
}

function pickPads(
  walkable: TagVec[],
  count: number,
  rng: () => number
): BoostPad[] {
  const pool = walkable.map((t) => ({ x: t.x, z: t.z }));
  const out: BoostPad[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = pickIndex(pool.length, rng);
    const tile = pool.splice(idx, 1)[0]!;
    out.push({ x: tile.x, z: tile.z, coolingUntilMs: 0 });
  }
  return out;
}

function beginResult(
  state: TagState,
  nowMs: number,
  outcome: Exclude<TagOutcome, null>,
  cfg: TagConfig
): TagState {
  const stung =
    outcome.type === "stung"
      ? {
          stungPlayerId: outcome.playerId,
          stungUntilMs: nowMs + cfg.stungSlowMs,
        }
      : {
          stungPlayerId: state.stungPlayerId,
          stungUntilMs: state.stungUntilMs,
        };
  return {
    ...state,
    phase: "result",
    outcome,
    holderBoostUntilMs: 0,
    resultUntilMs: nowMs + cfg.resultMs,
    ...stung,
  };
}

function applyLeave(
  state: TagState,
  playerId: string,
  nowMs: number,
  cfg: TagConfig,
  rng: () => number = () => 0
): TagState {
  if (state.phase === "idle") return state;

  if (state.phase === "calling") {
    if (playerId === state.callerId) return resetToIdle(state);
    return {
      ...state,
      joinerIds: state.joinerIds.filter((id) => id !== playerId),
    };
  }

  const remaining = state.participantIds.filter((id) => id !== playerId);
  if (remaining.length === 0) return resetToIdle(state);

  if (state.phase === "result") {
    return { ...state, participantIds: remaining };
  }

  if (remaining.length < cfg.minParticipants) {
    if (state.phase === "countdown") return resetToIdle(state);
    const last = remaining[0]!;
    return beginResult(
      { ...state, participantIds: remaining, holderId: last },
      nowMs,
      { type: "last_remaining", playerId: last },
      cfg
    );
  }

  let holderId = state.holderId;
  let previousHolderId = state.previousHolderId;
  if (state.phase === "playing" && holderId === playerId) {
    previousHolderId = playerId;
    holderId = remaining[pickIndex(remaining.length, rng)]!;
  }

  return {
    ...state,
    participantIds: remaining,
    holderId,
    previousHolderId,
    callerId:
      state.callerId === playerId ? remaining[0] ?? null : state.callerId,
  };
}

function applyPass(
  state: TagState,
  nowMs: number,
  poses: Record<string, TagVec>,
  cfg: TagConfig
): TagState {
  if (state.phase !== "playing" || !state.holderId) return state;
  if (nowMs < state.passCooldownUntilMs) return state;
  const holderPose = poses[state.holderId];
  if (!holderPose) return state;
  const from = snapTile(holderPose.x, holderPose.z);

  for (const id of state.participantIds) {
    if (id === state.holderId) continue;
    if (
      id === state.previousHolderId &&
      nowMs < state.previousHolderImmuneUntilMs
    ) {
      continue;
    }
    const pose = poses[id];
    if (!pose) continue;
    const to = snapTile(pose.x, pose.z);
    if (chebyshev(from, to) <= cfg.passChebyshevMax) {
      return {
        ...state,
        previousHolderId: state.holderId,
        holderId: id,
        passCooldownUntilMs: nowMs + cfg.passCooldownMs,
        previousHolderImmuneUntilMs: nowMs + cfg.previousHolderImmuneMs,
        holderBoostUntilMs: 0,
      };
    }
  }
  return state;
}

function applyBoost(
  state: TagState,
  nowMs: number,
  poses: Record<string, TagVec>,
  cfg: TagConfig
): TagState {
  if (state.phase !== "playing" || !state.holderId) return state;
  if (nowMs < state.holderBoostUntilMs) return state;
  const holderPose = poses[state.holderId];
  if (!holderPose) return state;
  const tile = snapTile(holderPose.x, holderPose.z);
  const pads = state.boostPads.map((p) => ({ ...p }));
  const pad = pads.find(
    (p) => p.x === tile.x && p.z === tile.z && p.coolingUntilMs <= nowMs
  );
  if (!pad) return state;
  pad.coolingUntilMs = nowMs + cfg.boostPadCooldownMs;
  return {
    ...state,
    boostPads: pads,
    holderBoostUntilMs: nowMs + cfg.boostDurationMs,
  };
}

function applyTick(
  state: TagState,
  event: Extract<TagEvent, { type: "tick" }>,
  cfg: TagConfig
): TagState {
  const { nowMs, poses, walkable, rng } = event;
  state = expireStung(state, nowMs);

  if (state.phase === "countdown") {
    if (nowMs < state.countdownEndsAtMs) return state;
    if (state.participantIds.length < cfg.minParticipants) {
      return resetToIdle(state);
    }
    const holderId =
      state.participantIds[pickIndex(state.participantIds.length, rng)]!;
    return {
      ...state,
      phase: "playing",
      holderId,
      previousHolderId: null,
      passCooldownUntilMs: nowMs,
      previousHolderImmuneUntilMs: 0,
      holderBoostUntilMs: 0,
      boostPads: pickPads(walkable, cfg.boostPadCount, rng),
      roundEndsAtMs: nowMs + cfg.roundMs,
    };
  }

  if (state.phase === "playing") {
    if (nowMs >= state.roundEndsAtMs && state.holderId) {
      return beginResult(
        state,
        nowMs,
        { type: "stung", playerId: state.holderId },
        cfg
      );
    }
    const afterPass = applyPass(state, nowMs, poses, cfg);
    return applyBoost(afterPass, nowMs, poses, cfg);
  }

  if (state.phase === "result") {
    if (nowMs >= state.resultUntilMs) return resetToIdle(state);
    return state;
  }

  return state;
}

/**
 * Advance Tag state by one event. Returns a NEW state (never mutates the input).
 */
export function reduceTag(
  state: TagState,
  event: TagEvent,
  cfg: TagConfig = TAG_DEFAULTS
): TagState {
  switch (event.type) {
    case "raise": {
      if (state.phase !== "idle") return state;
      return {
        ...resetToIdle(state),
        phase: "calling",
        callerId: event.playerId,
      };
    }
    case "cancel": {
      if (state.phase !== "calling") return state;
      if (state.callerId !== event.playerId) return state;
      return resetToIdle(state);
    }
    case "join": {
      if (state.phase !== "calling") return state;
      if (!state.callerId) return state;
      if (event.playerId === state.callerId) return state;
      if (state.joinerIds.includes(event.playerId)) return state;
      if (1 + state.joinerIds.length >= cfg.maxParticipants) return state;
      return { ...state, joinerIds: [...state.joinerIds, event.playerId] };
    }
    case "leave":
      return applyLeave(state, event.playerId, event.nowMs, cfg, event.rng);
    case "start": {
      if (state.phase !== "calling") return state;
      if (state.callerId !== event.playerId) return state;
      if (state.joinerIds.length < cfg.minParticipants - 1) return state;
      return {
        ...state,
        phase: "countdown",
        participantIds: [state.callerId, ...state.joinerIds],
        joinerIds: [],
        countdownEndsAtMs: event.nowMs + cfg.countdownMs,
      };
    }
    case "tick":
      return applyTick(state, event, cfg);
  }
}

export type MosquitoTagWire = {
  phase: TagPhase;
  caller: string | null;
  joiners: string[];
  participants: string[];
  holder: string | null;
  outcome: TagOutcome;
  countdownRemainingMs: number;
  roundRemainingMs: number;
  resultRemainingMs: number;
  boostPads: Array<{ x: number; z: number; cooling: boolean }>;
  holderBoostUntilMs: number;
  stungPlayerId: string | null;
  stungRemainingMs: number;
};

export function tagWireSnapshot(
  state: TagState,
  nowMs: number
): MosquitoTagWire {
  const remain = (until: number) => Math.max(0, until - nowMs);
  return {
    phase: state.phase,
    caller: state.callerId,
    joiners: [...state.joinerIds],
    participants: [...state.participantIds],
    holder: state.holderId,
    outcome: state.outcome,
    countdownRemainingMs:
      state.phase === "countdown" ? remain(state.countdownEndsAtMs) : 0,
    roundRemainingMs:
      state.phase === "playing" ? remain(state.roundEndsAtMs) : 0,
    resultRemainingMs:
      state.phase === "result" ? remain(state.resultUntilMs) : 0,
    boostPads: state.boostPads.map((p) => ({
      x: p.x,
      z: p.z,
      cooling: p.coolingUntilMs > nowMs,
    })),
    holderBoostUntilMs: state.holderBoostUntilMs,
    stungPlayerId: state.stungPlayerId,
    stungRemainingMs: state.stungPlayerId ? remain(state.stungUntilMs) : 0,
  };
}
