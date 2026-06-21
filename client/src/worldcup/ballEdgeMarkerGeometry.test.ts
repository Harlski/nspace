import { describe, it, expect } from "vitest";
import { computeBallEdgeMarkerPlacement } from "./ballEdgeMarkerGeometry.js";

const viewport = { width: 800, height: 450 };

describe("computeBallEdgeMarkerPlacement", () => {
  it("returns null when any part of the ball is on screen", () => {
    expect(
      computeBallEdgeMarkerPlacement({ x: 400, y: 225, radius: 20 }, viewport)
    ).toBeNull();
    expect(
      computeBallEdgeMarkerPlacement({ x: -5, y: 225, radius: 20 }, viewport)
    ).toBeNull();
    expect(
      computeBallEdgeMarkerPlacement({ x: 805, y: 225, radius: 20 }, viewport)
    ).toBeNull();
  });

  it("returns null for invalid viewport or ball radius", () => {
    expect(
      computeBallEdgeMarkerPlacement({ x: 900, y: 225, radius: 20 }, {
        width: 0,
        height: 450,
      })
    ).toBeNull();
    expect(
      computeBallEdgeMarkerPlacement({ x: 900, y: 225, radius: 0 }, viewport)
    ).toBeNull();
  });

  it("places a marker on the right edge when the ball is off-screen to the right", () => {
    const p = computeBallEdgeMarkerPlacement(
      { x: 950, y: 225, radius: 20 },
      viewport
    );
    expect(p).not.toBeNull();
    expect(p!.edgeX).toBeGreaterThan(viewport.width / 2);
    expect(p!.edgeX).toBeLessThanOrEqual(viewport.width);
    expect(Math.abs(p!.angleDeg)).toBeLessThan(45);
    expect(p!.opacity).toBeGreaterThan(0.5);
  });

  it("fades opacity as the ball nears the viewport edge", () => {
    const far = computeBallEdgeMarkerPlacement(
      { x: 1200, y: 225, radius: 20 },
      viewport
    );
    const near = computeBallEdgeMarkerPlacement(
      { x: 830, y: 225, radius: 20 },
      viewport
    );
    expect(far).not.toBeNull();
    expect(near).not.toBeNull();
    expect(far!.opacity).toBeGreaterThan(near!.opacity);
  });

  it("points toward an off-screen ball above the frame", () => {
    const p = computeBallEdgeMarkerPlacement(
      { x: 400, y: -80, radius: 20 },
      viewport
    );
    expect(p).not.toBeNull();
    expect(p!.edgeY).toBeLessThan(viewport.height / 2);
    expect(p!.angleDeg).toBeLessThan(-60);
  });
});
