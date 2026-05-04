/**
 * Shared layout and tokens for **main-site** HTML pages served from the game API host
 * (`/analytics`, `/admin`, `/payouts`, …). Not used by the **main-game** SPA
 * (https://nimiq.space).
 *
 * Pair with `analyticsTopbar.ts` (brand row + `#authUser` slot) and `docs/main-site-design.md`.
 */

/** Root-relative favicon (`client/public/favicon.ico` → `dist/`). */
export function mainSiteFaviconLinkTag(): string {
  return `<link rel="icon" href="/favicon.ico" sizes="any"/>`;
}

export function mainSiteShellCss(): string {
  return `
    :root {
      --ms-bg: #0f1419;
      --ms-text: #e6edf3;
      --ms-text-heading: #c8d4e4;
      --ms-muted: #6b7d95;
      --ms-muted-bright: #9fb0c7;
      --ms-surface: #131b27;
      --ms-surface-raised: #161d2a;
      --ms-border: #283244;
      --ms-border-soft: #2a394f;
      --ms-accent: #2b5ea7;
      --ms-accent-hover-border: #4d83d0;
      --ms-accent-tint: rgba(90, 160, 255, 0.12);
      --ms-link: #79b8ff;
      --ms-link-hover: #bfdbfe;
      --ms-err: #f87171;
    }
    html {
      background: var(--ms-bg);
    }
    body.ms-site {
      margin: 0 auto;
      padding: 1.5rem 1rem 2rem;
      max-width: 900px;
      box-sizing: border-box;
      background: var(--ms-bg);
      color: var(--ms-text);
    }
    body.ms-site.ms-site--wide {
      max-width: 1120px;
    }
    .ms-doc-title {
      margin: 0 0 0.75rem 0;
      font-size: clamp(1.02rem, 2.4vw, 1.28rem);
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--ms-text-heading);
    }
    .ms-doc-title .ms-doc-title__updated {
      font-weight: 400;
      font-style: italic;
      font-size: 0.72em;
      color: var(--ms-muted);
      letter-spacing: 0;
    }
    .ms-payout-queue-status:empty {
      display: none;
    }
    .payout-queue-sheet {
      margin-top: 0.25rem;
      padding: 0.9rem 1rem 1rem;
      border-radius: 10px;
      border: 1px solid var(--ms-border-soft);
      background: var(--ms-surface);
    }
    .payout-queue-intro {
      margin: 0 0 1rem 0;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid rgba(40, 50, 68, 0.85);
    }
    .payout-queue-intro:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .payout-queue-intro__counts {
      margin: 0;
      font-size: 0.84rem;
      line-height: 1.45;
      color: #b8c5d9;
    }
    .payout-queue-intro__note {
      margin: 0;
      margin-top: 1rem;
      font-size: 0.84rem;
      line-height: 1.45;
      color: var(--ms-muted);
    }
    .ms-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.45rem 0.65rem;
      margin: 0 0 0.55rem 0;
    }
    .ms-panel {
      margin-top: 0.65rem;
      padding: 0.75rem 0.85rem;
      border-radius: 8px;
      border: 1px solid var(--ms-border-soft);
      background: var(--ms-surface);
    }
    .ms-site .ms-mono,
    .ms-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
    }
    .ms-summary {
      font-size: 0.84rem;
      color: #b8c5d9;
      line-height: 1.45;
      margin: 0 0 0.35rem 0;
    }
    .ms-status {
      margin: 0.35rem 0 0.65rem;
      font-size: 0.72rem;
      color: var(--ms-muted);
    }
    .ms-banner {
      margin: 0.5rem 0 0.65rem;
      padding: 0.55rem 0.65rem;
      border-radius: 6px;
      border: 1px solid var(--ms-border-soft);
      background: var(--ms-surface);
      font-size: 0.82rem;
      color: #c9d1d9;
    }
    .ms-banner + .ms-status {
      margin-top: 0.25rem;
    }
    .ms-wallet-signing {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 4rem;
      padding: 0.9rem;
    }
    .ms-wallet-signing--column {
      flex-direction: column;
      gap: 0.65rem;
    }
    .ms-signing-in-line {
      margin: 0;
      font-size: 0.88rem;
      color: var(--ms-muted-bright);
      font-weight: 500;
    }
    .ms-signing-dots-live {
      display: inline-block;
      min-width: 2.5ch;
      text-align: left;
    }
    .ms-auth-gate {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 3.5rem;
      padding: 0.85rem 0.5rem;
      text-align: center;
    }
    .ms-auth-gate--standalone {
      min-height: 8rem;
    }
    .ms-auth-gate-msg {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--ms-text-heading);
    }
    .ms-auth-gate-msg.err {
      color: var(--ms-err);
    }
    .ms-spinner {
      display: block;
      height: 1.8rem;
      width: calc(1.8rem * 54 / 48);
      flex-shrink: 0;
      color: var(--ms-link);
    }
    .ms-spinner .big-hex {
      stroke-dashoffset: -40.5;
      animation: loading-big-hex 4s cubic-bezier(0.76, 0.29, 0.29, 0.76) infinite;
    }
    .ms-spinner .small-hex {
      stroke-dashoffset: 13;
      animation: loading-small-hex 4s cubic-bezier(0.76, 0.29, 0.29, 0.76) infinite;
    }
    .ms-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    @keyframes loading-big-hex {
      0% { stroke-dashoffset: -40.5; }
      17% { stroke-dashoffset: -15.08; }
      33% { stroke-dashoffset: 10.33; }
      50% { stroke-dashoffset: 35.75; }
      67% { stroke-dashoffset: 61.17; }
      83% { stroke-dashoffset: 86.58; }
      100% { stroke-dashoffset: 112; }
    }
    @keyframes loading-small-hex {
      0% { stroke-dashoffset: 13; }
      17% { stroke-dashoffset: 38.42; }
      33% { stroke-dashoffset: 63.84; }
      50% { stroke-dashoffset: 89.25; }
      67% { stroke-dashoffset: 114.66; }
      83% { stroke-dashoffset: 140.08; }
      100% { stroke-dashoffset: 165.5; }
    }
    .ms-signin-text {
      cursor: pointer;
      color: var(--ms-link);
      font-size: 0.84rem;
      font-weight: 500;
      user-select: none;
    }
    .ms-signin-text:hover {
      color: var(--ms-link-hover);
      text-decoration: underline;
    }
    .ms-signin-text:focus-visible {
      outline: 2px solid var(--ms-link);
      outline-offset: 2px;
      border-radius: 2px;
    }
    .ms-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--ms-accent-tint);
      color: #e8f0fc;
      border: 1px solid #324258;
      border-radius: 5px;
      padding: 0.28rem 0.55rem;
      cursor: pointer;
      font: inherit;
      font-size: 0.76rem;
    }
    .ms-btn:hover {
      border-color: var(--ms-accent-hover-border);
    }
    .ms-btn--ghost {
      background: transparent;
      color: var(--ms-muted-bright);
    }
    .ms-btn--primary {
      background: var(--ms-accent);
      color: #eef6ff;
      border: 1px solid var(--ms-accent-hover-border);
    }
    .ms-site table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.55rem;
      font-size: 0.82rem;
    }
    .ms-site th,
    .ms-site td {
      text-align: left;
      padding: 0.42rem 0.35rem;
      border-bottom: 1px solid #263041;
      vertical-align: middle;
    }
    .ms-site th {
      color: var(--ms-muted);
      font-size: 0.68rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .ms-site .amt {
      font-variant-numeric: tabular-nums;
    }
    .ms-section-title {
      font-size: 0.78rem;
      font-weight: 600;
      margin: 1rem 0 0.35rem;
      color: var(--ms-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .ms-link-expl {
      color: var(--ms-link);
      text-decoration: none;
    }
    .ms-link-expl:hover {
      text-decoration: underline;
    }
    .ms-err {
      color: var(--ms-err);
    }
    .ms-wallet-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .ms-site img.ident {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      display: block;
      flex-shrink: 0;
    }
  `;
}
