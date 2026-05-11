import { TERMS_PRIVACY_DOCS_VERSION } from "../termsPrivacyVersion.js";

/** Skip the first-login checkbox once this document version was acknowledged locally. */
export const TERMS_PRIVACY_ACK_STORAGE_KEY = `nspace_terms_privacy_ack_${TERMS_PRIVACY_DOCS_VERSION}`;

export function hasTermsPrivacyAckCachedLocally(): boolean {
  try {
    return localStorage.getItem(TERMS_PRIVACY_ACK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistTermsPrivacyAckLocal(): void {
  try {
    localStorage.setItem(TERMS_PRIVACY_ACK_STORAGE_KEY, "1");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("nspace_legal_bundle_")) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
