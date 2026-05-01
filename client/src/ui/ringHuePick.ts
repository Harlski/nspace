/**
 * Angular hue (0–359) from pointer position on a circular hue ring element.
 * Matches build-bar hue ring behavior (center hole returns null).
 */
export function ringHueFromClient(
  ringEl: HTMLElement,
  clientX: number,
  clientY: number
): number | null {
  const ringRect = ringEl.getBoundingClientRect();
  const cx = ringRect.left + ringRect.width / 2;
  const cy = ringRect.top + ringRect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  const outer = ringRect.width * 0.5;
  const inner = ringRect.width * 0.22;
  if (dist < inner || dist === 0) return null;
  if (dist > outer) {
    const ang = Math.atan2(dy, dx);
    let deg = (ang * 180) / Math.PI;
    return (deg + 90 + 360) % 360;
  }
  const ang = Math.atan2(dy, dx);
  let deg = (ang * 180) / Math.PI;
  return (deg + 90 + 360) % 360;
}
