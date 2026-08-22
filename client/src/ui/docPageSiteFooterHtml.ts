import { t } from "@nspace/i18n";

export type DocPageFooterCurrent = "tacs" | "privacy" | "patchnotes";

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function navLink(slug: DocPageFooterCurrent, label: string, href: string, current?: DocPageFooterCurrent): string {
  const active = current === slug;
  return `<a class="terms-privacy-doc-page__nav-link${
    active ? " terms-privacy-doc-page__nav-link--current" : ""
  }" href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
}

/** Footer: Terms · Privacy · Patch notes + contact - used on `/tacs`, `/privacy`, `/patchnotes`. */
export function siteDocFooterHtml(current?: DocPageFooterCurrent): string {
  const terms = navLink("tacs", t("docFooter.terms"), "/tacs", current);
  const privacy = navLink("privacy", t("docFooter.privacy"), "/privacy", current);
  const patchNotes = navLink("patchnotes", t("docFooter.patchNotes"), "/patchnotes", current);
  return `
          <footer class="terms-privacy-doc-page__site-footer">
            <nav class="terms-privacy-doc-page__nav" aria-label="${escAttr(t("docFooter.navAriaLabel"))}">
              ${terms}
              <span class="terms-privacy-doc-page__nav-dot" aria-hidden="true">·</span>
              ${privacy}
              <span class="terms-privacy-doc-page__nav-dot" aria-hidden="true">·</span>
              ${patchNotes}
            </nav>
            <p class="terms-privacy-doc-page__contact-line">
              <a class="terms-privacy-doc-page__contact-mail" href="mailto:nimiqspace@gmail.com">nimiqspace@gmail.com</a>
            </p>
          </footer>`;
}
