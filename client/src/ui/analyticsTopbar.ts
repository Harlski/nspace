import {
  isTokenExpired,
  listCachedSessions,
  MAIN_SITE_MAX_CACHED_ACCOUNTS,
} from "../auth/session.js";
import { apiUrl } from "../net/apiBase.js";
import { fetchNonce, signLoginChallenge, verifyWithServer } from "../auth/nimiq.js";
import {
  activateMainSiteCachedAccount,
  clearMainSiteAuthSession,
  MAIN_SITE_AUTH_ADDR_KEY,
  normalizeMainSiteWalletKey,
  readMainSiteAuthToken,
  writeMainSiteAuthToken,
} from "./mainSiteAuthKeys.js";
import { nimiqIconUseMarkup } from "./nimiqIcons.js";

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function walletShort(walletId: string): string {
  const compact = String(walletId || "").replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) return compact;
  return `${compact.slice(0, 4)}...${compact.slice(-4)}`;
}

function parseJwtSub(token: string): string {
  try {
    const p = String(token || "").split(".")[1] || "";
    if (!p) return "";
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
    const obj = JSON.parse(json) as { sub?: string };
    return String(obj.sub || "");
  } catch {
    return "";
  }
}

async function fetchIdenticon(wallet: string): Promise<string> {
  try {
    const r = await fetch(apiUrl(`/api/identicon/${encodeURIComponent(wallet)}`));
    if (!r.ok) return "";
    const j = (await r.json()) as { identicon?: string };
    return String(j.identicon || "");
  } catch {
    return "";
  }
}

type AnalyticsAuthStatus = {
  authenticated: boolean;
  analyticsAuthorized: boolean;
  analyticsManager: boolean;
  systemAdmin: boolean;
};

function applyMainSiteNavAuth(status: AnalyticsAuthStatus): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-auth-nav]").forEach((link) => {
    const nav = link.getAttribute("data-auth-nav");
    const visible =
      (nav === "analytics" && status.analyticsAuthorized) ||
      (nav === "admin" && status.analyticsManager) ||
      (nav === "system" && status.systemAdmin);
    link.hidden = !visible;
  });
}

/** Re-fetch `/api/analytics/auth-status` and update Analytics / Admin nav links. */
export async function refreshMainSiteNavFromSession(): Promise<void> {
  const token = readMainSiteAuthToken();
  if (!token || isTokenExpired(token)) {
    applyMainSiteNavAuth({
      authenticated: false,
      analyticsAuthorized: false,
      analyticsManager: false,
      systemAdmin: false,
    });
    return;
  }
  const s = await fetchAnalyticsAuthStatus(token);
  applyMainSiteNavAuth(s);
}

async function fetchAnalyticsAuthStatus(token: string): Promise<AnalyticsAuthStatus> {
  if (!token) {
    return {
      authenticated: false,
      analyticsAuthorized: false,
      analyticsManager: false,
      systemAdmin: false,
    };
  }
  if (isTokenExpired(token)) {
    return {
      authenticated: false,
      analyticsAuthorized: false,
      analyticsManager: false,
      systemAdmin: false,
    };
  }
  try {
    const r = await fetch(apiUrl("/api/analytics/auth-status"), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) throw new Error("auth_status_failed");
    const j = (await r.json()) as Partial<AnalyticsAuthStatus>;
    return {
      authenticated: Boolean(j.authenticated),
      analyticsAuthorized: Boolean(j.analyticsAuthorized),
      analyticsManager: Boolean(j.analyticsManager),
      systemAdmin: Boolean(j.systemAdmin),
    };
  } catch {
    return {
      authenticated: false,
      analyticsAuthorized: false,
      analyticsManager: false,
      systemAdmin: false,
    };
  }
}

function hubAppNameForPage(page: MainSitePage): string {
  if (page === "payouts") return "Nimiq Space payouts";
  if (page === "system") return "nspace system";
  return "nspace analytics";
}

export type MainSitePage = "analytics" | "admin" | "payouts" | "system";

/** Default wallet login used by main-site pages when no custom handler is passed. */
export async function mainSiteWalletLogin(page: MainSitePage): Promise<void> {
  const { nonce } = await fetchNonce();
  const signed = await signLoginChallenge(nonce, hubAppNameForPage(page));
  const { token, address } = await verifyWithServer(signed);
  if (!token) throw new Error("missing_token");
  writeMainSiteAuthToken(token, address);
  window.location.reload();
}

let authMenuDocBound = false;

export type RenderMainSiteTopbarOpts = {
  /** When set (e.g. analytics auth gate), invoked instead of {@link mainSiteWalletLogin}. */
  onLoginClick?: () => void | Promise<void>;
};

/**
 * Fills `#authUser`: Sign In (top right) when logged out, wallet menu when logged in.
 * Uses a shared JWT across analytics, admin, and payout queue pages.
 */
export async function renderMainSiteTopbar(
  currentPage: MainSitePage,
  opts?: RenderMainSiteTopbarOpts
): Promise<void> {
  const authUserEl = document.getElementById("authUser");
  if (!authUserEl) return;

  const token = readMainSiteAuthToken();
  let signed = sessionStorage.getItem(MAIN_SITE_AUTH_ADDR_KEY) || parseJwtSub(token);
  if (signed) sessionStorage.setItem(MAIN_SITE_AUTH_ADDR_KEY, signed);

  const runLogin = async (): Promise<void> => {
    if (opts?.onLoginClick) {
      await opts.onLoginClick();
      return;
    }
    await mainSiteWalletLogin(currentPage);
  };

  if (!signed || !token) {
    applyMainSiteNavAuth({
      authenticated: false,
      analyticsAuthorized: false,
      analyticsManager: false,
      systemAdmin: false,
    });
    authUserEl.style.display = "block";
    authUserEl.innerHTML =
      "<span id='authTopLogin' class='auth-user-signin' role='button' tabindex='0'>Sign In</span>";
    const loginEl = document.getElementById("authTopLogin");
    if (loginEl) {
      const go = (): void => {
        void runLogin().catch(() => {});
      };
      loginEl.addEventListener("click", go);
      loginEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    }
    return;
  }

  const sessionExpired = isTokenExpired(token);
  const [ident, authStatus] = await Promise.all([
    fetchIdenticon(signed),
    sessionExpired
      ? Promise.resolve({
          authenticated: false,
          analyticsAuthorized: false,
          analyticsManager: false,
          systemAdmin: false,
        })
      : fetchAnalyticsAuthStatus(token),
  ]);
  applyMainSiteNavAuth(authStatus);
  authUserEl.style.display = "block";
  const navRows: string[] = [];
  if (sessionExpired) {
    navRows.push("<button type='button' id='authRefreshSession'>Sign in again</button>");
  }
  navRows.push(
    "<div class='auth-user-menu-section'>" +
      "<button type='button' id='authChangeAccountToggle' class='auth-user-menu-row'>Change account</button>" +
      "<div id='authAccountPicker' class='auth-user-submenu' style='display:none' role='group' aria-label='Choose wallet'></div>" +
      "</div>"
  );
  navRows.push("<button type='button' id='authUserLogout' class='auth-user-menu-row'>Logout</button>");

  const alertSvg = sessionExpired
    ? nimiqIconUseMarkup("nq-alert-circle", { width: 14, height: 14, class: "auth-user-session-alert" })
    : "";
  const identBlock =
    ident || sessionExpired
      ? `<span class="auth-user-ident-wrap${ident ? "" : " auth-user-ident-wrap--solo"}">${
          ident ? `<img class="ident" src="${esc(ident)}" alt="wallet"/>` : ""
        }${alertSvg}</span>`
      : "";
  const btnTitle = sessionExpired
    ? `Session expired — sign in again (${esc(signed)})`
    : `Signed in as ${esc(signed)}`;

  authUserEl.innerHTML =
    "<button type='button' id='authUserBtn' class='auth-user-btn' title='" +
    btnTitle +
    "'>" +
    identBlock +
    "<span class='mono'>" +
    esc(walletShort(signed)) +
    "</span>" +
    "</button>" +
    "<div id='authUserMenu' class='auth-user-menu'>" +
    navRows.join("") +
    "</div>";

  const btn = document.getElementById("authUserBtn");
  const menu = document.getElementById("authUserMenu");
  const refreshSess = document.getElementById("authRefreshSession");
  const logout = document.getElementById("authUserLogout");
  const changeToggle = document.getElementById("authChangeAccountToggle");
  const accountPicker = document.getElementById("authAccountPicker");

  async function populateAccountPicker(): Promise<void> {
    if (!accountPicker) return;
    const entries = listCachedSessions();
    const activeN = normalizeMainSiteWalletKey(signed);
    const idents = await Promise.all(entries.map((e) => fetchIdenticon(e.address)));
    const rowsHtml = entries
      .map((e, i) => {
        const isActive = normalizeMainSiteWalletKey(e.address) === activeN;
        const exp = isTokenExpired(e.token);
        const ident = idents[i];
        const img = ident
          ? `<img class="auth-user-account-ident" src="${esc(ident)}" alt="" width="22" height="22"/>`
          : `<span class="auth-user-account-ident auth-user-account-ident--ph" aria-hidden="true"></span>`;
        const dis = exp ? " disabled" : "";
        const rowCls =
          "auth-user-account-row" +
          (exp ? " auth-user-account-row--expired" : "") +
          (isActive ? " auth-user-account-row--active" : "");
        const check = isActive ? `<span class="auth-user-account-check" aria-label="Active">✓</span>` : "";
        return `<button type="button" class="${rowCls}" data-switch-account="${esc(e.address)}"${dis}>${img}<span class="mono">${esc(walletShort(e.address))}</span>${check}</button>`;
      })
      .join("");
    const atCap = entries.length >= MAIN_SITE_MAX_CACHED_ACCOUNTS;
    const addHtml = atCap
      ? `<p class="auth-user-account-cap mono">Maximum ${MAIN_SITE_MAX_CACHED_ACCOUNTS} accounts saved.</p>`
      : `<button type="button" class="auth-user-account-row auth-user-account-row--add" id="authAddAccount">Add account</button>`;
    accountPicker.innerHTML = rowsHtml + addHtml;
    accountPicker.querySelectorAll<HTMLButtonElement>("[data-switch-account]").forEach((row) => {
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const addr = row.getAttribute("data-switch-account") || "";
        if (!addr || normalizeMainSiteWalletKey(addr) === activeN) {
          accountPicker.style.display = "none";
          return;
        }
        const ent = listCachedSessions().find(
          (x) => normalizeMainSiteWalletKey(x.address) === normalizeMainSiteWalletKey(addr)
        );
        if (!ent || isTokenExpired(ent.token)) return;
        if (activateMainSiteCachedAccount(addr)) window.location.reload();
      });
    });
    const addBtn = document.getElementById("authAddAccount");
    if (addBtn) {
      addBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        accountPicker.style.display = "none";
        if (menu) (menu as HTMLElement).style.display = "none";
        void mainSiteWalletLogin(currentPage).catch(() => {});
      });
    }
  }

  if (refreshSess) {
    refreshSess.addEventListener("click", () => {
      if (menu) (menu as HTMLElement).style.display = "none";
      void runLogin().catch(() => {});
    });
  }
  if (changeToggle && accountPicker) {
    changeToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = accountPicker.style.display !== "block";
      accountPicker.style.display = opening ? "block" : "none";
      if (opening) void populateAccountPicker();
    });
    void populateAccountPicker();
  }
  if (btn && menu) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.style.display !== "block";
      menu.style.display = open ? "block" : "none";
      if (!open && accountPicker) accountPicker.style.display = "none";
    });
    if (!authMenuDocBound) {
      document.addEventListener("click", (ev) => {
        if ((ev.target as HTMLElement).closest("#authUser")) return;
        const m = document.getElementById("authUserMenu");
        if (m) (m as HTMLElement).style.display = "none";
        const sub = document.getElementById("authAccountPicker");
        if (sub) (sub as HTMLElement).style.display = "none";
      });
      authMenuDocBound = true;
    }
  }
  if (logout) {
    logout.addEventListener("click", () => {
      clearMainSiteAuthSession();
      window.location.reload();
    });
  }
}

/** @deprecated Use {@link renderMainSiteTopbar} */
export async function renderAnalyticsTopbar(
  currentPage: "analytics" | "admin",
  opts?: RenderMainSiteTopbarOpts
): Promise<void> {
  return renderMainSiteTopbar(currentPage, opts);
}
