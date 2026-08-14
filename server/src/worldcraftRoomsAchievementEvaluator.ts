import { isCosmeticGalleryRoom } from "./cosmeticGallery.js";
import { isInviteLobbyRoomId } from "./directInvite/config.js";
import {
  CHAMBER_ROOM_ID,
  HUB_ROOM_ID,
  isBuiltinRoomId,
  normalizeRoomId,
} from "./roomLayouts.js";

export const PUBLIC_ROOM_VISITOR_SEEN_PREFIX = "public-room-visitor:";

function compactWallet(v: string): string {
  return String(v || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

/** Persisted player rooms for Open House / Two Keys (not official, Play Space, or builtin). */
export function isPersistedPlayerOwnedRoomEligible(opts: {
  roomId: string;
  isOfficial: boolean;
  deleted?: boolean;
}): boolean {
  if (opts.deleted) return false;
  if (opts.isOfficial) return false;
  const id = normalizeRoomId(opts.roomId);
  if (isBuiltinRoomId(id)) return false;
  if (isInviteLobbyRoomId(id)) return false;
  return true;
}

export function isOpenHouseEligibleRoom(opts: {
  roomId: string;
  isPublic: boolean;
  isOfficial: boolean;
  deleted?: boolean;
}): boolean {
  if (!opts.isPublic) return false;
  return isPersistedPlayerOwnedRoomEligible(opts);
}

/** Rooms that must not complete Room to Room as source or destination. */
export function isRoomToRoomExcludedRoom(roomId: string): boolean {
  const id = normalizeRoomId(roomId);
  if (id === HUB_ROOM_ID) return true;
  if (id === CHAMBER_ROOM_ID) return true;
  if (isCosmeticGalleryRoom(id)) return true;
  if (isInviteLobbyRoomId(id)) return true;
  if (isBuiltinRoomId(id)) return true;
  return false;
}

export function isRoomToRoomEligibleLink(opts: {
  sourceRoomId: string;
  destRoomId: string;
  sourceOwnerAddress: string | null;
  destOwnerAddress: string | null;
  actorAddress: string;
}): boolean {
  const source = normalizeRoomId(opts.sourceRoomId);
  const dest = normalizeRoomId(opts.destRoomId);
  if (!source || !dest || source === dest) return false;
  if (isRoomToRoomExcludedRoom(source) || isRoomToRoomExcludedRoom(dest)) {
    return false;
  }
  const actor = compactWallet(opts.actorAddress);
  const sourceOwner = compactWallet(opts.sourceOwnerAddress ?? "");
  const destOwner = compactWallet(opts.destOwnerAddress ?? "");
  if (!actor || !sourceOwner || !destOwner) return false;
  if (sourceOwner !== actor || destOwner !== actor) return false;
  return true;
}

export function countsTowardTwoKeys(opts: {
  roomId: string;
  isOfficial: boolean;
  deleted?: boolean;
}): boolean {
  return isPersistedPlayerOwnedRoomEligible(opts);
}

/** Extra Hands: ACL gains at least one other wallet (not the owner). */
export function isExtraHandsEligibleBuilderList(opts: {
  ownerAddress: string;
  builderAddresses: readonly string[];
}): boolean {
  const owner = compactWallet(opts.ownerAddress);
  if (!owner) return false;
  for (const raw of opts.builderAddresses) {
    const b = compactWallet(raw);
    if (b && b !== owner && !b.startsWith("GUEST:")) return true;
  }
  return false;
}

export function publicRoomVisitorSeenKey(visitorAddress: string): string {
  return `${PUBLIC_ROOM_VISITOR_SEEN_PREFIX}${compactWallet(visitorAddress)}`;
}

export function isCompanyVisitorEligible(opts: {
  roomId: string;
  isPublic: boolean;
  isOfficial: boolean;
  ownerAddress: string | null;
  visitorAddress: string;
}): boolean {
  if (!opts.isPublic || opts.isOfficial) return false;
  if (!isPersistedPlayerOwnedRoomEligible({
    roomId: opts.roomId,
    isOfficial: opts.isOfficial,
  })) {
    return false;
  }
  const owner = compactWallet(opts.ownerAddress ?? "");
  const visitor = compactWallet(opts.visitorAddress);
  if (!owner || !visitor) return false;
  if (owner === visitor) return false;
  if (visitor.startsWith("GUEST:")) return false;
  return true;
}
