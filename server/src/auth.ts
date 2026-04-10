import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const NONCE_TTL_MS = 5 * 60 * 1000;
const JWT_TTL_SEC = 60 * 60 * 12;

const nonces = new Map<string, number>();

export function createNonce(): { nonce: string; expiresAt: number } {
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces.set(nonce, expiresAt);
  pruneNonces();
  return { nonce, expiresAt };
}

function pruneNonces(): void {
  const now = Date.now();
  for (const [n, exp] of nonces) {
    if (exp < now) nonces.delete(n);
  }
}

export function consumeNonce(nonce: string): boolean {
  pruneNonces();
  const exp = nonces.get(nonce);
  if (!exp || exp < Date.now()) return false;
  nonces.delete(nonce);
  return true;
}

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function signSession(address: string, jwtSecret: string): string {
  return jwt.sign({ sub: address }, jwtSecret, { expiresIn: JWT_TTL_SEC });
}

export function verifySession(token: string, jwtSecret: string): SessionPayload {
  return jwt.verify(token, jwtSecret) as SessionPayload;
}
