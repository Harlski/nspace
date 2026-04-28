import HubApi from "@nimiq/hub-api";
import { apiUrl } from "../net/apiBase.js";

const HUB_URL = import.meta.env.VITE_HUB_URL || "https://hub.nimiq.com";

function toB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

/** Payload for `POST /api/auth/verify` after signing `Login:v1:${nonce}`. */
export type LoginSignPayload = {
  nonce: string;
  message: string;
  /**
   * Hub: omit when empty/unknown so JSON has no `signer` key (server must not treat as Nimiq Pay).
   * Nimiq Pay: always send `""` (see `signLoginChallengeMiniApp`).
   */
  signer?: string;
  signerPublicKey: string;
  signature: string;
  /** Set only by the mini-app client; server treats `true` as Nimiq Pay session (never send from Hub). */
  nimiqPayClient?: boolean;
};

/** True when the page runs inside Nimiq Pay (host injects context before scripts). */
export function isNimiqPayMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.nimiqPay != null;
}

function isProviderErrorResponse(x: unknown): x is { error: { message?: string } } {
  if (typeof x !== "object" || x === null || !("error" in x)) return false;
  const err = (x as { error: unknown }).error;
  return typeof err === "object" && err !== null;
}

/** Decode hex or standard base64 payload from Nimiq Pay `sign` RPC. */
function decodeBinaryString(s: string): Uint8Array {
  const t = s.trim();
  if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) {
    const out = new Uint8Array(t.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  try {
    const binary = atob(t);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    throw new Error("invalid_wallet_encoding");
  }
}

/** Nimiq Pay may return `string`, `Uint8Array`, or JSON numeric byte arrays from the native bridge. */
function coerceSignBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
    return new Uint8Array(v as number[]);
  }
  if (typeof v === "string") return decodeBinaryString(v);
  throw new Error("invalid_wallet_encoding");
}

async function signLoginChallengeMiniApp(nonce: string): Promise<LoginSignPayload> {
  const { init } = await import("@nimiq/mini-app-sdk");
  const nimiq = await init();
  const message = `Login:v1:${nonce}`;
  const raw = await nimiq.sign(message);
  if (isProviderErrorResponse(raw)) {
    throw new Error(String(raw.error?.message || "nimiq_pay_sign_failed"));
  }
  const { publicKey, signature } = raw as { publicKey: unknown; signature: unknown };
  const pubBytes = coerceSignBytes(publicKey);
  const sigBytes = coerceSignBytes(signature);
  /** Server derives the user-friendly address from the public key after verifying the signature. */
  return {
    nonce,
    message,
    signer: "",
    signerPublicKey: toB64(pubBytes),
    signature: toB64(sigBytes),
    nimiqPayClient: true,
  };
}

function nonEmptyHubSigner(signed: { signer?: unknown }): string | undefined {
  const raw = signed.signer;
  if (raw == null) return undefined;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return s.length > 0 ? s : undefined;
}

async function signLoginChallengeHub(nonce: string, appName: string): Promise<LoginSignPayload> {
  const hubApi = new HubApi(HUB_URL);
  const message = `Login:v1:${nonce}`;
  const signed = await hubApi.signMessage({ appName, message });
  const signer = nonEmptyHubSigner(signed as { signer?: unknown });
  const base: LoginSignPayload = {
    nonce,
    message,
    signerPublicKey: toB64(signed.signerPublicKey),
    signature: toB64(signed.signature),
  };
  if (signer !== undefined) base.signer = signer;
  return base;
}

/**
 * Signs the login challenge via Hub (browser) or Nimiq Pay injected provider (mini app).
 * `appName` is shown in Hub / host UI; the mini-app path uses the same login message only.
 */
export async function signLoginChallenge(nonce: string, appName: string): Promise<LoginSignPayload> {
  if (isNimiqPayMiniApp()) {
    return signLoginChallengeMiniApp(nonce);
  }
  return signLoginChallengeHub(nonce, appName);
}

/** Game and shared flows use the short Hub app label `"nspace"`. */
export async function signInWithWallet(nonce: string): Promise<LoginSignPayload> {
  return signLoginChallenge(nonce, "nspace");
}

export async function fetchNonce(): Promise<{ nonce: string; expiresAt: number }> {
  const r = await fetch(apiUrl("/api/auth/nonce"));
  if (!r.ok) throw new Error("nonce_failed");
  return r.json() as Promise<{ nonce: string; expiresAt: number }>;
}

export type VerifyAuthResponse = {
  token: string;
  address: string;
  /** Server-derived: true when login used the Nimiq Pay signing path (empty `signer` on verify). */
  nimiqPay?: boolean;
};

export async function verifyWithServer(body: LoginSignPayload): Promise<VerifyAuthResponse> {
  const r = await fetch(apiUrl("/api/auth/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "verify_failed");
  }
  return r.json() as Promise<VerifyAuthResponse>;
}
