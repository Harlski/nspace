import { t } from "@nspace/i18n";
import { TERMS_PRIVACY_DOCS_VERSION } from "../termsPrivacyVersion.js";
import { showTermsPrivacyAckModal } from "../ui/termsPrivacyAckModal.js";
import {
  TermsPrivacyAcknowledgementRequiredError,
  isNimiqPayMiniApp,
  signLoginChallenge,
} from "./nimiq.js";
import { persistTermsPrivacyAckLocal } from "./termsPrivacyAckLocal.js";
import {
  completeQrPayLoginTicket,
  fetchQrPayLoginChallenge,
} from "./qrPayLoginApi.js";

/**
 * Phone /auth/qr/:ticket page: open in Nimiq Pay, sign Login:v1, fulfill desktop ticket.
 * Does not enter the game on this device (cafe flow: desktop claims the JWT).
 */
export function mountQrPayLoginPhonePage(
  app: HTMLElement,
  ticketId: string
): () => void {
  app.innerHTML = "";
  const root = document.createElement("div");
  root.className = "qr-pay-login-phone";
  root.innerHTML = `
    <div class="qr-pay-login-phone__card" id="qr-pay-phone-card">
      <div class="qr-pay-login-phone__mark" id="qr-pay-phone-mark" hidden aria-hidden="true">
        <span class="qr-pay-login-phone__mark-check"></span>
      </div>
      <h1 class="qr-pay-login-phone__title" id="qr-pay-phone-title"></h1>
      <p class="qr-pay-login-phone__hint" id="qr-pay-phone-hint"></p>
      <p class="qr-pay-login-phone__status" id="qr-pay-phone-status"></p>
      <p class="qr-pay-login-phone__err" id="qr-pay-phone-err" hidden></p>
      <div class="qr-pay-login-phone__actions" id="qr-pay-phone-actions">
        <button type="button" class="qr-pay-login-phone__btn qr-pay-login-phone__btn--primary" id="qr-pay-phone-open-pay" hidden></button>
        <button type="button" class="qr-pay-login-phone__btn qr-pay-login-phone__btn--primary" id="qr-pay-phone-sign" hidden></button>
      </div>
    </div>
  `;
  app.appendChild(root);

  const cardEl = root.querySelector("#qr-pay-phone-card") as HTMLElement;
  const markEl = root.querySelector("#qr-pay-phone-mark") as HTMLElement;
  const titleEl = root.querySelector("#qr-pay-phone-title") as HTMLElement;
  const hintEl = root.querySelector("#qr-pay-phone-hint") as HTMLElement;
  const statusEl = root.querySelector("#qr-pay-phone-status") as HTMLElement;
  const errEl = root.querySelector("#qr-pay-phone-err") as HTMLElement;
  const actionsEl = root.querySelector("#qr-pay-phone-actions") as HTMLElement;
  const openPayBtn = root.querySelector(
    "#qr-pay-phone-open-pay"
  ) as HTMLButtonElement;
  const signBtn = root.querySelector("#qr-pay-phone-sign") as HTMLButtonElement;

  titleEl.textContent = t("qrPayLogin.phoneTitle");
  openPayBtn.textContent = t("qrPayLogin.openInPay");
  signBtn.textContent = t("qrPayLogin.confirmSign");

  const showErr = (msg: string): void => {
    errEl.hidden = !msg;
    errEl.textContent = msg;
  };

  const setBusy = (busy: boolean): void => {
    openPayBtn.disabled = busy;
    signBtn.disabled = busy;
    openPayBtn.classList.toggle("qr-pay-login-phone__btn--busy", busy);
    signBtn.classList.toggle("qr-pay-login-phone__btn--busy", busy);
  };

  const showSignedIn = (): void => {
    cardEl.classList.add("qr-pay-login-phone__card--done");
    markEl.hidden = false;
    markEl.setAttribute("aria-hidden", "false");
    titleEl.textContent = t("qrPayLogin.phoneDone");
    hintEl.textContent = t("qrPayLogin.phoneDoneHint");
    statusEl.textContent = t("qrPayLogin.phoneDoneStatus");
    statusEl.hidden = false;
    showErr("");
    actionsEl.hidden = true;
    signBtn.hidden = true;
    openPayBtn.hidden = true;
  };

  let disposed = false;
  let acceptedTermsPrivacyVersion: string | undefined;

  const runSign = async (): Promise<void> => {
    if (disposed) return;
    showErr("");
    setBusy(true);
    statusEl.hidden = false;
    statusEl.textContent = t("qrPayLogin.signing");
    try {
      for (;;) {
        const challenge = await fetchQrPayLoginChallenge(ticketId);
        if (challenge.status === "expired") {
          throw new Error("qr_login_expired");
        }
        if (challenge.status === "fulfilled") {
          showSignedIn();
          return;
        }
        const payload = await signLoginChallenge(challenge.nonce, "nspace");
        try {
          await completeQrPayLoginTicket(ticketId, {
            ...payload,
            ...(acceptedTermsPrivacyVersion
              ? { acceptedTermsPrivacyVersion }
              : {}),
          });
          persistTermsPrivacyAckLocal();
          showSignedIn();
          return;
        } catch (e) {
          if (e instanceof TermsPrivacyAcknowledgementRequiredError) {
            await showTermsPrivacyAckModal();
            acceptedTermsPrivacyVersion = TERMS_PRIVACY_DOCS_VERSION;
            continue;
          }
          throw e;
        }
      }
    } catch (e) {
      const code = e instanceof Error ? e.message : "qr_login_complete_failed";
      statusEl.textContent = "";
      if (code === "qr_login_expired") {
        showErr(t("qrPayLogin.expired"));
      } else if (code === "qr_login_cancelled" || /cancel/i.test(code)) {
        showErr(t("qrPayLogin.cancelled"));
      } else {
        showErr(t("qrPayLogin.signFailed"));
      }
      actionsEl.hidden = false;
      signBtn.hidden = false;
    } finally {
      if (!disposed) setBusy(false);
    }
  };

  const inPay = isNimiqPayMiniApp();
  if (inPay) {
    hintEl.textContent = t("qrPayLogin.phoneHintInPay");
    statusEl.textContent = t("qrPayLogin.phoneReady");
    signBtn.hidden = false;
    void runSign();
  } else {
    hintEl.textContent = t("qrPayLogin.phoneHintOpenPay");
    statusEl.textContent = "";
    statusEl.hidden = true;
    openPayBtn.hidden = false;
    signBtn.hidden = true;
    const spaUrl = `${location.origin}/auth/qr/${ticketId}`;
    openPayBtn.addEventListener("click", () => {
      /** Plain spa URL after url= (match desktop QR; no percent-encoding). */
      location.assign(`nimiqpay://miniapp?url=${spaUrl}`);
    });
  }

  signBtn.addEventListener("click", () => {
    void runSign();
  });

  return () => {
    disposed = true;
    root.remove();
  };
}
