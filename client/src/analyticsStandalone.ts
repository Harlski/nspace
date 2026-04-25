import { apiUrl } from "./net/apiBase.js";
import { renderAnalyticsTopbar } from "./ui/analyticsTopbar.js";

type LoginHourBucket = {
  hourUtc: number;
  starts: number;
  ends: number;
  startUsers: { walletId: string; identicon: string; count: number }[];
  endUsers: { walletId: string; identicon: string; count: number }[];
};

type SessionRow = {
  startedAt: number;
  address: string;
  roomId: string;
  durationMs: number | null;
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
  nimPayouts: PayoutRow[];
  daily: DailyRow[];
};

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

function bindToggle(
  barBtn: HTMLElement | null,
  chartBtn: HTMLElement | null,
  onMode: (mode: "bar" | "chart") => void
): void {
  if (!barBtn || !chartBtn) return;
  barBtn.addEventListener("click", () => {
    barBtn.classList.add("is-active");
    chartBtn.classList.remove("is-active");
    onMode("bar");
  });
  chartBtn.addEventListener("click", () => {
    chartBtn.classList.add("is-active");
    barBtn.classList.remove("is-active");
    onMode("chart");
  });
}

async function load(): Promise<void> {
  await renderAnalyticsTopbar("analytics");
  const statusEl = document.getElementById("status");
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

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const days = Number(params.get("days") || "7");
  const sessions = Number(params.get("sessions") || "300");
  const payouts = Number(params.get("payouts") || "300");
  const url = apiUrl(
    `/api/analytics/overview?days=${encodeURIComponent(String(days))}&sessions=${encodeURIComponent(String(sessions))}&payouts=${encodeURIComponent(String(payouts))}`
  );

  const resp = await fetch(url, {
    headers: token ? { "x-analytics-token": token } : {},
    cache: "no-store",
  });
  if (!resp.ok) {
    statusEl.innerHTML = `<span class="err">Request failed (${resp.status}). Add ?token=... to this URL.</span>`;
    return;
  }
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
        loginHoverEl.innerHTML = `<div><strong>${String(hour).padStart(2, "0")}:00 UTC</strong> · ${row.starts} in / ${row.ends} out · ${row.uniquePlayers} unique</div><div style="margin-top:0.35rem">${starts || "<div>No logins</div>"}${ends || "<div>No logouts</div>"}</div>`;
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

  renderLogin("bar");
  renderPayoutHours("bar");
  bindToggle(
    document.getElementById("loginModeBar"),
    document.getElementById("loginModeChart"),
    renderLogin
  );
  bindToggle(
    document.getElementById("payoutModeBar"),
    document.getElementById("payoutModeChart"),
    renderPayoutHours
  );

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
    "<table><thead><tr><th>Day</th><th class='right'>Players</th><th class='right'>Logins</th><th class='right'>Claims</th><th class='right'>Payouts</th></tr></thead><tbody>" +
    data.daily
      .slice(0, 30)
      .map(
        (d) =>
          `<tr><td>${esc(d.dayUtc)}</td><td class='right'>${d.activePlayers}</td><td class='right'>${d.sessionStarts}</td><td class='right'>${d.claimBlocks}</td><td class='right'>${d.payoutsSent}</td></tr>`
      )
      .join("") +
    "</tbody></table>";

  sessionsEl.innerHTML =
    "<table><thead><tr><th>Start</th><th>User</th><th>Room</th><th class='right'>Duration</th></tr></thead><tbody>" +
    data.sessions
      .slice(0, 60)
      .map(
        (s) =>
          `<tr><td>${esc(fmtUtc(s.startedAt))}</td><td>${esc(String(s.address).slice(0, 14))}…</td><td>${esc(s.roomId)}</td><td class='right'>${esc(fmtMs(s.durationMs))}</td></tr>`
      )
      .join("") +
    "</tbody></table>";
}

void load().catch((err: unknown) => {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.innerHTML = `<span class="err">Failed to load: ${esc(err instanceof Error ? err.message : String(err))}</span>`;
});
