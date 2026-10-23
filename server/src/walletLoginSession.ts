import {
  evaluateCosmeticsCatchUpAchievements,
  evaluateLoginStreakAchievements,
  evaluateOwnedRoomStateAchievements,
  evaluatePlayerLevelAchievements,
} from "./achievementStore.js";
import { signSession } from "./auth.js";
import { markWalletConnectNoticePending } from "./connectNotice.js";
import { ensureDevWalletAllCosmeticEntitlements } from "./cosmeticStore.js";
import { recordLoginStreakForWallet } from "./loginStreakStore.js";
import { getUsernamePromptStatus } from "./playerProfileStore.js";
import {
  hasAcceptedCurrentTermsPrivacyDocs,
  recordTermsPrivacyAcceptance,
} from "./termsPrivacyAcceptanceStore.js";
import { TERMS_PRIVACY_DOCS_VERSION } from "./termsPrivacyVersion.js";
import { computeNeedsTutorial } from "./tutorialSessionService.js";
import { verifySignedMessageDeriveAddress } from "./verifyNimiq.js";

function normalizeWalletId(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

export type WalletLoginVerifyBody = {
  message: string;
  signer?: unknown;
  signerPublicKey: string;
  signature: string;
  nimiqPayClient?: unknown;
  acceptedTermsPrivacyVersion?: unknown;
  acceptedLegalVersion?: unknown;
};

export type WalletLoginSessionOk = {
  ok: true;
  token: string;
  address: string;
  nimiqPay: boolean;
  usernamePrompt: ReturnType<typeof getUsernamePromptStatus>;
  tutorial?: { needsTutorial: boolean };
};

export type WalletLoginSessionErr = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

/**
 * Shared Hub/Pay signed-message → JWT path used by `POST /api/auth/verify` and QR Pay complete.
 * Caller must already have validated / consumed the nonce (or ticket nonce).
 */
export async function issueWalletSessionFromSignedLogin(opts: {
  expectedMessage: string;
  body: WalletLoginVerifyBody;
  jwtSecret: string;
  devAuthBypass: boolean;
}): Promise<WalletLoginSessionOk | WalletLoginSessionErr> {
  const { expectedMessage, body, jwtSecret, devAuthBypass } = opts;
  const message = String(body.message ?? "");
  const signer = String(body.signer ?? "");
  const signerPublicKey = String(body.signerPublicKey ?? "");
  const signature = String(body.signature ?? "");

  if (!message || !signerPublicKey || !signature) {
    return { ok: false, status: 400, body: { error: "missing_fields" } };
  }
  if (message !== expectedMessage) {
    return { ok: false, status: 401, body: { error: "message_mismatch" } };
  }

  let sessionAddress: string | null = null;

  if (devAuthBypass) {
    if (normalizeWalletId(signer)) {
      sessionAddress = signer;
    } else if (signerPublicKey && signature) {
      try {
        const derived = await verifySignedMessageDeriveAddress(
          message,
          signerPublicKey,
          signature
        );
        if (!derived) {
          return { ok: false, status: 401, body: { error: "invalid_signature" } };
        }
        sessionAddress = derived;
      } catch (e) {
        console.error("verifySignedMessageDeriveAddress (dev bypass)", e);
        return { ok: false, status: 401, body: { error: "invalid_signature" } };
      }
    } else {
      return { ok: false, status: 400, body: { error: "missing_fields" } };
    }
  } else {
    try {
      const derived = await verifySignedMessageDeriveAddress(
        message,
        signerPublicKey,
        signature
      );
      if (!derived) {
        return { ok: false, status: 401, body: { error: "invalid_signature" } };
      }
      const claimed = normalizeWalletId(signer);
      if (claimed && claimed !== normalizeWalletId(derived)) {
        return { ok: false, status: 401, body: { error: "signer_mismatch" } };
      }
      sessionAddress = derived;
    } catch (e) {
      console.error("verifySignedMessageDeriveAddress", e);
      return { ok: false, status: 401, body: { error: "invalid_signature" } };
    }
  }

  if (!sessionAddress) {
    return { ok: false, status: 500, body: { error: "internal" } };
  }

  const claimsPayClient = body.nimiqPayClient === true;
  const signerKeyPresent = Object.prototype.hasOwnProperty.call(body, "signer");
  const signerEmpty = signerKeyPresent && normalizeWalletId(signer) === "";
  const nimiqPay = claimsPayClient && signerEmpty;

  const normAddr = normalizeWalletId(sessionAddress);
  const rawTp =
    typeof body.acceptedTermsPrivacyVersion === "string"
      ? String(body.acceptedTermsPrivacyVersion).trim()
      : "";
  const rawLegacy =
    typeof body.acceptedLegalVersion === "string"
      ? String(body.acceptedLegalVersion).trim()
      : "";
  const acceptedTermsPrivacy = rawTp || rawLegacy;
  if (!hasAcceptedCurrentTermsPrivacyDocs(normAddr)) {
    if (acceptedTermsPrivacy !== TERMS_PRIVACY_DOCS_VERSION) {
      return {
        ok: false,
        status: 403,
        body: {
          error: "terms_privacy_ack_required",
          requiredVersion: TERMS_PRIVACY_DOCS_VERSION,
        },
      };
    }
    recordTermsPrivacyAcceptance(normAddr, TERMS_PRIVACY_DOCS_VERSION);
  }

  const token = signSession(sessionAddress, jwtSecret, { nimiqPay });
  try {
    recordLoginStreakForWallet(normAddr);
    evaluateLoginStreakAchievements(normAddr);
    evaluatePlayerLevelAchievements(normAddr);
    evaluateOwnedRoomStateAchievements(normAddr);
    evaluateCosmeticsCatchUpAchievements(normAddr);
  } catch (e) {
    console.error("[login-streak]", e);
  }
  ensureDevWalletAllCosmeticEntitlements(sessionAddress);
  const usernamePrompt = getUsernamePromptStatus(normAddr);
  markWalletConnectNoticePending(normAddr, { nimiqPay });

  return {
    ok: true,
    token,
    address: sessionAddress,
    nimiqPay,
    usernamePrompt,
    tutorial: nimiqPay
      ? { needsTutorial: computeNeedsTutorial(true, normAddr) }
      : undefined,
  };
}
