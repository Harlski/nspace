import { apiUrl } from "../net/apiBase.js";

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

async function canManageWallets(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const r = await fetch(apiUrl("/api/analytics/authorized-wallets"), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}

let authMenuDocBound = false;

export async function renderAnalyticsTopbar(currentPage: "analytics" | "admin"): Promise<void> {
  const authUserEl = document.getElementById("authUser");
  if (!authUserEl) return;

  const token = sessionStorage.getItem("nspace_analytics_auth_token") || "";
  let signed = sessionStorage.getItem("nspace_analytics_auth_addr") || parseJwtSub(token);
  if (signed) sessionStorage.setItem("nspace_analytics_auth_addr", signed);
  if (!signed) {
    authUserEl.style.display = "none";
    return;
  }

  const [ident, canManage] = await Promise.all([fetchIdenticon(signed), canManageWallets(token)]);
  authUserEl.style.display = "block";
  authUserEl.innerHTML =
    "<button id='authUserBtn' class='auth-user-btn' title='Signed in as " +
    esc(signed) +
    "'>" +
    (ident ? "<img class='ident' src='" + esc(ident) + "' alt='wallet'/>" : "") +
    "<span class='mono'>" +
    esc(walletShort(signed)) +
    "</span>" +
    "</button>" +
    "<div id='authUserMenu' class='auth-user-menu'>" +
    (currentPage === "admin"
      ? "<button id='authUserAnalytics'>Analytics</button>"
      : canManage
        ? "<button id='authUserAdmin'>Admin</button>"
        : "") +
    "<button id='authUserLogout'>Logout</button>" +
    "</div>";

  const btn = document.getElementById("authUserBtn");
  const menu = document.getElementById("authUserMenu");
  const admin = document.getElementById("authUserAdmin");
  const analytics = document.getElementById("authUserAnalytics");
  const logout = document.getElementById("authUserLogout");
  if (btn && menu) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });
    if (!authMenuDocBound) {
      document.addEventListener("click", () => {
        const m = document.getElementById("authUserMenu");
        if (m) (m as HTMLElement).style.display = "none";
      });
      authMenuDocBound = true;
    }
  }
  if (admin) {
    admin.addEventListener("click", () => {
      if (menu) (menu as HTMLElement).style.display = "none";
      window.location.href = "/admin";
    });
  }
  if (analytics) {
    analytics.addEventListener("click", () => {
      if (menu) (menu as HTMLElement).style.display = "none";
      window.location.href = "/analytics";
    });
  }
  if (logout) {
    logout.addEventListener("click", () => {
      sessionStorage.removeItem("nspace_analytics_auth_token");
      sessionStorage.removeItem("nspace_analytics_auth_addr");
      window.location.href = "/analytics";
    });
  }
}
