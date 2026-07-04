import { describe, it, expect } from "vitest";
import {
  rankWhisperCandidates,
  compactWhisperAddress,
  cycleWhisperDestination,
  findExactWhisperCandidate,
  type WhisperCandidate,
} from "./whisperRecipients.js";

const room = (name: string, address: string): WhisperCandidate => ({ name, address });

describe("compactWhisperAddress", () => {
  it("strips spaces and uppercases", () => {
    expect(compactWhisperAddress("nq07 abcd efgh")).toBe("NQ07ABCDEFGH");
  });
});

describe("rankWhisperCandidates", () => {
  const self = "NQ00 SELF";

  it("seeds recent partners first, then room-only players, alphabetical within each", () => {
    const out = rankWhisperCandidates("", {
      selfAddress: self,
      recentPartners: [room("zoe", "NQ00 ZOE"), room("amy", "NQ00 AMY")],
      roomPlayers: [room("bob", "NQ00 BOB"), room("ada", "NQ00 ADA")],
    });
    expect(out.map((c) => c.name)).toEqual(["amy", "zoe", "ada", "bob"]);
  });

  it("matches a case-insensitive name prefix", () => {
    const out = rankWhisperCandidates("A", {
      selfAddress: self,
      recentPartners: [],
      roomPlayers: [room("admin", "NQ00 ADMIN"), room("adzy", "NQ00 ADZY"), room("bob", "NQ00 BOB")],
    });
    expect(out.map((c) => c.name)).toEqual(["adzy", "admin"].sort());
    expect(out.every((c) => c.name.startsWith("ad"))).toBe(true);
  });

  it("is a prefix match, not a substring match", () => {
    const out = rankWhisperCandidates("dz", {
      selfAddress: self,
      recentPartners: [],
      roomPlayers: [room("adzy", "NQ00 ADZY")],
    });
    expect(out).toHaveLength(0);
  });

  it("dedupes a player present in both groups into the recent group with the fresh room name", () => {
    const out = rankWhisperCandidates("", {
      selfAddress: self,
      recentPartners: [room("old-name", "NQ00 DUP")],
      roomPlayers: [room("fresh-name", "NQ00 DUP")],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ address: "NQ00DUP", name: "fresh-name" });
  });

  it("excludes self from either group regardless of address spacing", () => {
    const out = rankWhisperCandidates("", {
      selfAddress: self,
      recentPartners: [room("me", "NQ00SELF")],
      roomPlayers: [room("me-room", " nq00 self ")],
    });
    expect(out).toHaveLength(0);
  });

  it("respects the result limit", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      room(`p${i}`, `NQ00 P${i}`)
    );
    const out = rankWhisperCandidates("", {
      selfAddress: self,
      recentPartners: [],
      roomPlayers: players,
      limit: 3,
    });
    expect(out).toHaveLength(3);
  });

  it("returns compacted addresses so a pick resolves unambiguously", () => {
    const out = rankWhisperCandidates("", {
      selfAddress: self,
      recentPartners: [],
      roomPlayers: [room("ada", "NQ00 ADA 1234")],
    });
    expect(out[0]?.address).toBe("NQ00ADA1234");
  });
});

describe("cycleWhisperDestination", () => {
  const partners: WhisperCandidate[] = [
    room("amy", "NQ00 AMY"),
    room("bob", "NQ00 BOB"),
    room("cid", "NQ00 CID"),
  ];

  it("stays on Say when there are no recent partners", () => {
    expect(cycleWhisperDestination(null, [], 1)).toBeNull();
    expect(cycleWhisperDestination(null, [], -1)).toBeNull();
  });

  it("Tab from Say lands on the most-recent partner (ring index 1)", () => {
    expect(cycleWhisperDestination(null, partners, 1)?.name).toBe("amy");
  });

  it("Shift+Tab from Say wraps to the last partner", () => {
    expect(cycleWhisperDestination(null, partners, -1)?.name).toBe("cid");
  });

  it("advances forward through the ring", () => {
    const amy = { address: "NQ00AMY", name: "amy" };
    expect(cycleWhisperDestination(amy, partners, 1)?.name).toBe("bob");
  });

  it("wraps from the last partner back to Say", () => {
    const cid = { address: "NQ00CID", name: "cid" };
    expect(cycleWhisperDestination(cid, partners, 1)).toBeNull();
  });

  it("goes backward and can reach Say from the first partner", () => {
    const amy = { address: "NQ00AMY", name: "amy" };
    expect(cycleWhisperDestination(amy, partners, -1)).toBeNull();
  });

  it("treats an off-ring current target as Say", () => {
    const ghost = { address: "NQ00 GHOST", name: "ghost" };
    expect(cycleWhisperDestination(ghost, partners, 1)?.name).toBe("amy");
  });

  it("matches the current target regardless of address spacing/case", () => {
    const amySpaced = { address: "nq00 amy", name: "amy" };
    expect(cycleWhisperDestination(amySpaced, partners, 1)?.name).toBe("bob");
  });

  it("dedupes the ring by address", () => {
    const dupe = [room("amy", "NQ00 AMY"), room("amy2", "NQ00AMY")];
    // ring is [Say, amy] only -> Tab forward twice returns to Say
    const first = cycleWhisperDestination(null, dupe, 1);
    expect(first?.address).toBe("NQ00AMY");
    expect(cycleWhisperDestination(first, dupe, 1)).toBeNull();
  });
});

describe("findExactWhisperCandidate", () => {
  const cands: WhisperCandidate[] = [
    room("bob", "NQ00 BOB"),
    room("bobby", "NQ00 BOBBY"),
  ];

  it("matches an exact name case-insensitively", () => {
    expect(findExactWhisperCandidate("BOB", cands)?.address).toBe("NQ00 BOB");
  });

  it("does not treat a prefix as an exact match", () => {
    expect(findExactWhisperCandidate("bo", cands)).toBeNull();
  });

  it("prefers the exact name over a longer one that shares the prefix", () => {
    expect(findExactWhisperCandidate("bobby", cands)?.address).toBe("NQ00 BOBBY");
  });

  it("returns null for an empty name", () => {
    expect(findExactWhisperCandidate("  ", cands)).toBeNull();
  });
});
