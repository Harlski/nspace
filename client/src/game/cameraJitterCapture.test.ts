import { describe, expect, it } from "vitest";
import { classifyCamJitSpike, type CamJitFrameInput } from "./cameraJitterCapture.js";

function frame(partial: Partial<CamJitFrameInput> & Pick<CamJitFrameInput, "meshX" | "meshZ">): CamJitFrameInput {
  return {
    t: 0,
    dt: 0.016,
    targetX: partial.meshX,
    targetZ: partial.meshZ,
    lookX: partial.meshX,
    lookZ: partial.meshZ,
    aheadX: 0,
    aheadZ: 0,
    svx: 5,
    svz: 0,
    playback: true,
    ...partial,
  };
}

describe("classifyCamJitSpike", () => {
  it("tags mesh_rewind when the mesh steps opposite server velocity", () => {
    const a = frame({ meshX: 5, meshZ: 0, svx: 5, svz: 0 });
    const b = frame({ meshX: 4.9, meshZ: 0, svx: 5, svz: 0 });
    const { tags } = classifyCamJitSpike(a, b);
    expect(tags).toContain("mesh_rewind");
  });

  it("tags ahead_spike when look-ahead jumps hard", () => {
    const a = frame({ meshX: 0, meshZ: 0, aheadX: 0, aheadZ: 0 });
    const b = frame({ meshX: 0.08, meshZ: 0, aheadX: 1.2, aheadZ: 0 });
    const { tags } = classifyCamJitSpike(a, b);
    expect(tags).toContain("ahead_spike");
  });

  it("tags extrap_lead when playback mesh sits ahead of target along velocity", () => {
    const a = frame({ meshX: 1, meshZ: 0, targetX: 1, targetZ: 0 });
    const b = frame({
      meshX: 1.12,
      meshZ: 0,
      targetX: 1,
      targetZ: 0,
      svx: 5,
      svz: 0,
      playback: true,
    });
    const { tags } = classifyCamJitSpike(a, b);
    expect(tags).toContain("extrap_lead");
  });
});
