/**
 * Which parameter rows appear in the build bottom dock context column
 * (`#tile-inspector-placement` in `build-dock-context-mods`).
 *
 * Reference IDs match `data-build-dock-param` on each row.
 */
export type BuildDockContextParamId =
  | "height"
  | "pyramid-base"
  | "hex-width"
  | "sphere-size"
  | "billboard-edit";

export type BuildDockContextTool =
  | "block"
  | "signpost"
  | "teleporter"
  | "billboard"
  | "gate";

export function buildDockContextParamVisible(
  param: BuildDockContextParamId,
  ctx: {
    tool: BuildDockContextTool;
    pyramid: boolean;
    hex: boolean;
    sphere: boolean;
    ramp: boolean;
    /** Signpost / teleporter / gate / billboard placement tools hide block params. */
    minimalInspector: boolean;
    /** False while editing teleporter, gate, billboard, etc. on the map. */
    blockParams?: boolean;
    /** Placed billboard selected in build mode (Edit opens billboard modal). */
    billboardSelectionEdit?: boolean;
  }
): boolean {
  if (param === "billboard-edit") {
    return ctx.billboardSelectionEdit === true;
  }
  if (ctx.minimalInspector) return false;
  if (ctx.blockParams === false) return false;
  if (param === "height") return ctx.tool === "block";
  if (param === "pyramid-base") {
    return ctx.tool === "block" && ctx.pyramid && !ctx.ramp;
  }
  if (param === "hex-width") {
    return ctx.tool === "block" && ctx.hex && !ctx.ramp;
  }
  if (param === "sphere-size") {
    return ctx.tool === "block" && ctx.sphere && !ctx.ramp;
  }
  return false;
}
