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
 * Desktop Main Menu: show QR (HTTPS SPA URL) and poll until the phone fulfills the ticket.
 */
export async function runQrPayLoginDesktop(): Promise<QrPayLoginDesktopResult> {
  const created = await createQrPayLoginTicket();
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let cancelled = false;

    const overlay = document.createElement("div");
    overlay.className = "qr-pay-login-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "qr-pay-login-title");

    overlay.innerHTML = `
      <div class="qr-pay-login-dialog">
        <h2 class="qr-pay-login-dialog__title" id="qr-pay-login-title"></h2>
        <p class="qr-pay-login-dialog__hint" id="qr-pay-login-hint"></p>
        <div class="qr-pay-login-dialog__qr" id="qr-pay-login-qr" aria-hidden="true"></div>
        <p class="qr-pay-login-dialog__status" id="qr-pay-login-status"></p>
        <p class="qr-pay-login-dialog__err" id="qr-pay-login-err" hidden></p>
        <div class="qr-pay-login-dialog__actions">
          <button type="button" class="nq-button light-blue qr-pay-login-dialog__cancel" id="qr-pay-login-cancel"></button>
        </div>
      </div>
    `;

    const titleEl = overlay.querySelector("#qr-pay-login-title") as HTMLElement;
    const hintEl = overlay.querySelector("#qr-pay-login-hint") as HTMLElement;
    const statusEl = overlay.querySelector("#qr-pay-login-status") as HTMLElement;
    const errEl = overlay.querySelector("#qr-pay-login-err") as HTMLElement;
    const qrHost = overlay.querySelector("#qr-pay-login-qr") as HTMLElement;
    const cancelBtn = overlay.querySelector(
      "#qr-pay-login-cancel"
    ) as HTMLButtonElement;

    titleEl.textContent = t("qrPayLogin.title");
    hintEl.textContent = t("qrPayLogin.desktopHint");
    statusEl.textContent = t("qrPayLogin.waiting");
    cancelBtn.textContent = t("common.cancel");

    document.body.appendChild(overlay);
    void renderQr(qrHost, created.spaUrl);

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
        radius: 0.4,
        ecLevel: "M",
        fill: "#111",
        background: "#fff",
        size: 180,
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
