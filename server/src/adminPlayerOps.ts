/**
 * Admin player lookup / tutorial ops — resolve wallet or custom username,
 * return a dossier (tutorial, moderation, activity). Live presence / room
 * counts are attached in the HTTP route (avoids importing rooms.ts here).
 */
import {
  findWalletByCustomUsername,
  getEffectivePlayerDisplayName,
  getPlayerProfilePublicJson,
  getTutorialProfileRow,
  playerHasCustomUsername,
} from "./playerProfileStore.js";
import {
  isChannelMuted,
  isMiningBanned,
  isUsernameSetBanned,
  listModerationSnapshot,
} from "./moderationStore.js";
import { resetTutorialProgress } from "./tutorialSessionService.js";
import { getConnectNoticeStatsForAddress } from "./eventLog.js";
import { listRoomsOwnedBy } from "./roomRegistry.js";
import { walletDisplayName } from "./walletDisplayName.js";
import { getPlayerCountry as getWorldcupPlayerCountry } from "./worldcup/scoreStore.js";

function compactWallet(raw: string): string {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function looksLikeWalletTarget(compact: string): boolean {
  // Custom usernames never start with NQ. Compact keys are typically NQ + 34.
  return compact.startsWith("NQ") && compact.length >= 36;
}

export type AdminPlayerResolveOk = {
  ok: true;
  wallet: string;
  matchedBy: "wallet" | "username";
  username: string | null;
};

export type AdminPlayerResolve =
  | AdminPlayerResolveOk
  | { ok: false; error: "invalid_target" | "not_found" };

/**
 * Resolve an admin-facing target: NQ wallet (spaces optional), or custom username
 * (case-insensitive, same as whisper `/w name`).
 */
export function resolveAdminPlayerTarget(raw: string): AdminPlayerResolve {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "invalid_target" };

  const walletForm = compactWallet(trimmed);
  if (looksLikeWalletTarget(walletForm)) {
    const username = playerHasCustomUsername(walletForm)
      ? getEffectivePlayerDisplayName(walletForm)
      : null;
    return {
      ok: true,
      wallet: walletForm,
      matchedBy: "wallet",
      username: username || null,
    };
  }

  // Partial NQ strings are not usernames — reject instead of false "not_found".
  if (walletForm.startsWith("NQ")) {
    return { ok: false, error: "invalid_target" };
  }

  const byName = findWalletByCustomUsername(trimmed);
  if (!byName) return { ok: false, error: "not_found" };
  const wallet = compactWallet(byName);
  return {
    ok: true,
    wallet,
    matchedBy: "username",
    username: getEffectivePlayerDisplayName(byName) || trimmed,
  };
}

/** Prefer username path when set; wallet path is always valid. */
export function adminUserProfilePath(
  wallet: string,
  username: string | null | undefined
): string {
  const name = String(username ?? "").trim();
  if (name) return `/admin/user/${encodeURIComponent(name)}`;
  return `/admin/user/${encodeURIComponent(compactWallet(wallet))}`;
}

export type AdminPlayerIdentity = {
  wallet: string;
  /** Custom in-game username when set; otherwise null. */
  username: string | null;
  /** Username or wallet shorthand — safe for human-facing labels. */
  displayName: string;
  /** `/admin/user/{username|wallet}` dossier path. */
  profilePath: string;
};

/** Resolve display + moderation-profile path for an admin UI player cell. */
export function adminPlayerIdentity(wallet: string): AdminPlayerIdentity {
  const w = compactWallet(wallet);
  if (!w) {
    return { wallet: "", username: null, displayName: "", profilePath: "/admin/user/" };
  }
  const username = playerHasCustomUsername(w)
    ? getEffectivePlayerDisplayName(w)
    : null;
  const displayName =
    username || walletDisplayName(w) || w;
  return {
    wallet: w,
    username,
    displayName,
    profilePath: adminUserProfilePath(w, username),
  };
}

export type AdminPlayerTutorialView = {
  completedAt?: number;
  abandonedAt?: number;
  /** Cleared completion ⇒ Pay sessions will be forced into the lesson again. */
  needsTutorialWhenPay: boolean;
  steps: {
    mine: boolean;
    pay: boolean;
    exit: boolean;
  };
  session?: {
    mineSlotTile?: string;
    mineCompletedAt?: number;
    doorPaidAt?: number;
    gateUnstuckAt?: number;
    lastStep?: "mine" | "pay" | "exit";
  };
};

export type AdminPlayerRoomRow = {
  id: string;
  displayName: string;
  isPublic: boolean;
  playerCount: number;
};

export type AdminPlayerView = {
  wallet: string;
  matchedBy: "wallet" | "username";
  username: string | null;
  displayName: string;
  walletShort: string;
  profilePath: string;
  recentAliases: string[];
  profileMessage: string;
  country: string | null;
  tutorial: AdminPlayerTutorialView;
  moderation: {
    miningRestricted: boolean;
    usernameSetBanned: boolean;
    channelMuted: boolean;
    miningNote?: string;
  };
  rooms: AdminPlayerRoomRow[];
  activity: {
    lastVisit: {
      nimEarnedLabel: string;
      activeMs: number;
      startedAt?: number;
      endedAt?: number;
    } | null;
    today: { nimEarnedLabel: string; activeMs: number };
  };
  presence: {
    online: boolean;
    roomId: string | null;
  };
  chatLogUrl: string;
};

function miningNoteFor(wallet: string): string | undefined {
  const row = listModerationSnapshot().miningRestrictions.find(
    (r) => compactWallet(r.address) === wallet
  );
  return row?.note;
}

export type AdminPlayerLiveContext = {
  currentRoomId: string | null;
  roomPlayerCount: (roomId: string) => number;
};

export function buildAdminPlayerView(
  resolved: AdminPlayerResolveOk,
  live?: AdminPlayerLiveContext
): AdminPlayerView {
  const wallet = resolved.wallet;
  const row = getTutorialProfileRow(wallet);
  const session = row.tutorialSession;
  const completedAt = row.tutorialCompletedAt;
  const mineDone = typeof session?.mineCompletedAt === "number";
  const payDone =
    typeof session?.doorPaidAt === "number" ||
    typeof session?.gateUnstuckAt === "number";
  const exitDone = typeof completedAt === "number";

  const note = miningNoteFor(wallet);
  const pub = getPlayerProfilePublicJson(wallet);
  const username =
    resolved.username ||
    (playerHasCustomUsername(wallet)
      ? getEffectivePlayerDisplayName(wallet)
      : null);
  const displayName = username || walletDisplayName(wallet) || wallet;
  const roomId = live?.currentRoomId ?? null;
  const stats = getConnectNoticeStatsForAddress(wallet);
  const country = getWorldcupPlayerCountry(wallet);

  const rooms = listRoomsOwnedBy(wallet)
    .map((room) => ({
      id: room.id,
      displayName: room.displayName,
      isPublic: room.isPublic === true,
      playerCount: live?.roomPlayerCount(room.id) ?? 0,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    wallet,
    matchedBy: resolved.matchedBy,
    username: username || null,
    displayName,
    walletShort: walletDisplayName(wallet),
    profilePath: adminUserProfilePath(wallet, username),
    recentAliases: pub.recentAliases ?? [],
    profileMessage: pub.message || "",
    country: country || null,
    tutorial: {
      ...(typeof completedAt === "number" ? { completedAt } : {}),
      ...(typeof row.tutorialAbandonedAt === "number"
        ? { abandonedAt: row.tutorialAbandonedAt }
        : {}),
      needsTutorialWhenPay: typeof completedAt !== "number",
      steps: {
        mine: mineDone || exitDone,
        pay: payDone || exitDone,
        exit: exitDone,
      },
      ...(session ? { session } : {}),
    },
    moderation: {
      miningRestricted: isMiningBanned(wallet),
      usernameSetBanned: isUsernameSetBanned(wallet),
      channelMuted: isChannelMuted(wallet),
      ...(note ? { miningNote: note } : {}),
    },
    rooms,
    activity: {
      lastVisit: stats.lastVisit
        ? {
            nimEarnedLabel: stats.lastVisit.nimEarnedLabel,
            activeMs: stats.lastVisit.activeMs,
            ...(typeof stats.lastVisit.startedAt === "number"
              ? { startedAt: stats.lastVisit.startedAt }
              : {}),
            ...(typeof stats.lastVisit.endedAt === "number"
              ? { endedAt: stats.lastVisit.endedAt }
              : {}),
          }
        : null,
      today: {
        nimEarnedLabel: stats.today.nimEarnedLabel,
        activeMs: stats.today.activeMs,
      },
    },
    presence: {
      online: roomId != null,
      roomId: roomId ?? null,
    },
    chatLogUrl: `/admin/chat?wallet=${encodeURIComponent(wallet)}`,
  };
}

function liveContextFromRooms(): AdminPlayerLiveContext {
  // Lazy require-style import via dynamic import is async; callers in index
  // pass live context. Tests omit it.
  return {
    currentRoomId: null,
    roomPlayerCount: () => 0,
  };
}

export function lookupAdminPlayer(
  raw: string,
  live?: AdminPlayerLiveContext
):
  | { ok: true; player: AdminPlayerView }
  | { ok: false; error: "invalid_target" | "not_found" } {
  const resolved = resolveAdminPlayerTarget(raw);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    player: buildAdminPlayerView(resolved, live ?? liveContextFromRooms()),
  };
}

/**
 * Full lesson wipe (Mine → Pay → Exit markers + completion) so the next
 * Nimiq Pay session needs the tutorial again. Caller clears spent mine claim ids.
 */
export function adminResetPlayerTutorial(
  raw: string,
  live?: AdminPlayerLiveContext
):
  | { ok: true; wallet: string; player: AdminPlayerView }
  | { ok: false; error: string } {
  const resolved = resolveAdminPlayerTarget(raw);
  if (!resolved.ok) return resolved;
  const result = resetTutorialProgress(resolved.wallet);
  if (!result.ok) return result;
  return {
    ok: true,
    wallet: resolved.wallet,
    player: buildAdminPlayerView(resolved, live ?? liveContextFromRooms()),
  };
}
