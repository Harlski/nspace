/**
 * Nimiq identicons on Node. Lazy-loads `@nimiq/identicons` so importing this
 * module (e.g. from game-server tests) does not initialize a second copy of the
 * bundle on the same `globalThis` as `server/src/nimiqIdenticonServer.ts`.
 * See docs/NIMIQDESIGN.md.
 */
import { createRequire } from "node:module";

type IdenticonsStatic = {
  toDataUrl: (address: string) => Promise<string>;
};

let identiconsClass: IdenticonsStatic | null = null;
let identiconsLoad: Promise<IdenticonsStatic> | null = null;

function stubDataUrl(): string {
  return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>');
}

function installDomParser(): void {
  if (typeof globalThis.DOMParser !== "undefined") return;
  const require = createRequire(import.meta.url);
  const domParserMod = require("dom-parser") as Record<string, unknown>;
  const named = domParserMod.parseFromString;
  const parseFromString = (html: string): unknown => {
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
  };
  (globalThis as unknown as { DOMParser: typeof DOMParser }).DOMParser =
    class NimDomParserPolyfill implements DOMParser {
      parseFromString(
        string: string,
        _mimeType?: DOMParserSupportedType
      ): Document {
        return parseFromString(string) as Document;
      }
    } as unknown as typeof DOMParser;
}

function resolveIdenticons(mod: Record<string, unknown>): {
  IdenticonsClass: IdenticonsStatic;
  IdenticonsAssets: string;
} {
  const topDefault = mod["default"];

  if (
    typeof topDefault === "function" &&
    typeof (topDefault as unknown as IdenticonsStatic).toDataUrl === "function" &&
    typeof mod["IdenticonsAssets"] === "string"
  ) {
    return {
      IdenticonsClass: topDefault as unknown as IdenticonsStatic,
      IdenticonsAssets: mod["IdenticonsAssets"] as string,
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

async function loadIdenticons(): Promise<IdenticonsStatic> {
  if (identiconsClass) return identiconsClass;
  if (!identiconsLoad) {
    identiconsLoad = (async () => {
      installDomParser();
      const IdenticonsModule = (await import(
        "@nimiq/identicons/dist/identicons.bundle.min.js"
      )) as Record<string, unknown>;
      const { IdenticonsClass, IdenticonsAssets } = resolveIdenticons(IdenticonsModule);
      const identiconsGlobal = globalThis as typeof globalThis & { IdenticonsAssets?: string };
      if (identiconsGlobal.IdenticonsAssets === undefined) {
        identiconsGlobal.IdenticonsAssets = IdenticonsAssets;
      }
      identiconsClass = IdenticonsClass;
      return IdenticonsClass;
    })();
  }
  return identiconsLoad;
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

/** SVG as `data:image/svg+xml;base64,...` - matches Nimiq wallet / in-game identicons. */
export async function nimiqIdenticonDataUrl(address: string): Promise<string> {
  if (process.env.ANALYTICS_IDENTICON_STUB === "1") return stubDataUrl();
  const IdenticonsClass = await loadIdenticons();
  return IdenticonsClass.toDataUrl(toNimiqUserFriendlyForIdenticon(address));
}
