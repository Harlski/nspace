import { describe, expect, it } from "vitest";
import { parseAuthQrTicketFromPath } from "./qrPayLoginApi.js";

describe("parseAuthQrTicketFromPath", () => {
  it("parses ticket id from /auth/qr/:ticket", () => {
    expect(parseAuthQrTicketFromPath("/auth/qr/abc123")).toBe("abc123");
    expect(parseAuthQrTicketFromPath("/auth/qr/abc123/")).toBe("abc123");
  });

  it("rejects other paths", () => {
    expect(parseAuthQrTicketFromPath("/")).toBeNull();
    expect(parseAuthQrTicketFromPath("/join/abc")).toBeNull();
    expect(parseAuthQrTicketFromPath("/auth/qr/")).toBeNull();
    expect(parseAuthQrTicketFromPath("/auth/qr/a/b")).toBeNull();
  });
});
