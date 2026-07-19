import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import { createFakeChainClient } from "../../payout-service/src/chain/fakeClient.js";
import { resetBalanceCacheForTests } from "../../payout-service/src/balance.js";
import { resetQueueForTests } from "../../payout-service/src/queue.js";
import { createPayoutApp } from "../../payout-service/src/app.js";
import type { AppConfig } from "../../payout-service/src/config.js";
import {
  peekPayoutBalanceCacheLuna,
  isPayoutSenderConfigured,
} from "../src/payoutGateway.js";
import {
  pullBalanceFromService,
  resetPulledBalanceCacheForTests,
  setPulledBalanceCacheForTests,
} from "../src/payoutBalancePull.js";

const CLAIM_REWARD_MIN_LUNA = 2000;

async function withStubService(
  t: test.TestContext,
  initialBalanceLuna: bigint,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const fake = createFakeChainClient({ initialBalanceLuna });
  const cfg: AppConfig = {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "gating-secret",
    dataDir: "/tmp/payout-gating-unused",
    nimNetwork: "testalbatross",
    defaultTxMessage: "test",
    processIntervalMs: 50_000,
    balanceCacheMs: 60_000,
    maxBackoffMs: 3_600_000,
    deadLetterAfterAttempts: 80,
    autoBulkAfterMs: 0,
    autoBulkCheckIntervalMs: 300_000,
  };
  const { app } = createPayoutApp({
    cfg,
    chainClient: fake,
    startProcessor: false,
  });
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  t.after(() => server.close());

  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  process.env.PAYOUT_SERVICE_URL = baseUrl;
  process.env.PAYOUT_SERVICE_API_SECRET = "gating-secret";
  t.after(() => {
    resetPulledBalanceCacheForTests();
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
  });

  resetPulledBalanceCacheForTests();
  resetBalanceCacheForTests();
  resetQueueForTests();
  await run(baseUrl);
}

test("pull caches balance from stub service", async (t) => {
  await withStubService(t, 750_000n, async () => {
    const pulled = await pullBalanceFromService();
    assert.equal(pulled, 750_000n);
    const peek = peekPayoutBalanceCacheLuna();
    assert.equal(peek?.luna, 750_000n);
  });
});

test("claim fund-gating peek uses local cache without another network call", async (t) => {
  await withStubService(t, 500_000n, async (baseUrl) => {
    let balanceFetches = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes(`${baseUrl}/v1/balance`)) {
        balanceFetches += 1;
      }
      return origFetch(input, init);
    };
    t.after(() => {
      globalThis.fetch = origFetch;
    });

    await pullBalanceFromService();
    assert.equal(balanceFetches, 1);

    const peek = peekPayoutBalanceCacheLuna();
    assert.ok(peek !== null);
    assert.equal(peek.luna, 500_000n);
    assert.equal(balanceFetches, 1);

    const payoutConfigured = isPayoutSenderConfigured();
    assert.equal(payoutConfigured, true);

    const hasFunds = peek.luna >= CLAIM_REWARD_MIN_LUNA;
    assert.equal(hasFunds, true);
    assert.equal(balanceFetches, 1);
  });
});

test("stale peek still gates claims when cache shows insufficient funds", () => {
  resetPulledBalanceCacheForTests();
  const prevUrl = process.env.PAYOUT_SERVICE_URL;
  const prevSecret = process.env.PAYOUT_SERVICE_API_SECRET;
  process.env.PAYOUT_SERVICE_URL = "http://127.0.0.1:1";
  process.env.PAYOUT_SERVICE_API_SECRET = "x";
  try {
    setPulledBalanceCacheForTests(1000n, Date.now() - 600_000);
    const peek = peekPayoutBalanceCacheLuna();
    assert.ok(peek !== null);
    assert.equal(peek.luna < CLAIM_REWARD_MIN_LUNA, true);
  } finally {
    resetPulledBalanceCacheForTests();
    if (prevUrl !== undefined) process.env.PAYOUT_SERVICE_URL = prevUrl;
    else delete process.env.PAYOUT_SERVICE_URL;
    if (prevSecret !== undefined) process.env.PAYOUT_SERVICE_API_SECRET = prevSecret;
    else delete process.env.PAYOUT_SERVICE_API_SECRET;
  }
});
