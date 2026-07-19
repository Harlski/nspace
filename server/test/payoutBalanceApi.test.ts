import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import { createFakeChainClient } from "../../payout-service/src/chain/fakeClient.js";
import { resetBalanceCacheForTests } from "../../payout-service/src/balance.js";
import { resetQueueForTests } from "../../payout-service/src/queue.js";
import { createPayoutApp } from "../../payout-service/src/app.js";
import type { AppConfig } from "../../payout-service/src/config.js";
import { resetPulledBalanceCacheForTests } from "../src/payoutBalancePull.js";
import { resolvePayoutBalanceApi } from "../src/payoutBalanceApi.js";

function withEnv(
  t: test.TestContext,
  patch: Record<string, string | undefined>
): void {
  const prev: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(patch)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetPulledBalanceCacheForTests();
  });
}

async function withStubService(
  t: test.TestContext,
  initialBalanceLuna: bigint,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const fake = createFakeChainClient({ initialBalanceLuna });
  const cfg: AppConfig = {
    host: "127.0.0.1",
    port: 0,
    apiSecret: "api-bal-secret",
    gameServerInternalUrl: null,
    dataDir: "/tmp/payout-api-bal-unused",
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

  withEnv(t, {
    PAYOUT_SERVICE_URL: baseUrl,
    PAYOUT_SERVICE_API_SECRET: "api-bal-secret",
    NIM_PAYOUT_DEV_FAKE_BALANCE: "1",
    NIM_PAYOUT_DEV_FAKE_BALANCE_NIM: "100",
  });
  resetPulledBalanceCacheForTests();
  resetBalanceCacheForTests();
  resetQueueForTests();
  await run(baseUrl);
}

test("dev fake balance when Payout Service is unreachable", async (t) => {
  withEnv(t, {
    PAYOUT_SERVICE_URL: "http://127.0.0.1:1",
    PAYOUT_SERVICE_API_SECRET: "test-secret",
    NIM_PAYOUT_DEV_FAKE_BALANCE: "1",
    NIM_PAYOUT_DEV_FAKE_BALANCE_NIM: "100",
    NIM_BALANCE_API_TIMEOUT_MS: "500",
  });
  resetPulledBalanceCacheForTests();

  const result = await resolvePayoutBalanceApi();

  assert.equal(result.status, 200);
  assert.equal(result.body.configured, true);
  assert.equal(result.body.hasNim, true);
  assert.equal(result.body.balanceNim, "100.0000");
  assert.equal(result.body.devFake, true);
});

test("without dev fake, unreachable Payout Service yields nim_unavailable", async (t) => {
  withEnv(t, {
    PAYOUT_SERVICE_URL: "http://127.0.0.1:1",
    PAYOUT_SERVICE_API_SECRET: "test-secret",
    NIM_PAYOUT_DEV_FAKE_BALANCE: undefined,
    NIM_BALANCE_API_TIMEOUT_MS: "500",
    NIM_BALANCE_API_STALE_MAX_MS: "0",
  });
  resetPulledBalanceCacheForTests();

  const result = await resolvePayoutBalanceApi();

  assert.equal(result.status, 503);
  assert.equal(result.body.error, "nim_unavailable");
  assert.equal(result.body.configured, true);
  assert.equal(result.body.hasNim, false);
  assert.equal(result.body.devFake, undefined);
});

test("live Payout Service balance wins over dev fake", async (t) => {
  await withStubService(t, 250_000n, async () => {
    const result = await resolvePayoutBalanceApi();
    assert.equal(result.status, 200);
    assert.equal(result.body.configured, true);
    assert.equal(result.body.hasNim, true);
    assert.equal(result.body.balanceNim, "2.5000");
    assert.equal(result.body.devFake, undefined);
  });
});

test("claim fund-gating sees dev fake when Payout Service pull fails", async (t) => {
  withEnv(t, {
    PAYOUT_SERVICE_URL: "http://127.0.0.1:1",
    PAYOUT_SERVICE_API_SECRET: "test-secret",
    NIM_PAYOUT_DEV_FAKE_BALANCE: "1",
    NIM_PAYOUT_DEV_FAKE_BALANCE_NIM: "100",
  });
  resetPulledBalanceCacheForTests();

  const { getPayoutWalletBalanceLuna, peekPayoutBalanceCacheLuna } =
    await import("../src/payoutGateway.js");

  const luna = await getPayoutWalletBalanceLuna();
  assert.equal(luna, 10_000_000n);
  const peek = peekPayoutBalanceCacheLuna();
  assert.ok(peek !== null);
  assert.equal(peek.luna, 10_000_000n);
  assert.equal(peek.luna >= 2000n, true);
});
