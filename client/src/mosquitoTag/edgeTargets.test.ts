import { describe, it, expect } from "vitest";
import { participantEdgeTargets } from "./edgeTargets.js";

describe("participantEdgeTargets", () => {
  it("is empty during a waiting Tag Call and the result linger", () => {
    expect(
      participantEdgeTargets(
        { phase: "calling", participants: [], holder: null },
        "a"
      )
    ).toEqual([]);
    expect(
      participantEdgeTargets(
        { phase: "result", participants: ["a", "b"], holder: "a" },
        "a"
      )
    ).toEqual([]);
  });

  it("lists other Participants for a Participant, marking the Holder", () => {
    expect(
      participantEdgeTargets(
        {
          phase: "playing",
          participants: ["a", "b", "c"],
          holder: "c",
        },
        "a"
      )
    ).toEqual([
      { address: "b", isHolder: false },
      { address: "c", isHolder: true },
    ]);
  });

  it("is empty for a Bystander", () => {
    expect(
      participantEdgeTargets(
        {
          phase: "playing",
          participants: ["a", "b"],
          holder: "a",
        },
        "z"
      )
    ).toEqual([]);
  });

  it("omits the viewer", () => {
    const targets = participantEdgeTargets(
      {
        phase: "countdown",
        participants: ["a", "b"],
        holder: null,
      },
      "a"
    );
    expect(targets.some((t) => t.address === "a")).toBe(false);
    expect(targets).toEqual([{ address: "b", isHolder: false }]);
  });
});
