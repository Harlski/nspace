/**
 * Nimiq Design sprite (`@nimiq/style`). Shipped as `client/public/nimiq-style.icons.svg`;
 * copy from `node_modules/@nimiq/style/nimiq-style.icons.svg` when upgrading `@nimiq/style`.
 *
 * Extra symbols (e.g. `nq-logos-fm-mono`, `nq-vertical-ellipsis`, `nq-pacifier`) are merged from
 * the `nimiq-icons` / Iconify `i-nimiq:*` set when needed.
 */
export const NIMIQ_ICON_SPRITE = "/nimiq-style.icons.svg";

export function nimiqIconUseMarkup(
  symbolId: string,
  opts?: { class?: string; width?: number; height?: number }
): string {
  const w = opts?.width ?? 16;
  const h = opts?.height ?? 16;
  const cls = ["nq-icon", opts?.class].filter(Boolean).join(" ");
  return `<svg class="${cls}" width="${w}" height="${h}" aria-hidden="true"><use href="${NIMIQ_ICON_SPRITE}#${symbolId}"/></svg>`;
}
