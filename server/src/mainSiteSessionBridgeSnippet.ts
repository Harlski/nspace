/**
 * Inline script for main-site HTML pages: sync JWT with in-game localStorage cache
 * (`nspace_auth_accounts_v1` / `nspace_auth_v1`, see client `auth/session.ts`).
 *
 * Exposes globals used by server-rendered pages and the topbar nav script.
 */
export function mainSiteSessionBridgeSnippet(): string {
  return `(function (g) {
  var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
  var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
  var ACCOUNTS_KEY = "nspace_auth_accounts_v1";
  var LEGACY_KEY = "nspace_auth_v1";
  var MAX_ACCOUNTS = 5;
  var SKEW_MS = 120000;
  function jwtExpMs(token) {
    try {
      var parts = String(token || "").split(".");
      if (parts.length !== 3) return null;
      var b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      var pad = b64 + "====".slice(0, (4 - (b64.length % 4)) % 4);
      var json = JSON.parse(atob(pad));
      return typeof json.exp === "number" ? json.exp * 1000 : null;
    } catch (e) {
      return null;
    }
  }
  function tokenExpired(token) {
    var exp = jwtExpMs(token);
    if (!exp) return true;
    return exp < Date.now() + SKEW_MS;
  }
  function sanitizeEntry(data) {
    if (!data || typeof data !== "object") return null;
    var tok = data.token;
    var addr = data.address;
    if (typeof tok !== "string" || typeof addr !== "string") return null;
    addr = addr.trim();
    if (!addr) return null;
    var u = data.updatedAt;
    var updatedAt = typeof u === "number" && isFinite(u) ? u : Date.now();
    return { token: tok, address: addr, updatedAt: updatedAt };
  }
  function readAccountEntries() {
    try {
      var raw = localStorage.getItem(ACCOUNTS_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      var out = [];
      for (var i = 0; i < data.length; i++) {
        var s = sanitizeEntry(data[i]);
        if (s) out.push(s);
      }
      out.sort(function (a, b) {
        return b.updatedAt - a.updatedAt;
      });
      return out.slice(0, MAX_ACCOUNTS);
    } catch (e) {
      return [];
    }
  }
  function writeAccountEntries(entries) {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(entries.slice(0, MAX_ACCOUNTS)));
    } catch (e) {}
  }
  function migrateLegacy(entries) {
    if (entries.length > 0) return entries;
    try {
      var raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return entries;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return entries;
      if (typeof data.token !== "string" || typeof data.address !== "string") return entries;
      var addr = data.address.trim();
      if (!addr) return entries;
      var migrated = { token: data.token, address: addr, updatedAt: Date.now() };
      writeAccountEntries([migrated]);
      return [migrated];
    } catch (e) {
      return entries;
    }
  }
  function pickCachedSession() {
    var entries = migrateLegacy(readAccountEntries());
    if (!entries.length) return null;
    for (var i = 0; i < entries.length; i++) {
      if (!tokenExpired(entries[i].token)) return entries[i];
    }
    return entries[0];
  }
  function sessionHasToken() {
    for (var i = 0; i < AUTH_KEYS.length; i++) {
      if (sessionStorage.getItem(AUTH_KEYS[i])) return true;
    }
    return false;
  }
  function hydrateFromGameCache() {
    if (sessionHasToken()) return false;
    var pick = pickCachedSession();
    if (!pick || !pick.token) return false;
    for (var j = 0; j < AUTH_KEYS.length; j++) {
      sessionStorage.setItem(AUTH_KEYS[j], pick.token);
    }
    if (pick.address) sessionStorage.setItem(AUTH_ADDR_KEY, pick.address);
    return true;
  }
  g.__nsHydrateMainSiteAuth = hydrateFromGameCache;
  g.__nsMainSiteJwtExpired = tokenExpired;
  g.__nsSaveMainSiteAuth = function (token, address) {
    var t = String(token || "");
    if (!t) return;
    for (var k = 0; k < AUTH_KEYS.length; k++) {
      sessionStorage.setItem(AUTH_KEYS[k], t);
    }
    var addr = String(address || sessionStorage.getItem(AUTH_ADDR_KEY) || "").trim();
    if (addr) sessionStorage.setItem(AUTH_ADDR_KEY, addr);
    if (!addr) return;
    var list = readAccountEntries().filter(function (e) {
      return e.address !== addr;
    });
    list.unshift({ token: t, address: addr, updatedAt: Date.now() });
    writeAccountEntries(list);
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify({ token: t, address: addr }));
    } catch (e) {}
  };
  g.__nsClearMainSiteAuth = function () {
    var addr = String(sessionStorage.getItem(AUTH_ADDR_KEY) || "").trim();
    for (var x = 0; x < AUTH_KEYS.length; x++) {
      sessionStorage.removeItem(AUTH_KEYS[x]);
    }
    sessionStorage.removeItem(AUTH_ADDR_KEY);
    if (!addr) return;
    var rest = readAccountEntries().filter(function (e) {
      return e.address !== addr;
    });
    writeAccountEntries(rest);
    try {
      var leg = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      if (leg && String(leg.address || "").trim() === addr) {
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch (e) {}
  };
  function allCachedEntries() {
    return migrateLegacy(readAccountEntries());
  }
  g.__nsListMainSiteCachedAccounts = function () {
    var entries = allCachedEntries();
    return entries.map(function (e) {
      return { address: e.address, expired: tokenExpired(e.token) };
    });
  };
  g.__nsActivateMainSiteCachedAccount = function (address) {
    var want = String(address || "").replace(/\s+/g, "").toUpperCase();
    var entries = allCachedEntries();
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (String(e.address).replace(/\s+/g, "").toUpperCase() === want) {
        g.__nsSaveMainSiteAuth(e.token, e.address);
        location.reload();
        return true;
      }
    }
    return false;
  };
  hydrateFromGameCache();
})(typeof window !== "undefined" ? window : this);`;
}
