import { apiUrl } from "../net/apiBase.js";
import type { LoginSignPayload, UsernamePromptStatus } from "./nimiq.js";
import { TermsPrivacyAcknowledgementRequiredError } from "./nimiq.js";

export type QrPayLoginCreated = {
  ticketId: string;
  claimSecret: string;
  expiresAt: number;
  spaUrl: string;
  payDeepLink: string;
};

export type QrPayLoginChallenge =
  | { status: "pending"; nonce: string; message: string; expiresAt: number }
  | { status: "fulfilled"; expiresAt?: number }
  | { status: "expired" };

export type QrPayLoginPollResult =
  | { status: "pending"; expiresAt: number }
  | {
      status: "fulfilled";
      token: string;
      address: string;
      nimiqPay?: boolean;
      usernamePrompt?: UsernamePromptStatus;
      tutorial?: { needsTutorial: boolean };
    }
  | { status: "expired" };

export async function createQrPayLoginTicket(): Promise<QrPayLoginCreated> {
  const r = await fetch(apiUrl("/api/auth/qr-login"), { method: "POST" });
  if (!r.ok) throw new Error("qr_login_create_failed");
  return r.json() as Promise<QrPayLoginCreated>;
}

export async function fetchQrPayLoginChallenge(
  ticketId: string
): Promise<QrPayLoginChallenge> {
  const r = await fetch(
    apiUrl(`/api/auth/qr-login/${encodeURIComponent(ticketId)}/challenge`)
  );
  if (r.status === 410) return { status: "expired" };
  if (!r.ok) throw new Error("qr_login_challenge_failed");
  return r.json() as Promise<QrPayLoginChallenge>;
}

export async function pollQrPayLoginTicket(
  ticketId: string,
  claimSecret: string
): Promise<QrPayLoginPollResult> {
  const qs = new URLSearchParams({ claimSecret });
  const r = await fetch(
    apiUrl(`/api/auth/qr-login/${encodeURIComponent(ticketId)}?${qs}`)
  );
  if (r.status === 410) return { status: "expired" };
  if (r.status === 403) throw new Error("qr_login_forbidden");
  if (!r.ok) throw new Error("qr_login_poll_failed");
  return r.json() as Promise<QrPayLoginPollResult>;
}

export async function completeQrPayLoginTicket(
  ticketId: string,
  body: LoginSignPayload & { acceptedTermsPrivacyVersion?: string }
): Promise<{ ok: true; address: string; nimiqPay?: boolean }> {
  const r = await fetch(
    apiUrl(`/api/auth/qr-login/${encodeURIComponent(ticketId)}/complete`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    const code = String((err as { error?: string }).error || "");
    if (
      r.status === 403 &&
      (code === "terms_privacy_ack_required" || code === "legal_consent_required")
    ) {
      throw new TermsPrivacyAcknowledgementRequiredError(
        String((err as { requiredVersion?: string }).requiredVersion || "")
      );
    }
    throw new Error(code || "qr_login_complete_failed");
  }
  return r.json() as Promise<{ ok: true; address: string; nimiqPay?: boolean }>;
}

export function parseAuthQrTicketFromPath(pathname: string): string | null {
  const m = /^\/auth\/qr\/([^/]+)\/?$/.exec(pathname);
  return m?.[1]?.trim() || null;
}
