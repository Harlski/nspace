import { defineConfig } from "vite";

export default defineConfig({
  server: {
    /** Listen on all interfaces so other devices on the LAN can open the dev app (same Wi‑Fi). */
    host: true,
    port: 5173,
    proxy: {
      // Nimiq balance uses light client + consensus; default proxy timeouts cause "socket hang up"
      "/api": {
        // Must match server PORT (default 3001 in server/.env). ECONNREFUSED = API not listening.
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
      "/ws": { target: "ws://127.0.0.1:3001", ws: true },
      /** Public HTML from Express (`server/src/index.ts`); without this, SPA serves `index.html`. */
      "/pending-payouts": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
