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
 * Desktop Main Menu: show a plain spa URL QR and poll until the phone fulfills the ticket.
 * QR is the readable `http(s)://…/auth/qr/{ticket}` address (never percent-encoded).
 * On the phone, open that page in Nimiq Pay and sign; this PC claims the JWT.
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
        <p class="qr-pay-login-dialog__url" id="qr-pay-login-url"></p>
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
    const urlEl = overlay.querySelector("#qr-pay-login-url") as HTMLElement;
    const statusEl = overlay.querySelector("#qr-pay-login-status") as HTMLElement;
    const errEl = overlay.querySelector("#qr-pay-login-err") as HTMLElement;
    const qrHost = overlay.querySelector("#qr-pay-login-qr") as HTMLElement;
    const cancelBtn = overlay.querySelector(
      "#qr-pay-login-cancel"
    ) as HTMLButtonElement;

    // Always build from this browser origin + ticket id. Never put payDeepLink
    // (or any `url=http%3A…` deeplink) in the QR — scanners were showing percent-encoding.
    const qrText = buildQrSpaUrlPayload({
      ticketId: created.ticketId,
      origin: typeof location !== "undefined" ? location.origin : "",
      spaUrl: created.spaUrl,
    });

    titleEl.textContent = t("qrPayLogin.title");
    subtitleEl.textContent = t("qrPayLogin.desktopSubtitle");
    helpBtn.textContent = "?";
    helpBtn.setAttribute("aria-label", t("qrPayLogin.helpAria"));
    helpBtn.title = t("qrPayLogin.helpAria");
    helpEl.textContent = t("qrPayLogin.desktopHelp");
    urlEl.textContent = qrText;
    statusEl.textContent = t("qrPayLogin.waiting");
    cancelBtn.textContent = t("common.cancel");

    document.body.appendChild(overlay);
    void renderQr(qrHost, qrText);

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

/**
 * QR payload is always a plain `http(s)://…/auth/qr/{ticket}` string.
 * Prefer this page's origin + ticket id so a stale API `payDeepLink` that still
 * percent-encodes `url=http%3A…` can never reach the QR or the text under it.
 */
export function buildQrSpaUrlPayload(created: {
  ticketId?: string;
  origin?: string;
  spaUrl?: string;
  /** Ignored — kept so older call sites type-check; never encoded into the QR. */
  payDeepLink?: string;
}): string {
  const ticketId = String(created.ticketId ?? "").trim();
  const origin = String(created.origin ?? "").trim().replace(/\/$/, "");
  if (ticketId && origin && /^https?:\/\//i.test(origin)) {
    return `${origin}/auth/qr/${ticketId}`;
  }

  const spa = unwrapPlainSpaUrl(String(created.spaUrl ?? "").trim());
  if (spa) return spa;

  return unwrapPlainSpaUrl(String(created.payDeepLink ?? "").trim());
}

/** Strip `nimiqpay://miniapp?url=` and decode any percent-encoding to a bare spa URL. */
export function unwrapPlainSpaUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const m = /^nimiqpay:\/\/miniapp\?url=(.+)$/i.exec(s);
  const value = m?.[1] ?? s;
  try {
    const decoded = decodeURIComponent(value);
    // If decode produced another deeplink wrapper, peel once more.
    const m2 = /^nimiqpay:\/\/miniapp\?url=(.+)$/i.exec(decoded);
    if (m2?.[1]) {
      try {
        return decodeURIComponent(m2[1]);
      } catch {
        return m2[1];
      }
    }
    return decoded;
  } catch {
    return value;
  }
}

/** @deprecated Use {@link buildQrSpaUrlPayload}. */
export function buildUnencodedPayQrPayload(created: {
  ticketId?: string;
  origin?: string;
  spaUrl?: string;
  payDeepLink?: string;
}): string {
  return buildQrSpaUrlPayload(created);
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
