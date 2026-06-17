export type MainSiteHeaderPage =
  | "analytics"
  | "admin"
  | "payouts"
  | "system"
  | "settings"
  | "header"
  | "feedback"
  | "campaign"
  | "rooms"
  | "advertise";

export type MainSiteNavAuthStatus = {
  signedIn: boolean;
  analyticsAuthorized: boolean;
  analyticsManager: boolean;
  systemAdmin: boolean;
};

type MainSiteNavItem = {
  page: MainSiteHeaderPage;
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
      { page: "rooms", href: "/admin/rooms", label: "Rooms", authKey: "rooms" },
    ],
  },
];

export function mainSiteNavLabelForPage(page: MainSiteHeaderPage): string {
  for (const group of MAIN_SITE_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.page === page) return item.label;
    }
  }
  if (page === "admin") return "Admin";
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
  if (authKey === "system" || authKey === "settings" || authKey === "header" || authKey === "feedback" || authKey === "campaign" || authKey === "rooms") {
    return status.systemAdmin;
  }
  return false;
}

function navItemHtml(item: MainSiteNavItem, currentPage: MainSiteHeaderPage): string {
  const current = item.page === currentPage ? ` aria-current="page"` : "";
  const authAttrs = item.authKey ? ` data-auth-nav="${item.authKey}" hidden` : "";
  return `<a class="main-site-nav-dropdown__link" role="menuitem" href="${item.href}"${current}${authAttrs}>${item.label}</a>`;
}

export function mainSiteNavDropdownHtml(currentPage: MainSiteHeaderPage = "analytics"): string {
  const groupsHtml = MAIN_SITE_NAV_GROUPS.map((group) => {
    const links = group.items.map((item) => navItemHtml(item, currentPage)).join("");
    const extra =
      currentPage === "admin" && group.id === "admin"
        ? `<a class="main-site-nav-dropdown__link" role="menuitem" href="#admin-quick-payout" data-auth-nav="admin" hidden>Quick payout</a>`
        : "";
    return `<details class="main-site-nav-dropdown__group" data-nav-group="${group.id}" open>
      <summary class="main-site-nav-dropdown__group-label">${group.label}</summary>
      <div class="main-site-nav-dropdown__group-links">${links}${extra}</div>
    </details>`;
  }).join("");

  const currentLabel = mainSiteNavLabelForPage(currentPage);

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

export function mainSiteNavDropdownCss(): string {
  return `
    .main-site-nav-dropdown {
      position: relative;
      min-width: 0;
      flex: 0 1 auto;
    }
    .main-site-nav-dropdown__trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-height: 2rem;
      padding: 0 0.72rem 0 0.82rem;
      border: 1px solid rgba(42, 57, 79, 0.82);
      border-radius: 999px;
      background: rgba(15, 22, 34, 0.58);
      color: var(--ms-muted-bright, #9fb0c7);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 650;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      max-width: min(12rem, 42vw);
    }
    .main-site-nav-dropdown__trigger:hover {
      color: #e6edf3;
      border-color: var(--ms-accent-hover-border, #4d83d0);
      background: rgba(22, 29, 42, 0.82);
    }
    .main-site-nav-dropdown__trigger:focus-visible {
      outline: 2px solid var(--ms-link, #79b8ff);
      outline-offset: 2px;
    }
    .main-site-nav-dropdown__trigger[aria-expanded="true"] {
      color: #eef6ff;
      background: var(--ms-accent-tint, rgba(90, 160, 255, 0.12));
      box-shadow: inset 0 0 0 1px rgba(77, 131, 208, 0.38);
    }
    #mainSiteNavCurrentLabel {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .main-site-nav-dropdown__chevron {
      font-size: 0.72rem;
      opacity: 0.85;
      flex-shrink: 0;
    }
    .main-site-nav-dropdown__panel {
      position: absolute;
      left: 0;
      top: calc(100% + 6px);
      z-index: 24;
      min-width: 13.5rem;
      max-width: min(18rem, 92vw);
      max-height: min(70vh, 24rem);
      overflow: auto;
      padding: 0.35rem;
      border: 1px solid #2d3c52;
      border-radius: 12px;
      background: #121926;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.32);
    }
    .main-site-nav-dropdown__panel[hidden] {
      display: none !important;
    }
    .main-site-nav-dropdown__group {
      border-bottom: 1px solid rgba(45, 60, 82, 0.75);
      margin-bottom: 0.2rem;
      padding-bottom: 0.2rem;
    }
    .main-site-nav-dropdown__group:last-child {
      border-bottom: 0;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .main-site-nav-dropdown__group[hidden] {
      display: none !important;
    }
    .main-site-nav-dropdown__group-label {
      display: list-item;
      list-style: none;
      cursor: pointer;
      padding: 0.28rem 0.45rem 0.18rem;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ms-muted, #6b7d95);
      user-select: none;
    }
    .main-site-nav-dropdown__group-label::-webkit-details-marker {
      display: none;
    }
    .main-site-nav-dropdown__group-label::before {
      content: "▸";
      display: inline-block;
      margin-right: 0.35rem;
      font-size: 0.62rem;
      transition: transform 0.12s ease;
    }
    .main-site-nav-dropdown__group[open] > .main-site-nav-dropdown__group-label::before {
      transform: rotate(90deg);
    }
    .main-site-nav-dropdown__group-links {
      display: flex;
      flex-direction: column;
      gap: 0.08rem;
      padding: 0.08rem 0.2rem 0.2rem;
    }
    .main-site-nav-dropdown__link {
      display: block;
      padding: 0.42rem 0.45rem;
      border-radius: 6px;
      color: #d6e0ef;
      font-size: 0.8rem;
      font-weight: 600;
      line-height: 1.2;
      text-decoration: none;
    }
    .main-site-nav-dropdown__link:hover {
      background: #1f2a3a;
      color: #f1f5f9;
    }
    .main-site-nav-dropdown__link:focus-visible {
      outline: 2px solid var(--ms-link, #79b8ff);
      outline-offset: 1px;
    }
    .main-site-nav-dropdown__link[aria-current="page"] {
      background: rgba(90, 160, 255, 0.12);
      color: #eef6ff;
      box-shadow: inset 0 0 0 1px rgba(77, 131, 208, 0.32);
    }
    [data-auth-nav][hidden] {
      display: none !important;
    }
    @media (max-width: 720px) {
      .main-site-nav-dropdown {
        order: 3;
        flex: 1 0 100%;
        width: 100%;
      }
      .main-site-nav-dropdown__trigger {
        width: 100%;
        max-width: none;
        justify-content: space-between;
      }
      .main-site-nav-dropdown__panel {
        left: 0;
        right: 0;
        width: 100%;
        max-width: none;
      }
    }
  `;
}

/** Inline script: permission-aware nav + dropdown open/close. */
export function mainSiteNavRuntimeScript(): string {
  return `
    (function () {
      function navItemVisible(nav, status) {
        return (
          !nav ||
          (nav === "advertise" && status.signedIn) ||
          (nav === "analytics" && status.analyticsAuthorized) ||
          (nav === "admin" && status.analyticsManager) ||
          (nav === "system" && status.systemAdmin) ||
          (nav === "settings" && status.systemAdmin) ||
          (nav === "header" && status.systemAdmin) ||
          (nav === "feedback" && status.systemAdmin) ||
          (nav === "campaign" && status.systemAdmin) ||
          (nav === "rooms" && status.systemAdmin)
        );
      }
      function applyNav(status) {
        document.querySelectorAll("[data-auth-nav]").forEach(function (link) {
          var nav = link.getAttribute("data-auth-nav");
          link.hidden = !navItemVisible(nav, status);
        });
        document.querySelectorAll("[data-nav-group]").forEach(function (group) {
          var links = group.querySelectorAll(".main-site-nav-dropdown__link");
          var hasVisible = false;
          links.forEach(function (link) {
            if (!link.hidden) hasVisible = true;
          });
          group.hidden = !hasVisible;
        });
      }
      function bindNavDropdown() {
        var trigger = document.getElementById("mainSiteNavTrigger");
        var panel = document.getElementById("mainSiteNavPanel");
        if (!trigger || !panel || trigger.dataset.bound === "1") return;
        trigger.dataset.bound = "1";
        function setOpen(open) {
          trigger.setAttribute("aria-expanded", open ? "true" : "false");
          panel.hidden = !open;
        }
        trigger.addEventListener("click", function (e) {
          e.stopPropagation();
          setOpen(panel.hidden);
        });
        panel.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        document.addEventListener("click", function () {
          setOpen(false);
        });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape") setOpen(false);
        });
      }
      window.__nsApplyMainSiteNav = applyNav;
      window.__nsBindMainSiteNavDropdown = bindNavDropdown;
      bindNavDropdown();
    })();
  `;
}
