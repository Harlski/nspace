import { TERMS_PRIVACY_DOCS_VERSION } from "../termsPrivacyVersion.js";
import { showTermsPrivacyAckModal } from "../ui/termsPrivacyAckModal.js";
import type { LoginSignPayload } from "./nimiq.js";
import {
  TermsPrivacyAcknowledgementRequiredError,
  type VerifyAuthBody,
  fetchNonce,
  verifyWithServer,
  type VerifyAuthResponse,
} from "./nimiq.js";
import { persistTermsPrivacyAckLocal } from "./termsPrivacyAckLocal.js";

/** Fetch nonce → build verify body → POST; show acknowledgement modal after `terms_privacy_ack_required`. */
export async function completeAuthVerifyWithTermsPrivacyRetry(
  buildBodyForNonce: (nonce: string) => Promise<LoginSignPayload>,
  opts?: { initialAcceptedTermsPrivacy?: string }
): Promise<VerifyAuthResponse> {
  let acceptedTermsPrivacyVersion = opts?.initialAcceptedTermsPrivacy;

  for (;;) {
    const { nonce } = await fetchNonce();
    const base = await buildBodyForNonce(nonce);
    const body: VerifyAuthBody = {
      ...base,
      ...(acceptedTermsPrivacyVersion ? { acceptedTermsPrivacyVersion } : {}),
    };
    try {
      const out = await verifyWithServer(body);
      persistTermsPrivacyAckLocal();
      return out;
    } catch (e) {
      if (e instanceof TermsPrivacyAcknowledgementRequiredError) {
        await showTermsPrivacyAckModal();
        acceptedTermsPrivacyVersion = TERMS_PRIVACY_DOCS_VERSION;
        continue;
      }
      throw e;
    }
  }
}

export async function completeWalletPayloadAuthWithTermsPrivacyRetry(
  signPayloadForNonce: (nonce: string) => Promise<LoginSignPayload>,
  opts?: { initialAcceptedTermsPrivacy?: string }
): Promise<VerifyAuthResponse> {
  return completeAuthVerifyWithTermsPrivacyRetry(signPayloadForNonce, opts);
}
