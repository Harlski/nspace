import nimiqIcons from "nimiq-icons/icons.json";

/** Icon key `nimiq:duotone-globe` (Nimiq Icons / `i-nimiq:duotone-globe` in Vue docs). */
const DUOTONE_GLOBE_KEY = "duotone-globe";

type NimiqIconsFile = {
  icons: Record<
    string,
    { body: string; width?: number; height?: number }
  >;
};

function duotoneGlobeSvgDataUrl(color: string): string {
  const { icons } = nimiqIcons as NimiqIconsFile;
  const icon = icons[DUOTONE_GLOBE_KEY];
  if (!icon) throw new Error(`nimiq-icons: missing ${DUOTONE_GLOBE_KEY}`);
  const w = icon.width ?? 24;
  const h = icon.height ?? 24;
  const ns = "http://www.w3.org/2000/svg";
  const inner = icon.body;
  const svg = `<svg xmlns="${ns}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="color:${color}">${inner}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

let globeHtmlImagePromise: Promise<HTMLImageElement> | null = null;

/** Cached decoded globe for drawing into name-label canvases (2D `drawImage`). */
export function loadDuotoneGlobeHtmlImage(): Promise<HTMLImageElement> {
  if (!globeHtmlImagePromise) {
    globeHtmlImagePromise = new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = (): void => resolve(img);
        img.onerror = (): void => reject(new Error("duotone-globe image load failed"));
        img.src = duotoneGlobeSvgDataUrl("#e2e8f0");
      } catch (e) {
        reject(e);
      }
    });
  }
  return globeHtmlImagePromise;
}
