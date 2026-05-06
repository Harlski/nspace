# Learned lessons

Short notes on non-obvious behavior we hit in production or dev, so the next change does not rediscover the same landmines.

## Nimiq payout mutex and block-claim latency

**Symptom:** After the mining bar finished, the client waited many seconds (sometimes 10–20s) before `blockClaimResult` arrived, even though the server had already validated adjacency and hold time.

**Cause:** All Nimiq `Client` usage is serialized behind a single global mutex (`withNimiqMutex` in `server/src/nimPayout/sender.ts`) because concurrent access was unstable in dev. `completeBlockClaim` awaited `getNimPayoutWalletBalanceLuna()` before sending success. That call joins the same mutex queue as `sendNimPayoutTransaction`, which originally held the mutex for the **entire** confirmation poll loop (multi-second sleeps + repeated `getTransaction`). Balance checks therefore blocked behind in-flight payouts. A second issue was **staleness**: even with a mutex-shortened send path, the claim handler still did a **live** balance fetch whenever the in-memory peek was considered too old, so miners still queued behind payouts.

**What fixed the “stall on confirming mining” feeling:** Payout sends were already asynchronous (`enqueueNimPayout` + `queue.ts`); the hot path had to stop awaiting Nimiq on every complete.

1. **Shorter mutex scope for payouts:** Build, sign, and `sendTransaction` run under the mutex once; **between** 2s confirmation polls the mutex is released so balance reads and other work can run (`sendNimPayoutTransaction` in `sender.ts`).

2. **Claim gate uses cached balance only (when enabled):** When `NIM_CLAIM_BALANCE_PEEK_MAX_MS > 0` (default), `completeBlockClaim` trusts **any** non-null `peekNimPayoutBalanceCacheLuna()` for the funds gate if it clears the minimum reward — **no** age check — so the WebSocket handler does not await the mutex behind in-flight payouts. Set `NIM_CLAIM_BALANCE_PEEK_MAX_MS=0` to force a live `getNimPayoutWalletBalanceLuna()` every complete (stricter, can stall).

3. **Background balance refresh:** `startNimPayoutProcessor` runs a delayed and then periodic `getNimPayoutWalletBalanceLuna()` (`NIM_BALANCE_BACKGROUND_REFRESH_MS`, default 45s) so the cache is repopulated after invalidation without a miner having to trigger a blocking read. HUD `/api/nim/payout-balance` polling also warms the cache.

4. **Do not clear the balance cache on every successful payout:** `invalidateNimBalanceCache()` after each included tx forced the next mine’s `completeBlockClaim` onto a **live** balance read. **Fix:** subtract the sent amount in memory (`adjustNimBalanceCacheAfterPayout` in `sender.ts`) and keep the cache’s original `at` timestamp; invalidate on tx failure/timeout/invalidated paths.

**Tradeoff:** A dedicated hot wallet drained outside the app could briefly show a high cached balance; payout queue retries absorb failed sends.

**Related env:** `NIM_BALANCE_CACHE_MS`, `NIM_CLAIM_BALANCE_PEEK_MAX_MS`, `NIM_BALANCE_BACKGROUND_REFRESH_MS`. **Payout send timeline:** `NIM_PAYOUT_TX_TRACE=1` — see [nim-payout-tracing.md](../nim-payout-tracing.md). **Splitting payouts to another process/container:** [brainstorm/nim-payout-worker-migration.md](../brainstorm/nim-payout-worker-migration.md).

## Nimiq `@nimiq/core` in Node worker threads (startup crash)

**Symptom:** Server logged IndexedDB / `addEventListener is not a function` from `nodejs/worker-wasm` and threw before HTTP was ready.

**Cause:** The WASM client expects a browser-like environment (IndexedDB for BLS key cache, `EventTarget`). Node `worker_threads` do not provide IndexedDB.

**Fix:** Dependency `fake-indexeddb`, `patch-package` + `patches/@nimiq+core+2.2.2.patch` prepend `import 'fake-indexeddb/auto'` in `@nimiq/core/nodejs/worker.mjs` before `worker-wasm` loads. Root `postinstall` runs `node scripts/postinstall.cjs` to apply patches (see **Vercel: skip `patch-package` on deploy** below). **Commit the `patches/` directory** so installs stay reproducible.

## Vercel: skip `patch-package` on deploy

**Symptom:** Vercel failed during `npm install` with `patch-package: command not found` (exit 127), or with `Cannot find module '.../node_modules/patch-package/index.js'` when `postinstall` tried to run `patch-package` directly.

**Cause:** Production-style installs omit dev dependencies; on Vercel, lifecycle timing for the workspace root could also run before `patch-package` was available on disk or on `PATH`. The `@nimiq/core` worker patch is only needed for **local Node** (server dev); the static **client** deploy on Vercel does not need it.

**Fix:** `patch-package` lives in **devDependencies**. `package.json` `postinstall` is `node scripts/postinstall.cjs`, which **exits immediately** when `process.env.VERCEL` is set (Vercel injects this during builds). Otherwise it runs `npx --yes patch-package@8.0.1` so normal local installs still apply patches without relying on a pre-linked binary.

## Client mining bar vs server accumulation

**Symptom:** Bar looked full while the server still rejected complete or felt “sticky” on the next block.

**Cause:** The HUD progress uses local adjacency time; the server only adds time on accepted `blockClaimTick` samples (first tick does not add; large gaps reset accumulation). Desync is expected if ticks stall or the server thinks the player left adjacency.

**Mitigation:** Design/documentation; optional future work is server-driven progress or aligned clocks.

## Client: stop ticks after complete

After `completeBlockClaim` is sent, the RAF loop should not keep sending `blockClaimTick` until the result arrives (`!ref.completeSent` guard in `client/src/main.ts`), to avoid useless traffic and confusing traces.

## Client: `@nimiq/style` sprite in `public/`

The HUD uses `<use href="/nimiq-style.icons.svg#…">` for Nimiq icons. The file **`client/public/nimiq-style.icons.svg`** is a copy of **`node_modules/@nimiq/style/nimiq-style.icons.svg`**. When you bump **`@nimiq/style`**, copy the package sprite into `client/public/` again so symbol IDs and paths stay in sync (or symlink if your deploy setup allows).

## Dev: Vite proxy before API is listening

**Symptom:** Chrome logged 503 on every poll of `/api/nim/payout-balance` while the server was still starting.

**Mitigation:** Dev proxy returns 200 + JSON including `_devProxyBackendDown` for that path; client treats wallet status as unavailable instead of “No more NIM”. Throttled Vite log uses `globalThis` so config re-eval does not reset the throttle.
