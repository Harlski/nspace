import type { MainSiteHeaderPage } from "./mainSiteNav.js";

export function mainSiteHubAppNameForPage(page: MainSiteHeaderPage): string {
  if (page === "payouts") return "Nimiq Space payouts";
  if (page === "advertise") return "Nimiq Space advertise";
  if (page === "system") return "nspace system";
  if (page === "settings") return "nspace admin settings";
  if (page === "header") return "nspace admin header";
  if (page === "feedback") return "nspace admin feedback";
  if (page === "campaign") return "nspace admin campaigns";
  return "nspace analytics";
}

/** Inline script: shared `#authUser` slot for all server-rendered main-site pages. */
export function mainSiteAuthTopbarRuntimeScript(currentPage: MainSiteHeaderPage): string {
  const appName = JSON.stringify(mainSiteHubAppNameForPage(currentPage));
  return `
    (function () {
      var AUTH_KEYS = ["nspace_analytics_auth_token", "nspace_pending_payouts_token"];
      var AUTH_ADDR_KEY = "nspace_analytics_auth_addr";
      var HUB_APP_NAME = ${appName};
      var authMenuDocBound = false;

      function readToken() {
        if (typeof window.__nsHydrateMainSiteAuth === "function") {
          window.__nsHydrateMainSiteAuth();
        }
        for (var i = 0; i < AUTH_KEYS.length; i++) {
          var t = sessionStorage.getItem(AUTH_KEYS[i]);
          if (t) return t;
        }
        return "";
      }
      function parseJwtSub(token) {
        try {
          var p = String(token || "").split(".")[1] || "";
          if (!p) return "";
          var json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
          return String(JSON.parse(json).sub || "");
        } catch (e) {
          return "";
        }
      }
      function esc(s) {
        return String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }
      function walletShort(walletId) {
        var compact = String(walletId || "").replace(/\\s+/g, "").toUpperCase();
        if (compact.length <= 8) return compact;
        return compact.slice(0, 4) + "..." + compact.slice(-4);
      }
      function walletNorm(a) {
        return String(a || "").replace(/\\s+/g, "").toUpperCase();
      }
      function toB64(u8) {
        var s = "";
        for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
        return btoa(s);
      }
      async function fetchIdenticon(wallet) {
        try {
          var r = await fetch("/api/identicon/" + encodeURIComponent(wallet));
          if (!r.ok) return "";
          var j = await r.json();
          return String(j.identicon || "");
        } catch (e) {
          return "";
        }
      }
      async function fetchAuthStatus(token) {
        if (!token) {
          return {
            signedIn: false,
            analyticsAuthorized: false,
            analyticsManager: false,
            systemAdmin: false,
          };
        }
        if (typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(token)) {
          return {
            signedIn: false,
            analyticsAuthorized: false,
            analyticsManager: false,
            systemAdmin: false,
          };
        }
        try {
          var r = await fetch("/api/analytics/auth-status", {
            headers: { authorization: "Bearer " + token },
            cache: "no-store",
          });
          if (!r.ok) throw new Error("auth_status_failed");
          var j = await r.json();
          return {
            signedIn: true,
            analyticsAuthorized: Boolean(j.analyticsAuthorized),
            analyticsManager: Boolean(j.analyticsManager),
            systemAdmin: Boolean(j.systemAdmin),
          };
        } catch (e) {
          return {
            signedIn: true,
            analyticsAuthorized: false,
            analyticsManager: false,
            systemAdmin: false,
          };
        }
      }
      function runLoginClick() {
        if (typeof window.__nsMainSiteLoginClick === "function") {
          try {
            window.__nsMainSiteLoginClick();
          } catch (e) {}
          return;
        }
        void defaultWalletLogin();
      }
      function waitForNimiqProvider(timeoutMs) {
        if (window.nimiq) return Promise.resolve(window.nimiq);
        var ms = timeoutMs == null ? 15000 : timeoutMs;
        return new Promise(function (resolve, reject) {
          var timer = setTimeout(function () {
            clearInterval(interval);
            reject(new Error("nimiq_provider_timeout"));
          }, ms);
          var interval = setInterval(function () {
            if (window.nimiq) {
              clearTimeout(timer);
              clearInterval(interval);
              resolve(window.nimiq);
            }
          }, 50);
        });
      }
      function coerceSignBytes(v) {
        if (v && v.constructor && v.constructor.name === "Uint8Array") return v;
        if (typeof v === "string") {
          var t = v.trim();
          if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) {
            var out = new Uint8Array(t.length / 2);
            for (var i = 0; i < out.length; i++) out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);
            return out;
          }
          try {
            var binary = atob(t);
            var arr = new Uint8Array(binary.length);
            for (var j = 0; j < binary.length; j++) arr[j] = binary.charCodeAt(j);
            return arr;
          } catch (e) {
            throw new Error("invalid_wallet_encoding");
          }
        }
        if (Array.isArray(v) && v.length && typeof v[0] === "number") return new Uint8Array(v);
        throw new Error("invalid_wallet_encoding");
      }
      function isProviderErrorResponse(x) {
        return !!(x && typeof x === "object" && x.error && typeof x.error.message === "string");
      }
      async function nimiqPayWalletLogin() {
        var nimiq = await waitForNimiqProvider(15000);
        var extraTpAck = undefined;
        var verified = null;
        retryTpAck: while (true) {
          var nonceResp = await fetch("/api/auth/nonce");
          if (!nonceResp.ok) throw new Error("nonce_failed");
          var nonceJson = await nonceResp.json();
          var nonce = String(nonceJson.nonce || "");
          var message = "Login:v1:" + nonce;
          var signed = await nimiq.sign(message);
          if (isProviderErrorResponse(signed)) {
            throw new Error(String(signed.error.message || "nimiq_pay_sign_failed"));
          }
          var pubBytes = coerceSignBytes(signed.publicKey);
          var sigBytes = coerceSignBytes(signed.signature);
          var verifyPayload = window.nspaceTermsPrivacyVerifyPayload(
            {
              nonce: nonce,
              message: message,
              signer: "",
              signerPublicKey: toB64(pubBytes),
              signature: toB64(sigBytes),
              nimiqPayClient: true,
            },
            extraTpAck
          );
          var verifyResp = await window.nspacePostAuthVerify(verifyPayload);
          if (verifyResp.ok) {
            window.nspaceTermsPrivacyPersistLocal();
            verified = await verifyResp.json();
            break retryTpAck;
          }
          var errBody = await verifyResp.json().catch(function () {
            return {};
          });
          if (
            verifyResp.status === 403 &&
            (errBody.error === "terms_privacy_ack_required" || errBody.error === "legal_consent_required")
          ) {
            await window.nspaceShowTermsPrivacyAckBarrier();
            extraTpAck = window.NSPACE_TERMS_PRIVACY_DOCS_VERSION;
            continue;
          }
          throw new Error(String(errBody.error || "verify_failed"));
        }
        var token = String(verified.token || "");
        var address = String(verified.address || "");
        if (!token) throw new Error("missing_token");
        if (typeof window.__nsSaveMainSiteAuth === "function") {
          window.__nsSaveMainSiteAuth(token, address);
        } else {
          for (var k = 0; k < AUTH_KEYS.length; k++) {
            sessionStorage.setItem(AUTH_KEYS[k], token);
          }
          if (address) sessionStorage.setItem(AUTH_ADDR_KEY, address);
        }
        window.location.reload();
      }
      async function defaultWalletLogin() {
        try {
          if (window.nimiqPay != null) {
            await nimiqPayWalletLogin();
            return;
          }
          var HubMod = await import("https://esm.sh/@nimiq/hub-api@1.13.0");
          var HubApi = HubMod.default;
          var hub = new HubApi("https://hub.nimiq.com");
          var extraTpAck = undefined;
          var verified = null;
          var lastSigned = null;
          retryTpAck: while (true) {
            var nonceResp = await fetch("/api/auth/nonce");
            if (!nonceResp.ok) throw new Error("nonce_failed");
            var nonceJson = await nonceResp.json();
            var nonce = String(nonceJson.nonce || "");
            var message = "Login:v1:" + nonce;
            lastSigned = await hub.signMessage({ appName: HUB_APP_NAME, message: message });
            var verifyPayload = window.nspaceTermsPrivacyVerifyPayload(
              {
                nonce: nonce,
                message: message,
                signer: lastSigned.signer,
                signerPublicKey: toB64(lastSigned.signerPublicKey),
                signature: toB64(lastSigned.signature),
              },
              extraTpAck
            );
            var verifyResp = await window.nspacePostAuthVerify(verifyPayload);
            if (verifyResp.ok) {
              window.nspaceTermsPrivacyPersistLocal();
              verified = await verifyResp.json();
              break retryTpAck;
            }
            var errBody = await verifyResp.json().catch(function () {
              return {};
            });
            if (
              verifyResp.status === 403 &&
              (errBody.error === "terms_privacy_ack_required" || errBody.error === "legal_consent_required")
            ) {
              await window.nspaceShowTermsPrivacyAckBarrier();
              extraTpAck = window.NSPACE_TERMS_PRIVACY_DOCS_VERSION;
              continue;
            }
            throw new Error(String(errBody.error || "verify_failed"));
          }
          var token = String(verified.token || "");
          var address = String(verified.address || (lastSigned && lastSigned.signer) || "");
          if (!token) throw new Error("missing_token");
          if (typeof window.__nsSaveMainSiteAuth === "function") {
            window.__nsSaveMainSiteAuth(token, address);
          } else {
            for (var k = 0; k < AUTH_KEYS.length; k++) {
              sessionStorage.setItem(AUTH_KEYS[k], token);
            }
            if (address) sessionStorage.setItem(AUTH_ADDR_KEY, address);
          }
          window.location.reload();
        } catch (e) {
          /* Page-specific handlers show body gates; topbar stays on Sign In. */
        }
      }
      function bindSignInControl() {
        var loginEl = document.getElementById("authTopLogin");
        if (!loginEl || loginEl.dataset.bound === "1") return;
        loginEl.dataset.bound = "1";
        var go = function () {
          runLoginClick();
        };
        loginEl.addEventListener("click", go);
        loginEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        });
      }
      var MAX_MAIN_SITE_ACCOUNTS = 5;
      async function populateAccountPicker(activeAddr) {
        var picker = document.getElementById("authAccountPicker");
        if (!picker || typeof window.__nsListMainSiteCachedAccounts !== "function") return;
        var rows = window.__nsListMainSiteCachedAccounts() || [];
        var activeN = walletNorm(activeAddr);
        var html = "";
        for (var ai = 0; ai < rows.length; ai++) {
          var row = rows[ai];
          var ident = await fetchIdenticon(row.address);
          var isAct = walletNorm(row.address) === activeN;
          var exp = row.expired;
          var img = ident
            ? "<img class='auth-user-account-ident' src='" + esc(ident) + "' alt='' width='22' height='22'/>"
            : "<span class='auth-user-account-ident auth-user-account-ident--ph' aria-hidden='true'></span>";
          var dis = exp ? " disabled" : "";
          var rowCls =
            "auth-user-account-row" +
            (exp ? " auth-user-account-row--expired" : "") +
            (isAct ? " auth-user-account-row--active" : "");
          var check = isAct ? "<span class='auth-user-account-check' aria-label='Active'>✓</span>" : "";
          html +=
            "<button type='button' class='" +
            rowCls +
            "' data-switch-account='" +
            esc(row.address) +
            "'" +
            dis +
            ">" +
            img +
            "<span class='mono'>" +
            esc(walletShort(row.address)) +
            "</span>" +
            check +
            "</button>";
        }
        if (rows.length >= MAX_MAIN_SITE_ACCOUNTS) {
          html +=
            "<p class='auth-user-account-cap mono'>Maximum " +
            MAX_MAIN_SITE_ACCOUNTS +
            " accounts saved.</p>";
        } else {
          html +=
            "<button type='button' class='auth-user-account-row auth-user-account-row--add' id='authAddAccount'>Add account</button>";
        }
        picker.innerHTML = html;
        picker.querySelectorAll("[data-switch-account]").forEach(function (b) {
          b.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var addr = String(b.getAttribute("data-switch-account") || "");
            if (!addr || walletNorm(addr) === activeN) {
              picker.style.display = "none";
              return;
            }
            if (typeof window.__nsActivateMainSiteCachedAccount === "function") {
              window.__nsActivateMainSiteCachedAccount(addr);
            }
          });
        });
        var addBtn = document.getElementById("authAddAccount");
        if (addBtn) {
          addBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            picker.style.display = "none";
            var m = document.getElementById("authUserMenu");
            if (m) m.style.display = "none";
            runLoginClick();
          });
        }
      }
      function bindAuthMenu(activeAddr) {
        var btn = document.getElementById("authUserBtn");
        var menu = document.getElementById("authUserMenu");
        var refreshSess = document.getElementById("authRefreshSession");
        var logout = document.getElementById("authUserLogout");
        var changeToggle = document.getElementById("authChangeAccountToggle");
        var accountPicker = document.getElementById("authAccountPicker");
        if (refreshSess) {
          refreshSess.addEventListener("click", function () {
            if (menu) menu.style.display = "none";
            runLoginClick();
          });
        }
        if (changeToggle && accountPicker) {
          changeToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            var opening = accountPicker.style.display !== "block";
            accountPicker.style.display = opening ? "block" : "none";
            if (opening) void populateAccountPicker(activeAddr);
          });
          void populateAccountPicker(activeAddr);
        }
        if (btn && menu) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var open = menu.style.display !== "block";
            menu.style.display = open ? "block" : "none";
            if (!open && accountPicker) accountPicker.style.display = "none";
          });
          if (!authMenuDocBound) {
            document.addEventListener("click", function (ev) {
              if (ev.target && ev.target.closest && ev.target.closest("#authUser")) return;
              var m = document.getElementById("authUserMenu");
              if (m) m.style.display = "none";
              var sub = document.getElementById("authAccountPicker");
              if (sub) sub.style.display = "none";
            });
            authMenuDocBound = true;
          }
        }
        if (logout) {
          logout.addEventListener("click", function () {
            if (typeof window.__nsClearMainSiteAuth === "function") {
              window.__nsClearMainSiteAuth();
            } else {
              for (var x = 0; x < AUTH_KEYS.length; x++) {
                sessionStorage.removeItem(AUTH_KEYS[x]);
              }
              sessionStorage.removeItem(AUTH_ADDR_KEY);
            }
            window.location.reload();
          });
        }
      }
      async function renderMainSiteAuthTopbar() {
        var authUserEl = document.getElementById("authUser");
        if (!authUserEl) return;
        var token = readToken();
        var signed = sessionStorage.getItem(AUTH_ADDR_KEY) || parseJwtSub(token);
        if (signed) sessionStorage.setItem(AUTH_ADDR_KEY, signed);
        if (!signed || !token) {
          if (typeof window.__nsApplyMainSiteNav === "function") {
            window.__nsApplyMainSiteNav({
              signedIn: false,
              analyticsAuthorized: false,
              analyticsManager: false,
              systemAdmin: false,
            });
          }
          authUserEl.style.display = "block";
          authUserEl.innerHTML =
            "<span id='authTopLogin' class='auth-user-signin' role='button' tabindex='0'>Sign In</span>";
          bindSignInControl();
          return;
        }
        var sessionExpired =
          typeof window.__nsMainSiteJwtExpired === "function" && window.__nsMainSiteJwtExpired(token);
        var ident = await fetchIdenticon(signed);
        var authStatus = sessionExpired
          ? {
              signedIn: false,
              analyticsAuthorized: false,
              analyticsManager: false,
              systemAdmin: false,
            }
          : await fetchAuthStatus(token);
        if (typeof window.__nsApplyMainSiteNav === "function") {
          window.__nsApplyMainSiteNav(
            sessionExpired ? authStatus : Object.assign({ signedIn: true }, authStatus)
          );
        }
        authUserEl.style.display = "block";
        var alertSvg =
          "<svg class='nq-icon auth-user-session-alert' width='14' height='14' aria-hidden='true' focusable='false'><use href='/nimiq-style.icons.svg#nq-alert-circle'/></svg>";
        var identWrap = "";
        if (ident || sessionExpired) {
          identWrap =
            "<span class='auth-user-ident-wrap" +
            (ident ? "" : " auth-user-ident-wrap--solo") +
            "'>" +
            (ident ? "<img class='ident' src='" + esc(ident) + "' alt='wallet'/>" : "") +
            (sessionExpired ? alertSvg : "") +
            "</span>";
        }
        var btnTitle = sessionExpired
          ? "Session expired - sign in again (" + esc(signed) + ")"
          : "Signed in as " + esc(signed);
        var acctSection =
          "<div class='auth-user-menu-section'><button type='button' id='authChangeAccountToggle' class='auth-user-menu-row'>Change account</button><div id='authAccountPicker' class='auth-user-submenu' style='display:none' role='group' aria-label='Choose wallet'></div></div>";
        var menuInner =
          (sessionExpired
            ? "<button type='button' id='authRefreshSession' class='auth-user-menu-row'>Sign in again</button>"
            : "") +
          acctSection +
          "<button type='button' id='authUserLogout' class='auth-user-menu-row'>Logout</button>";
        authUserEl.innerHTML =
          "<button type='button' id='authUserBtn' class='auth-user-btn' title='" +
          btnTitle +
          "'>" +
          identWrap +
          "<span class='mono'>" +
          esc(walletShort(signed)) +
          "</span></button>" +
          "<div id='authUserMenu' class='auth-user-menu'>" +
          menuInner +
          "</div>";
        bindAuthMenu(signed);
      }
      window.__nsRenderMainSiteAuthTopbar = renderMainSiteAuthTopbar;
      function bootAuthTopbar() {
        void renderMainSiteAuthTopbar();
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootAuthTopbar);
      } else {
        bootAuthTopbar();
      }
    })();
  `;
}
