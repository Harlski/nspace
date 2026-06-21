import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Server } from "node:http";
import { createFakeChainClient } from "../src/chain/fakeClient.js";
import type { AppConfig } from "../src/config.js";
import { createPayoutApp } from "../src/app.js";
import { resetQueueForTests, stopPayoutProcessorForTests } from "../src/queue.js";

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
    balanceCacheMs: 20_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
  };
}

async function withServer(
  t: test.TestContext,
  run: (ctx: { baseUrl: string; fake: ReturnType<typeof createFakeChainClient> }) => Promise<void>
): Promise<void> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "payout-report-"));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  resetQueueForTests();
  const fake = createFakeChainClient();
  const { app } = createPayoutApp({
    cfg: testCfg(dataDir),
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
  if (!addr || typeof addr === "string") throw new Error("expected bound port");
  await run({ baseUrl: `http://127.0.0.1:${addr.port}`, fake });
}

async function authed(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: "Bearer unit-test-secret",
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function enqueueTwoPending(baseUrl: string): Promise<void> {
  for (const claimId of ["report-a", "report-b"]) {
    const res = await authed(baseUrl, "/v1/pay-intents", {
      method: "POST",
      body: JSON.stringify({
        claimId,
        recipientAddress: testRecipient,
        amountLuna: "100000",
        roomId: "canvas",
        tileKey: "1,2,0",
      }),
    });
    assert.equal(res.status, 201);
  }
}

test("GET /v1/pending/totals reflects queued jobs", async (t) => {
  await withServer(t, async ({ baseUrl }) => {
    await enqueueTwoPending(baseUrl);
    const res = await authed(baseUrl, "/v1/pending/totals");
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      jobCount: number;
      recipientCount: number;
      totalLuna: string;
    };
    assert.equal(json.jobCount, 2);
    assert.equal(json.recipientCount, 1);
    assert.equal(json.totalLuna, "200000");
  });
});

test("POST /v1/manual-bulk-payout settles one recipient", async (t) => {
  await withServer(t, async ({ baseUrl, fake }) => {
    await enqueueTwoPending(baseUrl);
    const res = await authed(baseUrl, "/v1/manual-bulk-payout", {
      method: "POST",
      body: JSON.stringify({ recipient: testRecipient }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { jobsCleared: number; totalLuna: string };
    assert.equal(json.jobsCleared, 2);
    assert.equal(json.totalLuna, "200000");
    assert.equal(fake.sends.length, 1);
    assert.equal(fake.sends[0]?.amountLuna, 200_000n);

    const totals = await authed(baseUrl, "/v1/pending/totals");
    const pending = (await totals.json()) as { jobCount: number };
    assert.equal(pending.jobCount, 0);
  });
});

test("POST /v1/flush bulk-settles every recipient with pending jobs", async (t) => {
  await withServer(t, async ({ baseUrl, fake }) => {
    const otherRecipient = "NQ88 TEST WAL1 ET00 0000 0000 0000 0000 0001";
    for (const [claimId, recipient] of [
      ["flush-1", testRecipient],
      ["flush-2", otherRecipient],
    ] as const) {
      const res = await authed(baseUrl, "/v1/pay-intents", {
        method: "POST",
        body: JSON.stringify({
          claimId,
          recipientAddress: recipient,
          roomId: "canvas",
          tileKey: "0,0,0",
        }),
      });
      assert.equal(res.status, 201);
    }

    const flushRes = await authed(baseUrl, "/v1/flush", { method: "POST", body: "{}" });
    assert.equal(flushRes.status, 200);
    const flush = (await flushRes.json()) as {
      recipientsPaid: number;
      jobsCleared: number;
    };
    assert.equal(flush.recipientsPaid, 2);
    assert.equal(flush.jobsCleared, 2);
    assert.equal(fake.sends.length, 2);
  });
});
