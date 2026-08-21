/**
 * Decode Ambient Cast Face Tokens and render the same SVG pipeline as
 * `@nimiq/identicons` (without wallet address formatting).
 */
import Identicons, {
  IdenticonsAssets,
  makeHash,
  hashToIndices,
} from "@nimiq/identicons/dist/identicons.bundle.min.js";

type IdenticonsGlobal = typeof globalThis & { IdenticonsAssets?: string };
const identiconsGlobal = globalThis as IdenticonsGlobal;
if (identiconsGlobal.IdenticonsAssets === undefined) {
  identiconsGlobal.IdenticonsAssets = IdenticonsAssets;
}

type IdenticonsWithTemplate = typeof Identicons & {
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

const IdenticonsX = Identicons as IdenticonsWithTemplate;

export const FACE_TOKEN_PREFIX = "ac1_";

export type FaceFeatures = {
  main: number;
  background: number;
  accent: number;
  face: number;
  top: number;
  side: number;
  bottom: number;
};

function partKey(index1to21: number): string {
  return String(index1to21 - 1).padStart(2, "0");
}

function base64UrlToBytes(b64url: string): Uint8Array | null {
  try {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function decodeFaceToken(token: string): FaceFeatures | null {
  const raw = String(token || "").trim();
  if (!raw.startsWith(FACE_TOKEN_PREFIX)) return null;
  const bytes = base64UrlToBytes(raw.slice(FACE_TOKEN_PREFIX.length));
  if (!bytes || bytes.length !== 7) return null;
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

export async function dataUrlFromFaceToken(token: string): Promise<string> {
  const features = decodeFaceToken(token);
  if (!features) return "";
  const svg = await IdenticonsX._svgTemplate(
    String(features.main),
    String(features.background),
    partKey(features.face),
    partKey(features.top),
    partKey(features.side),
    partKey(features.bottom),
    String(features.accent)
  );
  return `data:image/svg+xml;base64,${IdenticonsX._btoa(svg)}`;
}

/** Exported for tests that compare wallet vs token faces in the browser. */
export function featuresFromIdenticonInput(input: string): FaceFeatures {
  const h = makeHash(input);
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
