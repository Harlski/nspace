import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createFakeChainClient } from "../src/chain/fakeClient.js";
import { resetBalanceCacheForTests } from "../src/balance.js";
import type { AppConfig } from "../src/config.js";
import { createPayoutApp } from "../src/app.js";
import {
  drainQueueForTests,
  resetQueueForTests,
  stopPayoutProcessorForTests,
} from "../src/queue.js";

const testRecipient = "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y";

function testCfg(dataDir: string): AppConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "unit-test-secret",
    dataDir,
    nimNetwork: "testalbatross",
    defaultTxMessage: "test payout",
    processIntervalMs: 50_000,
    balanceCacheMs: 60_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
  };
}

async function withServer(
  t: test.TestContext,
  opts: {
    initialBalanceLuna?: bigint;
    signerConfigured?: boolean;
  },
  run: (ctx: {
    baseUrl: string;
    fake: ReturnType<typeof createFakeChainClient>;
  }) => Promise<void>
): Promise<void> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-bal-"));
  t.after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  resetQueueForTests();
  resetBalanceCacheForTests();
  const fake = createFakeChainClient({
    initialBalanceLuna: opts.initialBalanceLuna ?? 500_000n,
    signerConfigured: opts.signerConfigured,
  });
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

  await run({ baseUrl, fake });
}

async function getBalance(baseUrl: string, secret: string): Promise<Response> {
  return fetch(`${baseUrl}/v1/balance`, {
    headers: { authorization: `Bearer ${secret}` },
  });
}

test("GET /v1/balance requires Bearer secret", async (t) => {
  await withServer(t, {}, async ({ baseUrl }) => {
    const res = await getBalance(baseUrl, "wrong");
    assert.equal(res.status, 401);
  });
});

test("balance read is cached and decremented after successful send", async (t) => {
  await withServer(t, { initialBalanceLuna: 500_000n }, async ({ baseUrl, fake }) => {
    const secret = "unit-test-secret";

    const first = await getBalance(baseUrl, secret);
    assert.equal(first.status, 200);
    const firstJson = (await first.json()) as { balanceLuna?: string };
    assert.equal(firstJson.balanceLuna, "500000");
    assert.equal(fake.balanceLuna, 500_000n);

    const body = {
      claimId: "bal-claim-1",
      recipientAddress: testRecipient,
      amountLuna: "100000",
      roomId: "canvas",
      tileKey: "1,2,0",
    };
    const enq = await fetch(`${baseUrl}/v1/pay-intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    assert.equal(enq.status, 201);

    await drainQueueForTests();
    assert.equal(fake.sends.length, 1);
    assert.equal(fake.balanceLuna, 500_000n);

    const second = await getBalance(baseUrl, secret);
    assert.equal(second.status, 200);
    const secondJson = (await second.json()) as { balanceLuna?: string };
    assert.equal(secondJson.balanceLuna, "400000");
  });
});
