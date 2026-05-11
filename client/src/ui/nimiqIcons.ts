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
 * [Nimiq Icons explorer — logos-nimiq-hexagon-outline-mono](https://onmax.github.io/nimiq-ui/nimiq-icons/explorer?icon=nimiq%3Alogos-nimiq-hexagon-outline-mono)),
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
