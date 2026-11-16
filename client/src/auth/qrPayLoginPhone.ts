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
import {
  phoneViewFromChallenge,
  readQrPhoneReceipt,
  writeQrPhoneReceipt,
  formatQrLoginAccountAddress,
  type QrPhoneReceipt,
} from "./qrPayLoginPhoneState.js";

/**
 * Phone /auth/qr/:ticket page: open in Nimiq Pay, sign Login:v1, fulfill desktop ticket.
 * Does not enter the game on this device (cafe flow: desktop claims the JWT).
 * After authorization, stays on an account confirmation — including after a reload.
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
      <p class="qr-pay-login-phone__eyebrow" id="qr-pay-phone-eyebrow" hidden></p>
      <div class="qr-pay-login-phone__mark" id="qr-pay-phone-mark" hidden aria-hidden="true">
        <span class="qr-pay-login-phone__mark-ring" aria-hidden="true"></span>
        <span class="qr-pay-login-phone__mark-check" aria-hidden="true"></span>
      </div>
      <h1 class="qr-pay-login-phone__title" id="qr-pay-phone-title"></h1>
      <div class="qr-pay-login-phone__account" id="qr-pay-phone-account" hidden>
        <img class="qr-pay-login-phone__ident" id="qr-pay-phone-ident" alt="" width="72" height="72" hidden />
        <p class="qr-pay-login-phone__account-label" id="qr-pay-phone-account-label"></p>
        <p class="qr-pay-login-phone__address" id="qr-pay-phone-address"></p>
        <p class="qr-pay-login-phone__method" id="qr-pay-phone-method"></p>
      </div>
      <p class="qr-pay-login-phone__hint" id="qr-pay-phone-hint"></p>
      <p class="qr-pay-login-phone__status" id="qr-pay-phone-status"></p>
      <p class="qr-pay-login-phone__err" id="qr-pay-phone-err" hidden></p>
      <div class="qr-pay-login-phone__actions" id="qr-pay-phone-actions" hidden>
        <button type="button" class="qr-pay-login-phone__btn qr-pay-login-phone__btn--primary" id="qr-pay-phone-sign" hidden></button>
        <button type="button" class="qr-pay-login-phone__btn qr-pay-login-phone__btn--secondary" id="qr-pay-phone-open-pay" hidden></button>
      </div>
    </div>
  `;
  app.appendChild(root);

  const cardEl = root.querySelector("#qr-pay-phone-card") as HTMLElement;
  const eyebrowEl = root.querySelector("#qr-pay-phone-eyebrow") as HTMLElement;
  const markEl = root.querySelector("#qr-pay-phone-mark") as HTMLElement;
  const titleEl = root.querySelector("#qr-pay-phone-title") as HTMLElement;
  const accountEl = root.querySelector("#qr-pay-phone-account") as HTMLElement;
  const identEl = root.querySelector("#qr-pay-phone-ident") as HTMLImageElement;
  const accountLabelEl = root.querySelector(
    "#qr-pay-phone-account-label"
  ) as HTMLElement;
  const addressEl = root.querySelector("#qr-pay-phone-address") as HTMLElement;
  const methodEl = root.querySelector("#qr-pay-phone-method") as HTMLElement;
  const hintEl = root.querySelector("#qr-pay-phone-hint") as HTMLElement;
  const statusEl = root.querySelector("#qr-pay-phone-status") as HTMLElement;
  const errEl = root.querySelector("#qr-pay-phone-err") as HTMLElement;
  const actionsEl = root.querySelector("#qr-pay-phone-actions") as HTMLElement;
  const openPayBtn = root.querySelector(
    "#qr-pay-phone-open-pay"
  ) as HTMLButtonElement;
  const signBtn = root.querySelector("#qr-pay-phone-sign") as HTMLButtonElement;

  document.title = t("qrPayLogin.phoneDocumentTitle");
  titleEl.textContent = t("common.loading");
  hintEl.textContent = "";
  statusEl.hidden = true;
  openPayBtn.textContent = t("qrPayLogin.openInPay");
  signBtn.textContent = t("qrPayLogin.confirmSignWallet");
  accountLabelEl.textContent = t("qrPayLogin.phoneAccountLabel");

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

  let disposed = false;
  let phase: "boot" | "authorized" | "signin" | "expired" = "boot";
  let acceptedTermsPrivacyVersion: string | undefined;
  const inPay = isNimiqPayMiniApp();

  const storage = (): Storage => sessionStorage;

  const showAuthorized = (receipt: QrPhoneReceipt): void => {
    phase = "authorized";
    if (receipt.address) writeQrPhoneReceipt(storage(), ticketId, receipt);
    root.classList.add("qr-pay-login-phone--done");
    cardEl.classList.add("qr-pay-login-phone__card--done");
    document.title = t("qrPayLogin.phoneDocumentTitleDone");
    eyebrowEl.hidden = false;
    eyebrowEl.textContent = t("qrPayLogin.phoneDoneEyebrow");
    markEl.hidden = false;
    markEl.setAttribute("aria-hidden", "false");
    titleEl.textContent = t("qrPayLogin.phoneDone");
    hintEl.hidden = false;
    hintEl.textContent = t("qrPayLogin.phoneDoneHint");
    statusEl.hidden = false;
    statusEl.classList.add("qr-pay-login-phone__status--done");
    statusEl.textContent = t("qrPayLogin.phoneDoneStatus");
    showErr("");
    actionsEl.hidden = true;
    signBtn.hidden = true;
    openPayBtn.hidden = true;
    const formatted = formatQrLoginAccountAddress(receipt.address);
    if (formatted) {
      accountEl.hidden = false;
      addressEl.textContent = formatted;
      methodEl.textContent = receipt.nimiqPay
        ? t("qrPayLogin.phoneAccountPay")
        : t("qrPayLogin.phoneAccountWallet");
      identEl.hidden = true;
      identEl.removeAttribute("src");
      void import("../game/identiconTexture.js")
        .then(({ identiconDataUrl }) => identiconDataUrl(receipt.address))
        .then((url) => {
          if (disposed || phase !== "authorized" || !url || !identEl.isConnected) return;
          identEl.src = url;
          identEl.hidden = false;
        })
        .catch(() => {
          /* Address text still identifies the account if the face fails to draw. */
        });
    } else {
      accountEl.hidden = true;
    }
  };

  const showExpired = (): void => {
    if (phase === "authorized") return;
    phase = "expired";
    root.classList.remove("qr-pay-login-phone--done");
    cardEl.classList.remove("qr-pay-login-phone__card--done");
    eyebrowEl.hidden = true;
    markEl.hidden = true;
    titleEl.textContent = t("qrPayLogin.expired");
    hintEl.textContent = "";
    statusEl.textContent = "";
    statusEl.hidden = true;
    accountEl.hidden = true;
    actionsEl.hidden = true;
    signBtn.hidden = true;
    openPayBtn.hidden = true;
    showErr("");
  };

  const presentSignIn = (): void => {
    if (disposed || phase === "authorized" || phase === "expired") return;
    phase = "signin";
    document.title = t("qrPayLogin.phoneDocumentTitle");
    titleEl.textContent = t("qrPayLogin.phoneTitle");
    accountEl.hidden = true;
    eyebrowEl.hidden = true;
    markEl.hidden = true;
    actionsEl.hidden = false;
    signBtn.hidden = false;
    if (inPay) {
      hintEl.textContent = t("qrPayLogin.phoneHintInPay");
      statusEl.hidden = false;
      statusEl.classList.remove("qr-pay-login-phone__status--done");
      statusEl.textContent = t("qrPayLogin.phoneReady");
      signBtn.textContent = t("qrPayLogin.confirmSign");
      openPayBtn.hidden = true;
    } else {
      hintEl.textContent = t("qrPayLogin.phoneHintWallet");
      statusEl.textContent = "";
      statusEl.hidden = true;
      signBtn.textContent = t("qrPayLogin.confirmSignWallet");
      openPayBtn.hidden = false;
    }
  };

  const applyChallengeView = async (): Promise<void> => {
    const stored = readQrPhoneReceipt(storage(), ticketId);
    if (stored && phase === "boot") showAuthorized(stored);
    const challenge = await fetchQrPayLoginChallenge(ticketId);
    if (disposed) return;
    const decision = phoneViewFromChallenge(
      challenge,
      readQrPhoneReceipt(storage(), ticketId)
    );
    if (decision.view === "authorized") {
      showAuthorized(decision.receipt);
      return;
    }
    if (decision.view === "expired") {
      if (phase === "authorized") phase = "boot";
      showExpired();
      return;
    }
    phase = "boot";
    root.classList.remove("qr-pay-login-phone--done");
    cardEl.classList.remove("qr-pay-login-phone__card--done");
    presentSignIn();
  };

  const runSign = async (): Promise<void> => {
    if (disposed || phase === "authorized" || phase === "expired") return;
    showErr("");
    setBusy(true);
    statusEl.hidden = false;
    statusEl.classList.remove("qr-pay-login-phone__status--done");
    statusEl.textContent = t("qrPayLogin.signing");
    try {
      for (;;) {
        const challenge = await fetchQrPayLoginChallenge(ticketId);
        if (disposed) return;
        const decision = phoneViewFromChallenge(
          challenge,
          readQrPhoneReceipt(storage(), ticketId)
        );
        if (decision.view === "authorized") {
          showAuthorized(decision.receipt);
          return;
        }
        if (decision.view === "expired") {
          showExpired();
          return;
        }
        if (challenge.status !== "pending") {
          showExpired();
          return;
        }
        const payload = await signLoginChallenge(challenge.nonce, "nspace");
        if (disposed) return;
        try {
          const done = await completeQrPayLoginTicket(ticketId, {
            ...payload,
            ...(acceptedTermsPrivacyVersion
              ? { acceptedTermsPrivacyVersion }
              : {}),
          });
          persistTermsPrivacyAckLocal();
          showAuthorized({
            address: done.address,
            nimiqPay: done.nimiqPay === true,
          });
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
      if (disposed || phase === "authorized") return;
      const code = e instanceof Error ? e.message : "qr_login_complete_failed";
      if (code === "already_fulfilled") {
        try {
          await applyChallengeView();
        } catch {
          const stored = readQrPhoneReceipt(storage(), ticketId);
          if (stored) showAuthorized(stored);
        }
        if (phase === "authorized") return;
      }
      statusEl.textContent = "";
      if (code === "qr_login_expired") {
        const stored = readQrPhoneReceipt(storage(), ticketId);
        if (stored) {
          showAuthorized(stored);
          return;
        }
        showExpired();
        return;
      }
      if (code === "qr_login_cancelled" || /cancel/i.test(code)) {
        showErr(t("qrPayLogin.cancelled"));
      } else {
        showErr(t("qrPayLogin.signFailed"));
      }
      presentSignIn();
    } finally {
      if (!disposed) setBusy(false);
    }
  };

  if (!inPay) {
    const spaUrl = `${location.origin}/auth/qr/${ticketId}`;
    openPayBtn.addEventListener("click", () => {
      /** Plain spa URL after url= (no percent-encoding). */
      location.assign(`nimiqpay://miniapp?url=${spaUrl}`);
    });
  }

  signBtn.addEventListener("click", () => {
    void runSign();
  });

  void applyChallengeView()
    .then(() => {
      if (disposed || phase !== "signin" || !inPay) return;
      void runSign();
    })
    .catch(() => {
      if (disposed || phase === "authorized") return;
      presentSignIn();
      if (inPay) void runSign();
    });

  return () => {
    disposed = true;
    root.remove();
  };
}
