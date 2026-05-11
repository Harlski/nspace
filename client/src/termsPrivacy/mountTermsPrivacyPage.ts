import { TERMS_PRIVACY_DOCS_VERSION } from "../termsPrivacyVersion.js";
import { siteDocFooterHtml } from "../ui/docPageSiteFooterHtml.js";

export type TermsPrivacyPageOptions = {
  /** Browser tab title and `document.title`. */
  documentTitle: string;
  /** First line of stacked title (orange), e.g. `TERMS`. */
  titleLine1: string;
  /** Second line of stacked title (white), e.g. `CONDITIONS`. */
  titleLine2: string;
  /** Upper mono line under title (same role as patch notes “Client v…”). */
  bundleMetaSuffix: string;
  /** HTML snippet (trusted) placed inside `.patchnotes-page__md`; use `__TERMS_PRIVACY_DOCS_PLACEHOLDER__` for the document version token. */
  bodyFragmentHtml: string;
  footerCurrent: "tacs" | "privacy";
};

/** Same shell layout as `/patchnotes` minus version/tier pickers (`mountPatchnotesPage`). */
export function mountTermsPrivacyPage(opts: TermsPrivacyPageOptions): void {
  const app = document.getElementById("app");
  if (!app) return;

  const escapedTitle = opts.documentTitle.replace(/"/g, "&quot;");
  document.title = opts.documentTitle;
  let metaNv = document.querySelector('meta[name="nspace-terms-privacy-version"]');
  if (!metaNv) {
    metaNv = document.createElement("meta");
    metaNv.setAttribute("name", "nspace-terms-privacy-version");
    document.head.appendChild(metaNv);
  }
  metaNv.setAttribute("content", TERMS_PRIVACY_DOCS_VERSION);

  const metaLine = opts.bundleMetaSuffix.replace(
    /__TERMS_PRIVACY_DOCS_PLACEHOLDER__/g,
    TERMS_PRIVACY_DOCS_VERSION
  );
  const inner = opts.bodyFragmentHtml.replace(
    /__TERMS_PRIVACY_DOCS_PLACEHOLDER__/g,
    TERMS_PRIVACY_DOCS_VERSION
  );

  const root = document.createElement("div");
  root.className = "main-menu patchnotes-page terms-privacy-doc-page";
  root.innerHTML = `
    <div class="main-menu__backdrop" aria-hidden="true"></div>
    <div class="main-menu__content">
      <div class="main-menu__card" role="presentation">
        <div class="main-menu__card-rim" aria-hidden="true"></div>
        <div class="main-menu__card-inner">
          <header class="main-menu__header patchnotes-page__header">
            <div class="patchnotes-page__topbar">
              <a class="patchnotes-page__back" href="/" aria-label="Home">←</a>
              <div class="patchnotes-page__title-wrap">
                <h1 class="main-menu__title patchnotes-page__title" title="${escapedTitle}">
                  <span class="main-menu__title-nimiq">${escapeAttr(opts.titleLine1)}</span>
                  <span class="main-menu__title-space">${escapeAttr(opts.titleLine2)}</span>
                </h1>
              </div>
              <span class="patchnotes-page__topbar-balance" aria-hidden="true"></span>
            </div>
            <p class="patchnotes-page__meta patchnotes-page__meta--center">${escapeHtml(metaLine)}</p>
          </header>
          <div class="patchnotes-page__list">
            <div class="patchnotes-page__rel-panel terms-privacy-doc-page__panel">
              <div class="patchnotes-page__body terms-privacy-doc-page__body">
                <div class="patchnotes-page__tier-view">
                  <div class="patchnotes-page__tier-panel terms-privacy-doc-page__article">
                    <div class="patchnotes-page__md terms-privacy-doc-page__article-inner">${inner}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ${siteDocFooterHtml(opts.footerCurrent)}
        </div>
      </div>
    </div>
  `.trim();

  app.replaceChildren(root);
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
