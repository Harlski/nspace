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
  | "cube-rotation"
  | "billboard-edit"
  | "unlock-pad-config"
  | "attention-marker-hover";

export type BuildDockContextTool =
  | "block"
  | "signpost"
  | "teleporter"
  | "billboard"
  | "gate"
  | "unlock-pad"
  | "attention-marker"
  | "prefab";

export function buildDockContextParamVisible(
  param: BuildDockContextParamId,
  ctx: {
    tool: BuildDockContextTool;
    pyramid: boolean;
    hex: boolean;
    sphere: boolean;
    ramp: boolean;
    /** Plain cube (not hex / pyramid / sphere / ramp). */
    plainCube?: boolean;
    /** Signpost / teleporter / gate / billboard placement tools hide block params. */
    minimalInspector: boolean;
    /** False while editing teleporter, gate, billboard, etc. on the map. */
    blockParams?: boolean;
    /** Placed billboard selected in build mode (Edit opens billboard modal). */
    billboardSelectionEdit?: boolean;
    /** Unlock Pad tool active or a placed Unlock Pad selected for edit. */
    unlockPadConfig?: boolean;
    /** Attention Marker tool or selected marker. */
    attentionMarkerHover?: boolean;
  }
): boolean {
  if (param === "billboard-edit") {
    return ctx.billboardSelectionEdit === true;
  }
  if (param === "unlock-pad-config") {
    return ctx.unlockPadConfig === true;
  }
  if (param === "attention-marker-hover") {
    return ctx.attentionMarkerHover === true;
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
  if (param === "cube-rotation") {
    return (
      ctx.tool === "block" &&
      ctx.plainCube === true &&
      !ctx.hex &&
      !ctx.pyramid &&
      !ctx.sphere &&
      !ctx.ramp
    );
  }
  return false;
}
