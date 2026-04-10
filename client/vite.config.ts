import { defineConfig } from "vite";

export default defineConfig({
  server: {
    /** Listen on all interfaces so other devices on the LAN can open the dev app (same Wi‑Fi). */
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:3001", ws: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
