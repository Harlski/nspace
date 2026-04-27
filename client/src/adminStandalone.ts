import "./mainSiteClient.css";
import { isTokenExpired } from "./auth/session.js";
import { apiUrl } from "./net/apiBase.js";
import { renderMainSiteTopbar } from "./ui/analyticsTopbar.js";
import {
  MAIN_SITE_AUTH_ADDR_KEY,
  readMainSiteAuthToken,
} from "./ui/mainSiteAuthKeys.js";

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeWallet(v: string): string {
  return String(v || "").replace(/\s+/g, " ").trim();
}
function walletShort(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase().slice(0, 8);
}
function walletGrouped(v: string): string {
  return String(v || "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, "$1 ");
}
async function fetchIdenticon(wallet: string): Promise<string> {
  try {
    const r = await fetch(apiUrl(`/api/identicon/${encodeURIComponent(wallet)}`));
    if (!r.ok) return "";
    const j = (await r.json()) as { identicon?: string };
    return String(j.identicon || "");
  } catch {
    return "";
  }
}

function parseJwtSub(token: string): string {
  try {
    const p = String(token || "").split(".")[1] || "";
    if (!p) return "";
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
    const obj = JSON.parse(json) as { sub?: string };
    return String(obj.sub || "");
  } catch {
    return "";
  }
}

async function load(): Promise<void> {
  await renderMainSiteTopbar("admin");
  const panel = document.getElementById("panel");
  const docTitle = document.getElementById("adminDocTitle") as HTMLElement | null;
  if (!panel) return;

  const token = readMainSiteAuthToken();
  let signed = sessionStorage.getItem(MAIN_SITE_AUTH_ADDR_KEY) || "";
  if (!signed && token) signed = parseJwtSub(token);
  if (signed) sessionStorage.setItem(MAIN_SITE_AUTH_ADDR_KEY, signed);
  if (!token) {
    if (docTitle) docTitle.hidden = true;
    panel.innerHTML =
      "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
      "<div class='ms-auth-gate-msg'>You must be signed in.</div>" +
      "</div>";
    return;
  }
  if (isTokenExpired(token)) {
    if (docTitle) docTitle.hidden = false;
    panel.innerHTML =
      "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
      "<div class='ms-auth-gate-msg'>Your session has expired. Use <strong>Sign in again</strong> above.</div>" +
      "</div>";
    return;
  }
  if (docTitle) docTitle.hidden = false;

  let wallets: string[] = [];
  let expandedWallet = "";
  let identByWallet: Record<string, string> = {};

  async function fetchWallets(): Promise<void> {
    const r = await fetch(apiUrl("/api/analytics/authorized-wallets"), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (r.status === 401) throw new Error("Session expired. Please login again.");
    if (r.status === 403) throw new Error("NS_WALLET_ACCESS_DENIED");
    if (!r.ok) throw new Error(`Request failed (${r.status}).`);
    const j = (await r.json()) as { wallets?: string[] };
    wallets = Array.isArray(j.wallets) ? j.wallets.slice() : [];
    const pairs = await Promise.all(
      wallets.map(async (w) => [w, await fetchIdenticon(w)] as const)
    );
    identByWallet = {};
    pairs.forEach(([w, i]) => {
      identByWallet[w] = i || "";
    });
  }

  function render(msg: string, isErr: boolean): void {
    panel.innerHTML =
      "<div><strong>Authorized analytics wallets</strong></div>" +
      "<div class='status'>Signed in: <span class='mono'>" +
      esc(signed || "unknown") +
      "</span></div>" +
      "<div class='row'>" +
      "<input id='walletInput' placeholder='NQ.. wallet to authorize' />" +
      "<button id='addBtn'>Add wallet</button>" +
      "</div>" +
      `<div class='status${isErr ? " err" : ""}'>${esc(msg || "")}</div>` +
      "<div class='list'>" +
      wallets
        .map(
          (w) =>
            `<div class='item'>
              <div class='item-top'>
                <button class='wallet-main' data-expand='${esc(w)}'>
                  ${identByWallet[w] ? `<img class="ident" src="${esc(identByWallet[w])}" alt="wallet"/>` : ""}
                  <span class='mono'>${esc(expandedWallet === w ? walletGrouped(w) : walletShort(w))}</span>
                  ${
                    expandedWallet === w
                      ? `<span class='wallet-copy-inline'><button class='wallet-copy' title='Copy wallet' aria-label='Copy wallet' data-copy='${esc(
                          w
                        )}'>⧉</button></span>`
                      : ""
                  }
                </button>
                <button data-remove='${esc(w)}'>Remove</button>
              </div>
            </div>`
        )
        .join("") +
      "</div>";

    const input = document.getElementById("walletInput") as HTMLInputElement | null;
    const addBtn = document.getElementById("addBtn");
    if (input && addBtn) {
      addBtn.addEventListener("click", async () => {
        const wallet = normalizeWallet(input.value);
        if (!wallet) return;
        const addResp = await fetch(apiUrl("/api/analytics/authorized-wallets"), {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ wallet }),
        });
        if (!addResp.ok) {
          render(`Failed to add wallet (${addResp.status}).`, true);
          return;
        }
        const addJson = (await addResp.json()) as { wallets?: string[] };
        wallets = Array.isArray(addJson.wallets) ? addJson.wallets.slice() : wallets;
        input.value = "";
        render("Wallet added.", false);
      });
    }

    panel.querySelectorAll<HTMLElement>("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const wallet = String(btn.dataset.remove || "");
        if (!wallet) return;
        const delResp = await fetch(apiUrl("/api/analytics/authorized-wallets"), {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ wallet }),
        });
        if (!delResp.ok) {
          render(`Failed to remove wallet (${delResp.status}).`, true);
          return;
        }
        const delJson = (await delResp.json()) as { wallets?: string[] };
        wallets = Array.isArray(delJson.wallets) ? delJson.wallets.slice() : wallets;
        render("Wallet removed.", false);
      });
    });
    panel.querySelectorAll<HTMLElement>("[data-expand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wallet = String(btn.dataset.expand || "");
        expandedWallet = expandedWallet === wallet ? "" : wallet;
        render(msg, isErr);
      });
    });
    panel.querySelectorAll<HTMLElement>("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wallet = String(btn.dataset.copy || "");
        if (!wallet) return;
        navigator.clipboard.writeText(wallet).catch(() => {});
      });
    });
  }

  try {
    await fetchWallets();
    render("", false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Session expired")) {
      await renderMainSiteTopbar("admin");
      panel.innerHTML =
        "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
        "<div class='ms-auth-gate-msg'>Your session has expired. Use <strong>Sign in again</strong> above.</div>" +
        "</div>";
      return;
    }
    await renderMainSiteTopbar("admin");
    const raw = err instanceof Error ? err.message : String(err);
    if (raw === "NS_WALLET_ACCESS_DENIED") {
      if (docTitle) docTitle.hidden = true;
      panel.innerHTML =
        "<div class='ms-auth-gate ms-auth-gate--standalone'>" +
        "<div class='ms-auth-gate-msg'>" +
        esc("Access denied for this wallet.") +
        "</div></div>";
      return;
    }
    panel.innerHTML =
      "<div class='ms-auth-gate'>" +
      "<div class='ms-auth-gate-msg err'>" +
      esc(raw) +
      "</div></div>";
  }
}

void load();
