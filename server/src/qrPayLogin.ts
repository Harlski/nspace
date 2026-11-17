import crypto from "node:crypto";

/** Match login nonce TTL so cafe QR sessions stay short-lived. */
export const QR_PAY_LOGIN_TTL_MS = 5 * 60 * 1000;

/**
 * External Pay entry for the QR payload.
 * Leave `url=` unencoded so phone cameras / Pay scanners see a readable spa address
 * (`nimiqpay://miniapp?url=https://…/auth/qr/…`). No extra `&` query params are appended.
 */
export function buildQrPayLoginDeepLink(spaUrl: string): string {
  return `nimiqpay://miniapp?url=${spaUrl.trim()}`;
}

/** Crockford-style alphabet: no 0/O or 1/I, so the two screens are easy to compare. */
const PLACE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPlaceCode(): string {
  const bytes = crypto.randomBytes(4);
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += PLACE_CODE_ALPHABET[bytes[i]! % PLACE_CODE_ALPHABET.length];
  }
  return code;
}

export type QrPayLoginTicketPending = {
  status: "pending";
  ticketId: string;
  claimSecret: string;
  /** Short code shown on both screens so the phone can name this computer. */
  placeCode: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
};

export type QrPayLoginSessionResult = {
  token: string;
  address: string;
  nimiqPay: boolean;
  usernamePrompt: unknown;
  tutorial?: { needsTutorial: boolean };
};

export type QrPayLoginTicketFulfilled = {
  status: "fulfilled";
  ticketId: string;
  claimSecret: string;
  placeCode: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
  session: QrPayLoginSessionResult;
};

/**
 * JWT already handed to the desktop. The phone can still read which account authorized
 * the sign-in until TTL. No claim secret and no token.
 */
export type QrPayLoginAuthorizationReceipt = {
  status: "authorized";
  ticketId: string;
  placeCode: string;
  createdAt: number;
  expiresAt: number;
  address: string;
  nimiqPay: boolean;
};

export type QrPayLoginTicket =
  | QrPayLoginTicketPending
  | QrPayLoginTicketFulfilled
  | QrPayLoginAuthorizationReceipt;

const tickets = new Map<string, QrPayLoginTicket>();

function pruneTickets(now = Date.now()): void {
  for (const [id, t] of tickets) {
    if (t.expiresAt < now) tickets.delete(id);
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function resetQrPayLoginTicketsForTests(): void {
  tickets.clear();
}

export function createQrPayLoginTicket(publicBaseUrl: string): {
  ticketId: string;
  claimSecret: string;
  placeCode: string;
  expiresAt: number;
  spaUrl: string;
  payDeepLink: string;
} {
  pruneTickets();
  const ticketId = crypto.randomBytes(16).toString("hex");
  const claimSecret = crypto.randomBytes(32).toString("hex");
  const placeCode = randomPlaceCode();
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + QR_PAY_LOGIN_TTL_MS;
  const ticket: QrPayLoginTicketPending = {
    status: "pending",
    ticketId,
    claimSecret,
    placeCode,
    nonce,
    createdAt: Date.now(),
    expiresAt,
  };
  tickets.set(ticketId, ticket);
  const spaUrl = `${publicBaseUrl.replace(/\/$/, "")}/auth/qr/${ticketId}`;
  return {
    ticketId,
    claimSecret,
    placeCode,
    expiresAt,
    spaUrl,
    payDeepLink: buildQrPayLoginDeepLink(spaUrl),
  };
}

export function getQrPayLoginTicket(ticketId: string): QrPayLoginTicket | null {
  pruneTickets();
  const id = String(ticketId || "").trim();
  if (!id) return null;
  return tickets.get(id) ?? null;
}

/** Phone challenge: public fields only (no claim secret, no session JWT). */
export function getQrPayLoginChallenge(ticketId: string): {
  status: "pending" | "fulfilled" | "expired";
  nonce?: string;
  message?: string;
  expiresAt?: number;
  /** Set once the phone has authorized. Safe to show on the phone; not a session. */
  address?: string;
  nimiqPay?: boolean;
  /** Same code the desktop shows, so the phone can name that screen. */
  placeCode?: string;
} {
  const t = getQrPayLoginTicket(ticketId);
  if (!t) return { status: "expired" };
  if (t.expiresAt < Date.now()) {
    tickets.delete(t.ticketId);
    return { status: "expired" };
  }
  if (t.status === "fulfilled") {
    return {
      status: "fulfilled",
      expiresAt: t.expiresAt,
      address: t.session.address,
      nimiqPay: t.session.nimiqPay,
      placeCode: t.placeCode,
    };
  }
  if (t.status === "authorized") {
    return {
      status: "fulfilled",
      expiresAt: t.expiresAt,
      address: t.address,
      nimiqPay: t.nimiqPay,
      placeCode: t.placeCode,
    };
  }
  return {
    status: "pending",
    nonce: t.nonce,
    message: `Login:v1:${t.nonce}`,
    expiresAt: t.expiresAt,
    placeCode: t.placeCode,
  };
}

export function fulfillQrPayLoginTicket(
  ticketId: string,
  session: QrPayLoginSessionResult
): { ok: true } | { ok: false; error: "not_found" | "expired" | "already_fulfilled" } {
  const t = getQrPayLoginTicket(ticketId);
  if (!t) return { ok: false, error: "not_found" };
  if (t.expiresAt < Date.now()) {
    tickets.delete(t.ticketId);
    return { ok: false, error: "expired" };
  }
  if (t.status !== "pending") return { ok: false, error: "already_fulfilled" };
  tickets.set(t.ticketId, {
    status: "fulfilled",
    ticketId: t.ticketId,
    claimSecret: t.claimSecret,
    placeCode: t.placeCode,
    nonce: t.nonce,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    session,
  });
  return { ok: true };
}

/**
 * Desktop poll/claim. With a valid claim secret, a fulfilled ticket returns the session once.
 * The JWT is dropped; an address receipt remains until TTL so the phone can show which
 * account authorized. Wrong secret never reveals the JWT.
 */
export function pollQrPayLoginTicket(
  ticketId: string,
  claimSecret: string
):
  | { status: "pending"; expiresAt: number }
  | { status: "fulfilled"; session: QrPayLoginSessionResult }
  | { status: "expired" }
  | { status: "forbidden" } {
  const t = getQrPayLoginTicket(ticketId);
  if (!t) return { status: "expired" };
  if (t.status === "authorized") return { status: "expired" };
  if (!timingSafeEqualHex(t.claimSecret, String(claimSecret || ""))) {
    return { status: "forbidden" };
  }
  if (t.expiresAt < Date.now()) {
    tickets.delete(t.ticketId);
    return { status: "expired" };
  }
  if (t.status === "pending") {
    return { status: "pending", expiresAt: t.expiresAt };
  }
  tickets.set(t.ticketId, {
    status: "authorized",
    ticketId: t.ticketId,
    placeCode: t.placeCode,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    address: t.session.address,
    nimiqPay: t.session.nimiqPay,
  });
  return { status: "fulfilled", session: t.session };
}

export function expectedLoginMessageForTicket(
  ticket: QrPayLoginTicketPending | QrPayLoginTicketFulfilled
): string {
  return `Login:v1:${ticket.nonce}`;
}
