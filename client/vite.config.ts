import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** How often we repeat the “backend not ready” hint (Vite may re-evaluate config; use global). */
const BACKEND_DOWN_LOG_THROTTLE_MS = 10_000;
const BACKEND_DOWN_HINT_TS_KEY = "__nspaceViteBackendDownHintTs";

function isBenignBackendTransportError(err: NodeJS.ErrnoException): boolean {
  const code = err.code;
  const msg = String(err.message ?? "").toLowerCase();
  return (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT" ||
    msg.includes("socket hang up")
  );
}

/**
 * When the dev API is not listening (or resets a long request), http-proxy would otherwise
 * leave some HTTP upgrades hanging and Vite prints large stack traces. Finish the response
 * or destroy the client socket so the browser / fetch can fail fast and retry.
 */
function installDevApiProxyErrorHandler(proxy: EventEmitter): void {
  proxy.on("error", (err: NodeJS.ErrnoException, req: unknown, resOrSocket: unknown) => {
    if (!isBenignBackendTransportError(err)) return;

    const maybeRes = resOrSocket as Partial<ServerResponse> | undefined;
    if (maybeRes?.writeHead && typeof maybeRes.end === "function") {
      const res = maybeRes as ServerResponse;
      if (!res.headersSent) {
        const path = String((req as IncomingMessage | undefined)?.url ?? "")
          .split("?")[0]!
          .replace(/\/$/, "");
        /** Avoid Chrome “503 (Service Unavailable)” noise for the frequent wallet poll. */
        if (path === "/api/nim/payout-balance") {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              configured: true,
              hasNim: false,
              balanceNim: "0.0000",
              _devProxyBackendDown: true,
            })
          );
        } else {
          res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              error: "backend_unavailable",
              message:
                "Dev API not reachable on port 3001 (server still starting or stopped).",
            })
          );
        }
      }
      return;
    }

    const sock = resOrSocket as Socket | undefined;
    if (sock && typeof sock.destroy === "function" && !sock.destroyed) {
      sock.destroy();
    }
  });
}

/** Vite logs a warn + often a separate error stack for the same transient failure — soften both. */
function shouldMuteViteProxyNoise(msg: string): boolean {
  const s = msg.toLowerCase();
  if (s.includes("http proxy error") || s.includes("ws proxy error")) return true;
  if (s.includes("econnrefused") && s.includes("3001")) return true;
  if (s.trim().startsWith("error:") && s.includes("socket hang up")) return true;
  return false;
}

function createDevProxyFriendlyLogger(): ReturnType<typeof createLogger> {
  const logger = createLogger();
  const origWarn = logger.warn.bind(logger);
  const origError = logger.error.bind(logger);

  const hint = () => {
    const t = Date.now();
    const g = globalThis as unknown as Record<string, number>;
    const last = g[BACKEND_DOWN_HINT_TS_KEY] ?? 0;
    if (t - last < BACKEND_DOWN_LOG_THROTTLE_MS) return;
    g[BACKEND_DOWN_HINT_TS_KEY] = t;
    logger.info(
      "\x1b[2m[vite]\x1b[0m Dev proxy: API on :3001 not ready yet (normal right after `npm run dev`). Wallet poll gets a placeholder JSON; WS retries until the server listens."
    );
  };

  logger.warn = (msg, options) => {
    if (shouldMuteViteProxyNoise(String(msg))) {
      hint();
      return;
    }
    origWarn(msg, options);
  };

  logger.error = (msg, options) => {
    if (shouldMuteViteProxyNoise(String(msg))) {
      hint();
      return;
    }
    origError(msg, options);
  };

  return logger;
}

function attachDevProxyHandlers(proxy: EventEmitter): void {
  installDevApiProxyErrorHandler(proxy);
}

export default defineConfig({
  customLogger: createDevProxyFriendlyLogger(),
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        pendingPayouts: resolve(__dirname, "pending-payouts.html"),
        analytics: resolve(__dirname, "analytics.html"),
        admin: resolve(__dirname, "admin.html"),
      },
    },
  },
  server: {
    /** Listen on all interfaces so other devices on the LAN can open the dev app (same Wi‑Fi). */
    host: true,
    port: 5173,
    proxy: {
      // Nimiq balance uses light client + consensus; long proxy timeouts avoid premature hang-up.
      "/api": {
        // Must match server PORT (default 3001 in server/.env).
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        timeout: 120_000,
        proxyTimeout: 120_000,
        configure: attachDevProxyHandlers,
      },
      "/ws": {
        target: "ws://127.0.0.1:3001",
        ws: true,
        configure: attachDevProxyHandlers,
      },
      /** Public HTML from Express (`server/src/index.ts`); without this, SPA serves `index.html`. */
      "/pending-payouts": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure: attachDevProxyHandlers,
      },
      "/analytics": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure: attachDevProxyHandlers,
      },
      "/admin": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure: attachDevProxyHandlers,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
