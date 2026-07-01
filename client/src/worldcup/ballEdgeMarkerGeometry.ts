/**
 * Ball Edge Marker geometry - pure screen-space placement math (CLIENT-ONLY,
 * FEATURE-FLAGGED, DEPRECATABLE). Used by [ballEdgeMarker.ts](./ballEdgeMarker.ts).
 */
/** Screen-space ball centre + projected radius (canvas-local pixels). */
export type BallScreen = {
  x: number;
  y: number;
  radius: number;
};

export type Viewport = {
  width: number;
  height: number;
};

export type BallEdgeMarkerPlacement = {
  edgeX: number;
  edgeY: number;
  /** CSS rotation in degrees; 0 points right, 90 points down. */
  angleDeg: number;
  opacity: number;
};

const DEFAULT_EDGE_INSET = 22;
const DEFAULT_MIN_OPACITY = 0.28;
const DEFAULT_FADE_DISTANCE = 120;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** True when the ball circle intersects the viewport rectangle. */
export function isBallOnScreen(ball: BallScreen, viewport: Viewport): boolean {
  const left = ball.x - ball.radius;
  const right = ball.x + ball.radius;
  const top = ball.y - ball.radius;
  const bottom = ball.y + ball.radius;
  return (
    right > 0 &&
    left < viewport.width &&
    bottom > 0 &&
    top < viewport.height
  );
}

/** Distance from the ball body to the viewport rect (0 when overlapping). */
export function ballViewportOverflow(
  ball: BallScreen,
  viewport: Viewport
): number {
  const closestX = clamp(ball.x, 0, viewport.width);
  const closestY = clamp(ball.y, 0, viewport.height);
  const dist = Math.hypot(ball.x - closestX, ball.y - closestY);
  return Math.max(0, dist - ball.radius);
}

function rayToInsetRectEdge(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): { x: number; y: number } {
  let t = Infinity;
  if (Math.abs(dx) > 1e-6) {
    const tx = dx > 0 ? (maxX - cx) / dx : (minX - cx) / dx;
    if (tx > 0) t = Math.min(t, tx);
  }
  if (Math.abs(dy) > 1e-6) {
    const ty = dy > 0 ? (maxY - cy) / dy : (minY - cy) / dy;
    if (ty > 0) t = Math.min(t, ty);
  }
  if (!Number.isFinite(t) || t === Infinity) {
    return { x: cx, y: cy };
  }
  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * Ball Edge Marker placement for an off-screen ball. Returns null when the ball is
 * visible (any part inside the letterboxed viewport) or inputs are invalid.
 */
export function computeBallEdgeMarkerPlacement(
  ball: BallScreen,
  viewport: Viewport,
  opts?: {
    edgeInset?: number;
    minOpacity?: number;
    fadeDistance?: number;
  }
): BallEdgeMarkerPlacement | null {
  const { width, height } = viewport;
  if (
    !(width > 0 && height > 0) ||
    !(ball.radius > 0) ||
    !Number.isFinite(ball.x) ||
    !Number.isFinite(ball.y)
  ) {
    return null;
  }
  if (isBallOnScreen(ball, viewport)) return null;

  const inset = opts?.edgeInset ?? DEFAULT_EDGE_INSET;
  const minOpacity = opts?.minOpacity ?? DEFAULT_MIN_OPACITY;
  const fadeDistance = opts?.fadeDistance ?? DEFAULT_FADE_DISTANCE;

  const cx = width / 2;
  const cy = height / 2;
  let dx = ball.x - cx;
  let dy = ball.y - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    dy = -1;
  }

  const edge = rayToInsetRectEdge(
    cx,
    cy,
    dx,
    dy,
    inset,
    inset,
    width - inset,
    height - inset
  );

  const overflow = ballViewportOverflow(ball, viewport);
  const t = clamp(overflow / fadeDistance, 0, 1);
  const opacity = minOpacity + (1 - minOpacity) * t;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return { edgeX: edge.x, edgeY: edge.y, angleDeg, opacity };
}
