import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "return-walk-"));
process.env.RETURN_WALK_STORE_FILE = path.join(tmp, "return-walk.sqlite");
process.env.ADMIN_RUNTIME_SETTINGS_FILE = path.join(tmp, "admin-runtime-settings.json");
process.env.RESIDENT_ADDRESSES =
  "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
process.env.RETURN_WALK_SERVER_WALLET_ADDRESS =
  "NQ11 22AA 33BB 44CC 55DD 66EE 77FF 00AA 11BB";

const JWT_SECRET = "return-walk-test-secret";

const {
  getServerWalletAddress,
  isResidentWallet,
  invalidateReturnWalkConfigCache,
} = await import("../src/returnWalk/config.js");
const {
  createUnpaidInvoice,
  creditInvoice,
  expireUnpaidInvoices,
  getInvoice,
  remainingReturnBudgetLuna,
  releaseReturnGoldReservation,
  reserveReturnGold,
  spendReturnGoldReservation,
  __resetReturnWalkStoreForTests,
} = await import("../src/returnWalk/store.js");
const { invoiceToPublicJson } = await import("../src/returnWalk/invoiceJson.js");
const { registerReturnWalkRoutes } = await import("../src/returnWalk/http.js");
const { classifyPublicRoomKind } = await import("../src/returnWalk/roomKind.js");
const { setDepositTxVerifierForTests } = await import(
  "../src/returnWalk/creditVerify.js"
);
const {
  isReturnGold,
  isOrdinarySolidEligibleForUpgrade,
  applyReturnGoldUpgrade,
  revertReturnGoldToOrdinarySolid,
  pickUpgradeTiles,
  directoryGoldKind,
  isInUpgradeVicinity,
  filterTilesInUpgradeVicinity,
  hasOrthogonalClaimStand,
} = await import("../src/returnWalk/tiles.js");
const {
  INVOICE_TTL_MS,
  RETURN_WALK_DEPOSIT_LUNA,
  STREAM_FAUCET_ADDRESS,
  UPGRADE_VICINITY_RADIUS,
} = await import("../src/returnWalk/constants.js");

invalidateReturnWalkConfigCache();

const RESIDENT = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";
const OTHER = "NQ12 34AB CDEF GHJK LMNP QRST UVWX YZ01 2345";

function sign(sub: string): string {
  return jwt.sign({ sub }, JWT_SECRET, { expiresIn: "1h" });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  const requireJwt = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const h = req.headers.authorization;
    if (!h || typeof h !== "string" || !h.startsWith("Bearer ")) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      jwt.verify(h.slice(7).trim(), JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  };
  const jwtAddressFromReq = (req: express.Request) => {
    const h = req.headers.authorization;
    if (!h || typeof h !== "string") return null;
    try {
      return (jwt.verify(h.slice(7).trim(), JWT_SECRET) as { sub: string }).sub;
    } catch {
      return null;
    }
  };
  registerReturnWalkRoutes(app, requireJwt, jwtAddressFromReq, JWT_SECRET);
  return app;
}

async function jsonReq(
  app: express.Express,
  opts: {
    method: string;
    path: string;
    token?: string;
    body?: unknown;
  }
): Promise<{ status: number; json: Record<string, unknown> }> {
  const http = await import("node:http");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${opts.path}`, {
      method: opts.method,
      headers: {
        "content-type": "application/json",
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json()) as Record<string, unknown>;
    return { status: res.status, json };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

describe("returnWalk", { concurrency: false }, () => {
test("Server Wallet is distinct from the Stream Faucet", () => {
  const to = getServerWalletAddress();
  assert.ok(to);
  assert.notEqual(
    to.replace(/\s+/g, "").toUpperCase(),
    STREAM_FAUCET_ADDRESS.replace(/\s+/g, "").toUpperCase()
  );
});

test("isResidentWallet allowlists only RESIDENT_ADDRESSES", () => {
  assert.equal(isResidentWallet(RESIDENT), true);
  assert.equal(isResidentWallet(OTHER), false);
});

test("non-Resident JWT gets 403 on Invoice and directory routes", async () => {
  const app = makeApp();
  const token = sign(OTHER);
  const inv = await jsonReq(app, {
    method: "POST",
    path: "/api/resident/return-walk/invoices",
    token,
    body: { amountNim: 1000 },
  });
  assert.equal(inv.status, 403);
  const dir = await jsonReq(app, {
    method: "GET",
    path: "/api/resident/public-rooms",
    token,
  });
  assert.equal(dir.status, 403);
});

test("Resident can POST Invoice; second unpaid POST is rejected", async () => {
  __resetReturnWalkStoreForTests();
  const app = makeApp();
  const token = sign(RESIDENT);
  const first = await jsonReq(app, {
    method: "POST",
    path: "/api/resident/return-walk/invoices",
    token,
    body: { amountNim: 1000 },
  });
  assert.equal(first.status, 200);
  assert.equal(first.json.status, "unpaid");
  assert.equal(first.json.amountNim, 1000);
  assert.equal(first.json.returnBudgetNim, 0);
  assert.equal(first.json.amountLuna, "100000000");
  assert.equal(first.json.returnBudgetLuna, "0");
  assert.ok(String(first.json.invoiceId).startsWith("inv-"));
  const second = await jsonReq(app, {
    method: "POST",
    path: "/api/resident/return-walk/invoices",
    token,
    body: { amountNim: 1000 },
  });
  assert.equal(second.status, 409);
});

test("tx hint credits unpaid Invoice with Return Budget 1000 NIM", async () => {
  __resetReturnWalkStoreForTests();
  const app = makeApp();
  const token = sign(RESIDENT);
  const created = await jsonReq(app, {
    method: "POST",
    path: "/api/resident/return-walk/invoices",
    token,
    body: { amountNim: 1000 },
  });
  const invoiceId = String(created.json.invoiceId);
  const to = String(created.json.to);
  setDepositTxVerifierForTests(async () => ({
    hash: "tx-deposit-1",
    sender: RESIDENT,
    recipient: to,
    valueLuna: RETURN_WALK_DEPOSIT_LUNA,
  }));
  const credited = await jsonReq(app, {
    method: "POST",
    path: `/api/resident/return-walk/invoices/${invoiceId}/tx`,
    token,
    body: { txHash: "tx-deposit-1" },
  });
  setDepositTxVerifierForTests(null);
  assert.equal(credited.status, 200);
  assert.equal(credited.json.status, "credited");
  assert.equal(credited.json.returnBudgetNim, 1000);
  const got = await jsonReq(app, {
    method: "GET",
    path: `/api/resident/return-walk/invoices/${invoiceId}`,
    token,
  });
  assert.equal(got.json.status, "credited");
  assert.equal(got.json.returnBudgetNim, 1000);
});

test("unpaid Invoice expires after 30 minutes", () => {
  __resetReturnWalkStoreForTests();
  const row = createUnpaidInvoice({
    residentWallet: RESIDENT,
    toAddress: getServerWalletAddress()!,
  });
  assert.ok("invoiceId" in row);
  expireUnpaidInvoices(Date.now() + INVOICE_TTL_MS + 1);
  const expired = getInvoice(row.invoiceId, Date.now() + INVOICE_TTL_MS + 2);
  assert.equal(expired?.status, "expired");
});

test("Upgrade reserves 1 NIM; leftover Return Budget stays credited", () => {
  __resetReturnWalkStoreForTests();
  const created = createUnpaidInvoice({
    residentWallet: RESIDENT,
    toAddress: getServerWalletAddress()!,
  });
  assert.ok("invoiceId" in created);
  const credited = creditInvoice({
    invoiceId: created.invoiceId,
    txHash: "tx-2",
  });
  assert.ok("invoiceId" in credited);
  assert.equal(reserveReturnGold({ roomId: "hub", tileKey: "3,4" }), true);
  assert.equal(remainingReturnBudgetLuna(), RETURN_WALK_DEPOSIT_LUNA - 100_000n);
  const json = invoiceToPublicJson(getInvoice(created.invoiceId)!);
  assert.equal(json.status, "credited");
  assert.equal(json.returnBudgetNim, 999);
  spendReturnGoldReservation({ roomId: "hub", tileKey: "3,4" });
  assert.equal(getInvoice(created.invoiceId)?.returnBudgetLuna, "99900000");
});

test("Return Gold kind flags and ordinary-solid eligibility", () => {
  const solid = { passable: false, ramp: false, claimable: false };
  assert.equal(isOrdinarySolidEligibleForUpgrade(solid), true);
  assert.equal(
    isOrdinarySolidEligibleForUpgrade({ ...solid, ramp: true }),
    false
  );
  assert.equal(
    isOrdinarySolidEligibleForUpgrade({ ...solid, claimable: true }),
    false
  );
  applyReturnGoldUpgrade(solid);
  assert.equal(isReturnGold(solid), true);
  assert.equal(directoryGoldKind(solid), "returnGold");
  revertReturnGoldToOrdinarySolid(solid);
  assert.equal(isReturnGold(solid), false);
  assert.equal(solid.claimable, false);
});

test("pickUpgradeTiles prefers two different tiles", () => {
  const tiles = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
  ];
  let i = 0;
  const picked = pickUpgradeTiles(tiles, 2, () => {
    const v = i === 0 ? 0 : 0.9;
    i += 1;
    return v;
  });
  assert.equal(picked.length, 2);
  assert.notEqual(`${picked[0]!.x},${picked[0]!.z}`, `${picked[1]!.x},${picked[1]!.z}`);
});

test("Upgrade vicinity includes diagonal and distant tiles, not only orthogonal", () => {
  assert.equal(isInUpgradeVicinity(0, 0, 1, 0), true);
  assert.equal(isInUpgradeVicinity(0, 0, 3, 5), true);
  assert.equal(isInUpgradeVicinity(0, 0, 8, 8), true);
  assert.equal(isInUpgradeVicinity(0, 0, 0, 0), false);
  assert.equal(isInUpgradeVicinity(0, 0, 9, 0), false);
  assert.equal(UPGRADE_VICINITY_RADIUS, 8);
  const pool = [
    { x: 1, z: 0 },
    { x: 4, z: 3 },
    { x: 9, z: 0 },
    { x: 0, z: 0 },
  ];
  const inVicinity = filterTilesInUpgradeVicinity(0, 0, pool);
  assert.deepEqual(inVicinity, [
    { x: 1, z: 0 },
    { x: 4, z: 3 },
  ]);
});

test("pickUpgradeTiles can select a non-adjacent vicinity tile", () => {
  const tiles = [
    { x: 1, z: 0 },
    { x: 6, z: 4 },
    { x: -5, z: 7 },
  ];
  const picked = pickUpgradeTiles(tiles, 1, () => 0.5);
  assert.deepEqual(picked, [{ x: 6, z: 4 }]);
});

test("boxed-in solids have no orthogonal claim stand", () => {
  const blocked = new Set(["1,0", "-1,0", "0,1", "0,-1"]);
  const stand = (x: number, z: number) => !blocked.has(`${x},${z}`);
  assert.equal(hasOrthogonalClaimStand(0, 0, stand), false);
});

test("one open orthogonal edge is enough to claim", () => {
  const blocked = new Set(["1,0", "-1,0", "0,1"]);
  const stand = (x: number, z: number) => !blocked.has(`${x},${z}`);
  assert.equal(hasOrthogonalClaimStand(0, 0, stand), true);
});

test("Stream Faucet cannot be the Server Wallet", () => {
  const prev = process.env.RETURN_WALK_SERVER_WALLET_ADDRESS;
  process.env.RETURN_WALK_SERVER_WALLET_ADDRESS = STREAM_FAUCET_ADDRESS;
  invalidateReturnWalkConfigCache();
  assert.equal(getServerWalletAddress(), null);
  if (prev === undefined) {
    delete process.env.RETURN_WALK_SERVER_WALLET_ADDRESS;
  } else {
    process.env.RETURN_WALK_SERVER_WALLET_ADDRESS = prev;
  }
  invalidateReturnWalkConfigCache();
  assert.ok(getServerWalletAddress());
});

test("Public Room kinds: hub is commons, chamber omitted, play spaces labelled", () => {
  assert.equal(classifyPublicRoomKind("hub"), "commons");
  assert.equal(classifyPublicRoomKind("chamber"), null);
  assert.equal(classifyPublicRoomKind("tutorial"), "tutorial");
  assert.equal(classifyPublicRoomKind("invite-lobby-abc123"), "playSpace");
  assert.equal(classifyPublicRoomKind("wc-match-xyz"), "matchPitch");
  assert.equal(classifyPublicRoomKind("some-user-room"), "public");
});

test("Resident directory is Resident-only and returns rooms array", async () => {
  const app = makeApp();
  const token = sign(RESIDENT);
  const dir = await jsonReq(app, {
    method: "GET",
    path: "/api/resident/public-rooms",
    token,
  });
  assert.equal(dir.status, 200);
  assert.ok(Array.isArray(dir.json.rooms));
});

test("failed Upgrade restores Return Budget", () => {
  __resetReturnWalkStoreForTests();
  const created = createUnpaidInvoice({
    residentWallet: RESIDENT,
    toAddress: getServerWalletAddress()!,
  });
  assert.ok("invoiceId" in created);
  creditInvoice({ invoiceId: created.invoiceId, txHash: "tx-restore" });
  assert.equal(reserveReturnGold({ roomId: "hub", tileKey: "5,6" }), true);
  assert.equal(
    remainingReturnBudgetLuna(),
    RETURN_WALK_DEPOSIT_LUNA - 100_000n
  );
  assert.equal(
    releaseReturnGoldReservation({ roomId: "hub", tileKey: "5,6" }),
    true
  );
  assert.equal(remainingReturnBudgetLuna(), RETURN_WALK_DEPOSIT_LUNA);
});
});
