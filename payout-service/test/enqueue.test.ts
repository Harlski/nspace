import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createFakeChainClient } from "../src/chain/fakeClient.js";
import type { AppConfig } from "../src/config.js";
import { createPayoutApp } from "../src/app.js";
import {
  drainQueueForTests,
  resetQueueForTests,
  stopPayoutProcessorForTests,
} from "../src/queue.js";

const testRecipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

function testCfg(dataDir: string, overrides?: Partial<AppConfig>): AppConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "unit-test-secret",
    dataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test payout",
    processIntervalMs: 50_000,
    balanceCacheMs: 20_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
    ...overrides,
  };
}

async function withServer(
  t: test.TestContext,
  run: (ctx: {
    baseUrl: string;
    fake: ReturnType<typeof createFakeChainClient>;
    dataDir: string;
  }) => Promise<void>
): Promise<void> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-svc-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const fake = createFakeChainClient();
  const cfg = testCfg(dataDir);
  const { app } = createPayoutApp({
    cfg,
    chainClient: fake,
    startProcessor: false,
  });

  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  t.after(() => {
    server.close();
    stopPayoutProcessorForTests();
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("expected bound port");
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  await run({ baseUrl, fake, dataDir });
}

async function postIntent(
  baseUrl: string,
  secret: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(`${baseUrl}/v1/pay-intents`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("GET /health is open without auth", async (t) => {
  await withServer(t, async ({ baseUrl }) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { ok?: boolean; service?: string };
    assert.equal(json.ok, true);
    assert.equal(json.service, "nspace-payout");
  });
});

test("POST /v1/pay-intents requires Bearer secret", async (t) => {
  await withServer(t, async ({ baseUrl }) => {
    const res = await postIntent(baseUrl, "wrong-secret", {
      claimId: "claim-1",
      recipientAddress: testRecipient,
      roomId: "room-a",
      tileKey: "1,2,0",
    });
    assert.equal(res.status, 401);
  });
});

test("enqueue is idempotent by claimId and sends once on fake chain", async (t) => {
  await withServer(t, async ({ baseUrl, fake, dataDir }) => {
    const body = {
      claimId: "claim-block-abc",
      recipientAddress: testRecipient,
      amountLuna: "100000",
      roomId: "canvas",
      tileKey: "3,4,0",
    };

    const first = await postIntent(baseUrl, "unit-test-secret", body);
    assert.equal(first.status, 201);
    const second = await postIntent(baseUrl, "unit-test-secret", body);
    assert.equal(second.status, 200);

    await drainQueueForTests();
    assert.equal(fake.sends.length, 1);
    assert.equal(fake.sends[0]?.claimId, "claim-block-abc");
    assert.equal(fake.sends[0]?.amountLuna, 100_000n);

    const queueFile = path.join(dataDir, "nim-payout-pending.json");
    assert.equal(fs.existsSync(queueFile), true);
    const onDisk = JSON.parse(fs.readFileSync(queueFile, "utf8")) as unknown[];
    assert.equal(onDisk.length, 0);
  });
});

test("service queue persists across restart and drains one send", { concurrency: false }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-restart-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  const cfg = testCfg(dataDir);

  {
    const fake = createFakeChainClient({ signerConfigured: false });
    const { app } = createPayoutApp({
      cfg,
      chainClient: fake,
      startProcessor: false,
    });
    const server = await new Promise<Server>((resolve, reject) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
      s.on("error", reject);
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    const r = await postIntent(baseUrl, "unit-test-secret", {
      claimId: "persist-claim",
      recipientAddress: testRecipient,
      roomId: "canvas",
      tileKey: "0,0,0",
    });
    server.close();
    assert.equal(r.status, 201);
    assert.equal(fake.sends.length, 0);

    const queueFile = path.join(dataDir, "nim-payout-pending.json");
    assert.equal(fs.existsSync(queueFile), true);
    const onDisk = JSON.parse(fs.readFileSync(queueFile, "utf8")) as unknown[];
    assert.equal(onDisk.length, 1);
  }

  resetQueueForTests();
  const fake2 = createFakeChainClient();
  createPayoutApp({ cfg, chainClient: fake2, startProcessor: false });
  await drainQueueForTests();
  stopPayoutProcessorForTests();

  assert.equal(fake2.sends.length, 1);
  assert.equal(fake2.sends[0]?.claimId, "persist-claim");
});
