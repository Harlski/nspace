import "./mainSiteClient.css";
import { signLoginChallenge } from "./auth/nimiq.js";
import { completeWalletPayloadAuthWithTermsPrivacyRetry } from "./auth/authTermsPrivacyVerify.js";
import { isTokenExpired } from "./auth/session.js";
import { apiUrl } from "./net/apiBase.js";
import { refreshMainSiteNavFromSession, renderMainSiteTopbar } from "./ui/analyticsTopbar.js";
import { readMainSiteAuthToken, writeMainSiteAuthToken } from "./ui/mainSiteAuthKeys.js";
import {
  animateSigningDots,
  isSigningUserCancelledError,
  walletSigningMarkup,
} from "./ui/walletSigningUi.js";

type LoginHourBucket = {
  hourUtc: number;
  starts: number;
  ends: number;
  uniquePlayers?: number;
  /** First-ever `session_start` in this report, bucketed by UTC hour of that first event. */
  firstStarts?: number;
  startUsers: { walletId: string; identicon: string; count: number }[];
  endUsers: { walletId: string; identicon: string; count: number }[];
};

type SessionRow = {
  startedAt: number;
  address: string;
  roomId: string;
  durationMs: number | null;
  activeDurationMs?: number | null;
};

type PlayTimeByRoomRow = {
  address: string;
  roomId: string;
  identicon: string;
  activeDurationMs: number;
  wallDurationMs: number;
  sessionCount: number;
};

type PayoutRow = {
  sentAt: number;
  recipient: string;
  amountNim: string | null;
};

type DailyRow = {
  dayUtc: string;
  activePlayers: number;
  sessionStarts: number;
  claimBlocks: number;
  payoutsSent: number;
  placeBlocks: number;
  chats: number;
};

type VisitorRow = {
  walletId: string;
  identicon: string;
  sessionStarts: number;
  sessionEnds: number;
  totalPayoutNim: string;
};

type PayoutHourRow = {
  hourUtc: number;
  payouts: number;
  totalNim: string;
  users: {
    walletId: string;
    identicon: string;
    payouts: number;
    totalNim: string;
  }[];
};

type AnalyticsPayload = {
  generatedAt: number;
  maxDays: number;
  uniqueVisitors: number;
  visitors: VisitorRow[];
  loginByHourUtc: LoginHourBucket[];
  payoutByHourUtc: PayoutHourRow[];
  sessions: SessionRow[];
  playTimeByRoom?: PlayTimeByRoomRow[];
  nimPayouts: PayoutRow[];
  daily: DailyRow[];
};

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

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtUtc(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min} UTC`;
}

function fmtMs(ms: number | null): string {
  if (!Number.isFinite(ms) || !ms || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function walletShort(walletId: string): string {
  const compact = String(walletId || "").replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) return compact;
  return `${compact.slice(0, 4)}...${compact.slice(-4)}`;
}

function copyWallet(walletId: string): void {
  const full = String(walletId || "");
  if (!full) return;
  navigator.clipboard.writeText(full).catch(() => {});
}

function walletChip(identicon: string, walletId: string): string {
  return `<span class="wallet-chip" title="${esc(walletShort(walletId))}" data-wallet="${esc(walletId)}"><img class="ident" src="${esc(identicon || "")}" alt="wallet"/></span>`;
}

function attachCopyHandlers(root: Element | null): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[data-wallet]").forEach((el) => {
    if (el.dataset.walletBound === "1") return;
    el.dataset.walletBound = "1";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyWallet(el.dataset.wallet ?? "");
    });
  });
}

async function load(): Promise<void> {
  const statusEl = document.getElementById("status");
  const authGateEl = document.getElementById("authGate");
  const analyticsGridEl = document.getElementById("analyticsGrid");
  const loginsEl = document.getElementById("logins");
  const payoutsEl = document.getElementById("payouts");
  const payoutHoursEl = document.getElementById("payoutHours");
  const visitorsEl = document.getElementById("visitors");
  const dailyEl = document.getElementById("daily");
  const sessionsEl = document.getElementById("sessions");
  const loginHoverEl = document.getElementById("loginHover");
  const payoutHoverEl = document.getElementById("payoutHover");
  if (
    !statusEl ||
    !authGateEl ||
    !analyticsGridEl ||
    !loginsEl ||
    !payoutsEl ||
    !payoutHoursEl ||
    !visitorsEl ||
    !dailyEl ||
    !sessionsEl ||
    !loginHoverEl ||
    !payoutHoverEl
  ) {
    return;
  }

  {
    const token = readMainSiteAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    void fetch(apiUrl("/api/analytics/page-view"), {
      method: "POST",
      headers,
      keepalive: true,
    }).catch(() => {});
  }

  const setAuthedVisible = (visible: boolean): void => {
    (analyticsGridEl as HTMLElement).style.display = visible ? "grid" : "none";
  };
  const showAuthGateMessage = (msg: string, layout: "default" | "standalone" = "default"): void => {
    (authGateEl as HTMLElement).style.display = "block";
    setAuthedVisible(false);
    const standalone = layout === "standalone";
    const extra = standalone ? " ms-auth-gate--standalone" : "";
    (authGateEl as HTMLElement).className = standalone ? "ms-panel ms-mono" : "auth-gate mono";
    authGateEl.innerHTML = `<div class="ms-auth-gate${extra}"><div class="ms-auth-gate-msg">${esc(msg)}</div></div>`;
  };
  const runAnalyticsLogin = async (): Promise<void> => {
    let stopDots = (): void => {};
    try {
      (authGateEl as HTMLElement).style.display = "block";
      (authGateEl as HTMLElement).className = "auth-gate mono";
      authGateEl.innerHTML = walletSigningMarkup();
      stopDots = animateSigningDots(authGateEl);
      const { token, address } = await completeWalletPayloadAuthWithTermsPrivacyRetry((nonce) =>
        signLoginChallenge(nonce, "nspace analytics")
      );
      if (!token) throw new Error("missing_token");
      writeMainSiteAuthToken(token, address);
      stopDots();
      window.location.reload();
    } catch (e) {
      stopDots();
      if (isSigningUserCancelledError(e)) {
        showAuthGateMessage("You must be signed in.", "standalone");
      } else {
        showAuthGateMessage("Sign-in could not be completed.");
      }
    }
  };

  const params = new URLSearchParams(window.location.search);
  const tokenFromQuery = String(params.get("token") || "").trim();
  if (tokenFromQuery) {
    const qAddr = parseJwtSub(tokenFromQuery);
    writeMainSiteAuthToken(tokenFromQuery, qAddr);
    window.history.replaceState({}, "", "/analytics");
  }
  const token = readMainSiteAuthToken();
  if (!token) {
    setAuthedVisible(false);
    (statusEl as HTMLElement).style.display = "none";
    statusEl.textContent = "";
    showAuthGateMessage("You must be signed in.", "standalone");
    await renderMainSiteTopbar("analytics", { onLoginClick: () => void runAnalyticsLogin() });
    return;
  }
  if (isTokenExpired(token)) {
    setAuthedVisible(false);
    statusEl.innerHTML = "<span class='err'>Session expired.</span>";
    (statusEl as HTMLElement).style.display = "";
    showAuthGateMessage("Your session has expired.", "standalone");
    await renderMainSiteTopbar("analytics", { onLoginClick: () => void runAnalyticsLogin() });
    await refreshMainSiteNavFromSession();
    return;
  }

  (statusEl as HTMLElement).style.display = "";
  await renderMainSiteTopbar("analytics");

  const q = new URLSearchParams(window.location.search);
  if (!q.get("days")) q.set("days", "7");
  if (!q.get("sessions")) q.set("sessions", "300");
  if (!q.get("payouts")) q.set("payouts", "1000");
  const url = apiUrl(`/api/analytics/overview?${q.toString()}`);

  const resp = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!resp.ok) {
    if (resp.status === 403) {
      showAuthGateMessage("Access denied for this wallet.", "standalone");
      statusEl.textContent = "";
      await refreshMainSiteNavFromSession();
      return;
    }
    if (resp.status === 401) {
      showAuthGateMessage("Your session has expired.");
      statusEl.innerHTML = "<span class='err'>Session expired.</span>";
      await renderMainSiteTopbar("analytics", { onLoginClick: () => void runAnalyticsLogin() });
      await refreshMainSiteNavFromSession();
      return;
    }
    statusEl.innerHTML = `<span class="err">Request failed (${resp.status}).</span>`;
    return;
  }
  (authGateEl as HTMLElement).style.display = "none";
  (authGateEl as HTMLElement).className = "auth-gate mono";
  setAuthedVisible(true);
  const data = (await resp.json()) as AnalyticsPayload;
  statusEl.textContent = `Generated ${fmtUtc(data.generatedAt)} · last ${data.maxDays} days`;

  const maxStarts = Math.max(1, ...data.loginByHourUtc.map((x) => Number(x.starts || 0)));
  const maxEnds = Math.max(1, ...data.loginByHourUtc.map((x) => Number(x.ends || 0)));
  const maxPayout = Math.max(
    1,
    ...data.payoutByHourUtc.map((x) => Number(String(x.totalNim || "0").replace(/,/g, "")))
  );

  function renderLogin(mode: "bar" | "chart"): void {
    if (mode === "bar") {
      loginsEl.innerHTML = data.loginByHourUtc
        .map((row) => {
          const sw = Math.max(2, Math.round((Number(row.starts || 0) / maxStarts) * 100));
          const ew = Math.max(2, Math.round((Number(row.ends || 0) / maxEnds) * 100));
          return (
            `<div class="row" data-hour="${row.hourUtc}"><div>${String(row.hourUtc).padStart(2, "0")}</div><div class="barWrap"><div class="bar" style="width:${sw}%"></div></div><div>${row.starts} in</div></div>` +
            `<div class="row" data-hour="${row.hourUtc}"><div></div><div class="barWrap"><div class="bar bar--logout" style="width:${ew}%"></div></div><div>${row.ends} out</div></div>`
          );
        })
        .join("");
    } else {
      loginsEl.innerHTML =
        `<div class="chart-cols">` +
        data.loginByHourUtc
          .map((row) => {
            const inH = Math.max(
              3,
              Math.round((Number(row.starts || 0) / Math.max(maxStarts, maxEnds)) * 100)
            );
            const outH = Math.max(
              3,
              Math.round((Number(row.ends || 0) / Math.max(maxStarts, maxEnds)) * 100)
            );
            return `<div class="col" data-hour="${row.hourUtc}" title="${String(row.hourUtc).padStart(2, "0")} UTC"><div class="in" style="height:${inH}%"></div><div class="out" style="height:${outH}%"></div></div>`;
          })
          .join("") +
        `</div><div class="ticks">${["00","02","04","06","08","10","12","14","16","18","20","22"].map((t) => `<span>${t}</span>`).join("")}</div>`;
    }
    const rows = loginsEl.querySelectorAll<HTMLElement>("[data-hour]");
    rows.forEach((el) => {
      el.addEventListener("mouseenter", () => {
        const hour = Number(el.dataset.hour ?? "-1");
        const row = data.loginByHourUtc[hour];
        if (!row) return;
        const starts = row.startUsers
          .slice(0, 8)
          .map(
            (u) =>
              `<div class="user-row">${walletChip(u.identicon, u.walletId)}<span>${esc(walletShort(u.walletId))}</span><span>${u.count} in</span></div>`
          )
          .join("");
        const ends = row.endUsers
          .slice(0, 8)
          .map(
            (u) =>
              `<div class="user-row">${walletChip(u.identicon, u.walletId)}<span>${esc(walletShort(u.walletId))}</span><span>${u.count} out</span></div>`
          )
          .join("");
        const fs = Number(row.firstStarts || 0);
        const uniq = Number(row.uniquePlayers || 0);
        loginHoverEl.innerHTML = `<div><strong>${String(hour).padStart(2, "0")}:00 UTC</strong> · ${row.starts} in / ${row.ends} out · ${uniq} unique · ${fs} first-ever sign-in${fs === 1 ? "" : "s"} (this report)</div><div style="margin-top:0.35rem">${starts || "<div>No logins</div>"}${ends || "<div>No logouts</div>"}</div>`;
        attachCopyHandlers(loginHoverEl);
      });
    });
  }

  function renderPayoutHours(mode: "bar" | "chart"): void {
    if (mode === "bar") {
      payoutHoursEl.innerHTML = data.payoutByHourUtc
        .map((row) => {
          const n = Number(String(row.totalNim || "0").replace(/,/g, ""));
          const w = Math.max(2, Math.round((n / maxPayout) * 100));
          return `<div class="row" data-hour="${row.hourUtc}"><div>${String(row.hourUtc).padStart(2, "0")}</div><div class="barWrap"><div class="bar" style="width:${w}%"></div></div><div>${esc(row.totalNim)} NIM</div></div>`;
        })
        .join("");
    } else {
      payoutHoursEl.innerHTML =
        `<div class="chart-cols">` +
        data.payoutByHourUtc
          .map((row) => {
            const n = Number(String(row.totalNim || "0").replace(/,/g, ""));
            const h = Math.max(3, Math.round((n / maxPayout) * 100));
            return `<div class="col" data-hour="${row.hourUtc}" title="${String(row.hourUtc).padStart(2, "0")} UTC"><div class="in" style="height:${h}%"></div></div>`;
          })
          .join("") +
        `</div><div class="ticks">${["00","02","04","06","08","10","12","14","16","18","20","22"].map((t) => `<span>${t}</span>`).join("")}</div>`;
    }
    const bars = payoutHoursEl.querySelectorAll<HTMLElement>("[data-hour]");
    bars.forEach((el) => {
      el.addEventListener("mouseenter", () => {
        const hour = Number(el.dataset.hour ?? "-1");
        const row = data.payoutByHourUtc[hour];
        if (!row) return;
        const users = row.users
          .slice(0, 10)
          .map(
            (u) =>
              `<div class="user-row">${walletChip(u.identicon, u.walletId)}<span>${esc(walletShort(u.walletId))}</span><span>${esc(u.totalNim)} NIM</span></div>`
          )
          .join("");
        payoutHoverEl.innerHTML = `<div><strong>${String(hour).padStart(2, "0")}:00 UTC</strong> · ${esc(row.totalNim)} NIM · ${row.payouts} payouts</div><div style="margin-top:0.35rem">${users || "<div>No payouts</div>"}</div>`;
        attachCopyHandlers(payoutHoverEl);
      });
    });
  }

  renderLogin("chart");
  renderPayoutHours("chart");

  visitorsEl.innerHTML =
    `<div style="margin-bottom:0.45rem">${data.uniqueVisitors} unique visitors in range</div>` +
    data.visitors
      .slice(0, 120)
      .map(
        (v) =>
          `<div class="user-row">${walletChip(v.identicon, v.walletId)}<span>${esc(walletShort(v.walletId))}</span><span>${v.sessionStarts} in / ${v.sessionEnds} out · ${esc(v.totalPayoutNim)} NIM</span></div>`
      )
      .join("");
  attachCopyHandlers(visitorsEl);

  payoutsEl.innerHTML =
    "<table><thead><tr><th>When</th><th>User</th><th class='right'>NIM</th></tr></thead><tbody>" +
    data.nimPayouts
      .slice(0, 60)
      .map(
        (p) =>
          `<tr><td>${esc(fmtUtc(p.sentAt))}</td><td>${esc(String(p.recipient).slice(0, 14))}…</td><td class='right'>${esc(p.amountNim || "—")}</td></tr>`
      )
      .join("") +
    "</tbody></table>";

  dailyEl.innerHTML =
    "<table><thead><tr><th>Day</th><th class='right'>Players</th><th class='right'>Payouts</th><th class='right'>Place blocks</th><th class='right'>Chats</th></tr></thead><tbody>" +
    data.daily
      .slice(0, 30)
      .map(
        (d) =>
          `<tr><td>${esc(d.dayUtc)}</td><td class='right'>${d.activePlayers}</td><td class='right'>${d.payoutsSent}</td><td class='right'>${Number(d.placeBlocks) || 0}</td><td class='right'>${Number(d.chats) || 0}</td></tr>`
      )
      .join("") +
    "</tbody></table>";

  const roomRows =
    Array.isArray(data.playTimeByRoom) && data.playTimeByRoom.length > 0
      ? data.playTimeByRoom
      : [];
  if (roomRows.length) {
    sessionsEl.innerHTML =
      "<table><thead><tr><th>User</th><th>Room</th><th class='right'>Sessions</th><th class='right'>Active</th><th class='right'>Wall</th></tr></thead><tbody>" +
      roomRows
        .slice(0, 80)
        .map(
          (r) =>
            `<tr><td>${walletChip(r.identicon, r.address)}<span class="mono">${esc(walletShort(r.address))}</span></td><td>${esc(r.roomId)}</td><td class='right'>${r.sessionCount}</td><td class='right'>${esc(fmtMs(r.activeDurationMs))}</td><td class='right'>${esc(fmtMs(r.wallDurationMs))}</td></tr>`
        )
        .join("") +
      "</tbody></table>";
  } else {
    sessionsEl.innerHTML =
      "<table><thead><tr><th>Start</th><th>User</th><th>Room</th><th class='right'>Active</th></tr></thead><tbody>" +
      data.sessions
        .slice(0, 60)
        .map((s) => {
          const active =
            s.activeDurationMs != null && Number.isFinite(Number(s.activeDurationMs))
              ? Number(s.activeDurationMs)
              : s.durationMs;
          return `<tr><td>${esc(fmtUtc(s.startedAt))}</td><td>${esc(String(s.address).slice(0, 14))}…</td><td>${esc(s.roomId)}</td><td class='right'>${esc(fmtMs(active))}</td></tr>`;
        })
        .join("") +
      "</tbody></table>";
  }
  attachCopyHandlers(sessionsEl);
}

void load().catch((err: unknown) => {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.innerHTML = `<span class="err">Failed to load: ${esc(err instanceof Error ? err.message : String(err))}</span>`;
});
