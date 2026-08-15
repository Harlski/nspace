/** Match server `PLAYER_RECONNECT_GRACE_MS` so the loading label tracks resume. */
export const LAST_SESSION_ROOM_HINT_MAX_AGE_MS = 10 * 60 * 1000;

const STORAGE_KEY = "nspace.lastSessionRoomHint";

type Hint = { roomId: string; at: number };

function readHint(): Hint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Hint>;
    if (
      !o ||
      typeof o.roomId !== "string" ||
      !o.roomId.trim() ||
      typeof o.at !== "number" ||
      !Number.isFinite(o.at)
    ) {
      return null;
    }
    return { roomId: o.roomId, at: o.at };
  } catch {
    return null;
  }
}

export function rememberLastSessionRoomId(
  roomId: string,
  now = Date.now()
): void {
  const trimmed = roomId.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ roomId: trimmed, at: now } satisfies Hint)
    );
  } catch {
    /* storage optional */
  }
}

export function peekLastSessionRoomId(now = Date.now()): string | null {
  const hint = readHint();
  if (!hint) return null;
  if (now - hint.at > LAST_SESSION_ROOM_HINT_MAX_AGE_MS) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage optional */
    }
    return null;
  }
  return hint.roomId;
}
