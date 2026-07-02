import { Game } from "../game/Game.js";

/** Same-room bidirectional pair sentinel (matches build dock / server pair configure). */
export const TELEPORTER_PAIR_ROOM_VALUE = "__THIS_ROOM_PAIR__";

export type TeleporterDestinationPickerRoom = {
  id: string;
  displayName: string;
};

export type TeleporterDestinationPickerResult =
  | { ok: true; roomId: string; x: number; z: number }
  | { ok: false; reason: "cancelled" | "load_failed" | "unauthorized" };

export type OpenTeleporterDestinationPickerOpts = {
  rooms: TeleporterDestinationPickerRoom[];
  hubRoomId: string;
  currentRoomId: string;
  initialRoomId: string;
  initialX: number;
  initialZ: number;
  /** When true, room select is locked to the linked-pair "This room" option. */
  lockToPairOnly: boolean;
  token: string;
  apiBase?: string;
};

/** @deprecated Use {@link OpenTeleporterDestinationPickerOpts} */
export type TeleporterDestPreviewResult = TeleporterDestinationPickerResult;

/** @deprecated Use {@link OpenTeleporterDestinationPickerOpts} */
export type TeleporterDestPreviewOpts = {
  roomId: string;
  displayName: string;
  token: string;
  initialX: number;
  initialZ: number;
  apiBase?: string;
};

let activeCleanup: (() => void) | null = null;

export function closeTeleporterDestPreview(): void {
  activeCleanup?.();
  activeCleanup = null;
}

export async function openTeleporterDestinationPicker(
  opts: OpenTeleporterDestinationPickerOpts
): Promise<TeleporterDestinationPickerResult> {
  closeTeleporterDestPreview();

  return new Promise((resolve) => {
    void runTeleporterDestinationPicker(opts, resolve);
  });
}

/** @deprecated Use {@link openTeleporterDestinationPicker} */
export async function openTeleporterDestPreview(
  opts: TeleporterDestPreviewOpts
): Promise<TeleporterDestPreviewResult> {
  return openTeleporterDestinationPicker({
    rooms: [{ id: opts.roomId, displayName: opts.displayName }],
    hubRoomId: "",
    currentRoomId: opts.roomId,
    initialRoomId: opts.roomId,
    initialX: opts.initialX,
    initialZ: opts.initialZ,
    lockToPairOnly: false,
    token: opts.token,
    apiBase: opts.apiBase,
  });
}

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

function layoutRoomId(selectedRoomId: string, currentRoomId: string): string | null {
  const sel = selectedRoomId.trim();
  if (!sel || sel === TELEPORTER_PAIR_ROOM_VALUE) {
    return normalizeId(currentRoomId);
  }
  return normalizeId(sel);
}

function isHubSelection(selectedRoomId: string, hubRoomId: string): boolean {
  return Boolean(hubRoomId) && normalizeId(selectedRoomId) === normalizeId(hubRoomId);
}

async function runTeleporterDestinationPicker(
  opts: OpenTeleporterDestinationPickerOpts,
  resolve: (result: TeleporterDestinationPickerResult) => void
): Promise<void> {
  const base = (opts.apiBase ?? "").replace(/\/$/, "");
  const currentRoomId = normalizeId(opts.currentRoomId);

  const backdrop = document.createElement("div");
  backdrop.className = "teleporter-dest-preview-overlay";
  backdrop.setAttribute("role", "presentation");

  const dlg = document.createElement("div");
  dlg.className = "teleporter-dest-preview-dialog";
  dlg.setAttribute("role", "dialog");
  dlg.setAttribute("aria-modal", "true");
  dlg.setAttribute("aria-labelledby", "tp-dest-preview-title");
  dlg.innerHTML = `
    <div class="teleporter-dest-preview-dialog__head">
      <h2 class="teleporter-dest-preview-dialog__title" id="tp-dest-preview-title">Set destination</h2>
      <button type="button" class="teleporter-dest-preview-dialog__close" aria-label="Close">×</button>
    </div>
    <label class="teleporter-dest-preview-dialog__room-label">
      <span class="teleporter-dest-preview-dialog__room-label-text">Destination room</span>
      <select id="tp-dest-room-select" class="teleporter-dest-preview-dialog__room-select" aria-label="Destination room"></select>
    </label>
    <p class="teleporter-dest-preview-dialog__hint">Click a walkable floor tile. Teal ring = Join Spawn fallback if your hint becomes blocked.</p>
    <p class="teleporter-dest-preview-dialog__hub-note" hidden>Players warp to Hub spawn. No landing tile is needed.</p>
    <p class="teleporter-dest-preview-dialog__coords" aria-live="polite"></p>
    <div class="teleporter-dest-preview-dialog__canvas-wrap">
      <div class="teleporter-dest-preview-dialog__host"></div>
      <p class="teleporter-dest-preview-dialog__status" hidden></p>
    </div>
    <div class="teleporter-dest-preview-dialog__actions">
      <button type="button" class="teleporter-dest-preview-dialog__btn teleporter-dest-preview-dialog__btn--secondary" data-action="cancel">Cancel</button>
      <button type="button" class="teleporter-dest-preview-dialog__btn teleporter-dest-preview-dialog__btn--primary" data-action="confirm" disabled>Confirm</button>
    </div>`;

  backdrop.appendChild(dlg);
  document.body.appendChild(backdrop);

  const roomSelect = dlg.querySelector(
    "#tp-dest-room-select"
  ) as HTMLSelectElement;
  const coordsEl = dlg.querySelector(
    ".teleporter-dest-preview-dialog__coords"
  ) as HTMLElement;
  const hubNoteEl = dlg.querySelector(
    ".teleporter-dest-preview-dialog__hub-note"
  ) as HTMLElement;
  const hintEl = dlg.querySelector(
    ".teleporter-dest-preview-dialog__hint"
  ) as HTMLElement;
  const statusEl = dlg.querySelector(
    ".teleporter-dest-preview-dialog__status"
  ) as HTMLElement;
  const canvasWrap = dlg.querySelector(
    ".teleporter-dest-preview-dialog__canvas-wrap"
  ) as HTMLElement;
  const hostEl = dlg.querySelector(
    ".teleporter-dest-preview-dialog__host"
  ) as HTMLElement;
  const confirmBtn = dlg.querySelector(
    '[data-action="confirm"]'
  ) as HTMLButtonElement;
  const cancelBtn = dlg.querySelector(
    '[data-action="cancel"]'
  ) as HTMLButtonElement;
  const closeBtn = dlg.querySelector(
    ".teleporter-dest-preview-dialog__close"
  ) as HTMLButtonElement;

  roomSelect.replaceChildren();
  if (opts.lockToPairOnly) {
    const pairOpt = document.createElement("option");
    pairOpt.value = TELEPORTER_PAIR_ROOM_VALUE;
    pairOpt.textContent = "This room";
    roomSelect.appendChild(pairOpt);
    roomSelect.disabled = true;
  } else {
    const pairOpt = document.createElement("option");
    pairOpt.value = TELEPORTER_PAIR_ROOM_VALUE;
    pairOpt.textContent = "This room (linked pair)";
    roomSelect.appendChild(pairOpt);
    const seen = new Set<string>();
    for (const row of opts.rooms) {
      const rid = normalizeId(row.id);
      if (!rid || seen.has(rid)) continue;
      seen.add(rid);
      const o = document.createElement("option");
      o.value = rid;
      o.textContent = row.displayName;
      roomSelect.appendChild(o);
    }
  }

  let selectedRoomId = opts.initialRoomId.trim() || TELEPORTER_PAIR_ROOM_VALUE;
  if (opts.lockToPairOnly) {
    selectedRoomId = TELEPORTER_PAIR_ROOM_VALUE;
  } else {
    const match = [...roomSelect.options].find(
      (op) =>
        op.value === selectedRoomId ||
        normalizeId(op.value) === normalizeId(selectedRoomId)
    );
    roomSelect.value = match?.value ?? TELEPORTER_PAIR_ROOM_VALUE;
    selectedRoomId = roomSelect.value;
  }

  let pickedX = Math.floor(opts.initialX);
  let pickedZ = Math.floor(opts.initialZ);
  let hasPick =
    !isHubSelection(selectedRoomId, opts.hubRoomId) &&
    Number.isFinite(opts.initialX) &&
    Number.isFinite(opts.initialZ);

  let game: Game | null = null;
  let raf = 0;
  let disposed = false;
  let loadGen = 0;
  let pointerHandler: ((ev: PointerEvent) => void) | null = null;

  const syncCoords = (): void => {
    if (isHubSelection(selectedRoomId, opts.hubRoomId)) {
      coordsEl.textContent = "Hub spawn";
      confirmBtn.disabled = false;
      return;
    }
    coordsEl.textContent = hasPick
      ? `Landing Hint: (${pickedX}, ${pickedZ})`
      : "Click the map to choose a tile.";
    confirmBtn.disabled = !hasPick;
  };

  const detachPointer = (): void => {
    if (pointerHandler) {
      hostEl.removeEventListener("pointerdown", pointerHandler);
      pointerHandler = null;
    }
  };

  const stopPreviewLoop = (): void => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const disposePreviewGame = (): void => {
    detachPointer();
    stopPreviewLoop();
    game?.dispose();
    game = null;
  };

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("keydown", onKeydown, true);
    disposePreviewGame();
    backdrop.remove();
    if (activeCleanup === cleanup) activeCleanup = null;
  };

  activeCleanup = cleanup;

  const finish = (result: TeleporterDestinationPickerResult): void => {
    cleanup();
    resolve(result);
  };

  const onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      finish({ ok: false, reason: "cancelled" });
    }
  };

  cancelBtn.addEventListener("click", () =>
    finish({ ok: false, reason: "cancelled" })
  );
  closeBtn.addEventListener("click", () =>
    finish({ ok: false, reason: "cancelled" })
  );
  confirmBtn.addEventListener("click", () => {
    if (isHubSelection(selectedRoomId, opts.hubRoomId)) {
      finish({ ok: true, roomId: opts.hubRoomId, x: 0, z: 0 });
      return;
    }
    if (!hasPick) return;
    finish({
      ok: true,
      roomId: selectedRoomId,
      x: pickedX,
      z: pickedZ,
    });
  });

  window.addEventListener("keydown", onKeydown, true);

  const loadLayoutForSelection = async (): Promise<void> => {
    const gen = ++loadGen;
    syncCoords();

    if (isHubSelection(selectedRoomId, opts.hubRoomId)) {
      disposePreviewGame();
      canvasWrap.hidden = true;
      hubNoteEl.hidden = false;
      hintEl.hidden = true;
      statusEl.hidden = true;
      return;
    }

    canvasWrap.hidden = false;
    hubNoteEl.hidden = true;
    hintEl.hidden = false;

    const rid = layoutRoomId(selectedRoomId, opts.currentRoomId);
    if (!rid) {
      statusEl.hidden = false;
      statusEl.textContent = "Choose a destination room.";
      return;
    }

    disposePreviewGame();
    statusEl.hidden = false;
    statusEl.textContent = "Loading room…";

    const layoutUrl = `${base}/api/rooms/${encodeURIComponent(rid)}/layout`;
    let snapshot: Awaited<ReturnType<typeof fetchLayout>>;
    try {
      snapshot = await fetchLayout(layoutUrl, opts.token);
    } catch {
      if (gen !== loadGen || disposed) return;
      statusEl.textContent = "Could not load room layout.";
      return;
    }

    if (gen !== loadGen || disposed) return;

    if (snapshot.kind === "unauthorized") {
      statusEl.textContent = "Not authorized to preview this room.";
      return;
    }
    if (snapshot.kind === "error") {
      statusEl.textContent = "Could not load room layout.";
      return;
    }

    try {
      statusEl.hidden = true;
      game = new Game(hostEl);
      game.applyRoomLayoutSnapshot(snapshot.data);
      if (hasPick) {
        game.setPreviewLandingHintHighlight({ x: pickedX, z: pickedZ });
      }
    } catch (err) {
      if (gen !== loadGen || disposed) return;
      statusEl.hidden = false;
      statusEl.textContent =
        err instanceof Error ? err.message : "Could not open room preview.";
      return;
    }

    pointerHandler = (ev: PointerEvent): void => {
      if (!game || ev.button !== 0) return;
      const tile = game.pickWalkableFloorAtScreen(ev.clientX, ev.clientY);
      if (!tile) return;
      pickedX = tile.x;
      pickedZ = tile.z;
      hasPick = true;
      game.setPreviewLandingHintHighlight({ x: pickedX, z: pickedZ });
      syncCoords();
    };
    hostEl.addEventListener("pointerdown", pointerHandler);

    let last = performance.now();
    const loop = (now: number): void => {
      if (disposed || !game || gen !== loadGen) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      game.tick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    syncCoords();
  };

  roomSelect.addEventListener("change", () => {
    selectedRoomId = roomSelect.value;
    if (isHubSelection(selectedRoomId, opts.hubRoomId)) {
      hasPick = false;
    } else if (selectedRoomId === TELEPORTER_PAIR_ROOM_VALUE) {
      hasPick = Number.isFinite(opts.initialX) && Number.isFinite(opts.initialZ);
    }
    void loadLayoutForSelection();
  });

  await loadLayoutForSelection();
}

async function fetchLayout(
  url: string,
  token: string
): Promise<
  | { kind: "ok"; data: Parameters<Game["applyRoomLayoutSnapshot"]>[0] }
  | { kind: "unauthorized" }
  | { kind: "error" }
> {
  const r = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.status === 401 || r.status === 403) return { kind: "unauthorized" };
  if (!r.ok) return { kind: "error" };
  const data = (await r.json()) as Parameters<Game["applyRoomLayoutSnapshot"]>[0];
  return { kind: "ok", data };
}
