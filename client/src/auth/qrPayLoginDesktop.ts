import { t } from "@nspace/i18n";
import type { UsernamePromptStatus } from "./nimiq.js";
import {
  createQrPayLoginTicket,
  pollQrPayLoginTicket,
  type QrPayLoginCreated,
} from "./qrPayLoginApi.js";

export type QrPayLoginDesktopResult = {
  token: string;
  address: string;
  nimiqPay?: boolean;
  usernamePrompt?: UsernamePromptStatus;
  needsTutorial?: boolean;
};

const POLL_MS = 1500;

/**
 * Desktop Main Menu: show a Nimiq Pay deeplink QR and poll until the phone fulfills the ticket.
 * Camera scan opens Pay; user signs there; this PC claims the JWT (keys never leave the phone).
 */
export async function runQrPayLoginDesktop(): Promise<QrPayLoginDesktopResult> {
  const created = await createQrPayLoginTicket();
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let cancelled = false;
    let helpOpen = false;

    const overlay = document.createElement("div");
    overlay.className = "qr-pay-login-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "qr-pay-login-title");

    overlay.innerHTML = `
      <div class="qr-pay-login-dialog">
        <div class="qr-pay-login-dialog__header">
          <h2 class="qr-pay-login-dialog__title" id="qr-pay-login-title"></h2>
          <button type="button" class="qr-pay-login-dialog__help-btn" id="qr-pay-login-help-btn" aria-expanded="false" aria-controls="qr-pay-login-help"></button>
        </div>
        <p class="qr-pay-login-dialog__subtitle" id="qr-pay-login-subtitle"></p>
        <div class="qr-pay-login-dialog__help" id="qr-pay-login-help" hidden></div>
        <div class="qr-pay-login-dialog__qr" id="qr-pay-login-qr" aria-hidden="true"></div>
        <p class="qr-pay-login-dialog__status" id="qr-pay-login-status"></p>
        <p class="qr-pay-login-dialog__err" id="qr-pay-login-err" hidden></p>
        <button type="button" class="qr-pay-login-dialog__cancel" id="qr-pay-login-cancel"></button>
      </div>
    `;

    const titleEl = overlay.querySelector("#qr-pay-login-title") as HTMLElement;
    const subtitleEl = overlay.querySelector(
      "#qr-pay-login-subtitle"
    ) as HTMLElement;
    const helpBtn = overlay.querySelector(
      "#qr-pay-login-help-btn"
    ) as HTMLButtonElement;
    const helpEl = overlay.querySelector("#qr-pay-login-help") as HTMLElement;
    const statusEl = overlay.querySelector("#qr-pay-login-status") as HTMLElement;
    const errEl = overlay.querySelector("#qr-pay-login-err") as HTMLElement;
    const qrHost = overlay.querySelector("#qr-pay-login-qr") as HTMLElement;
    const cancelBtn = overlay.querySelector(
      "#qr-pay-login-cancel"
    ) as HTMLButtonElement;

    titleEl.textContent = t("qrPayLogin.title");
    subtitleEl.textContent = t("qrPayLogin.desktopSubtitle");
    helpBtn.textContent = "?";
    helpBtn.setAttribute("aria-label", t("qrPayLogin.helpAria"));
    helpBtn.title = t("qrPayLogin.helpAria");
    helpEl.textContent = t("qrPayLogin.desktopHelp");
    statusEl.textContent = t("qrPayLogin.waiting");
    cancelBtn.textContent = t("common.cancel");

    document.body.appendChild(overlay);
    /** Prefer Pay deeplink so the phone camera opens Nimiq Pay, not a bare browser tab. */
    void renderQr(qrHost, created.payDeepLink || created.spaUrl);

    const setHelpOpen = (open: boolean): void => {
      helpOpen = open;
      helpEl.hidden = !open;
      helpBtn.setAttribute("aria-expanded", open ? "true" : "false");
      helpBtn.classList.toggle("qr-pay-login-dialog__help-btn--open", open);
    };

    helpBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      setHelpOpen(!helpOpen);
    });

    const cleanup = (): void => {
      cancelled = true;
      if (pollTimer != null) window.clearTimeout(pollTimer);
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown, true);
    };

    const fail = (err: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const succeed = (result: QrPayLoginDesktopResult): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const showErr = (msg: string): void => {
      errEl.hidden = !msg;
      errEl.textContent = msg;
    };

    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        fail(new Error("qr_login_cancelled"));
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    cancelBtn.addEventListener("click", () => fail(new Error("qr_login_cancelled")));

    const schedulePoll = (): void => {
      if (cancelled) return;
      pollTimer = window.setTimeout(() => {
        void doPoll();
      }, POLL_MS);
    };

    const doPoll = async (): Promise<void> => {
      if (cancelled || settled) return;
      try {
        const result = await pollQrPayLoginTicket(
          created.ticketId,
          created.claimSecret
        );
        if (result.status === "pending") {
          if (result.expiresAt <= Date.now()) {
            fail(new Error("qr_login_expired"));
            return;
          }
          statusEl.textContent = t("qrPayLogin.waiting");
          schedulePoll();
          return;
        }
        if (result.status === "expired") {
          fail(new Error("qr_login_expired"));
          return;
        }
        succeed({
          token: result.token,
          address: result.address,
          nimiqPay: result.nimiqPay,
          usernamePrompt: result.usernamePrompt,
          needsTutorial: result.tutorial?.needsTutorial,
        });
      } catch (e) {
        showErr(e instanceof Error ? e.message : t("common.error"));
        schedulePoll();
      }
    };

    schedulePoll();
  });
}

async function renderQr(host: HTMLElement, url: string): Promise<void> {
  host.replaceChildren();
  if (!url) return;
  try {
    const { default: QrCreator } = await import("qr-creator");
    QrCreator.render(
      {
        text: url,
        radius: 0.35,
        ecLevel: "M",
        fill: "#111",
        background: "#fff",
        size: 200,
      },
      host
    );
  } catch {
    const fallback = document.createElement("p");
    fallback.className = "qr-pay-login-dialog__qr-fallback";
    fallback.textContent = url;
    host.appendChild(fallback);
  }
}

/** Exported for tests / typing of created ticket shape. */
export type { QrPayLoginCreated };
