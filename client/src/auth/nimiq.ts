import HubApi from "@nimiq/hub-api";

const HUB_URL = import.meta.env.VITE_HUB_URL || "https://hub.nimiq.com";

function toB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

export async function signInWithWallet(nonce: string): Promise<{
  nonce: string;
  message: string;
  signer: string;
  signerPublicKey: string;
  signature: string;
}> {
  const hubApi = new HubApi(HUB_URL);
  const message = `Login:v1:${nonce}`;
  const signed = await hubApi.signMessage({
    appName: "nspace",
    message,
  });
  return {
    nonce,
    message,
    signer: signed.signer,
    signerPublicKey: toB64(signed.signerPublicKey),
    signature: toB64(signed.signature),
  };
}

export async function fetchNonce(): Promise<{ nonce: string; expiresAt: number }> {
  const r = await fetch("/api/auth/nonce");
  if (!r.ok) throw new Error("nonce_failed");
  return r.json() as Promise<{ nonce: string; expiresAt: number }>;
}

export async function verifyWithServer(body: {
  nonce: string;
  message: string;
  signer: string;
  signerPublicKey: string;
  signature: string;
}): Promise<{ token: string; address: string }> {
  const r = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "verify_failed");
  }
  return r.json() as Promise<{ token: string; address: string }>;
}
