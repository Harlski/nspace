/**
 * Nimiq identicons on Node (pending payouts API, etc.).
 * Uses the same `@nimiq/identicons` bundle as the client; see docs/NIMIQDESIGN.md.
 */
import { createRequire } from "node:module";
import * as IdenticonsModule from "@nimiq/identicons/dist/identicons.bundle.min.js";

const require = createRequire(import.meta.url);
const domParserMod = require("dom-parser") as Record<string, unknown>;

/** Supports dom-parser@1.x (`{ parseFromString }`) and 0.x (`module.exports = DomParser`). */
function domParserParseFromString(html: string): unknown {
  const named = domParserMod.parseFromString;
  if (typeof named === "function") {
    return (named as (h: string) => unknown)(html);
  }
  const Ctor = domParserMod as unknown;
  if (typeof Ctor === "function") {
    return new (Ctor as new () => { parseFromString: (h: string) => unknown })().parseFromString(
      html
    );
  }
  throw new Error("[nimiq-identicon] dom-parser: unrecognized export shape");
}

if (typeof globalThis.DOMParser === "undefined") {
  (globalThis as unknown as { DOMParser: typeof DOMParser }).DOMParser =
    class NimDomParserPolyfill implements DOMParser {
      parseFromString(
        string: string,
        _mimeType?: DOMParserSupportedType
      ): Document {
        return domParserParseFromString(string) as Document;
      }
    } as unknown as typeof DOMParser;
}

type IdenticonsStatic = {
  toDataUrl: (address: string) => Promise<string>;
};

function resolveIdenticons(): {
  IdenticonsClass: IdenticonsStatic;
  IdenticonsAssets: string;
} {
  const top = IdenticonsModule as unknown as Record<string, unknown>;
  const topDefault = top["default"];

  if (
    typeof topDefault === "function" &&
    typeof (topDefault as unknown as IdenticonsStatic).toDataUrl ===
      "function" &&
    typeof top["IdenticonsAssets"] === "string"
  ) {
    return {
      IdenticonsClass: topDefault as unknown as IdenticonsStatic,
      IdenticonsAssets: top["IdenticonsAssets"] as string,
    };
  }

  if (topDefault && typeof topDefault === "object") {
    const nested = topDefault as Record<string, unknown>;
    const inner = nested["default"];
    if (
      typeof inner === "function" &&
      typeof (inner as unknown as IdenticonsStatic).toDataUrl === "function" &&
      typeof nested["IdenticonsAssets"] === "string"
    ) {
      return {
        IdenticonsClass: inner as unknown as IdenticonsStatic,
        IdenticonsAssets: nested["IdenticonsAssets"] as string,
      };
    }
  }

  throw new Error("[nimiq-identicon] Could not resolve @nimiq/identicons exports");
}

const { IdenticonsClass, IdenticonsAssets } = resolveIdenticons();

type IdenticonsGlobal = typeof globalThis & { IdenticonsAssets?: string };
const identiconsGlobal = globalThis as IdenticonsGlobal;
if (identiconsGlobal.IdenticonsAssets === undefined) {
  identiconsGlobal.IdenticonsAssets = IdenticonsAssets;
}

/** Same rules as `client/src/nimiqIdenticonAddress.ts` (kept in sync). */
function toNimiqUserFriendlyForIdenticon(addr: string): string {
  const raw = String(addr).trim();
  if (!raw) return raw;
  if (/\s/.test(raw)) {
    return raw.replace(/\s+/g, " ").trim();
  }
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) return raw;
  const chunks: string[] = [];
  for (let i = 0; i < compact.length; i += 4) {
    chunks.push(compact.slice(i, i + 4));
  }
  return chunks.join(" ");
}

/** SVG as `data:image/svg+xml;base64,...` — matches Nimiq wallet / in-game identicons. */
export async function nimiqIdenticonDataUrl(address: string): Promise<string> {
  return IdenticonsClass.toDataUrl(toNimiqUserFriendlyForIdenticon(address));
}
