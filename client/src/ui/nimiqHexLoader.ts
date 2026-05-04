/**
 * Nimiq Keyguard opening loader (paired stroked hexagons with dash animation).
 * Source: https://github.com/nimiq/keyguard — `src/common.css`, request `index.html` (MIT).
 */
export function nimiqHexLoaderSvg(classNames: string): string {
  const cls = classNames.trim().replace(/\s+/g, " ");
  return (
    `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 48" color="inherit" aria-hidden="true" focusable="false">` +
    `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round">` +
    `<path class="big-hex" d="M51.9,21.9L41.3,3.6c-0.8-1.3-2.2-2.1-3.7-2.1H16.4c-1.5,0-2.9,0.8-3.7,2.1L2.1,21.9c-0.8,1.3-0.8,2.9,0,4.2 l10.6,18.3c0.8,1.3,2.2,2.1,3.7,2.1h21.3c1.5,0,2.9-0.8,3.7-2.1l10.6-18.3C52.7,24.8,52.7,23.2,51.9,21.9z" opacity="0.4" stroke-dasharray="92.5 60"/>` +
    `<path class="small-hex" d="M51.9,21.9L41.3,3.6c-0.8-1.3-2.2-2.1-3.7-2.1H16.4c-1.5,0-2.9,0.8-3.7,2.1L2.1,21.9c-0.8,1.3-0.8,2.9,0,4.2 l10.6,18.3c0.8,1.3,2.2,2.1,3.7,2.1h21.3c1.5,0,2.9-0.8,3.7-2.1l10.6-18.3C52.7,24.8,52.7,23.2,51.9,21.9z" stroke-dasharray="47.5 105"/>` +
    `</g></svg>`
  );
}
