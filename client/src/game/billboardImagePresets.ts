/**
 * Built-in billboard textures: every raster image under `client/src/game/`
 * (Vite resolves each to a hashed asset URL).
 */
export type BillboardImagePreset = {
  id: string;
  label: string;
  /** URL string suitable for TextureLoader and for sending to the server. */
  url: string;
};

const rawGlob = import.meta.glob<string>("./**/*.{png,jpg,jpeg,webp,gif}", {
  eager: true,
  import: "default",
});

function pathToPresetId(rel: string): string {
  return rel
    .replace(/^\.\//, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}

const sortedPaths = Object.keys(rawGlob).sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" })
);

export const BILLBOARD_IMAGE_PRESETS: readonly BillboardImagePreset[] =
  sortedPaths.map((path) => ({
    id: pathToPresetId(path),
    label: path.replace(/^\.\//, ""),
    url: rawGlob[path]!,
  }));

export const DEFAULT_BILLBOARD_PRESET_ID =
  BILLBOARD_IMAGE_PRESETS[0]?.id ?? "none";

export function getBillboardPresetById(
  id: string
): BillboardImagePreset | undefined {
  return BILLBOARD_IMAGE_PRESETS.find((p) => p.id === id);
}

/** Pick preset id when `url` matches a bundled asset; otherwise `"__custom__"`. */
export function matchBillboardPresetIdForUrl(url: string): string {
  const u = url.trim();
  if (!u) return "__custom__";
  for (const p of BILLBOARD_IMAGE_PRESETS) {
    if (p.url === u) return p.id;
    try {
      const a = new URL(p.url, window.location.origin);
      const b = new URL(u, window.location.origin);
      if (a.pathname === b.pathname) return p.id;
    } catch {
      /* ignore */
    }
  }
  return "__custom__";
}
