import { mainSiteSessionBridgeSnippet } from "./mainSiteSessionBridgeSnippet.js";

/** Google Fonts: Mulish is the current name for the Muli family. */
export function analyticsFontLinkTags(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Mulish:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet"/>`;
}

/** Use with analyticsFontLinkTags() in <head>. Keeps .mono as monospace. */
export function analyticsPageRootCss(): string {
  return `:root { font-family: 'Mulish', 'Muli', system-ui, sans-serif; }`;
}

export function analyticsTopbarCss(): string {
  return `
    .ms-site-header {
      margin-bottom: 1.35rem;
      padding: 0.62rem 0.7rem;
      border: 1px solid var(--ms-border-soft, #2a394f);
      border-radius: 16px;
      background:
        linear-gradient(135deg, rgba(252, 135, 2, 0.1), rgba(43, 94, 167, 0.08) 42%, rgba(22, 29, 42, 0.92)),
        var(--ms-surface, #131b27);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
    }
    .ms-site-header + .ms-doc-title {
      margin-top: 0;
    }
    .title-row { display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; margin-bottom: 0; }
    .title-left { display: flex; align-items: center; gap: 0.7rem; min-width: 0; flex: 1 1 auto; }
    .brand-title-link { text-decoration: none; color: inherit; display: inline-flex; align-items: center; gap: 0.2em; min-width: 0; flex: 0 0 auto; border-radius: 999px; padding: 0.18rem 0.38rem; }
    .brand-title-link:hover .brand-title__nimiq { color: #f0f4f8; }
    .brand-title-link:hover .brand-title__space { color: #ffa64d; }
    .brand-title-link:focus-visible { outline: 2px solid var(--ms-link, #79b8ff); outline-offset: 3px; }
    .brand-title { margin: 0; font-size: clamp(18px, 3vw, 26px); font-weight: 800; letter-spacing: -0.035em; line-height: 1; display: inline-flex; align-items: baseline; justify-content: flex-start; gap: 0.18em; text-transform: uppercase; min-width: 0; }
    .brand-title__nimiq { color: #ffffff; }
    .brand-title__space { color: #fc8702; }
    .main-site-nav {
      display: inline-flex;
      align-items: center;
      gap: 0.18rem;
      min-width: 0;
      padding: 0.16rem;
      border: 1px solid rgba(42, 57, 79, 0.82);
      border-radius: 999px;
      background: rgba(15, 22, 34, 0.58);
    }
    .main-site-nav__link {
      display: inline-flex;
      align-items: center;
      min-height: 1.8rem;
      padding: 0 0.62rem;
      border-radius: 999px;
      color: var(--ms-muted-bright, #9fb0c7);
      font-size: 0.78rem;
      font-weight: 650;
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
    }
    .main-site-nav__link:hover {
      color: #e6edf3;
      background: rgba(255, 255, 255, 0.05);
    }
    .main-site-nav__link:focus-visible {
      outline: 2px solid var(--ms-link, #79b8ff);
      outline-offset: 2px;
    }
    .main-site-nav__link[aria-current="page"] {
      color: #eef6ff;
      background: var(--ms-accent-tint, rgba(90, 160, 255, 0.12));
      box-shadow: inset 0 0 0 1px rgba(77, 131, 208, 0.38);
    }
    [data-auth-nav][hidden] {
      display: none !important;
    }
    .analytics-topbar {
      display: flex;
      justify-content: flex-end;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.35rem;
      padding-right: 0;
      margin-right: 0;
    }
    .main-site-social {
      display: inline-flex;
      align-items: center;
      gap: 0.18rem;
    }
    .main-site-social__link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.1rem;
      height: 2.1rem;
      border: 1px solid #2f3d53;
      border-radius: 999px;
      background: rgba(22, 29, 42, 0.58);
      color: #d9e3f1;
      text-decoration: none;
    }
    .main-site-social__link:hover {
      color: #ffffff;
      border-color: var(--ms-accent-hover-border, #4d83d0);
      background: rgba(22, 29, 42, 0.92);
    }
    .main-site-social__link:focus-visible {
      outline: 2px solid var(--ms-link, #79b8ff);
      outline-offset: 2px;
    }
    .main-site-social__icon {
      width: 1rem;
      height: 1rem;
      fill: currentColor;
      display: block;
    }
    .auth-user { position: relative; z-index: 5; }
    .auth-user-btn { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2.1rem; background: rgba(22, 29, 42, 0.92); color: #d9e3f1; border: 1px solid #2f3d53; border-radius: 999px; padding: 0.18rem 0.48rem 0.18rem 0.24rem; cursor: pointer; }
    .auth-user-btn:hover { border-color: var(--ms-accent-hover-border, #4d83d0); }
    .auth-user-btn .ident { width: 24px; height: 24px; border-radius: 999px; }
    .auth-user-ident-wrap { position: relative; display: inline-flex; width: 24px; height: 24px; flex-shrink: 0; align-items: center; justify-content: center; }
    .auth-user-ident-wrap--solo { width: 22px; height: 22px; }
    .auth-user-ident-wrap .ident { display: block; width: 24px; height: 24px; border-radius: 999px; }
    .auth-user-session-alert { position: absolute; right: -4px; bottom: -3px; color: #facc15; filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.75)); pointer-events: none; }
    .auth-user-ident-wrap--solo .auth-user-session-alert { position: static; }
    .auth-user-menu { position: absolute; right: 0; top: calc(100% + 6px); min-width: 200px; background: #121926; border: 1px solid #2d3c52; border-radius: 10px; padding: 0.35rem; display: none; z-index: 20; box-shadow: 0 16px 32px rgba(0, 0, 0, 0.32); }
    .auth-user-menu-section { border-bottom: 1px solid rgba(45, 60, 82, 0.75); margin-bottom: 0.25rem; padding-bottom: 0.25rem; }
    .auth-user-menu-section:last-of-type { border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }
    .auth-user-menu-row,
    .auth-user-menu button { width: 100%; text-align: left; background: transparent; color: #d6e0ef; border: 0; border-radius: 6px; padding: 0.4rem 0.45rem; cursor: pointer; font: inherit; font-size: 0.8rem; }
    .auth-user-menu-row:hover,
    .auth-user-menu button:hover { background: #1f2a3a; }
    .auth-user-submenu { max-height: 220px; overflow-y: auto; margin-top: 0.2rem; padding: 0.15rem 0; }
    .auth-user-account-row { display: flex; align-items: center; gap: 0.45rem; width: 100%; text-align: left; background: transparent; color: #d6e0ef; border: 0; border-radius: 6px; padding: 0.35rem 0.4rem; cursor: pointer; font: inherit; font-size: 0.78rem; }
    .auth-user-account-row:hover:not(:disabled) { background: #1f2a3a; }
    .auth-user-account-row:disabled,
    .auth-user-account-row--expired { opacity: 0.45; cursor: not-allowed; }
    .auth-user-account-row--active { background: rgba(90, 160, 255, 0.08); }
    .auth-user-account-ident { width: 22px; height: 22px; border-radius: 999px; flex-shrink: 0; object-fit: cover; }
    .auth-user-account-ident--ph { display: inline-block; width: 22px; height: 22px; border-radius: 999px; background: #2a3548; }
    .auth-user-account-check { margin-left: auto; color: #5aa0ff; font-size: 0.85rem; }
    .auth-user-account-row--add { margin-top: 0.25rem; padding-top: 0.45rem; border-top: 1px solid rgba(45, 60, 82, 0.75); color: #b8c5d9; }
    .auth-user-account-cap { margin: 0.35rem 0.4rem 0.15rem; font-size: 0.72rem; color: #8b9cb3; line-height: 1.35; }
    .auth-user-signin {
      display: inline-flex;
      align-items: center;
      min-height: 2.1rem;
      cursor: pointer;
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 650;
      user-select: none;
      padding: 0 0.7rem;
      border: 1px solid #2f3d53;
      border-radius: 999px;
      background: rgba(22, 29, 42, 0.82);
    }
    .auth-user-signin:hover { color: #f1f5f9; border-color: var(--ms-accent-hover-border, #4d83d0); }
    .auth-user-signin:focus-visible { outline: 2px solid #79b8ff; outline-offset: 2px; }
    @media (max-width: 720px) {
      .ms-site-header { padding: 0.58rem; }
      .title-row { gap: 0.55rem; flex-wrap: wrap; }
      .title-left { display: contents; }
      .analytics-topbar { margin-left: auto; }
      .main-site-nav { order: 3; flex: 1 0 100%; width: 100%; overflow-x: auto; justify-content: flex-start; border-radius: 12px; }
      .main-site-nav__link { min-height: 2rem; }
    }
  `;
}

export type MainSiteHeaderPage = "analytics" | "admin" | "payouts";

function navLink(
  page: MainSiteHeaderPage,
  currentPage: MainSiteHeaderPage,
  href: string,
  label: string,
  authRequired = false
): string {
  const current = page === currentPage ? ` aria-current="page"` : "";
  const authAttrs = authRequired ? ` data-auth-nav="${page}" hidden` : "";
  return `<a class="main-site-nav__link" href="${href}"${current}${authAttrs}>${label}</a>`;
}

export function analyticsTopbarHtml(currentPage: MainSiteHeaderPage = "analytics"): string {
  return `
  <header class="ms-site-header">
    <div class="title-row">
      <div class="title-left">
        <a class="brand-title-link" href="/" title="Nimiq Space (play)">
          <span class="brand-title"><span class="brand-title__nimiq">NIMIQ</span> <span class="brand-title__space">SPACE</span></span>
        </a>
        <nav class="main-site-nav" aria-label="Main site">
          ${navLink("payouts", currentPage, "/payouts", "Payouts")}
          ${navLink("analytics", currentPage, "/analytics", "Analytics", true)}
          ${navLink("admin", currentPage, "/admin", "Admin", true)}
          ${
            currentPage === "admin"
              ? `<a class="main-site-nav__link" href="#admin-quick-payout">Quick payout</a>`
              : ""
          }
        </nav>
      </div>
      <div class="analytics-topbar">
        <div class="main-site-social" aria-label="Social links">
          <a class="main-site-social__link" href="https://x.com/nimiqspace" target="_blank" rel="noopener noreferrer" aria-label="Nimiq Space on X">
            <svg class="main-site-social__icon" viewBox="0 0 1200 1227" aria-hidden="true" focusable="false"><path d="M714.15 519.295 1160.89 0h-105.86L667.142 450.883 357.328 0H0l468.485 681.802L0 1226.37h105.866l409.627-476.155 327.179 476.155H1200L714.15 519.295Zm-145.016 168.51-47.468-67.894L144.011 79.694h162.604l304.797 436.03 47.468 67.894 396.2 566.682H892.476L569.134 687.805Z"/></svg>
          </a>
          <a class="main-site-social__link" href="https://t.me/nimiqspace" target="_blank" rel="noopener noreferrer" aria-label="Nimiq Space on Telegram">
            <svg class="main-site-social__icon" viewBox="0 0 240.1 240.1" aria-hidden="true" focusable="false"><path d="M54.3 118.8c35-15.2 58.3-25.3 70-30.2 33.3-13.9 40.3-16.3 44.8-16.4 1 0 3.2.2 4.7 1.4 1.2 1 1.5 2.3 1.7 3.3s.4 3.1.2 4.7c-1.8 19-9.6 65.1-13.6 86.3-1.7 9-5 12-8.2 12.3-7 .6-12.3-4.6-19-9-10.6-6.9-16.5-11.2-26.8-18-11.9-7.8-4.2-12.1 2.6-19.1 1.8-1.8 32.5-29.8 33.1-32.3.1-.3.1-1.5-.6-2.1-.7-.6-1.7-.4-2.5-.2-1.1.2-17.9 11.4-50.6 33.5-4.8 3.3-9.1 4.9-13 4.8-4.3-.1-12.5-2.4-18.7-4.4-7.5-2.4-13.5-3.7-13-7.9.3-2.2 3.3-4.4 8.9-6.7Z"/></svg>
          </a>
        </div>
        <div id="authUser" class="auth-user" style="display:none"></div>
      </div>
    </div>
  </header>
  <script>${mainSiteSessionBridgeSnippet()}</script>
  <script>
    (function () {
      var keys = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
      function readToken() {
        if (typeof window.__nsHydrateMainSiteAuth === "function") {
          window.__nsHydrateMainSiteAuth();
        }
        for (var i = 0; i < keys.length; i++) {
          var t = sessionStorage.getItem(keys[i]);
          if (t) return t;
        }
        return "";
      }
      function applyNav(status) {
        document.querySelectorAll("[data-auth-nav]").forEach(function (link) {
          var nav = link.getAttribute("data-auth-nav");
          link.hidden = !(
            (nav === "analytics" && status.analyticsAuthorized) ||
            (nav === "admin" && status.analyticsManager)
          );
        });
      }
      function refreshNavFromSession() {
        var token = readToken();
        if (!token) {
          applyNav({ analyticsAuthorized: false, analyticsManager: false });
          return;
        }
        if (typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(token)) {
          applyNav({ analyticsAuthorized: false, analyticsManager: false });
          return;
        }
        fetch("/api/analytics/auth-status", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        })
          .then(function (r) {
            return r.ok ? r.json() : {};
          })
          .then(function (status) {
            applyNav({
              analyticsAuthorized: Boolean(status.analyticsAuthorized),
              analyticsManager: Boolean(status.analyticsManager),
            });
          })
          .catch(function () {
            applyNav({ analyticsAuthorized: false, analyticsManager: false });
          });
      }
      window.__nsApplyMainSiteNav = applyNav;
      window.__nsRefreshMainSiteNavFromSession = refreshNavFromSession;
      refreshNavFromSession();
    })();
  </script>
  `;
}
