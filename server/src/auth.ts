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
  /** Present when the session was issued after Nimiq Pay mini-app login (empty `signer` on verify). */
  nimiqPay?: boolean;
  /** Ephemeral Direct Invite guest session. */
  guest?: true;
  guestId?: string;
  displayName?: string;
  inviteSlug?: string;
  /** Wallet linked after splash upgrade (guestId preserved). */
  upgradedWallet?: string;
  iat: number;
  exp: number;
}

export function isGuestSession(payload: SessionPayload): boolean {
  return payload.guest === true || payload.sub.startsWith("guest:");
}

export function guestSub(guestId: string): string {
  return `guest:${guestId}`;
}

export function signSession(
  address: string,
  jwtSecret: string,
  opts?: { nimiqPay?: boolean }
): string {
  const payload: { sub: string; nimiqPay?: boolean } = { sub: address };
  if (opts?.nimiqPay) payload.nimiqPay = true;
  return jwt.sign(payload, jwtSecret, { expiresIn: JWT_TTL_SEC });
}

export function verifySession(token: string, jwtSecret: string): SessionPayload {
  return jwt.verify(token, jwtSecret) as SessionPayload;
}

export function signGuestSession(
  guestId: string,
  displayName: string,
  jwtSecret: string,
  opts?: { inviteSlug?: string; ttlSec?: number }
): string {
  const payload: {
    sub: string;
    guest: true;
    guestId: string;
    displayName: string;
    inviteSlug?: string;
  } = {
    sub: guestSub(guestId),
    guest: true,
    guestId,
    displayName,
  };
  if (opts?.inviteSlug) payload.inviteSlug = opts.inviteSlug;
  const ttl = opts?.ttlSec ?? 4 * 60 * 60;
  return jwt.sign(payload, jwtSecret, { expiresIn: ttl });
}

export function signUpgradedGuestSession(
  guestId: string,
  wallet: string,
  displayName: string,
  jwtSecret: string,
  opts?: { inviteSlug?: string; nimiqPay?: boolean; ttlSec?: number }
): string {
  const payload: {
    sub: string;
    guest: true;
    guestId: string;
    displayName: string;
    upgradedWallet: string;
    inviteSlug?: string;
    nimiqPay?: boolean;
  } = {
    sub: guestSub(guestId),
    guest: true,
    guestId,
    displayName,
    upgradedWallet: wallet,
  };
  if (opts?.inviteSlug) payload.inviteSlug = opts.inviteSlug;
  if (opts?.nimiqPay) payload.nimiqPay = true;
  const ttl = opts?.ttlSec ?? 4 * 60 * 60;
  return jwt.sign(payload, jwtSecret, { expiresIn: ttl });
}
