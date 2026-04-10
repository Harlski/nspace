/**
 * Must match `HubApi.MSG_PREFIX` from `@nimiq/hub-api` (Keyguard signed-message format).
 */
const NIMIQ_MSG_PREFIX = "\x16Nimiq Signed Message:\n";

/**
 * Verifies a Hub `signMessage` result against the exact UTF-8 message string.
 * Uses the same prefix + SHA256 + Ed25519 path as Keyguard.
 */
export async function verifySignedMessage(
  message: string,
  signerPublicKeyB64: string,
  signatureB64: string,
  expectedSigner: string
): Promise<boolean> {
  const { Hash, PublicKey, Signature } = await import("@nimiq/core");

  const pubBytes = Buffer.from(signerPublicKeyB64, "base64");
  const sigBytes = Buffer.from(signatureB64, "base64");

  const data =
    NIMIQ_MSG_PREFIX + String(message.length) + message;
  const dataBytes = new TextEncoder().encode(data);
  const hash = Hash.computeSha256(dataBytes);

  const publicKey = new PublicKey(pubBytes);
  const signature = Signature.deserialize(sigBytes);

  if (!publicKey.verify(signature, hash)) return false;

  const addr = publicKey.toAddress().toUserFriendlyAddress();
  return addr === expectedSigner;
}
