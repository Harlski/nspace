import nimiqIconsData from "nimiq-icons/icons.json";

/**
 * Nimiq Design sprite (`@nimiq/style`). Shipped as `client/public/nimiq-style.icons.svg`;
 * copy from `node_modules/@nimiq/style/nimiq-style.icons.svg` when upgrading `@nimiq/style`.
 *
 * Extra symbols (e.g. `nq-logos-fm-mono`, Iconify `i-nimiq:logos-fm-mono`) are merged from
 * the `nimiq-icons` icon set when needed.
 */
export const NIMIQ_ICON_SPRITE = "/nimiq-style.icons.svg";

/** Iconify ID under `nimiq-icons` for `i-nimiq:logos-nimiq-hexagon-outline-mono`. */
const LOGOS_NIMIQ_HEX_OUTLINE_MONO_ID = "logos-nimiq-hexagon-outline-mono" as const;

/**
 * Outline mono Nimiq hex from `nimiq-icons` (same asset as
 * [Nimiq Icons explorer - logos-nimiq-hexagon-outline-mono](https://onmax.github.io/nimiq-ui/nimiq-icons/explorer?icon=nimiq%3Alogos-nimiq-hexagon-outline-mono)),
 * with a centered plus sign overlay for “add wallet”.
 */
export function nimiqLogosHexOutlineMonoPlusMarkup(opts?: { graphicClass?: string }): string {
  const ic = nimiqIconsData.icons[LOGOS_NIMIQ_HEX_OUTLINE_MONO_ID];
  const body = ic?.body;
  if (!body) throw new Error("[nimiqIcons] nimiq-icons: missing logos-nimiq-hexagon-outline-mono");
  const vw = ic.width ?? 18;
  const vh = ic.height ?? 17;
  const gc = opts?.graphicClass;
  const cls = ["main-menu__cached-add-hex__graphic", gc].filter(Boolean).join(" ");
  /** Match the outline path’s `stroke-width="1.5"`; centered in the 18×17 viewBox. */
  const plusStroke = "1.5";
  const plus = `<path fill="none" stroke="currentColor" stroke-width="${plusStroke}" stroke-linecap="round" d="M9 11.05V6.95M6.52 9h4.96"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(vw)} ${String(vh)}" fill="none" class="${cls}" aria-hidden="true">` +
    body +
    plus +
    "</svg>"
  );
}

export function nimiqIconifyMarkup(
  iconId: string,
  opts?: { class?: string; width?: number; height?: number }
): string {
  const ic = nimiqIconsData.icons[iconId];
  const body = ic?.body;
  if (!body) throw new Error(`[nimiqIcons] nimiq-icons: missing ${iconId}`);
  const w = opts?.width ?? ic.width ?? 16;
  const h = opts?.height ?? ic.height ?? 16;
  const cls = ["nq-icon", opts?.class].filter(Boolean).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(
    w
  )} ${String(h)}" class="${cls}" aria-hidden="true">${body}</svg>`;
}

export function nimiqIconUseMarkup(
  symbolId: string,
  opts?: { class?: string; width?: number; height?: number }
): string {
  const w = opts?.width ?? 16;
  const h = opts?.height ?? 16;
  const cls = ["nq-icon", opts?.class].filter(Boolean).join(" ");
  return `<svg class="${cls}" width="${w}" height="${h}" aria-hidden="true"><use href="${NIMIQ_ICON_SPRITE}#${symbolId}"/></svg>`;
}

/** Canvas raster of `{@link NIMIQ_ICON_SPRITE}#nq-hexagon` (viewBox 0 0 27 24). */
const NQ_HEXAGON_VB_W = 27;
const NQ_HEXAGON_VB_H = 24;
const NQ_HEXAGON_PATH_D =
  "M26.6991 10.875L21.0741 1.125C20.6691 0.4275 19.9266 0 19.1241 0H7.87414C7.07164 0 6.32914 0.4275 5.92789 1.125L0.302891 10.875C-0.0983594 11.5725 -0.0983594 12.4275 0.302891 13.125L5.92789 22.875C6.32914 23.5725 7.07164 24 7.87414 24H19.1241C19.9266 24 20.6691 23.5725 21.0704 22.875L26.6954 13.125C27.1004 12.4275 27.1004 11.5725 26.6991 10.875Z";

export function nqHexagonLogoWidthForHeight(heightPx: number): number {
  return heightPx * (NQ_HEXAGON_VB_W / NQ_HEXAGON_VB_H);
}

/** White silhouette ring + fill, matching mining-reward text outline style. */
export function drawNqHexagonWithWhiteOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: string,
  outlinePx: number
): void {
  const path = new Path2D(NQ_HEXAGON_PATH_D);
  const corners: [number, number][] = [
    [-outlinePx, 0],
    [outlinePx, 0],
    [0, -outlinePx],
    [0, outlinePx],
    [-outlinePx, -outlinePx],
    [outlinePx, -outlinePx],
    [-outlinePx, outlinePx],
    [outlinePx, outlinePx],
  ];
  const sx = width / NQ_HEXAGON_VB_W;
  const sy = height / NQ_HEXAGON_VB_H;
  ctx.save();
  for (const [ox, oy] of corners) {
    ctx.save();
    ctx.translate(x + ox, y + oy);
    ctx.scale(sx, sy);
    ctx.fillStyle = "#ffffff";
    ctx.fill(path);
    ctx.restore();
  }
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.fillStyle = fillColor;
  ctx.fill(path);
  ctx.restore();
}
