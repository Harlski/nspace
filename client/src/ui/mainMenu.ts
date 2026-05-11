import telegramIconUrl from "../assets/social/telegram.svg?url";
import xIconUrl from "../assets/social/x.svg?url";
import { signInWithWallet } from "../auth/nimiq.js";
import {
  completeAuthVerifyWithTermsPrivacyRetry,
  completeWalletPayloadAuthWithTermsPrivacyRetry,
} from "../auth/authTermsPrivacyVerify.js";
import { hasTermsPrivacyAckCachedLocally } from "../auth/termsPrivacyAckLocal.js";
import { TERMS_PRIVACY_DOCS_VERSION } from "../termsPrivacyVersion.js";
import { formatWalletAddressGap4 } from "../formatWalletAddress.js";
import { identiconDataUrl } from "../game/identiconTexture.js";
import { APP_DISPLAY_VERSION } from "../appVersion.js";
import { apiUrl } from "../net/apiBase.js";
import { TELEGRAM_URL, X_URL } from "../socialLinks.js";
import { nimiqLogosHexOutlineMonoPlusMarkup } from "./nimiqIcons.js";

/** Public asset — Vite serves `client/public` at `/`. */
const NIM_LOGO_SRC = "/branding/nimiq-nim-logo.svg";

/** Session replay UI only on loopback — not on public deployments (e.g. Vercel). */
function isReplayMenuHost(): boolean {
  if (typeof location === "undefined") return false;
  const h = location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h === "::1"
  );
}

type ReplaySessionRow = {
  sessionId: string;
  address: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
};

type ReplayEventRow = {
  ts: number;
  kind: string;
  sessionId: string;
  address: string;
  roomId: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
};

type CachedSessionMenuEntry = {
  address: string;
  token: string;
  updatedAt: number;
  expiresAtMs: number | null;
  isExpired: boolean;
  nimiqPay?: boolean;
};

const REPLAY_KIND_LABEL: Record<string, string> = {
  session_start: "Connected",
  session_end: "Disconnected",
  move_to: "Move",
  place_block: "Place block",
  set_obstacle_props: "Edit block",
  remove_obstacle: "Remove block",
  move_obstacle: "Reposition block",
  place_extra_floor: "Expand floor",
  remove_extra_floor: "Remove floor",
  chat: "Chat",
};

function formatReplayTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatDuration(startedAt: number, endedAt: number | null): string {
  if (endedAt === null) return "in progress";
  const sec = Math.round((endedAt - startedAt) / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${sec % 60}s`;
}

function formatRelativeExpiry(expiresAtMs: number | null): string {
  if (!expiresAtMs) return "No expiry";
  const deltaMs = expiresAtMs - Date.now();
  if (deltaMs <= 0) return "Expired";
  const min = Math.round(deltaMs / 60000);
  if (min < 1) return "Expires in <1m";
  if (min < 60) return `Expires in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Expires in ${hr}h ${min % 60}m`;
  const d = Math.floor(hr / 24);
  return `Expires in ${d}d ${hr % 24}h`;
}

function summarizePayload(kind: string, p?: Record<string, unknown>): string {
  if (!p) return "—";
  switch (kind) {
    case "chat":
      return JSON.stringify(String(p.text ?? "")).slice(0, 80);
    case "move_to":
      return `→ (${p.toX},${p.toZ}) layer ${p.goalLayer ?? 0}`;
    case "place_block":
    case "remove_obstacle":
    case "set_obstacle_props":
      return `tile (${p.x},${p.z})`;
    case "move_obstacle":
      return `(${p.fromX},${p.fromZ}) → (${p.toX},${p.toZ})`;
    case "place_extra_floor":
    case "remove_extra_floor":
      return `tile (${p.x},${p.z})`;
    default:
      return JSON.stringify(p).slice(0, 96);
  }
}

async function replayFetchJson<T>(
  token: string,
  path: string
): Promise<T> {
  const r = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json() as Promise<T>;
}

export type MainMenuOptions = {
  app: HTMLElement;
  cachedSessions: CachedSessionMenuEntry[];
  /** JWT for `/api/replay/*` (session action log). */
  authToken: string | null;
  devBypass: boolean;
  onReconnect: (address: string) => void;
  onLoggedIn: (token: string, address: string, nimiqPay?: boolean) => void;
  onLogout: (address?: string) => void;
};

/**
 * Full-screen lobby: title, floating hexes, identicon continue / Nimiq wallet entry, social tiles (Telegram / X).
 */
export function mountMainMenu(opts: MainMenuOptions): () => void {
  const {
    app,
    cachedSessions,
    authToken,
    devBypass,
    onReconnect,
    onLoggedIn,
    onLogout,
  } = opts;
  app.innerHTML = "";

  const replayUiEnabled = isReplayMenuHost();

  const root = document.createElement("div");
  root.className = "main-menu";
  root.innerHTML = `
    <div class="main-menu__nim-layer" aria-hidden="true"></div>
    <div class="main-menu__backdrop" aria-hidden="true"></div>
    <div class="main-menu__content">
      <div class="main-menu__card" role="presentation">
        <div class="main-menu__card-rim" aria-hidden="true"></div>
        <div class="main-menu__card-inner">
          <header class="main-menu__header">
            <h1 class="main-menu__title">
              <span class="main-menu__title-nimiq">NIMIQ</span>
              <span class="main-menu__title-space">SPACE</span>
            </h1>
            <p class="main-menu__welcome" id="main-menu-welcome" hidden>Welcome back!</p>
          </header>
          <div class="main-menu__cached" id="main-menu-cached" hidden>
            <div class="main-menu__cached-list" id="main-menu-cached-list"></div>
          </div>
          <div class="main-menu__err" id="main-menu-err" hidden></div>
          <div class="main-menu__actions" id="main-menu-actions">
            <div class="main-menu__actions-swap">
            <div class="main-menu__actions-default" id="main-menu-actions-default">
              <p class="main-menu__wallet-hint" id="main-menu-wallet-hint">Sign in with your Nimiq wallet</p>
              <div class="main-menu__wallet-signin-hex-wrap" id="main-menu-wallet-signin-wrap">
                <button type="button" class="main-menu__cached-add-hex main-menu__wallet-signin-hex" id="main-menu-wallet-signin" aria-label="Sign in with your Nimiq wallet"></button>
                <span id="main-menu-wallet-signin-terms-tooltip" class="main-menu__terms-required-tooltip" hidden role="tooltip"></span>
              </div>
              <div class="main-menu__terms-privacy" id="main-menu-terms-privacy-row" hidden>
                <label class="main-menu__terms-privacy-label"><input type="checkbox" id="main-menu-terms-privacy-cb" autocomplete="off" /><span>I have read and agree to the <a href="/tacs" target="_blank" rel="noopener noreferrer">Terms</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
              </div>
              ${
                devBypass
                  ? `<button type="button" class="nq-button light-blue main-menu__nq-btn main-menu__nq-btn--pill" id="btn-dev-login">Dev login</button>`
                  : ""
              }
            </div>
            <div class="main-menu__actions-account main-menu__actions-pane--hidden" id="main-menu-actions-account">
              <p class="main-menu__actions-account__addr" id="main-menu-actions-account-addr"></p>
              <p class="main-menu__actions-account__expiry" id="main-menu-actions-account-expiry"></p>
              <div class="main-menu__actions-account__row">
                <button type="button" class="main-menu__actions-account__pill main-menu__actions-account__pill--forget" id="main-menu-actions-forget">Forget</button>
                <div class="main-menu__actions-account__cluster">
                  <a class="main-menu__actions-account__pill main-menu__actions-account__pill--payouts" id="main-menu-actions-payouts" href="/payouts" target="_blank" rel="noopener noreferrer">Payouts</a>
                  <button type="button" class="main-menu__actions-account__pill main-menu__actions-account__pill--enter" id="main-menu-actions-enter">Enter</button>
                </div>
              </div>
            </div>
            </div>
          </div>
      ${
        replayUiEnabled
          ? `
      <div class="main-menu__replay">
        <button type="button" class="nq-button-s light-blue main-menu__nq-btn main-menu__replay-toggle" id="btn-replay-toggle" aria-expanded="false">
          Session replay
        </button>
        <div class="main-menu__replay-panel" id="replay-panel" hidden>
          <p class="main-menu__replay-hint" id="replay-hint"></p>
          <label class="main-menu__replay-field">
            <span>Player</span>
            <div class="main-menu__replay-row">
              <select class="main-menu__replay-select" id="replay-player-select" aria-label="Known players"></select>
              <input type="text" class="main-menu__replay-input" id="replay-address-input"
                placeholder="Or type address" spellcheck="false" autocomplete="off" />
            </div>
          </label>
          <div class="main-menu__replay-actions">
            <button type="button" class="nq-button-s light-blue main-menu__nq-btn" id="btn-replay-refresh-players">Refresh list</button>
            <button type="button" class="nq-button-s light-blue main-menu__nq-btn" id="btn-replay-load-sessions">Load sessions</button>
          </div>
          <div class="main-menu__replay-sessions" id="replay-sessions" role="list"></div>
          <div class="main-menu__replay-events-wrap" id="replay-events-wrap" hidden>
            <div class="main-menu__replay-events-title" id="replay-events-title">Actions</div>
            <pre class="main-menu__replay-events" id="replay-events"></pre>
          </div>
          <div class="main-menu__replay-err" id="replay-err" hidden></div>
        </div>
      </div>
      `
          : ""
      }
          <footer class="main-menu__footer">
            <p class="main-menu__footer-social-lead">Community</p>
            <div class="main-menu__social">
              <a class="main-menu__social-tile" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">
                <img class="main-menu__social-icon" src="${telegramIconUrl}" alt="" width="22" height="22" aria-hidden="true" />
                <span class="main-menu__social-label">Telegram</span>
              </a>
              <a class="main-menu__social-tile" href="${X_URL}" target="_blank" rel="noopener noreferrer">
                <img class="main-menu__social-icon" src="${xIconUrl}" alt="" width="22" height="22" aria-hidden="true" />
                <span class="main-menu__social-label">X</span>
              </a>
            </div>
            <div class="main-menu__legal-version-row">
              <a class="main-menu__legal-foot-link" href="/tacs">Terms</a>
              <a class="main-menu__version" href="/patchnotes">${APP_DISPLAY_VERSION}</a>
              <a class="main-menu__legal-foot-link" href="/privacy">Privacy</a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  `;
  app.appendChild(root);

  const nimLayer = root.querySelector(".main-menu__nim-layer") as HTMLElement;
  const nNim = 16;
  for (let i = 0; i < nNim; i++) {
    const wrap = document.createElement("div");
    wrap.className = "main-menu__nim-wrap";
    wrap.style.left = `${8 + Math.random() * 84}%`;
    wrap.style.top = `${8 + Math.random() * 84}%`;
    wrap.style.setProperty("--rot", `${Math.random() * 360}deg`);
    const img = document.createElement("img");
    img.className = "main-menu__nim-logo";
    img.src = NIM_LOGO_SRC;
    img.alt = "";
    img.draggable = false;
    img.style.setProperty("--dur", `${18 + Math.random() * 22}s`);
    img.style.setProperty("--delay", `${-Math.random() * 25}s`);
    wrap.appendChild(img);
    nimLayer.appendChild(wrap);
  }

  /** Logged-out-only control; omit entirely when the account picker row is shown. */
  if (cachedSessions.length > 0) {
    root.querySelector("#main-menu-wallet-signin-wrap")?.remove();
  }

  const errEl = root.querySelector("#main-menu-err") as HTMLElement;
  const showErr = (s: string): void => {
    if (!s) {
      errEl.hidden = true;
      errEl.textContent = "";
      return;
    }
    errEl.hidden = false;
    errEl.textContent = s;
  };

  const welcomeEl = root.querySelector("#main-menu-welcome") as HTMLElement;
  const cachedWrap = root.querySelector("#main-menu-cached") as HTMLElement;
  const cachedList = root.querySelector("#main-menu-cached-list") as HTMLElement;
  const walletSigninHexBtn = root.querySelector(
    "#main-menu-wallet-signin"
  ) as HTMLButtonElement | null;
  const walletSigninTermsTooltipEl = root.querySelector(
    "#main-menu-wallet-signin-terms-tooltip"
  ) as HTMLElement | null;
  if (walletSigninHexBtn) {
    walletSigninHexBtn.innerHTML = nimiqLogosHexOutlineMonoPlusMarkup();
  }
  const walletHintEl = root.querySelector("#main-menu-wallet-hint") as HTMLElement;

  const termsPrivacyRow = root.querySelector("#main-menu-terms-privacy-row") as HTMLElement;
  const termsPrivacyCb = root.querySelector("#main-menu-terms-privacy-cb") as HTMLInputElement;
  const refreshTermsPrivacyAckRowVisibility = (): void => {
    termsPrivacyRow.hidden = hasTermsPrivacyAckCachedLocally();
    termsPrivacyCb.checked = false;
  };
  refreshTermsPrivacyAckRowVisibility();

  let termsTooltipHideTimer: ReturnType<typeof setTimeout> | null = null;
  let activeTermsTooltipEl: HTMLElement | null = null;
  const hideTermsRequiredTooltip = (): void => {
    if (termsTooltipHideTimer !== null) {
      clearTimeout(termsTooltipHideTimer);
      termsTooltipHideTimer = null;
    }
    if (activeTermsTooltipEl) {
      const el = activeTermsTooltipEl;
      el.hidden = true;
      el.style.position = "";
      el.style.left = "";
      el.style.top = "";
      el.style.right = "";
      el.style.transform = "";
      el.style.zIndex = "";
      el.style.opacity = "";
      activeTermsTooltipEl = null;
    }
  };
  const showTermsRequiredTooltip = (tooltipEl: HTMLElement): void => {
    hideTermsRequiredTooltip();
    activeTermsTooltipEl = tooltipEl;
    tooltipEl.textContent =
      "Tick the Terms and Privacy checkbox below before signing in.";
    const wrap = tooltipEl.closest(".main-menu__wallet-signin-hex-wrap");
    const anchor =
      wrap?.querySelector<HTMLElement>(
        ".main-menu__cached-add-hex, .main-menu__wallet-signin-hex"
      ) ?? wrap;
    tooltipEl.hidden = false;
    tooltipEl.style.position = "fixed";
    tooltipEl.style.transform = "none";
    tooltipEl.style.zIndex = "10050";
    tooltipEl.style.left = "-99999px";
    tooltipEl.style.top = "0";
    tooltipEl.style.opacity = "0";

    const place = (): void => {
      if (!root.isConnected) return;
      if (!anchor || !tooltipEl.isConnected) {
        tooltipEl.style.opacity = "";
        tooltipEl.hidden = true;
        return;
      }
      const tw = Math.max(tooltipEl.offsetWidth, 1);
      const th = Math.max(tooltipEl.offsetHeight, 1);
      const ar = anchor.getBoundingClientRect();
      const gap = 7;
      const pad = 8;
      let left = Math.round(ar.left + ar.width / 2 - tw / 2);
      let top = Math.round(ar.bottom + gap);
      left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad));
      const roomBelow = window.innerHeight - pad - top;
      if (roomBelow < th && ar.top > th + gap + pad) {
        top = Math.round(ar.top - gap - th);
      }
      const maxTop = window.innerHeight - th - pad;
      top = Math.max(pad, Math.min(top, maxTop));
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.opacity = "1";
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(place);
      termsTooltipHideTimer = setTimeout(() => {
        hideTermsRequiredTooltip();
      }, 4500);
    });
  };
  /** Cached “add wallet” hex tooltip — created in `renderCachedAccounts`. */
  let cachedAddTermsTooltipEl: HTMLElement | null = null;
  termsPrivacyCb.addEventListener("change", () => {
    if (termsPrivacyCb.checked) hideTermsRequiredTooltip();
  });

  welcomeEl.hidden = cachedSessions.length === 0;
  cachedWrap.hidden = cachedSessions.length === 0;
  walletHintEl.hidden = cachedSessions.length > 0;

  /** Present when cached sessions exist — Nimiq-sign-in (+ hex) beside identicons only. */
  let cachedAddWalletBtn: HTMLButtonElement | null = null;

  const perAccountButtons = new Set<HTMLButtonElement>();
  const registerAccountButton = (el: Element | null): void => {
    if (el instanceof HTMLButtonElement) perAccountButtons.add(el);
  };

  const actionsDefaultEl = root.querySelector("#main-menu-actions-default") as HTMLElement;
  const actionsAccountEl = root.querySelector("#main-menu-actions-account") as HTMLElement;
  const actionsAccountAddrEl = root.querySelector(
    "#main-menu-actions-account-addr"
  ) as HTMLElement;
  const actionsAccountExpiryEl = root.querySelector(
    "#main-menu-actions-account-expiry"
  ) as HTMLElement;
  const actionsEnterBtn = root.querySelector("#main-menu-actions-enter") as HTMLButtonElement;
  const actionsForgetBtn = root.querySelector("#main-menu-actions-forget") as HTMLButtonElement;

  let selectedCachedSession: CachedSessionMenuEntry | null = null;

  const clearCachedAccountSelection = (): void => {
    selectedCachedSession = null;
    syncCachedSelectionUi();
  };

  const syncCachedSelectionUi = (): void => {
    if (!root.isConnected) return;
    for (const el of cachedList.querySelectorAll(
      ".main-menu__cached-item:not(.main-menu__cached-item--add)"
    )) {
      const item = el as HTMLElement;
      const addr = item.dataset.address ?? "";
      const open =
        selectedCachedSession !== null && addr === selectedCachedSession.address;
      const btn = item.querySelector(".main-menu__cached-avatar") as HTMLButtonElement | null;
      btn?.setAttribute("aria-expanded", open ? "true" : "false");
    }
    const hasCache = cachedSessions.length > 0;
    /* No stacked panes needed — account markup must not reserve row height. */
    actionsAccountEl.hidden = !hasCache;
    if (!hasCache) {
      actionsDefaultEl.classList.remove("main-menu__actions-pane--hidden");
      actionsAccountEl.classList.add("main-menu__actions-pane--hidden");
      actionsDefaultEl.setAttribute("aria-hidden", "false");
      actionsAccountEl.setAttribute("aria-hidden", "true");
      return;
    }

    const showAccountPanel = selectedCachedSession !== null;
    actionsDefaultEl.classList.toggle(
      "main-menu__actions-pane--hidden",
      showAccountPanel
    );
    actionsAccountEl.classList.toggle(
      "main-menu__actions-pane--hidden",
      !showAccountPanel
    );
    actionsDefaultEl.setAttribute(
      "aria-hidden",
      showAccountPanel ? "true" : "false"
    );
    actionsAccountEl.setAttribute(
      "aria-hidden",
      showAccountPanel ? "false" : "true"
    );
    if (showAccountPanel && selectedCachedSession) {
      actionsAccountAddrEl.textContent = formatWalletAddressGap4(
        selectedCachedSession.address
      );
      actionsAccountExpiryEl.textContent = formatRelativeExpiry(
        selectedCachedSession.expiresAtMs
      );
      actionsAccountExpiryEl.classList.toggle(
        "main-menu__actions-account__expiry--expired",
        selectedCachedSession.isExpired
      );
      actionsEnterBtn.textContent = selectedCachedSession.isExpired
        ? "Re-login"
        : "Enter";
    }
  };

  /**
   * Wallet / dev login on this menu must tick the checkbox when the row is visible,
   * or when a prior session stored local ack (row may be hidden until we reveal it).
   */
  const requiresTermsCheckboxTickForLogin = (): boolean =>
    !termsPrivacyRow.hidden || hasTermsPrivacyAckCachedLocally();

  /**
   * Local ack hides the terms row; hex / dev still need an explicit tick — show the row again for this mount.
   */
  const revealTermsRowIfWalletConsentSuppressedByAck = (): boolean => {
    if (!termsPrivacyRow.hidden || !hasTermsPrivacyAckCachedLocally()) return false;
    termsPrivacyRow.hidden = false;
    termsPrivacyCb.checked = false;
    if (cachedSessions.length > 0) clearCachedAccountSelection();
    requestAnimationFrame(() => {
      termsPrivacyRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return true;
  };

  const renderCachedAccounts = (): void => {
    cachedList.replaceChildren();
    cachedAddWalletBtn = null;
    cachedAddTermsTooltipEl = null;
    if (cachedSessions.length === 0) return;
    for (const entry of cachedSessions) {
      const item = document.createElement("div");
      item.className = "main-menu__cached-item";
      item.dataset.address = entry.address;

      const avatarBtn = document.createElement("button");
      avatarBtn.type = "button";
      avatarBtn.className = "main-menu__cached-avatar";
      avatarBtn.setAttribute("aria-expanded", "false");
      avatarBtn.setAttribute("aria-haspopup", "dialog");
      avatarBtn.setAttribute("aria-controls", "main-menu-actions-account");
      avatarBtn.setAttribute(
        "aria-label",
        `Account ${formatWalletAddressGap4(entry.address)} — show account actions`
      );
      avatarBtn.title = entry.address;

      const icon = document.createElement("img");
      icon.className = "main-menu__cached-identicon";
      icon.alt = "";
      icon.width = 48;
      icon.height = 48;
      avatarBtn.appendChild(icon);
      void identiconDataUrl(entry.address)
        .then((url) => {
          icon.src = url;
        })
        .catch(() => {
          icon.hidden = true;
        });

      avatarBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (selectedCachedSession?.address === entry.address) {
          clearCachedAccountSelection();
          return;
        }
        selectedCachedSession = entry;
        syncCachedSelectionUi();
      });

      item.appendChild(avatarBtn);
      cachedList.appendChild(item);
    }

    const addItem = document.createElement("div");
    addItem.className = "main-menu__cached-item main-menu__cached-item--add";
    addItem.setAttribute("role", "presentation");
    const addWrap = document.createElement("div");
    addWrap.className =
      "main-menu__wallet-signin-hex-wrap main-menu__wallet-signin-hex-wrap--cached-add";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.id = "main-menu-cached-add-wallet";
    addBtn.className = "main-menu__cached-add-hex";
    addBtn.setAttribute(
      "aria-label",
      "Add another Nimiq wallet account — sign in to link it"
    );
    addBtn.innerHTML = nimiqLogosHexOutlineMonoPlusMarkup();
    const addTermsTooltip = document.createElement("span");
    addTermsTooltip.className = "main-menu__terms-required-tooltip";
    addTermsTooltip.setAttribute("role", "tooltip");
    addTermsTooltip.hidden = true;
    cachedAddTermsTooltipEl = addTermsTooltip;
    addWrap.appendChild(addBtn);
    addWrap.appendChild(addTermsTooltip);
    addItem.appendChild(addWrap);
    cachedList.appendChild(addItem);
    cachedAddWalletBtn = addBtn;
  };
  renderCachedAccounts();
  if (cachedAddWalletBtn) registerAccountButton(cachedAddWalletBtn);
  syncCachedSelectionUi();

  registerAccountButton(actionsForgetBtn);
  registerAccountButton(actionsEnterBtn);

  actionsForgetBtn.addEventListener("click", () => {
    if (!selectedCachedSession) return;
    showErr("");
    const addr = selectedCachedSession.address;
    onLogout(addr);
    clearCachedAccountSelection();
  });

  actionsEnterBtn.addEventListener("click", async () => {
    if (!selectedCachedSession) return;
    showErr("");
    if (!selectedCachedSession.isExpired) {
      onReconnect(selectedCachedSession.address);
      return;
    }
    setBusy(true);
    try {
      await runNimiqWalletSignIn();
    } catch (e) {
      showErr(e instanceof Error ? e.message : "login_failed");
      setBusy(false);
    }
  });

  const disposeCachedMenuListeners: Array<() => void> = [];
  if (cachedSessions.length > 0) {
    const onDocKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        hideTermsRequiredTooltip();
        clearCachedAccountSelection();
      }
    };
    document.addEventListener("keydown", onDocKeyDown, true);
    disposeCachedMenuListeners.push(() =>
      document.removeEventListener("keydown", onDocKeyDown, true)
    );
  }

  const runNimiqWalletSignIn = async (): Promise<void> => {
    revealTermsRowIfWalletConsentSuppressedByAck();
    if (requiresTermsCheckboxTickForLogin() && !termsPrivacyCb.checked) {
      showErr("Please confirm below that you have read the Terms and Privacy Policy.");
      setBusy(false);
      return;
    }
    const { token, address, nimiqPay } = await completeWalletPayloadAuthWithTermsPrivacyRetry(
      (nonce) => signInWithWallet(nonce),
      {
        initialAcceptedTermsPrivacy: termsPrivacyCb.checked
          ? TERMS_PRIVACY_DOCS_VERSION
          : undefined,
      }
    );
    refreshTermsPrivacyAckRowVisibility();
    onLoggedIn(token, address, nimiqPay);
  };

  const setBusy = (busy: boolean): void => {
    if (walletSigninHexBtn) walletSigninHexBtn.disabled = busy;
    perAccountButtons.forEach((b) => {
      b.disabled = busy;
    });
    const devBtn = root.querySelector("#btn-dev-login") as
      | HTMLButtonElement
      | undefined;
    if (devBtn) devBtn.disabled = busy;
    actionsForgetBtn.disabled = busy;
    actionsEnterBtn.disabled = busy;
  };

  const invokePrimaryWalletLogin = async (): Promise<void> => {
    showErr("");
    setBusy(true);
    try {
      await runNimiqWalletSignIn();
    } catch (e) {
      showErr(e instanceof Error ? e.message : "login_failed");
      setBusy(false);
    }
  };

  if (walletSigninHexBtn) {
    const tipWallet = walletSigninTermsTooltipEl;
    walletSigninHexBtn.addEventListener("click", () => {
      revealTermsRowIfWalletConsentSuppressedByAck();
      if (requiresTermsCheckboxTickForLogin() && !termsPrivacyCb.checked) {
        if (tipWallet) showTermsRequiredTooltip(tipWallet);
        return;
      }
      void invokePrimaryWalletLogin();
    });
  }

  cachedAddWalletBtn?.addEventListener("click", () => {
    revealTermsRowIfWalletConsentSuppressedByAck();
    if (requiresTermsCheckboxTickForLogin() && !termsPrivacyCb.checked) {
      if (cachedAddTermsTooltipEl)
        showTermsRequiredTooltip(cachedAddTermsTooltipEl);
      return;
    }
    void invokePrimaryWalletLogin();
  });

  root.querySelector("#btn-dev-login")?.addEventListener("click", async () => {
    showErr("");
    setBusy(true);
    try {
      revealTermsRowIfWalletConsentSuppressedByAck();
      if (requiresTermsCheckboxTickForLogin() && !termsPrivacyCb.checked) {
        showErr("Please confirm below that you have read the Terms and Privacy Policy.");
        setBusy(false);
        return;
      }
      const z32 = new Uint8Array(32);
      const z64 = new Uint8Array(64);
      const b64 = (u: Uint8Array): string => {
        let s = "";
        for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!);
        return btoa(s);
      };
      const { token, address, nimiqPay } = await completeAuthVerifyWithTermsPrivacyRetry(
        async (nonce) => ({
          nonce,
          message: `Login:v1:${nonce}`,
          signer: "NQ07 DEV0000000000000000000000000000000000",
          signerPublicKey: b64(z32),
          signature: b64(z64),
        }),
        {
          initialAcceptedTermsPrivacy: termsPrivacyCb.checked
            ? TERMS_PRIVACY_DOCS_VERSION
            : undefined,
        }
      );
      refreshTermsPrivacyAckRowVisibility();
      onLoggedIn(token, address, nimiqPay);
    } catch (e) {
      showErr(e instanceof Error ? e.message : "dev_login_failed");
      setBusy(false);
    }
  });

  if (!replayUiEnabled) {
    return () => {
      hideTermsRequiredTooltip();
      clearCachedAccountSelection();
      for (const d of disposeCachedMenuListeners) d();
      app.innerHTML = "";
    };
  }

  const replayToggle = root.querySelector("#btn-replay-toggle") as HTMLButtonElement;
  const replayPanel = root.querySelector("#replay-panel") as HTMLElement;
  const replayHint = root.querySelector("#replay-hint") as HTMLElement;
  const replayPlayerSelect = root.querySelector("#replay-player-select") as HTMLSelectElement;
  const replayAddressInput = root.querySelector("#replay-address-input") as HTMLInputElement;
  const replaySessionsEl = root.querySelector("#replay-sessions") as HTMLElement;
  const replayEventsWrap = root.querySelector("#replay-events-wrap") as HTMLElement;
  const replayEventsTitle = root.querySelector("#replay-events-title") as HTMLElement;
  const replayEventsPre = root.querySelector("#replay-events") as HTMLElement;
  const replayErr = root.querySelector("#replay-err") as HTMLElement;

  const showReplayErr = (s: string): void => {
    if (!s) {
      replayErr.hidden = true;
      replayErr.textContent = "";
      return;
    }
    replayErr.hidden = false;
    replayErr.textContent = s;
  };

  replayToggle.addEventListener("click", () => {
    const open = replayPanel.hidden;
    replayPanel.hidden = !open;
    replayToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      if (authToken) {
        replayHint.textContent =
          "Pick a player, load their sessions, then open one to see moves, builds, and chat from that visit.";
      } else {
        replayHint.textContent =
          "Sign in (wallet or dev) to load replay data from the server.";
      }
    }
  });

  const effectiveReplayToken = (): string | null => authToken;

  const setPlayersInSelect = (players: string[]): void => {
    replayPlayerSelect.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— select —";
    replayPlayerSelect.appendChild(opt0);
    for (const p of players) {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = p.length > 22 ? `${p.slice(0, 10)}…${p.slice(-8)}` : p;
      replayPlayerSelect.appendChild(o);
    }
  };

  root.querySelector("#btn-replay-refresh-players")?.addEventListener("click", async () => {
    showReplayErr("");
    const token = effectiveReplayToken();
    if (!token) {
      showReplayErr("Sign in first.");
      return;
    }
    try {
      const data = await replayFetchJson<{ players: string[] }>(
        token,
        "/api/replay/players?days=7&limit=200"
      );
      setPlayersInSelect(data.players ?? []);
    } catch (e) {
      showReplayErr(e instanceof Error ? e.message : "replay_failed");
    }
  });

  const selectedPlayerAddress = (): string => {
    const fromSelect = replayPlayerSelect.value.trim();
    const manual = replayAddressInput.value.trim();
    return manual || fromSelect;
  };

  root.querySelector("#btn-replay-load-sessions")?.addEventListener("click", async () => {
    showReplayErr("");
    replayEventsWrap.hidden = true;
    replaySessionsEl.innerHTML = "";
    const token = effectiveReplayToken();
    if (!token) {
      showReplayErr("Sign in first.");
      return;
    }
    const address = selectedPlayerAddress();
    if (!address) {
      showReplayErr("Choose or enter a player address.");
      return;
    }
    try {
      const data = await replayFetchJson<{ sessions: ReplaySessionRow[] }>(
        token,
        `/api/replay/sessions?address=${encodeURIComponent(address)}&days=14`
      );
      const sessions = data.sessions ?? [];
      if (sessions.length === 0) {
        replaySessionsEl.textContent = "No sessions found in the last 14 days.";
        return;
      }
      for (const s of sessions) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "main-menu__replay-session-btn";
        row.setAttribute("role", "listitem");
        const when = formatReplayTime(s.startedAt);
        const dur = formatDuration(s.startedAt, s.endedAt);
        row.textContent = `${when} · ${s.roomId} · ${dur}`;
        row.title = s.sessionId;
        row.addEventListener("click", async () => {
          showReplayErr("");
          try {
            const ev = await replayFetchJson<{ events: ReplayEventRow[] }>(
              token,
              `/api/replay/session/${encodeURIComponent(s.sessionId)}/events?days=14`
            );
            const events = ev.events ?? [];
            replayEventsTitle.textContent = `Actions (${events.length}) — ${s.sessionId.slice(0, 12)}…`;
            const lines: string[] = [];
            for (const e of events) {
              if (e.kind === "session_start" || e.kind === "session_end") {
                lines.push(
                  `[${formatReplayTime(e.ts)}] ${REPLAY_KIND_LABEL[e.kind] ?? e.kind}`
                );
                continue;
              }
              const label = REPLAY_KIND_LABEL[e.kind] ?? e.kind;
              const extra = summarizePayload(e.kind, e.payload);
              lines.push(`[${formatReplayTime(e.ts)}] ${label}: ${extra}`);
            }
            replayEventsPre.textContent = lines.join("\n");
            replayEventsWrap.hidden = false;
          } catch (err) {
            showReplayErr(err instanceof Error ? err.message : "events_failed");
          }
        });
        replaySessionsEl.appendChild(row);
      }
    } catch (e) {
      showReplayErr(e instanceof Error ? e.message : "sessions_failed");
    }
  });

  return () => {
    hideTermsRequiredTooltip();
    clearCachedAccountSelection();
    for (const d of disposeCachedMenuListeners) d();
    app.innerHTML = "";
  };
}
