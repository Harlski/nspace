/**
 * Ambient Cast Face Tokens: opaque encodings of Nimiq identicon features so the
 * public snapshot stays lean and address-free while pixels match the wallet face.
 */
import { createRequire } from "node:module";
import * as IdenticonsModule from "@nimiq/identicons/dist/identicons.bundle.min.js";

const require = createRequire(import.meta.url);
const domParserMod = require("dom-parser") as Record<string, unknown>;

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
  throw new Error("[ambient-face-token] dom-parser: unrecognized export shape");
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
  svg: (address: string) => Promise<string>;
  _svgTemplate: (
    main: string,
    background: string,
    face: string,
    top: string,
    side: string,
    bottom: string,
    accent: string
  ) => Promise<string>;
  _btoa: (s: string) => string;
};

function resolveIdenticons(): {
  IdenticonsClass: IdenticonsStatic;
  IdenticonsAssets: string;
  makeHash: (input: string) => string;
  hashToIndices: (
    main: number,
    background: number,
    accent: number
  ) => { main: number; background: number; accent: number };
} {
  const top = IdenticonsModule as unknown as Record<string, unknown>;
  const topDefault = top["default"];
  const makeHash = top["makeHash"];
  const hashToIndices = top["hashToIndices"];
  if (typeof makeHash !== "function" || typeof hashToIndices !== "function") {
    throw new Error("[ambient-face-token] missing makeHash/hashToIndices exports");
  }
  if (
    typeof topDefault === "function" &&
    typeof (topDefault as unknown as IdenticonsStatic).toDataUrl === "function" &&
    typeof top["IdenticonsAssets"] === "string"
  ) {
    return {
      IdenticonsClass: topDefault as unknown as IdenticonsStatic,
      IdenticonsAssets: top["IdenticonsAssets"] as string,
      makeHash: makeHash as (input: string) => string,
      hashToIndices: hashToIndices as (
        main: number,
        background: number,
        accent: number
      ) => { main: number; background: number; accent: number },
    };
  }
  throw new Error("[ambient-face-token] Could not resolve @nimiq/identicons exports");
}

const { IdenticonsClass, IdenticonsAssets, makeHash, hashToIndices } =
  resolveIdenticons();

type IdenticonsGlobal = typeof globalThis & { IdenticonsAssets?: string };
const identiconsGlobal = globalThis as IdenticonsGlobal;
if (identiconsGlobal.IdenticonsAssets === undefined) {
  identiconsGlobal.IdenticonsAssets = IdenticonsAssets;
}

/** Same rules as `client/src/nimiqIdenticonAddress.ts`. */
export function toNimiqUserFriendlyForIdenticon(addr: string): string {
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

export type FaceFeatures = {
  main: number;
  background: number;
  accent: number;
  /** 1–21 part indices */
  face: number;
  top: number;
  side: number;
  bottom: number;
};

export const FACE_TOKEN_PREFIX = "ac1_";

const tokenCache = new Map<string, string>();

function partKey(index1to21: number): string {
  return String(index1to21 - 1).padStart(2, "0");
}

export function featuresFromIdenticonInput(input: string): FaceFeatures {
  const h = makeHash(input);
  if (h.length < 12) {
    throw new Error("[ambient-face-token] makeHash too short");
  }
  const colors = hashToIndices(
    Number.parseInt(h[0]!, 10),
    Number.parseInt(h[2]!, 10),
    Number.parseInt(h[11]!, 10)
  );
  return {
    main: colors.main,
    background: colors.background,
    accent: colors.accent,
    face: (Number(h[3]! + h[4]!) % 21) + 1,
    top: (Number(h[5]! + h[6]!) % 21) + 1,
    side: (Number(h[7]! + h[8]!) % 21) + 1,
    bottom: (Number(h[9]! + h[10]!) % 21) + 1,
  };
}

export function encodeFaceToken(features: FaceFeatures): string {
  const bytes = Uint8Array.from([
    features.main & 0xff,
    features.background & 0xff,
    features.accent & 0xff,
    features.face & 0xff,
    features.top & 0xff,
    features.side & 0xff,
    features.bottom & 0xff,
  ]);
  return FACE_TOKEN_PREFIX + Buffer.from(bytes).toString("base64url");
}

export function decodeFaceToken(token: string): FaceFeatures | null {
  const raw = String(token || "").trim();
  if (!raw.startsWith(FACE_TOKEN_PREFIX)) return null;
  const b64 = raw.slice(FACE_TOKEN_PREFIX.length);
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64url");
  } catch {
    return null;
  }
  if (bytes.length !== 7) return null;
  const face = bytes[3]!;
  const top = bytes[4]!;
  const side = bytes[5]!;
  const bottom = bytes[6]!;
  if (
    bytes[0]! > 9 ||
    bytes[1]! > 9 ||
    bytes[2]! > 9 ||
    face < 1 ||
    face > 21 ||
    top < 1 ||
    top > 21 ||
    side < 1 ||
    side > 21 ||
    bottom < 1 ||
    bottom > 21
  ) {
    return null;
  }
  return {
    main: bytes[0]!,
    background: bytes[1]!,
    accent: bytes[2]!,
    face,
    top,
    side,
    bottom,
  };
}

export function isFaceToken(token: string): boolean {
  return decodeFaceToken(token) !== null;
}

export async function svgFromFaceFeatures(features: FaceFeatures): Promise<string> {
  return IdenticonsClass._svgTemplate(
    String(features.main),
    String(features.background),
    partKey(features.face),
    partKey(features.top),
    partKey(features.side),
    partKey(features.bottom),
    String(features.accent)
  );
}

export async function dataUrlFromFaceFeatures(
  features: FaceFeatures
): Promise<string> {
  const svg = await svgFromFaceFeatures(features);
  return `data:image/svg+xml;base64,${IdenticonsClass._btoa(svg)}`;
}

export async function dataUrlFromFaceToken(token: string): Promise<string> {
  const features = decodeFaceToken(token);
  if (!features) return "";
  return dataUrlFromFaceFeatures(features);
}

function walletCacheKey(address: string): string {
  return toNimiqUserFriendlyForIdenticon(address).replace(/\s+/g, "").toUpperCase();
}

/** Deterministic Face Token for a wallet (exact public identicon features). */
export function faceTokenForWallet(address: string): string {
  const key = walletCacheKey(address);
  if (!key) return "";
  const cached = tokenCache.get(key);
  if (cached) return cached;
  const formatted = toNimiqUserFriendlyForIdenticon(address);
  const token = encodeFaceToken(featuresFromIdenticonInput(formatted));
  tokenCache.set(key, token);
  return token;
}

/** Test helper: clear in-memory token memo. */
export function clearFaceTokenCacheForTests(): void {
  tokenCache.clear();
}

export function normalizeIdenticonSvg(svgOrDataUrl: string): string {
  let svg = svgOrDataUrl;
  const prefix = "data:image/svg+xml;base64,";
  if (svg.startsWith(prefix)) {
    svg = Buffer.from(svg.slice(prefix.length), "base64").toString("utf8");
  }
  return svg.replace(/hexagon-clip-\d+/g, "hexagon-clip-X");
}

export async function walletIdenticonDataUrl(address: string): Promise<string> {
  return IdenticonsClass.toDataUrl(toNimiqUserFriendlyForIdenticon(address));
}
