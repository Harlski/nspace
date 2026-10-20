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

export type QrPayLoginTicketPending = {
  status: "pending";
  ticketId: string;
  claimSecret: string;
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
  nonce: string;
  createdAt: number;
  expiresAt: number;
  session: QrPayLoginSessionResult;
};

export type QrPayLoginTicket = QrPayLoginTicketPending | QrPayLoginTicketFulfilled;

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
  expiresAt: number;
  spaUrl: string;
  payDeepLink: string;
} {
  pruneTickets();
  const ticketId = crypto.randomBytes(16).toString("hex");
  const claimSecret = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + QR_PAY_LOGIN_TTL_MS;
  const ticket: QrPayLoginTicketPending = {
    status: "pending",
    ticketId,
    claimSecret,
    nonce,
    createdAt: Date.now(),
    expiresAt,
  };
  tickets.set(ticketId, ticket);
  const spaUrl = `${publicBaseUrl.replace(/\/$/, "")}/auth/qr/${ticketId}`;
  return {
    ticketId,
    claimSecret,
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
} {
  const t = getQrPayLoginTicket(ticketId);
  if (!t) return { status: "expired" };
  if (t.expiresAt < Date.now()) {
    tickets.delete(t.ticketId);
    return { status: "expired" };
  }
  if (t.status === "fulfilled") {
    return { status: "fulfilled", expiresAt: t.expiresAt };
  }
  return {
    status: "pending",
    nonce: t.nonce,
    message: `Login:v1:${t.nonce}`,
    expiresAt: t.expiresAt,
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
  if (t.status === "fulfilled") return { ok: false, error: "already_fulfilled" };
  tickets.set(t.ticketId, {
    status: "fulfilled",
    ticketId: t.ticketId,
    claimSecret: t.claimSecret,
    nonce: t.nonce,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    session,
  });
  return { ok: true };
}

/**
 * Desktop poll/claim. With a valid claim secret, a fulfilled ticket returns the session once
 * and is deleted (one-shot). Wrong secret never reveals the JWT.
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
  tickets.delete(t.ticketId);
  return { status: "fulfilled", session: t.session };
}

export function expectedLoginMessageForTicket(ticket: QrPayLoginTicket): string {
  return `Login:v1:${ticket.nonce}`;
}
