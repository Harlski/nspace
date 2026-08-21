/**
 * Shared CSS + inline JS for admin HTML shells: show player username (else
 * short wallet) as a link to `/admin/user/...` moderation profile.
 *
 * Inject `${adminPlayerLinkCss()}` into page `<style>` and
 * `${adminPlayerLinkClientJs()}` near the top of the page `<script>`.
 * Call sites must define `escHtml` (or alias `esc`) before using
 * `adminPlayerLinkHtml`.
 */

export function adminPlayerLinkCss(): string {
  return `
    .admin-player-link {
      color: #93c5fd; font-weight: 600; text-decoration: none;
    }
    .admin-player-link:hover { color: #bfdbfe; text-decoration: underline; }
  `;
}

/**
 * Client helpers (no IIFE). Expects a page-local `escHtml` or `esc` function.
 * Usage: adminPlayerLinkHtml({ wallet, username, displayName })
 */
export function adminPlayerLinkClientJs(): string {
  return `
  function adminNormWallet(w) {
    return String(w || "").replace(/\\s+/g, "").toUpperCase();
  }
  function adminWalletShort(w) {
    var c = adminNormWallet(w);
    if (!c) return "";
    if (c.length <= 8) return c;
    return c.slice(0, 4) + c.slice(-4);
  }
  function adminProfileHref(wallet, username) {
    var name = String(username || "").trim();
    if (name) return "/admin/user/" + encodeURIComponent(name);
    var c = adminNormWallet(wallet);
    return c ? "/admin/user/" + encodeURIComponent(c) : "#";
  }
  function adminPlayerEsc(s) {
    if (typeof escHtml === "function") return escHtml(s);
    if (typeof esc === "function") return esc(s);
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }
  /** @param {{ wallet?: string, username?: string|null, displayName?: string|null }} opts */
  function adminPlayerLinkHtml(opts) {
    opts = opts || {};
    var wallet = String(opts.wallet || "").trim();
    if (!wallet) return "-";
    var label = String(opts.displayName || opts.username || "").trim();
    if (!label) label = adminWalletShort(wallet);
    var href = adminProfileHref(wallet, opts.username);
    return (
      "<a class='admin-player-link' href='" +
      adminPlayerEsc(href) +
      "' title='" +
      adminPlayerEsc(wallet) +
      "' onclick='event.stopPropagation()'>" +
      adminPlayerEsc(label) +
      "</a>"
    );
  }
`;
}
