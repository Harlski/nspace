import { Game } from "../game/Game.js";

export type RoomCatalogPreviewHandle = {
  /** Load preview for a room id, or clear when null. */
  selectRoom: (roomId: string | null) => void;
  dispose: () => void;
};

async function fetchPreviewLayout(
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
  const data = (await r.json()) as Parameters<
    Game["applyRoomLayoutSnapshot"]
  >[0];
  return { kind: "ok", data };
}

function waitForHostLayout(hostEl: HTMLElement, gen: number, loadGen: () => number): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const tick = (): void => {
      if (gen !== loadGen()) {
        resolve(false);
        return;
      }
      const w = hostEl.clientWidth;
      const h = hostEl.clientHeight;
      if (w >= 2 && h >= 2) {
        resolve(true);
        return;
      }
      attempts += 1;
      if (attempts >= 60) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function mountRoomCatalogPreview(
  hostEl: HTMLElement,
  statusEl: HTMLElement,
  opts: { apiBase: string; token: string }
): RoomCatalogPreviewHandle {
  const base = opts.apiBase.replace(/\/$/, "");
  let disposed = false;
  let loadGen = 0;
  let game: Game | null = null;
  let raf = 0;
  let resizeObserver: ResizeObserver | null = null;

  const disposePreviewGame = (): void => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (game) {
      game.dispose();
      game = null;
    }
    hostEl.replaceChildren();
  };

  const selectRoom = (roomId: string | null): void => {
    void (async (): Promise<void> => {
      const gen = ++loadGen;
      disposePreviewGame();
      if (!roomId) {
        statusEl.hidden = false;
        statusEl.textContent = "Select a room to preview.";
        return;
      }
      statusEl.hidden = false;
      statusEl.textContent = "Loading room…";
      const layoutUrl = `${base}/api/rooms/${encodeURIComponent(roomId)}/preview`;
      let snapshot: Awaited<ReturnType<typeof fetchPreviewLayout>>;
      try {
        snapshot = await fetchPreviewLayout(layoutUrl, opts.token);
      } catch {
        if (gen !== loadGen || disposed) return;
        statusEl.textContent = "Could not load room preview.";
        return;
      }
      if (gen !== loadGen || disposed) return;
      if (snapshot.kind === "unauthorized") {
        statusEl.textContent = "Not authorized to preview this room.";
        return;
      }
      if (snapshot.kind === "error") {
        statusEl.textContent = "Could not load room preview.";
        return;
      }
      const laidOut = await waitForHostLayout(hostEl, gen, () => loadGen);
      if (!laidOut || gen !== loadGen || disposed) return;
      try {
        statusEl.hidden = true;
        game = new Game(hostEl);
        game.applyRoomLayoutSnapshot(snapshot.data, { catalogPreview: true });
        resizeObserver = new ResizeObserver(() => {
          game?.resize();
        });
        resizeObserver.observe(hostEl);
        game.resize();
      } catch (err) {
        if (gen !== loadGen || disposed) return;
        statusEl.hidden = false;
        statusEl.textContent =
          err instanceof Error ? err.message : "Could not open room preview.";
        return;
      }
      let last = performance.now();
      const loop = (now: number): void => {
        if (disposed || !game || gen !== loadGen) return;
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        game.tick(dt);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
  };

  const dispose = (): void => {
    disposed = true;
    loadGen += 1;
    disposePreviewGame();
  };

  return { selectRoom, dispose };
}
