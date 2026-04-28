/// <reference types="vite/client" />

/** Seeded by Nimiq Pay before mini-app scripts run ([docs](https://nimiq.dev/mini-apps/)). */
interface NimiqPayHostContext {
  readonly language?: string;
}

interface Window {
  nimiqPay?: NimiqPayHostContext;
}

interface ImportMetaEnv {
  readonly VITE_HUB_URL?: string;
  readonly VITE_DEV_AUTH_BYPASS?: string;
  /** Set to "true" to show the Admin panel (random layout, zoom limits). */
  readonly VITE_ADMIN_ENABLED?: string;
  /** e.g. https://api.example.com — optional split-host deploy */
  readonly VITE_API_BASE_URL?: string;
  /** WebSocket origin e.g. wss://api.example.com — optional; defaults to page origin */
  readonly VITE_WS_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
