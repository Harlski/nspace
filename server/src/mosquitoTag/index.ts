export {
  MOSQUITO_TAG_ENABLED,
} from "./config.js";
export {
  TAG_DEFAULTS,
  chebyshev,
  initTagState,
  isPlayerInTag,
  reduceTag,
  snapTile,
  tagWireSnapshot,
  walkSpeedMul,
  type MosquitoTagWire,
  type TagConfig,
  type TagEvent,
  type TagOutcome,
  type TagPhase,
  type TagState,
  type TagVec,
} from "./engine.js";
export {
  mosquitoTagAllowedInRoom,
  mosquitoTagOccupiedTileKeys,
} from "./policy.js";
export {
  applyMosquitoTagEvent,
  getMosquitoTag,
  roomsWithMosquitoTag,
  setMosquitoTag,
} from "./store.js";
