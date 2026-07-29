import { describe, expect, it, vi } from "vitest";
import { createNimConnectProfileIdentity } from "./nimconnectProfileIdentity.js";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createNimConnectProfileIdentity", () => {
  it("renders a verified handle linking to its NimConnect profile", async () => {
    const getHandleByAddress = vi.fn().mockResolvedValue({
      handle: "space_owner",
      address: "nq11owner",
    });
    const identity = createNimConnectProfileIdentity({ getHandleByAddress });

    await identity.show("NQ11 OWNER", false);

    expect(getHandleByAddress).toHaveBeenCalledWith("NQ11 OWNER");
    expect(identity.element.hidden).toBe(false);
    expect(identity.element.textContent).toBe("@space_owner");
    expect(identity.element.href).toBe(
      "https://nimconnect.nimiqminiapps.com/#/u/space_owner"
    );
    expect(identity.element.target).toBe("");
    expect(identity.element.getAttribute("aria-label")).toBe(
      "Open @space_owner in NimConnect"
    );
    expect(identity.element.className).toBe(
      "other-player-profile__nimconnect-handle"
    );
  });

  it("offers the signed-in player a claim link when no handle exists", async () => {
    const identity = createNimConnectProfileIdentity({
      getHandleByAddress: vi.fn().mockResolvedValue(null),
    });

    await identity.show("NQ22 SELF", true);

    expect(identity.element.hidden).toBe(false);
    expect(identity.element.textContent).toBe("Claim an @handle");
    expect(identity.element.href).toBe(
      "https://nimconnect.nimiqminiapps.com/#/me?sheet=claim"
    );
    expect(identity.element.getAttribute("aria-label")).toBe(
      "Claim an @handle in NimConnect"
    );
  });

  it("stays hidden for another player without a handle", async () => {
    const identity = createNimConnectProfileIdentity({
      getHandleByAddress: vi.fn().mockResolvedValue(null),
    });

    await identity.show("NQ33 OTHER", false);

    expect(identity.element.hidden).toBe(true);
    expect(identity.element.textContent).toBe("");
  });

  it("stays hidden when NimConnect is unavailable", async () => {
    const identity = createNimConnectProfileIdentity({
      getHandleByAddress: vi.fn().mockRejectedValue(new Error("offline")),
    });

    await expect(identity.show("NQ44 OFFLINE", true)).resolves.toBeUndefined();
    expect(identity.element.hidden).toBe(true);
    expect(identity.element.textContent).toBe("");
  });

  it("stays hidden when a resolver response contains an invalid handle", async () => {
    const identity = createNimConnectProfileIdentity({
      getHandleByAddress: vi.fn().mockResolvedValue({
        handle: "../not-a-handle",
        address: "NQ45MALFORMED",
      }),
    });

    await identity.show("NQ45 MALFORMED", true);

    expect(identity.element.hidden).toBe(true);
    expect(identity.element.textContent).toBe("");
  });

  it("stays hidden when a claim is missing its owner address", async () => {
    const identity = createNimConnectProfileIdentity({
      getHandleByAddress: vi.fn().mockResolvedValue({ handle: "unowned" }),
    });

    await identity.show("NQ46 MISSING", true);

    expect(identity.element.hidden).toBe(true);
    expect(identity.element.textContent).toBe("");
  });

  it("stays hidden when a claim belongs to a different wallet", async () => {
    const identity = createNimConnectProfileIdentity({
      getHandleByAddress: vi.fn().mockResolvedValue({
        handle: "wrong_owner",
        address: "NQ99 SOMEONEELSE",
      }),
    });

    await identity.show("NQ47 EXPECTED", false);

    expect(identity.element.hidden).toBe(true);
    expect(identity.element.textContent).toBe("");
  });

  it("ignores a late lookup after the open profile changes", async () => {
    const first = deferred<{ handle: string; address: string } | null>();
    const second = deferred<{ handle: string; address: string } | null>();
    const getHandleByAddress = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const identity = createNimConnectProfileIdentity({ getHandleByAddress });

    const firstShow = identity.show("NQ55 FIRST", false);
    const secondShow = identity.show("NQ66 SECOND", false);
    second.resolve({ handle: "second", address: "NQ66SECOND" });
    await secondShow;
    first.resolve({ handle: "first", address: "NQ55FIRST" });
    await firstShow;

    expect(identity.element.textContent).toBe("@second");
    expect(identity.element.href).toBe(
      "https://nimconnect.nimiqminiapps.com/#/u/second"
    );
  });
});
