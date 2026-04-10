/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUB_URL?: string;
  readonly VITE_DEV_AUTH_BYPASS?: string;
  /** Set to "true" to show the Admin panel (random layout, zoom limits). */
  readonly VITE_ADMIN_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
