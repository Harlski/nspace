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
  const panelEl = document.getElementById("panel");
  const docTitle = document.getElementById("adminDocTitle") as HTMLElement | null;
  if (!panelEl) return;
  const panel = panelEl;

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
  type PageViewDay = { dayUtc: string; views: number };
  type PageViewRecent = { t: number; wallet: string | null; identicon?: string };
  let pageViewsByDay: PageViewDay[] = [];
  let pageViewsRecent: PageViewRecent[] = [];

  function chartAxisTicksAdmin(maxVal: number, formatTick: (x: number) => string): string {
    const maxN = Math.max(1, Number(maxVal) || 1);
    const mid = maxN / 2;
    return (
      "<div class='chart-axis mono' aria-hidden='true'>" +
      `<span>${esc(formatTick(maxN))}</span><span>${esc(formatTick(mid))}</span><span>0</span></div>`
    );
  }

  function adminDayTicks(rows: PageViewDay[]): string {
    const n = Math.max(1, rows?.length || 1);
    const style = `grid-template-columns:repeat(${n},minmax(0,1fr))`;
    const inner = (rows || [])
      .map((r) => {
        const d = r.dayUtc ? String(r.dayUtc).slice(8) : "";
        return `<span class='tick-day' title='${esc(String(r.dayUtc || "") + " UTC")}'>${esc(d)}</span>`;
      })
      .join("");
    return `<div class='ticks ticks--days mono' style='${style}'>${inner}</div>`;
  }

  function adminAnalyticsViewsChart(rows: PageViewDay[]): string {
    const list = rows?.length ? rows : [];
    if (!list.length) {
      return (
        "<section class='admin-pv-section'>" +
        "<div class='admin-pv-head'><strong>/analytics</strong> visits <span class='admin-pv-note'>(client beacons, UTC days)</span></div>" +
        "<p class='status' style='margin-top:0'>No chart data (request failed or empty window).</p>" +
        "</section>"
      );
    }
    let maxV = 1;
    list.forEach((r) => {
      maxV = Math.max(maxV, Number(r.views || 0));
    });
    const n = Math.max(1, list.length);
    const gridStyle = `grid-template-columns:repeat(${n},minmax(4px,1fr))`;
    const bars = list
      .map((r) => {
        const v = Number(r.views || 0);
        const pct = Math.max(3, Math.round((v / maxV) * 100));
        return (
          `<div class='col' title='${esc(r.dayUtc + " UTC — " + v + " view" + (v === 1 ? "" : "s"))}'>` +
          `<div class='in' style='height:${pct}%'></div></div>`
        );
      })
      .join("");
    return (
      "<section class='admin-pv-section'>" +
      "<div class='admin-pv-head'><strong>/analytics</strong> visits <span class='admin-pv-note'>(UTC days, last " +
      list.length +
      ")</span></div>" +
      "<div class='chart-block'>" +
      chartAxisTicksAdmin(maxV, (x) => String(Math.round(Number(x)))) +
      "<div class='chart-main'>" +
      `<div class='chart-cols' style='${gridStyle}'>` +
      bars +
      "</div>" +
      adminDayTicks(list) +
      "</div></div></section>"
    );
  }

  function fmtPageViewUtc(ms: number): string {
    const d = new Date(Number(ms) || 0);
    return esc(d.toISOString().replace("T", " ").slice(0, 19) + " UTC");
  }

  function adminRecentViewsTable(rows: PageViewRecent[]): string {
    if (!rows?.length) {
      return (
        "<div class='admin-pv-recent'>" +
        "<strong>Recent visits</strong><span class='admin-pv-recent-hint'>newest first</span>" +
        "<p class='status' style='margin-top:0.35rem'>No rows in this window.</p>" +
        "</div>"
      );
    }
    const thead = "<thead><tr><th>Time</th><th>Wallet</th></tr></thead>";
    const body = rows
      .map((r) => {
        const w = r.wallet != null && String(r.wallet) !== "" ? String(r.wallet) : "";
        const ident = r.identicon ? String(r.identicon) : "";
        const identBlock =
          ident !== ""
            ? `<div class='admin-pv-identline'><img class='ident' src='${esc(ident)}' alt='' width='24' height='24'/></div>`
            : "";
        const wCell = w
          ? `<div class='admin-pv-walletcell'><div class='admin-pv-walletline'><span class='mono'>${esc(walletGrouped(w))}</span><span class='admin-pv-copy' role='button' tabindex='0' data-copy='${esc(w)}' title='Copy wallet address' aria-label='Copy wallet address'>Copy</span></div>${identBlock}</div>`
          : "<span class='admin-pv-anon'>—</span><span class='admin-pv-anon-hint'>not signed in, expired session, or wallet not on analytics allowlist</span>";
        return `<tr><td class='mono'>${fmtPageViewUtc(r.t)}</td><td>${wCell}</td></tr>`;
      })
      .join("");
    return (
      "<div class='admin-pv-recent'>" +
      "<strong>Recent visits</strong><span class='admin-pv-recent-hint'>newest first · times UTC</span>" +
      "<div class='admin-pv-tablewrap'><table class='admin-pv-table'>" +
      thead +
      "<tbody>" +
      body +
      "</tbody></table></div></div>"
    );
  }

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
      adminAnalyticsViewsChart(pageViewsByDay) +
      adminRecentViewsTable(pageViewsRecent) +
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
    panel.querySelectorAll<HTMLElement>("[data-copy]").forEach((el) => {
      const copyWallet = (): void => {
        const wallet = String(el.dataset.copy || "");
        if (!wallet) return;
        navigator.clipboard.writeText(wallet).catch(() => {});
      };
      el.addEventListener("click", () => {
        copyWallet();
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copyWallet();
        }
      });
    });
  }

  try {
    await Promise.all([
      fetchWallets(),
      (async () => {
        try {
          const pv = await fetch(apiUrl("/api/analytics/page-views?days=14&recent=150"), {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (pv.ok) {
            const pvj = (await pv.json()) as { byDay?: PageViewDay[]; recent?: PageViewRecent[] };
            pageViewsByDay = Array.isArray(pvj.byDay) ? pvj.byDay.slice() : [];
            pageViewsRecent = Array.isArray(pvj.recent) ? pvj.recent.slice() : [];
          }
        } catch {
          /* keep pageViewsByDay */
        }
      })(),
    ]);
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
