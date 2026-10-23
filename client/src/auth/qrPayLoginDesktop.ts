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

/** Which wallet app the desktop QR should open on the phone. */
export type QrLoginClientMode = "pay" | "wallet";

const POLL_MS = 1500;

/**
 * Desktop Main Menu: QR login with Pay vs Wallet mode, poll until phone fulfills.
 * Pay QR uses an unencoded `nimiqpay://miniapp?url=…` deeplink. Wallet QR is the
 * plain spa URL so the phone browser can sign via Nimiq Hub / Wallet.
 */
export async function runQrPayLoginDesktop(): Promise<QrPayLoginDesktopResult> {
  const created = await createQrPayLoginTicket();
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let cancelled = false;
    let helpOpen = false;
    let mode: QrLoginClientMode = "pay";

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
        <div class="qr-pay-login-dialog__mode" id="qr-pay-login-mode" role="tablist" aria-label=""></div>
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
    const modeEl = overlay.querySelector("#qr-pay-login-mode") as HTMLElement;
    const urlEl = overlay.querySelector("#qr-pay-login-url") as HTMLElement;
    const statusEl = overlay.querySelector("#qr-pay-login-status") as HTMLElement;
    const errEl = overlay.querySelector("#qr-pay-login-err") as HTMLElement;
    const qrHost = overlay.querySelector("#qr-pay-login-qr") as HTMLElement;
    const cancelBtn = overlay.querySelector(
      "#qr-pay-login-cancel"
    ) as HTMLButtonElement;

    const spaBase = {
      ticketId: created.ticketId,
      origin: typeof location !== "undefined" ? location.origin : "",
      spaUrl: created.spaUrl,
    };

    modeEl.setAttribute("aria-label", t("qrPayLogin.modeAria"));
    modeEl.innerHTML = `
      <button type="button" class="qr-pay-login-dialog__mode-btn" role="tab" id="qr-pay-mode-pay" data-mode="pay" aria-selected="true"></button>
      <button type="button" class="qr-pay-login-dialog__mode-btn" role="tab" id="qr-pay-mode-wallet" data-mode="wallet" aria-selected="false"></button>
    `;
    const payTab = modeEl.querySelector("#qr-pay-mode-pay") as HTMLButtonElement;
    const walletTab = modeEl.querySelector(
      "#qr-pay-mode-wallet"
    ) as HTMLButtonElement;
    payTab.textContent = t("qrPayLogin.modePay");
    walletTab.textContent = t("qrPayLogin.modeWallet");

    const applyModeUi = (): void => {
      const qrText = buildQrLoginPayload(mode, spaBase);
      payTab.setAttribute("aria-selected", mode === "pay" ? "true" : "false");
      walletTab.setAttribute(
        "aria-selected",
        mode === "wallet" ? "true" : "false"
      );
      payTab.classList.toggle("qr-pay-login-dialog__mode-btn--active", mode === "pay");
      walletTab.classList.toggle(
        "qr-pay-login-dialog__mode-btn--active",
        mode === "wallet"
      );
      subtitleEl.textContent =
        mode === "pay"
          ? t("qrPayLogin.desktopSubtitlePay")
          : t("qrPayLogin.desktopSubtitleWallet");
      helpEl.textContent =
        mode === "pay"
          ? t("qrPayLogin.desktopHelpPay")
          : t("qrPayLogin.desktopHelpWallet");
      urlEl.textContent = qrText;
      void renderQr(qrHost, qrText);
    };

    titleEl.textContent = t("qrPayLogin.title");
    helpBtn.textContent = "?";
    helpBtn.setAttribute("aria-label", t("qrPayLogin.helpAria"));
    helpBtn.title = t("qrPayLogin.helpAria");
    statusEl.textContent = t("qrPayLogin.waiting");
    cancelBtn.textContent = t("common.cancel");
    applyModeUi();

    document.body.appendChild(overlay);

    const setMode = (next: QrLoginClientMode): void => {
      if (mode === next) return;
      mode = next;
      applyModeUi();
    };

    payTab.addEventListener("click", () => setMode("pay"));
    walletTab.addEventListener("click", () => setMode("wallet"));

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

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

/**
 * Prefer the page origin when it is already a LAN/public host. On localhost /
 * loopback in dev, use the server `spaUrl` origin (LAN IP + Vite port) so a
 * phone can open the QR. Matches Play Space share-link behavior.
 */
export function resolveQrSpaOrigin(created: {
  origin?: string;
  spaUrl?: string;
}): string {
  const pageOrigin = String(created.origin ?? "").trim().replace(/\/$/, "");
  let serverOrigin = "";
  const spa = String(created.spaUrl ?? "").trim();
  if (spa) {
    try {
      serverOrigin = new URL(spa).origin;
    } catch {
      /* ignore invalid spaUrl */
    }
  }

  if (pageOrigin && /^https?:\/\//i.test(pageOrigin)) {
    try {
      const host = new URL(pageOrigin).hostname;
      if (isLoopbackHostname(host) && serverOrigin) return serverOrigin;
      return pageOrigin;
    } catch {
      return pageOrigin;
    }
  }
  return serverOrigin || pageOrigin;
}

/**
 * Plain spa sign-in URL (no deeplink wrapper). Uses LAN IP in local dev when
 * the desktop page is opened via localhost.
 */
export function buildQrSpaUrlPayload(created: {
  ticketId?: string;
  origin?: string;
  spaUrl?: string;
  payDeepLink?: string;
}): string {
  const ticketId = String(created.ticketId ?? "").trim();
  const origin = resolveQrSpaOrigin(created);
  if (ticketId && origin && /^https?:\/\//i.test(origin)) {
    return `${origin}/auth/qr/${ticketId}`;
  }

  const spa = unwrapPlainSpaUrl(String(created.spaUrl ?? "").trim());
  if (spa) return spa;

  return unwrapPlainSpaUrl(String(created.payDeepLink ?? "").trim());
}

/**
 * QR text for the selected client mode.
 * Pay: unencoded `nimiqpay://miniapp?url=http(s)://…/auth/qr/…` (opens Nimiq Pay).
 * Wallet: plain spa URL (phone browser → Nimiq Hub / Wallet sign). There is no
 * official Wallet custom-scheme for remote login QR.
 */
export function buildQrLoginPayload(
  mode: QrLoginClientMode,
  created: {
    ticketId?: string;
    origin?: string;
    spaUrl?: string;
    payDeepLink?: string;
  }
): string {
  const spa = buildQrSpaUrlPayload(created);
  if (!spa) return "";
  if (mode === "pay") return `nimiqpay://miniapp?url=${spa}`;
  return spa;
}

/** Strip `nimiqpay://miniapp?url=` and decode any percent-encoding to a bare spa URL. */
export function unwrapPlainSpaUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const m = /^nimiqpay:\/\/miniapp\?url=(.+)$/i.exec(s);
  const value = m?.[1] ?? s;
  try {
    const decoded = decodeURIComponent(value);
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

/** @deprecated Use {@link buildQrSpaUrlPayload} or {@link buildQrLoginPayload}. */
export function buildUnencodedPayQrPayload(created: {
  ticketId?: string;
  origin?: string;
  spaUrl?: string;
  payDeepLink?: string;
}): string {
  return buildQrLoginPayload("pay", created);
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
