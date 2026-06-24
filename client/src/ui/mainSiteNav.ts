export type MainSiteNavPage =
  | "analytics"
  | "admin"
  | "payouts"
  | "system"
  | "settings"
  | "header"
  | "feedback"
  | "campaign"
  | "cosmetics"
  | "rooms"
  | "advertise";

export type MainSiteNavAuthStatus = {
  signedIn: boolean;
  analyticsAuthorized: boolean;
  analyticsManager: boolean;
  systemAdmin: boolean;
};

type MainSiteNavItem = {
  page: MainSiteNavPage;
  href: string;
  label: string;
  authKey?: string;
};

type MainSiteNavGroup = {
  id: string;
  label: string;
  items: MainSiteNavItem[];
};

const MAIN_SITE_NAV_GROUPS: MainSiteNavGroup[] = [
  {
    id: "site",
    label: "Site",
    items: [
      { page: "payouts", href: "/payouts", label: "Payouts" },
      { page: "advertise", href: "/advertise", label: "Advertise", authKey: "advertise" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { page: "admin", href: "/admin", label: "Admin", authKey: "admin" },
      { page: "analytics", href: "/analytics", label: "Analytics", authKey: "analytics" },
      { page: "system", href: "/admin/system", label: "System", authKey: "system" },
      { page: "settings", href: "/admin/settings", label: "Settings", authKey: "settings" },
      { page: "header", href: "/admin/header", label: "Header", authKey: "header" },
      { page: "feedback", href: "/admin/feedback", label: "Feedback", authKey: "feedback" },
      { page: "campaign", href: "/admin/campaign", label: "Campaigns", authKey: "campaign" },
      { page: "cosmetics", href: "/admin/cosmetics", label: "Cosmetics", authKey: "campaign" },
      { page: "rooms", href: "/admin/rooms", label: "Rooms", authKey: "rooms" },
    ],
  },
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mainSiteNavLabelForPage(page: MainSiteNavPage): string {
  for (const group of MAIN_SITE_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.page === page) return item.label;
    }
  }
  return "Navigate";
}

export function isMainSiteNavItemVisible(
  authKey: string | undefined,
  status: MainSiteNavAuthStatus
): boolean {
  if (!authKey) return true;
  if (authKey === "advertise") return status.signedIn;
  if (authKey === "analytics") return status.analyticsAuthorized;
  if (authKey === "admin") return status.analyticsManager;
  if (authKey === "system" || authKey === "settings" || authKey === "header" || authKey === "feedback" || authKey === "campaign" || authKey === "cosmetics" || authKey === "rooms") {
    return status.systemAdmin;
  }
  return false;
}

function navItemHtml(item: MainSiteNavItem, currentPage: MainSiteNavPage): string {
  const current = item.page === currentPage ? ` aria-current="page"` : "";
  const authAttrs = item.authKey ? ` data-auth-nav="${item.authKey}" hidden` : "";
  return `<a class="main-site-nav-dropdown__link" role="menuitem" href="${esc(item.href)}"${current}${authAttrs}>${esc(item.label)}</a>`;
}

export function mainSiteNavDropdownHtml(currentPage: MainSiteNavPage): string {
  const groupsHtml = MAIN_SITE_NAV_GROUPS.map((group) => {
    const links = group.items.map((item) => navItemHtml(item, currentPage)).join("");
    const extra =
      currentPage === "admin" && group.id === "admin"
        ? `<a class="main-site-nav-dropdown__link" role="menuitem" href="#admin-quick-payout" data-auth-nav="admin" hidden>Quick payout</a>`
        : "";
    return `<details class="main-site-nav-dropdown__group" data-nav-group="${group.id}" open>
      <summary class="main-site-nav-dropdown__group-label">${esc(group.label)}</summary>
      <div class="main-site-nav-dropdown__group-links">${links}${extra}</div>
    </details>`;
  }).join("");

  const currentLabel = esc(mainSiteNavLabelForPage(currentPage));

  return `<div class="main-site-nav-dropdown">
    <button
      type="button"
      class="main-site-nav-dropdown__trigger"
      id="mainSiteNavTrigger"
      aria-haspopup="menu"
      aria-expanded="false"
      aria-controls="mainSiteNavPanel"
    >
      <span id="mainSiteNavCurrentLabel">${currentLabel}</span>
      <span class="main-site-nav-dropdown__chevron" aria-hidden="true">▾</span>
    </button>
    <div class="main-site-nav-dropdown__panel" id="mainSiteNavPanel" role="menu" hidden>
      ${groupsHtml}
    </div>
  </div>`;
}

export function applyMainSiteNavAuth(status: MainSiteNavAuthStatus): void {
  document.querySelectorAll<HTMLElement>("[data-auth-nav]").forEach((link) => {
    const nav = link.getAttribute("data-auth-nav") || undefined;
    link.hidden = !isMainSiteNavItemVisible(nav, status);
  });
  document.querySelectorAll<HTMLElement>("[data-nav-group]").forEach((group) => {
    const links = group.querySelectorAll<HTMLElement>(".main-site-nav-dropdown__link");
    const hasVisible = Array.from(links).some((link) => !link.hidden);
    group.hidden = !hasVisible;
  });
}

let navDropdownDocBound = false;

export function bindMainSiteNavDropdown(): void {
  const trigger = document.getElementById("mainSiteNavTrigger");
  const panel = document.getElementById("mainSiteNavPanel");
  if (!trigger || !panel || trigger.dataset.bound === "1") return;
  trigger.dataset.bound = "1";

  const setOpen = (open: boolean): void => {
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  if (!navDropdownDocBound) {
    document.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
    navDropdownDocBound = true;
  }
}

/** Mount grouped nav dropdown into `.main-site-nav` (Vite static pages). */
export function mountMainSiteNav(currentPage: MainSiteNavPage): void {
  const nav = document.querySelector<HTMLElement>(".main-site-nav");
  if (!nav) return;
  nav.innerHTML = mainSiteNavDropdownHtml(currentPage);
  bindMainSiteNavDropdown();
}
