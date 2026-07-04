import { Game } from "../game/Game.js";
import { normalizeRoomId, PIXEL_ROOM_ID } from "../game/roomLayouts.js";
import { roomSceneBackgroundToRgb } from "../game/wardrobePreviewBackdrop.js";

export type RoomCatalogPreviewHandle = {
  /** Load preview for a room id, or clear when null. */
  selectRoom: (roomId: string | null) => void;
  dispose: () => void;
};

/**
 * Huge spatial rooms (Pixel) strip their floor tiles from the preview snapshot,
 * so the 3D scene would be empty. `spatial` is not part of the Game snapshot
 * type, so widen it here.
 */
type PreviewLayout = Parameters<Game["applyRoomLayoutSnapshot"]>[0] & {
  spatial?: boolean;
};

/** Horizontal extent (world tiles) of the spawn-centered spatial-room crop. */
const SPATIAL_PREVIEW_WINDOW_TILES = 100;

async function fetchPreviewLayout(
  url: string,
  token: string
): Promise<
  | { kind: "ok"; data: PreviewLayout }
  | { kind: "unauthorized" }
  | { kind: "error" }
> {
  const r = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.status === 401 || r.status === 403) return { kind: "unauthorized" };
  if (!r.ok) return { kind: "error" };
  const data = (await r.json()) as PreviewLayout;
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

function rgbToCss(colorRgb: number): string {
  return `#${(colorRgb & 0xffffff).toString(16).padStart(6, "0")}`;
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
  let rasterImage: HTMLImageElement | null = null;

  const disposePreview = (): void => {
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
    if (rasterImage) {
      rasterImage.onload = null;
      rasterImage.onerror = null;
      rasterImage = null;
    }
    hostEl.replaceChildren();
  };

  /**
   * Spatial rooms (Pixel) render a top-down 2D crop of the live board raster
   * (`/pixels.png`) centered on the join spawn - the 3D floor is intentionally
   * empty for these rooms, and a raster avoids a wasted WebGL context.
   */
  const mountSpatialRaster = (data: PreviewLayout, gen: number): void => {
    const b = data.roomBounds;
    const spawn = data.joinSpawn ?? {
      x: Math.round((b.minX + b.maxX) / 2),
      z: Math.round((b.minZ + b.maxZ) / 2),
    };
    // Only shown in the void margin when the crop runs past the board edge
    // (never for Pixel's central spawn). `roomBackgroundNeutral` is loosely
    // typed on the Game snapshot, so derive the fill from the hue alone.
    const bg = roomSceneBackgroundToRgb({
      hueDeg: data.roomBackgroundHueDeg ?? null,
    });

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.imageRendering = "pixelated";

    const img = new Image();
    rasterImage = img;

    const draw = (): void => {
      if (gen !== loadGen || disposed) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cw = Math.max(1, Math.floor(hostEl.clientWidth));
      const ch = Math.max(1, Math.floor(hostEl.clientHeight));
      canvas.width = cw;
      canvas.height = ch;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = rgbToCss(bg);
      ctx.fillRect(0, 0, cw, ch);

      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (nw < 1 || nh < 1) return;

      const tilesX = b.maxX - b.minX + 1;
      const tilesZ = b.maxZ - b.minZ + 1;
      const pxPerTileX = nw / tilesX;
      const pxPerTileZ = nh / tilesZ;
      const aspect = cw / ch;

      // Spawn stays dead-center; window follows the pane aspect. No clamping to
      // the board, so edge spawns show void margin (filled with bg above).
      const winTilesX = SPATIAL_PREVIEW_WINDOW_TILES;
      const winTilesZ = winTilesX / aspect;
      const centerPxX = (spawn.x - b.minX + 0.5) * pxPerTileX;
      const centerPxZ = (spawn.z - b.minZ + 0.5) * pxPerTileZ;
      const sx = centerPxX - (winTilesX / 2) * pxPerTileX;
      const sy = centerPxZ - (winTilesZ / 2) * pxPerTileZ;
      const sw = winTilesX * pxPerTileX;
      const sh = winTilesZ * pxPerTileZ;

      // Draw only the part of the crop that actually overlaps the board raster.
      const ix0 = Math.max(0, sx);
      const iy0 = Math.max(0, sy);
      const ix1 = Math.min(nw, sx + sw);
      const iy1 = Math.min(nh, sy + sh);
      if (ix1 <= ix0 || iy1 <= iy0) return;
      const dx0 = ((ix0 - sx) / sw) * cw;
      const dy0 = ((iy0 - sy) / sh) * ch;
      const dx1 = ((ix1 - sx) / sw) * cw;
      const dy1 = ((iy1 - sy) / sh) * ch;
      ctx.drawImage(
        img,
        ix0,
        iy0,
        ix1 - ix0,
        iy1 - iy0,
        dx0,
        dy0,
        dx1 - dx0,
        dy1 - dy0
      );
    };

    img.onload = (): void => {
      if (gen !== loadGen || disposed) return;
      statusEl.hidden = true;
      hostEl.replaceChildren(canvas);
      draw();
      resizeObserver = new ResizeObserver(() => draw());
      resizeObserver.observe(hostEl);
    };
    img.onerror = (): void => {
      if (gen !== loadGen || disposed) return;
      statusEl.hidden = false;
      statusEl.textContent = "Could not load room preview.";
    };
    img.src = `${base}/pixels.png`;
  };

  const selectRoom = (roomId: string | null): void => {
    void (async (): Promise<void> => {
      const gen = ++loadGen;
      disposePreview();
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
      const data = snapshot.data;

      // Spatial rooms omit floor tiles, so render the 2D board raster instead of
      // an empty 3D scene. Only Pixel exposes a raster today.
      if (data.spatial) {
        if (normalizeRoomId(data.roomId) === PIXEL_ROOM_ID) {
          mountSpatialRaster(data, gen);
        } else {
          statusEl.hidden = false;
          statusEl.textContent = "Preview not available for this room.";
        }
        return;
      }

      const laidOut = await waitForHostLayout(hostEl, gen, () => loadGen);
      if (!laidOut || gen !== loadGen || disposed) return;
      try {
        statusEl.hidden = true;
        game = new Game(hostEl);
        game.applyRoomLayoutSnapshot(data, { catalogPreview: true });
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
    disposePreview();
  };

  return { selectRoom, dispose };
}
