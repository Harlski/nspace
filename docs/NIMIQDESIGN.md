# Nimiq identicons — project usage (summary)

We use **`@nimiq/identicons`** so avatars match **Nimiq wallets** (same hash → same hex face / parts).

## Package and entry

- **Dependency:** `@nimiq/identicons` (same major/minor as the client, e.g. `^1.6.2`).
- **Import path:** `@nimiq/identicons/dist/identicons.bundle.min.js`  
  The ESM **bundle** exposes `IdenticonsAssets` (inline SVG sprite string) and the `Identicons` class. The package `browser` field points at a different file; prefer the **bundle** in tooling that needs named exports.

## `IdenticonsAssets` global (required)

The library loads sprite `<symbol>`s from a global **`IdenticonsAssets`** unless it fetches an external SVG. The bundle **exports** the string but does **not** assign `globalThis.IdenticonsAssets`, so without this step you get a **blank or minimal** identicon (missing face parts).

**Pattern (browser and Node):**

```ts
import Identicons, { IdenticonsAssets } from "@nimiq/identicons/dist/identicons.bundle.min.js";

const g = globalThis as typeof globalThis & { IdenticonsAssets?: string };
if (g.IdenticonsAssets === undefined) {
  g.IdenticonsAssets = IdenticonsAssets;
}
```

## Address string → same image as the wallet

Identicons hash the **user-friendly** address (groups of **4** characters separated by spaces). A **compact** `NQAA…` string hashes differently than the spaced form the wallet shows.

**Always normalize** before `toDataUrl`:

- Shared helper: **`client/src/nimiqIdenticonAddress.ts`** — `toNimiqUserFriendlyForIdenticon(addr)`.
- Server duplicate (same logic): **`server/src/nimiqIdenticonServer.ts`** — keep in sync when changing rules.

## Client: Three.js and `<img>`

| Use case | File | API |
|----------|------|-----|
| Data URL for `<img src>` (HUD, menus) | `client/src/game/identiconTexture.ts` | `identiconDataUrl(address)` → `Promise<string>` |
| `THREE.CanvasTexture` for the 3D scene | same | `loadIdenticonTexture(address)` — now uses the same address normalization as `identiconDataUrl`. |

Both set `globalThis.IdenticonsAssets` once, then call `Identicons.toDataUrl(toNimiqUserFriendlyForIdenticon(address))`.

**Build note (Vite):** If `IdenticonsAssets` is not set globally, the runtime may try to load `/node_modules/@nimiq/identicons/dist/identicons.min.svg` from the dev server and **404**; the global assignment avoids that.

## Server: Node / Express

| Use case | File | API |
|----------|------|-----|
| Pending NIM payout rows and other server-rendered HTML that shows avatars | `server/src/nimiqIdenticonServer.ts` | `nimiqIdenticonDataUrl(address)` → `Promise<string>` |

**Node prerequisites:**

1. **`dom-parser`** — the bundle parses inline SVG with `new DOMParser().parseFromString(…)`. Node has no global `DOMParser`. Under **ESM**, the bundle’s internal `require("dom-parser")` path may not run, so **`nimiqIdenticonServer.ts`** assigns **`globalThis.DOMParser`** before any identicon call, using **`dom-parser` v1.x**’s exported **`parseFromString(html)`** (not a constructor) inside a small `DOMParser`-compatible wrapper.
2. **`IdenticonsAssets` on `globalThis`** — same as the client (see above).
3. **Default export shape** — depending on the loader, `import * as M from "…bundle.min.js"` may expose the class as `M.default` or nested as `M.default.default`. **`nimiqIdenticonServer.ts`** resolves both.

`Identicons.toDataUrl` returns **`data:image/svg+xml;base64,...`** (SVG, not raster PNG) — fine for `<img>` and JSON APIs.

## Quick checklist when adding a new identicon call site

1. Set **`globalThis.IdenticonsAssets`** once before the first render.
2. Pass addresses through **`toNimiqUserFriendlyForIdenticon`** (or keep parity with the server duplicate).
3. Prefer **`identicons.bundle.min.js`** so `IdenticonsAssets` is importable.
4. On **Node**, ensure **`dom-parser`** is installed and **`globalThis.DOMParser`** is set (see **`server/src/nimiqIdenticonServer.ts`**) before `Identicons.toDataUrl`.
