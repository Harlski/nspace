import { apiUrl } from "./net/apiBase.js";
import { renderAnalyticsTopbar } from "./ui/analyticsTopbar.js";

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

async function load(): Promise<void> {
  await renderAnalyticsTopbar("admin");
  const panel = document.getElementById("panel");
  if (!panel) return;

  const token = sessionStorage.getItem("nspace_analytics_auth_token") || "";
  const signed = sessionStorage.getItem("nspace_analytics_auth_addr") || "";
  if (!token) {
    panel.innerHTML =
      "<span class='err'>Login required. Open <a href='/analytics'>/analytics</a> and sign in first.</span>";
    return;
  }

  let wallets: string[] = [];
  let expandedWallet = "";
  let identByWallet: Record<string, string> = {};

  async function fetchWallets(): Promise<void> {
    const r = await fetch(apiUrl("/api/analytics/authorized-wallets"), {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (r.status === 401) throw new Error("Session expired. Please login again.");
    if (r.status === 403) throw new Error("This wallet does not have admin permissions.");
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
    panel.innerHTML = `<span class='err'>${esc(
      err instanceof Error ? err.message : String(err)
    )}</span>`;
  }
}

void load();
