import { Game } from "./game/Game.js";

/** Same session-token keys the main-site admin pages use (shared per-origin). */
const AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];

function readToken(): string {
  for (const k of AUTH_KEYS) {
    const t = sessionStorage.getItem(k);
    if (t) return t;
  }
  return "";
}

function setStatus(msg: string): void {
  const el = document.getElementById("preview-status");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function hideStatus(): void {
  const el = document.getElementById("preview-status");
  if (el) el.hidden = true;
}

function setNote(msg: string): void {
  const el = document.getElementById("preview-note");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

async function main(): Promise<void> {
  const host = document.getElementById("preview-host");
  if (!host) return;

  const params = new URLSearchParams(location.search);
  const roomId = (params.get("room") || "").trim();
  const token = params.get("token") || readToken();

  if (!roomId) {
    setStatus("No room specified.");
    return;
  }
  if (!token) {
    setStatus("Not signed in.");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let snapshot: any;
  try {
    const r = await fetch(
      `/api/admin/rooms/${encodeURIComponent(roomId)}/layout`,
      { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (r.status === 401 || r.status === 403) {
      setStatus("Not authorized for this room.");
      return;
    }
    if (!r.ok) {
      setStatus(`Failed to load room (${r.status}).`);
      return;
    }
    snapshot = await r.json();
  } catch {
    setStatus("Failed to load room.");
    return;
  }

  const game = new Game(host);
  game.setMapOverviewUnlocked(true);
  game.applyRoomFromWelcome({
    roomId: snapshot.roomId,
    roomBounds: snapshot.roomBounds,
    doors: snapshot.doors ?? [],
    placeRadiusBlocks: Number.isFinite(snapshot.placeRadiusBlocks)
      ? snapshot.placeRadiusBlocks
      : 5,
  });
  game.setRoomSceneBackground({
    hueDeg: snapshot.roomBackgroundHueDeg ?? null,
    neutral: snapshot.roomBackgroundNeutral ?? null,
  });

  const b = snapshot.roomBounds;
  const centerX = Math.round((b.minX + b.maxX) / 2);
  const centerZ = Math.round((b.minZ + b.maxZ) / 2);
  game.applyWelcomeFloorPayload({
    extraFloorTiles: snapshot.extraFloorTiles ?? [],
    baseFloorColorTiles: snapshot.baseFloorColorTiles ?? [],
    removedBaseFloorTiles: snapshot.removedBaseFloorTiles ?? [],
    spawnX: centerX,
    spawnZ: centerZ,
  });
  game.setObstacles(snapshot.obstacles ?? []);
  game.setSignboards(snapshot.signboards ?? []);
  game.setBillboards(snapshot.billboards ?? []);
  game.setVoxelTextsForRoom(snapshot.roomId, snapshot.voxelTexts ?? []);
  game.resize();

  hideStatus();
  if (snapshot.spatial) {
    setNote("Large room — floor detail is simplified in this preview.");
  }

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    game.tick(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

void main();
