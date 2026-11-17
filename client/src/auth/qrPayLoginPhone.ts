import { t } from "@nspace/i18n";
import { TERMS_PRIVACY_DOCS_VERSION } from "../termsPrivacyVersion.js";
import { showTermsPrivacyAckModal } from "../ui/termsPrivacyAckModal.js";
import {
  TermsPrivacyAcknowledgementRequiredError,
  isNimiqPayMiniApp,
  signLoginChallenge,
  type LoginSignPayload,
} from "./nimiq.js";
import { persistTermsPrivacyAckLocal } from "./termsPrivacyAckLocal.js";
import {
  completeQrPayLoginTicket,
  fetchQrPayLoginChallenge,
  previewQrPayLoginTicket,
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
    <div class="qr-pay-login-phone__backdrop" aria-hidden="true"></div>
    <div class="qr-pay-login-phone__content">
    <header class="qr-pay-login-phone__brand">
      <p class="main-menu__title qr-pay-login-phone__brand-title">
        <span class="main-menu__title-nimiq">NIMIQ</span>
        <span class="main-menu__title-space">SPACE</span>
      </p>
    </header>
    <div class="qr-pay-login-phone__card" id="qr-pay-phone-card">
      <p class="qr-pay-login-phone__eyebrow" id="qr-pay-phone-eyebrow" hidden></p>
      <div class="qr-pay-login-phone__mark" id="qr-pay-phone-mark" hidden aria-hidden="true">
        <span class="qr-pay-login-phone__mark-ring" aria-hidden="true"></span>
        <span class="qr-pay-login-phone__mark-check" aria-hidden="true"></span>
      </div>
      <h1 class="qr-pay-login-phone__title" id="qr-pay-phone-title"></h1>
      <div class="qr-pay-login-phone__account" id="qr-pay-phone-account" hidden>
        <img class="qr-pay-login-phone__ident" id="qr-pay-phone-ident" alt="" width="96" height="96" hidden />
        <div class="qr-pay-login-phone__accent" id="qr-pay-phone-accent" hidden></div>
        <p class="qr-pay-login-phone__account-label" id="qr-pay-phone-account-label"></p>
        <p class="qr-pay-login-phone__username" id="qr-pay-phone-username" hidden></p>
        <p class="qr-pay-login-phone__address" id="qr-pay-phone-address"></p>
        <p class="qr-pay-login-phone__method" id="qr-pay-phone-method"></p>
      </div>
      <p class="qr-pay-login-phone__hint" id="qr-pay-phone-hint"></p>
      <p class="qr-pay-login-phone__status" id="qr-pay-phone-status"></p>
      <p class="qr-pay-login-phone__err" id="qr-pay-phone-err" hidden></p>
      <div class="qr-pay-login-phone__actions" id="qr-pay-phone-actions" hidden>
        <button type="button" class="qr-pay-login-phone__btn qr-pay-login-phone__btn--primary" id="qr-pay-phone-sign" hidden></button>
        <button type="button" class="qr-pay-login-phone__btn qr-pay-login-phone__btn--secondary" id="qr-pay-phone-cancel" hidden></button>
        <button type="button" class="qr-pay-login-phone__btn qr-pay-login-phone__btn--secondary" id="qr-pay-phone-open-pay" hidden></button>
      </div>
    </div>
    </div>
  `;
  app.appendChild(root);

  const cardEl = root.querySelector("#qr-pay-phone-card") as HTMLElement;
  const eyebrowEl = root.querySelector("#qr-pay-phone-eyebrow") as HTMLElement;
  const markEl = root.querySelector("#qr-pay-phone-mark") as HTMLElement;
  const titleEl = root.querySelector("#qr-pay-phone-title") as HTMLElement;
  const accountEl = root.querySelector("#qr-pay-phone-account") as HTMLElement;
  const accentEl = root.querySelector("#qr-pay-phone-accent") as HTMLElement;
  const identEl = root.querySelector("#qr-pay-phone-ident") as HTMLImageElement;
  const accountLabelEl = root.querySelector(
    "#qr-pay-phone-account-label"
  ) as HTMLElement;
  const usernameEl = root.querySelector("#qr-pay-phone-username") as HTMLElement;
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
  const cancelBtn = root.querySelector("#qr-pay-phone-cancel") as HTMLButtonElement;

  document.title = t("qrPayLogin.phoneDocumentTitle");
  titleEl.textContent = t("common.loading");
  hintEl.textContent = "";
  statusEl.hidden = true;
  openPayBtn.textContent = t("qrPayLogin.openInPay");
  cancelBtn.textContent = t("qrPayLogin.confirmCancel");
  signBtn.textContent = t("qrPayLogin.confirmSignWallet");
  accountLabelEl.textContent = t("qrPayLogin.phoneAccountLabel");

  const showErr = (msg: string): void => {
    errEl.hidden = !msg;
    errEl.textContent = msg;
  };

  const setBusy = (busy: boolean): void => {
    openPayBtn.disabled = busy;
    signBtn.disabled = busy;
    cancelBtn.disabled = busy;
    openPayBtn.classList.toggle("qr-pay-login-phone__btn--busy", busy);
    signBtn.classList.toggle("qr-pay-login-phone__btn--busy", busy);
    cancelBtn.classList.toggle("qr-pay-login-phone__btn--busy", busy);
  };

  let disposed = false;
  let signing = false;
  let phase: "boot" | "authorized" | "signin" | "confirm" | "expired" = "boot";
  let acceptedTermsPrivacyVersion: string | undefined;
  let staged: (LoginSignPayload & { acceptedTermsPrivacyVersion?: string }) | null =
    null;
  let stagedReceipt: QrPhoneReceipt | null = null;
  let placeCode = "";
  const inPay = isNimiqPayMiniApp();

  const storage = (): Storage => sessionStorage;

  const paintAccount = (receipt: QrPhoneReceipt): void => {
    const formatted = formatQrLoginAccountAddress(receipt.address);
    if (!formatted) {
      accountEl.hidden = true;
      return;
    }
    accountEl.hidden = false;
    accentEl.hidden = false;
    accountLabelEl.hidden = true;
    addressEl.textContent = formatted;
    const username = receipt.username?.trim() || "";
    usernameEl.hidden = !username;
    usernameEl.textContent = username;
    methodEl.hidden = false;
    methodEl.textContent = receipt.nimiqPay
      ? t("qrPayLogin.phoneAccountPay")
      : t("qrPayLogin.phoneAccountWallet");
    identEl.hidden = true;
    identEl.removeAttribute("src");
    void import("../game/identiconTexture.js")
      .then(({ identiconDataUrl }) => identiconDataUrl(receipt.address))
      .then((url) => {
        if (disposed || (phase !== "authorized" && phase !== "confirm") || !url || !identEl.isConnected) {
          return;
        }
        identEl.src = url;
        identEl.hidden = false;
      })
      .catch(() => {
        /* Address text still identifies the account if the face fails to draw. */
      });
  };

  const usePaperCard = (): void => {
    root.classList.add("qr-pay-login-phone--paper");
    cardEl.classList.add("qr-pay-login-phone__card--paper");
    eyebrowEl.hidden = true;
    markEl.hidden = true;
    markEl.setAttribute("aria-hidden", "true");
    statusEl.hidden = true;
    statusEl.textContent = "";
  };

  const clearPaperCard = (): void => {
    root.classList.remove(
      "qr-pay-login-phone--paper",
      "qr-pay-login-phone--done",
      "qr-pay-login-phone--confirm"
    );
    cardEl.classList.remove(
      "qr-pay-login-phone__card--paper",
      "qr-pay-login-phone__card--done"
    );
  };

  const showAuthorized = (receipt: QrPhoneReceipt): void => {
    phase = "authorized";
    if (receipt.address) writeQrPhoneReceipt(storage(), ticketId, receipt);
    root.classList.remove("qr-pay-login-phone--confirm");
    root.classList.add("qr-pay-login-phone--done");
    cardEl.classList.add("qr-pay-login-phone__card--done");
    usePaperCard();
    document.title = t("qrPayLogin.phoneDocumentTitleDone");
    titleEl.textContent = t("qrPayLogin.phoneDone");
    hintEl.hidden = false;
    hintEl.textContent = t("qrPayLogin.phoneDoneHint");
    showErr("");
    actionsEl.hidden = true;
    signBtn.hidden = true;
    cancelBtn.hidden = true;
    openPayBtn.hidden = true;
    paintAccount(receipt);
  };

  const showExpired = (): void => {
    if (phase === "authorized") return;
    phase = "expired";
    clearPaperCard();
    eyebrowEl.hidden = true;
    markEl.hidden = true;
    accentEl.hidden = true;
    titleEl.textContent = t("qrPayLogin.expired");
    hintEl.textContent = "";
    statusEl.textContent = "";
    statusEl.hidden = true;
    accountEl.hidden = true;
    actionsEl.hidden = true;
    signBtn.hidden = true;
    cancelBtn.hidden = true;
    openPayBtn.hidden = true;
    showErr("");
  };

  const presentSignIn = (): void => {
    if (disposed || phase === "authorized" || phase === "expired") return;
    phase = "signin";
    staged = null;
    stagedReceipt = null;
    clearPaperCard();
    document.title = t("qrPayLogin.phoneDocumentTitle");
    titleEl.textContent = t("qrPayLogin.phoneTitle");
    accountEl.hidden = true;
    accentEl.hidden = true;
    eyebrowEl.hidden = true;
    markEl.hidden = true;
    actionsEl.hidden = false;
    signBtn.className = "qr-pay-login-phone__btn qr-pay-login-phone__btn--primary";
    cancelBtn.className = "qr-pay-login-phone__btn qr-pay-login-phone__btn--secondary";
    signBtn.hidden = false;
    cancelBtn.hidden = true;
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

  const rememberPlaceCode = (code: unknown): void => {
    if (typeof code !== "string") return;
    const next = code.trim().toUpperCase();
    if (next) placeCode = next;
  };

  /** White card after the wallet has signed, before the other computer receives the session. */
  const showConfirm = (receipt: QrPhoneReceipt): void => {
    if (disposed || phase === "authorized" || phase === "expired") return;
    phase = "confirm";
    root.classList.add("qr-pay-login-phone--confirm");
    usePaperCard();
    const title = placeCode
      ? t("qrPayLogin.confirmTitleOn", { code: placeCode })
      : t("qrPayLogin.confirmTitle");
    document.title = title;
    titleEl.textContent = title;
    hintEl.hidden = true;
    hintEl.textContent = "";
    showErr("");
    actionsEl.hidden = false;
    signBtn.hidden = false;
    signBtn.className = "nq-button light-blue qr-pay-login-phone__nq";
    signBtn.textContent = t("qrPayLogin.confirmApprove");
    cancelBtn.hidden = false;
    cancelBtn.className = "nq-button-s qr-pay-login-phone__nq";
    cancelBtn.textContent = t("qrPayLogin.confirmCancel");
    openPayBtn.hidden = true;
    paintAccount(receipt);
    methodEl.hidden = true;
  };

  const applyChallengeView = async (): Promise<void> => {
    const stored = readQrPhoneReceipt(storage(), ticketId);
    if (stored && phase === "boot") showAuthorized(stored);
    const challenge = await fetchQrPayLoginChallenge(ticketId);
    if (disposed) return;
    rememberPlaceCode("placeCode" in challenge ? challenge.placeCode : "");
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
    clearPaperCard();
    presentSignIn();
  };

  const failSign = async (e: unknown, keepConfirm: boolean): Promise<void> => {
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
    if (!keepConfirm || phase !== "confirm") presentSignIn();
  };

  /** Wallet signature and account lookup. The other computer stays signed out. */
  const beginSign = async (): Promise<void> => {
    if (
      disposed ||
      signing ||
      phase === "authorized" ||
      phase === "expired" ||
      phase === "confirm"
    ) {
      return;
    }
    signing = true;
    showErr("");
    setBusy(true);
    statusEl.hidden = false;
    statusEl.classList.remove("qr-pay-login-phone__status--done");
    statusEl.textContent = t("qrPayLogin.signing");
    try {
      const challenge = await fetchQrPayLoginChallenge(ticketId);
      if (disposed) return;
      rememberPlaceCode("placeCode" in challenge ? challenge.placeCode : "");
      const decision = phoneViewFromChallenge(
        challenge,
        readQrPhoneReceipt(storage(), ticketId)
      );
      if (decision.view === "authorized") {
        showAuthorized(decision.receipt);
        return;
      }
      if (decision.view === "expired" || challenge.status !== "pending") {
        showExpired();
        return;
      }
      const payload = await signLoginChallenge(challenge.nonce, "nspace");
      if (disposed) return;
      const preview = await previewQrPayLoginTicket(ticketId, payload);
      if (disposed) return;
      const username = preview.username?.trim() || "";
      staged = {
        ...payload,
        ...(acceptedTermsPrivacyVersion ? { acceptedTermsPrivacyVersion } : {}),
      };
      stagedReceipt = {
        address: preview.address,
        nimiqPay: preview.nimiqPay === true,
        ...(username ? { username } : {}),
      };
      showConfirm(stagedReceipt);
    } catch (e) {
      await failSign(e, false);
    } finally {
      signing = false;
      if (!disposed) setBusy(false);
    }
  };

  /** User confirmed this account. Only now does the other computer receive a session. */
  const finishSign = async (): Promise<void> => {
    if (disposed || !staged || phase !== "confirm") return;
    showErr("");
    setBusy(true);
    try {
      for (;;) {
        const payload = staged;
        if (!payload) return;
        try {
          const done = await completeQrPayLoginTicket(ticketId, payload);
          persistTermsPrivacyAckLocal();
          const username = stagedReceipt?.username?.trim() || "";
          staged = null;
          stagedReceipt = null;
          showAuthorized({
            address: done.address,
            nimiqPay: done.nimiqPay === true,
            ...(username ? { username } : {}),
          });
          return;
        } catch (e) {
          if (e instanceof TermsPrivacyAcknowledgementRequiredError) {
            await showTermsPrivacyAckModal();
            acceptedTermsPrivacyVersion = TERMS_PRIVACY_DOCS_VERSION;
            staged = { ...payload, acceptedTermsPrivacyVersion };
            continue;
          }
          throw e;
        }
      }
    } catch (e) {
      await failSign(e, true);
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
    if (phase === "confirm") {
      void finishSign();
      return;
    }
    void beginSign();
  });
  cancelBtn.addEventListener("click", () => {
    presentSignIn();
  });

  void applyChallengeView().catch(() => {
    if (disposed || phase === "authorized") return;
    presentSignIn();
  });

  return () => {
    disposed = true;
    root.remove();
  };
}
