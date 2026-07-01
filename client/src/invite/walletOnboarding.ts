export const NIMIQ_PAY_APP_STORE_URL =
  "https://apps.apple.com/au/app/nimiq-pay/id6471844738";
export const NIMIQ_PAY_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.nimiq.pay";
export const NIMIQ_PAY_WEB_URL = "https://nimpay.app";

export const GUEST_ID_COOKIE = "nspace_guest_id";

export function clearGuestInviteCookie(): void {
  try {
    document.cookie = `${GUEST_ID_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const APPLE_ICON_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.365 1.43c0 1.14-.42 2.08-1.24 2.82-.88.8-1.94 1.26-3.08 1.18-.14-1.08.38-2.22 1.16-2.96.84-.78 2.22-1.34 3.16-1.04zM20.7 17.07c-.58 1.32-.86 1.92-1.62 3.1-1.04 1.58-2.52 3.56-4.34 3.58-1.62.02-2.04-1.04-4.24-1.04-2.2 0-2.66 1.02-4.28 1.06-1.84.04-3.24-1.78-4.28-3.36C.82 18.12-.06 15.38.66 12.5c.58-2.22 2.26-3.84 4.24-3.88 1.66-.04 2.88 1.12 4.34 1.12 1.46 0 2.36-1.12 4.28-1.12 1.52.02 2.84.82 3.54 2.12-3.12 1.68-2.62 6.06.64 7.33z"/></svg>`;

const PLAY_ICON_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15C4.34 1.91 4.92 2.01 5.32 2.41L20.32 11.41C20.72 11.71 20.92 12.21 20.92 12.71C20.92 13.21 20.72 13.71 20.32 14.01L5.32 22.01C4.92 22.41 4.34 22.51 3.84 22.27C3.34 22.03 3 21.51 3 20.92V20.5Z"/></svg>`;

function storeLinksHtml(): string {
  return `<div class="join-gate__stores">
    <a class="join-gate__store join-gate__store--apple" href="${NIMIQ_PAY_APP_STORE_URL}" target="_blank" rel="noopener noreferrer">
      <span class="join-gate__store-icon">${APPLE_ICON_SVG}</span>
      <span class="join-gate__store-text">
        <span class="join-gate__store-kicker">Download on the</span>
        <span class="join-gate__store-name">App Store</span>
      </span>
    </a>
    <a class="join-gate__store join-gate__store--google" href="${NIMIQ_PAY_PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer">
      <span class="join-gate__store-icon">${PLAY_ICON_SVG}</span>
      <span class="join-gate__store-text">
        <span class="join-gate__store-kicker">Get it on</span>
        <span class="join-gate__store-name">Google Play</span>
      </span>
    </a>
    <a class="join-gate__store join-gate__store--web" href="${NIMIQ_PAY_WEB_URL}" target="_blank" rel="noopener noreferrer">
      <span class="join-gate__store-text">
        <span class="join-gate__store-kicker">Or visit</span>
        <span class="join-gate__store-name">nimpay.app</span>
      </span>
    </a>
  </div>`;
}

function walletOnboardingCardInnerHtml(opts: {
  title: string;
  hint: string;
  showClose: boolean;
}): string {
  return `
    ${opts.showClose ? `<button type="button" class="join-gate__close" aria-label="Close">✕</button>` : ""}
    <header class="join-gate__brand">
      <h1 class="main-menu__title join-gate__brand-title">
        <span class="main-menu__title-nimiq">NIMIQ</span>
        <span class="main-menu__title-space">SPACE</span>
      </h1>
    </header>
    <h2 id="nspaceWalletOnboardingTitle" class="invite-splash__title join-gate__title">${escapeHtml(opts.title)}</h2>
    <p class="invite-splash__hint join-gate__hint">${escapeHtml(opts.hint)}</p>
    <div class="join-gate__body join-gate__body--wallet">
      <div class="invite-splash__actions join-gate__wallet-actions">
        <button type="button" class="invite-splash__signin join-gate__signin join-gate__signin-wallet">Sign in with wallet</button>
      </div>
      <p class="join-gate__miniapp-note">--- or find us as a mini app on Nimiq Pay ---</p>
      ${storeLinksHtml()}
    </div>
  `;
}

function mountJoinGateShell(
  innerHtml: string,
  extraRootClass = ""
): HTMLElement {
  const root = document.createElement("div");
  root.className = ["invite-splash", "join-gate", extraRootClass].filter(Boolean).join(" ");
  root.innerHTML = `<div class="invite-splash__card join-gate__card">${innerHtml}</div>`;
  return root;
}

function bindWalletOnboardingActions(
  root: HTMLElement,
  opts: { onWebWallet: () => void; onClose?: () => void }
): void {
  root.querySelector(".join-gate__signin-wallet")?.addEventListener("click", () => {
    opts.onClose?.();
    opts.onWebWallet();
  });
  const closeBtn = root.querySelector(".join-gate__close");
  if (closeBtn && opts.onClose) {
    closeBtn.addEventListener("click", opts.onClose);
  }
}

/** Dismissible overlay over the game (Get a Wallet toolbar button). */
export function showGetWalletPrompt(opts: { onWebWallet: () => void }): void {
  document.getElementById("nspaceGetWalletPrompt")?.remove();

  const wrap = mountJoinGateShell(
    walletOnboardingCardInnerHtml({
      title: "Get a Nimiq wallet",
      hint: "Play as a guest today - or sign in with a wallet to explore all of Nimiq Space.",
      showClose: true,
    }),
    "join-gate--overlay"
  );
  wrap.id = "nspaceGetWalletPrompt";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-labelledby", "nspaceWalletOnboardingTitle");
  document.body.appendChild(wrap);

  const close = (): void => wrap.remove();
  bindWalletOnboardingActions(wrap, { onWebWallet: opts.onWebWallet, onClose: close });
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) close();
  });
}

/** Full-page onboarding when a guest's Play Space is gone (not dismissible). */
export function mountGuestPlaySpaceClosedOnboarding(
  app: HTMLElement,
  opts: { message: string; title?: string; onWebWallet: () => void }
): void {
  app.innerHTML = "";
  const root = mountJoinGateShell(
    walletOnboardingCardInnerHtml({
      title: opts.title ?? "Play space closed",
      hint: opts.message,
      showClose: false,
    })
  );
  app.appendChild(root);
  bindWalletOnboardingActions(root, { onWebWallet: opts.onWebWallet });
}
