export type DocPageFooterCurrent = "tacs" | "privacy" | "patchnotes";

function navLink(slug: DocPageFooterCurrent, label: string, href: string, current?: DocPageFooterCurrent): string {
  const active = current === slug;
  return `<a class="terms-privacy-doc-page__nav-link${
    active ? " terms-privacy-doc-page__nav-link--current" : ""
  }" href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
}

/** Footer: Terms · Privacy · Patch notes + contact — used on `/tacs`, `/privacy`, `/patchnotes`. */
export function siteDocFooterHtml(current?: DocPageFooterCurrent): string {
  const t = navLink("tacs", "Terms", "/tacs", current);
  const p = navLink("privacy", "Privacy", "/privacy", current);
  const n = navLink("patchnotes", "Patch notes", "/patchnotes", current);
  return `
          <footer class="terms-privacy-doc-page__site-footer">
            <nav class="terms-privacy-doc-page__nav" aria-label="Policies and changelog">
              ${t}
              <span class="terms-privacy-doc-page__nav-dot" aria-hidden="true">·</span>
              ${p}
              <span class="terms-privacy-doc-page__nav-dot" aria-hidden="true">·</span>
              ${n}
            </nav>
            <p class="terms-privacy-doc-page__contact-line">
              <a class="terms-privacy-doc-page__contact-mail" href="mailto:nimiqspace@gmail.com">nimiqspace@gmail.com</a>
            </p>
          </footer>`;
}
