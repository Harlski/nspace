/**
 * Main-site typography aligned with [@nimiq/style](https://nimiq.github.io/submodules/style/demo.html)
 * (Muli + Fira Mono via Google Fonts; same stacks as `nimiq-style.min.css`).
 */

/** Google Fonts: Muli (Nimiq UI) + Fira Mono (wallet / numeric mono). */
export function mainSiteNimiqFontLinkTags(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Muli:wght@400;600;700;800&family=Mulish:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css?family=Fira+Mono&text=0123456789ABCDEFGHJKLMNPQRSTUVXY%20" rel="stylesheet"/>`;
}

/** Base font stacks for server-rendered `body.ms-site` pages. */
export function mainSiteTypographyCss(): string {
  return `
    html {
      font-size: 16px;
      font-family: Muli, Mulish, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans,
        Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    body.ms-site {
      font-family: inherit;
      font-weight: 600;
      font-size: 1rem;
      line-height: 1.45;
    }
    body.ms-site .ms-mono,
    body.ms-site .mono,
    .ms-mono {
      font-family: "Fira Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  `;
}

/** @deprecated Use {@link mainSiteNimiqFontLinkTags} */
export function analyticsFontLinkTags(): string {
  return mainSiteNimiqFontLinkTags();
}

/** @deprecated Use {@link mainSiteTypographyCss} */
export function analyticsPageRootCss(): string {
  return mainSiteTypographyCss();
}
